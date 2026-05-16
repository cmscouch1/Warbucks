"""Import chat histories from provider exports and neutral JSON files."""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, cast

from warbucks.models import ChatMessage, Conversation, Role, utc_now_iso


@dataclass(frozen=True)
class ImportedConversation:
    """A parsed conversation and its messages."""

    conversation: Conversation
    messages: tuple[ChatMessage, ...]


def load_generic_json(path: Path | str) -> list[ImportedConversation]:
    """Load neutral JSON with a top-level list or {"conversations": [...]}."""

    payload = _read_json(path)
    raw_conversations = payload.get("conversations", payload) if isinstance(payload, dict) else payload
    if not isinstance(raw_conversations, list):
        raise ValueError("Generic JSON must be a list or an object with a conversations list.")

    conversations: list[ImportedConversation] = []
    for index, item in enumerate(raw_conversations):
        if not isinstance(item, dict):
            raise ValueError(f"Conversation at index {index} must be an object.")
        conversations.append(_parse_generic_conversation(item, index))
    return conversations


def load_chatgpt_export(path: Path | str, source_model: str = "chatgpt") -> list[ImportedConversation]:
    """Load conversations.json from a ChatGPT data export."""

    payload = _read_json(path)
    raw_conversations = payload.get("conversations", payload) if isinstance(payload, dict) else payload
    if not isinstance(raw_conversations, list):
        raise ValueError("ChatGPT export must be a list or an object with a conversations list.")

    conversations: list[ImportedConversation] = []
    for index, item in enumerate(raw_conversations):
        if not isinstance(item, dict):
            continue
        imported = _parse_chatgpt_conversation(item, index, source_model)
        if imported.messages:
            conversations.append(imported)
    return conversations


def _parse_generic_conversation(item: dict[str, Any], index: int) -> ImportedConversation:
    source_model = str(item.get("source_model") or item.get("model") or "unknown")
    title = str(item.get("title") or f"Conversation {index + 1}")
    created_at = _coerce_timestamp(item.get("created_at") or item.get("create_time"))
    conversation_id = str(item.get("id") or _stable_id(source_model, title, created_at, str(index)))
    raw_messages = item.get("messages", [])
    if not isinstance(raw_messages, list):
        raise ValueError(f"Conversation {title!r} has a non-list messages field.")

    messages: list[ChatMessage] = []
    for message_index, raw_message in enumerate(raw_messages):
        if not isinstance(raw_message, dict):
            continue
        content = str(raw_message.get("content") or "").strip()
        if not content:
            continue
        role = _coerce_role(raw_message.get("role"))
        message_created_at = _coerce_timestamp(raw_message.get("created_at") or raw_message.get("create_time"))
        message_id = str(
            raw_message.get("id")
            or _stable_id(conversation_id, str(message_index), role, message_created_at, content)
        )
        messages.append(
            ChatMessage(
                id=message_id,
                conversation_id=conversation_id,
                source_model=source_model,
                role=role,
                content=content,
                created_at=message_created_at,
            )
        )

    return ImportedConversation(
        conversation=Conversation(
            id=conversation_id,
            source_model=source_model,
            title=title,
            created_at=created_at,
        ),
        messages=tuple(messages),
    )


def _parse_chatgpt_conversation(
    item: dict[str, Any],
    index: int,
    source_model: str,
) -> ImportedConversation:
    title = str(item.get("title") or f"ChatGPT conversation {index + 1}")
    created_at = _coerce_timestamp(item.get("create_time") or item.get("created_at"))
    conversation_id = str(item.get("id") or _stable_id(source_model, title, created_at, str(index)))
    mapping = item.get("mapping", {})
    if not isinstance(mapping, dict):
        mapping = {}

    messages: list[ChatMessage] = []
    for node_id, node in mapping.items():
        if not isinstance(node, dict):
            continue
        raw_message = node.get("message")
        if not isinstance(raw_message, dict):
            continue
        content = _chatgpt_content(raw_message.get("content"))
        if not content:
            continue
        author = raw_message.get("author", {})
        role_value = author.get("role") if isinstance(author, dict) else None
        role = _coerce_role(role_value)
        message_created_at = _coerce_timestamp(raw_message.get("create_time") or raw_message.get("created_at"))
        message_id = str(raw_message.get("id") or node_id or _stable_id(conversation_id, content))
        messages.append(
            ChatMessage(
                id=message_id,
                conversation_id=conversation_id,
                source_model=source_model,
                role=role,
                content=content,
                created_at=message_created_at,
            )
        )

    messages.sort(key=lambda message: (message.created_at, message.id))
    return ImportedConversation(
        conversation=Conversation(
            id=conversation_id,
            source_model=source_model,
            title=title,
            created_at=created_at,
        ),
        messages=tuple(messages),
    )


def _chatgpt_content(content: object) -> str:
    if isinstance(content, str):
        return content.strip()
    if not isinstance(content, dict):
        return ""
    parts = content.get("parts")
    if isinstance(parts, list):
        return "\n".join(_stringify_part(part) for part in parts).strip()
    text = content.get("text")
    if isinstance(text, str):
        return text.strip()
    return ""


def _stringify_part(part: object) -> str:
    if isinstance(part, str):
        return part
    if part is None:
        return ""
    return json.dumps(part, sort_keys=True)


def _coerce_role(value: object) -> Role:
    if value in {"system", "user", "assistant", "tool"}:
        return cast(Role, value)
    return "unknown"


def _coerce_timestamp(value: object) -> str:
    if value is None:
        return utc_now_iso()
    if isinstance(value, int | float):
        return datetime.fromtimestamp(value, tz=timezone.utc).replace(microsecond=0).isoformat()
    if isinstance(value, str):
        if value.strip():
            return value
    return utc_now_iso()


def _read_json(path: Path | str) -> Any:
    with Path(path).expanduser().open("r", encoding="utf-8") as handle:
        return json.load(handle)


def _stable_id(*parts: str) -> str:
    digest = hashlib.sha256("\x1f".join(parts).encode("utf-8")).hexdigest()
    return digest[:24]
