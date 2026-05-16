"""SQLite persistence for cross-model chat context."""

from __future__ import annotations

import re
import sqlite3
from collections.abc import Iterable
from pathlib import Path

from warbucks.models import ChatMessage, ContextHit, Conversation

DEFAULT_DB_PATH = Path.home() / ".warbucks" / "chat_context.sqlite3"
TOKEN_RE = re.compile(r"[A-Za-z0-9_'-]+")


class ChatStore:
    """Small SQLite store optimized for local-first context retrieval."""

    def __init__(self, db_path: Path | str = DEFAULT_DB_PATH) -> None:
        self.db_path = Path(db_path).expanduser()
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self.connection = sqlite3.connect(self.db_path)
        self.connection.row_factory = sqlite3.Row
        self._initialize()

    def close(self) -> None:
        self.connection.close()

    def __enter__(self) -> "ChatStore":
        return self

    def __exit__(self, exc_type: object, exc_value: object, traceback: object) -> None:
        self.close()

    def _initialize(self) -> None:
        self.connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS conversations (
                id TEXT PRIMARY KEY,
                source_model TEXT NOT NULL,
                title TEXT NOT NULL,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS messages (
                id TEXT PRIMARY KEY,
                conversation_id TEXT NOT NULL,
                source_model TEXT NOT NULL,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY (conversation_id) REFERENCES conversations(id)
            );

            CREATE INDEX IF NOT EXISTS idx_messages_source_model
                ON messages(source_model);

            CREATE INDEX IF NOT EXISTS idx_messages_conversation_created
                ON messages(conversation_id, created_at);
            """
        )
        self.connection.commit()

    def upsert_conversation(self, conversation: Conversation) -> None:
        self.connection.execute(
            """
            INSERT INTO conversations (id, source_model, title, created_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                source_model = excluded.source_model,
                title = excluded.title,
                created_at = excluded.created_at
            """,
            (
                conversation.id,
                conversation.source_model,
                conversation.title,
                conversation.created_at,
            ),
        )
        self.connection.commit()

    def upsert_messages(self, messages: Iterable[ChatMessage]) -> int:
        rows = [
            (
                message.id,
                message.conversation_id,
                message.source_model,
                message.role,
                message.content,
                message.created_at,
            )
            for message in messages
        ]
        if not rows:
            return 0
        self.connection.executemany(
            """
            INSERT INTO messages (
                id,
                conversation_id,
                source_model,
                role,
                content,
                created_at
            )
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                conversation_id = excluded.conversation_id,
                source_model = excluded.source_model,
                role = excluded.role,
                content = excluded.content,
                created_at = excluded.created_at
            """,
            rows,
        )
        self.connection.commit()
        return len(rows)

    def get_conversation(self, conversation_id: str) -> Conversation | None:
        row = self.connection.execute(
            """
            SELECT id, source_model, title, created_at
            FROM conversations
            WHERE id = ?
            """,
            (conversation_id,),
        ).fetchone()
        if row is None:
            return None
        return _conversation_from_row(row)

    def list_conversations(self, source_model: str | None = None) -> list[Conversation]:
        if source_model is None:
            rows = self.connection.execute(
                """
                SELECT id, source_model, title, created_at
                FROM conversations
                ORDER BY created_at DESC, title ASC
                """
            ).fetchall()
        else:
            rows = self.connection.execute(
                """
                SELECT id, source_model, title, created_at
                FROM conversations
                WHERE source_model = ?
                ORDER BY created_at DESC, title ASC
                """,
                (source_model,),
            ).fetchall()
        return [_conversation_from_row(row) for row in rows]

    def messages_for_conversation(self, conversation_id: str) -> list[ChatMessage]:
        rows = self.connection.execute(
            """
            SELECT id, conversation_id, source_model, role, content, created_at
            FROM messages
            WHERE conversation_id = ?
            ORDER BY created_at ASC, id ASC
            """,
            (conversation_id,),
        ).fetchall()
        return [_message_from_row(row) for row in rows]

    def search(
        self,
        query: str,
        *,
        source_model: str | None = None,
        limit: int = 8,
    ) -> list[ContextHit]:
        """Return relevant messages using deterministic local token scoring."""

        tokens = _tokens(query)
        if not tokens:
            return []

        if source_model is None:
            rows = self.connection.execute(
                """
                SELECT
                    messages.id AS message_id,
                    messages.conversation_id,
                    messages.source_model AS message_source_model,
                    messages.role,
                    messages.content,
                    messages.created_at AS message_created_at,
                    conversations.id AS conversation_id,
                    conversations.source_model AS conversation_source_model,
                    conversations.title,
                    conversations.created_at AS conversation_created_at
                FROM messages
                JOIN conversations ON conversations.id = messages.conversation_id
                """
            ).fetchall()
        else:
            rows = self.connection.execute(
                """
                SELECT
                    messages.id AS message_id,
                    messages.conversation_id,
                    messages.source_model AS message_source_model,
                    messages.role,
                    messages.content,
                    messages.created_at AS message_created_at,
                    conversations.id AS conversation_id,
                    conversations.source_model AS conversation_source_model,
                    conversations.title,
                    conversations.created_at AS conversation_created_at
                FROM messages
                JOIN conversations ON conversations.id = messages.conversation_id
                WHERE messages.source_model = ?
                """,
                (source_model,),
            ).fetchall()

        scored_hits: list[tuple[int, str, ContextHit]] = []
        for row in rows:
            haystack = f"{row['title']} {row['content']}".lower()
            score = sum(haystack.count(token) for token in tokens)
            if score == 0:
                continue
            message = ChatMessage(
                id=row["message_id"],
                conversation_id=row["conversation_id"],
                source_model=row["message_source_model"],
                role=row["role"],
                content=row["content"],
                created_at=row["message_created_at"],
            )
            conversation = Conversation(
                id=row["conversation_id"],
                source_model=row["conversation_source_model"],
                title=row["title"],
                created_at=row["conversation_created_at"],
            )
            scored_hits.append(
                (score, message.created_at, ContextHit(message=message, conversation=conversation))
            )

        scored_hits.sort(key=lambda item: (-item[0], item[1]))
        return [hit for _, _, hit in scored_hits[:limit]]


def _conversation_from_row(row: sqlite3.Row) -> Conversation:
    return Conversation(
        id=row["id"],
        source_model=row["source_model"],
        title=row["title"],
        created_at=row["created_at"],
    )


def _message_from_row(row: sqlite3.Row) -> ChatMessage:
    return ChatMessage(
        id=row["id"],
        conversation_id=row["conversation_id"],
        source_model=row["source_model"],
        role=row["role"],
        content=row["content"],
        created_at=row["created_at"],
    )


def _tokens(query: str) -> list[str]:
    return [token.lower() for token in TOKEN_RE.findall(query)]
