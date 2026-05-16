from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from warbucks.context import build_context_packet
from warbucks.importers import load_chatgpt_export, load_generic_json
from warbucks.store import ChatStore


class ImportersStoreContextTest(unittest.TestCase):
    def test_imports_generic_json_and_builds_context_packet(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "generic.json"
            db_path = Path(directory) / "context.sqlite3"
            path.write_text(
                json.dumps(
                    {
                        "conversations": [
                            {
                                "id": "chatgpt-roadmap",
                                "source_model": "chatgpt",
                                "title": "Roadmap notes",
                                "created_at": "2026-05-16T00:00:00+00:00",
                                "messages": [
                                    {
                                        "id": "m1",
                                        "role": "user",
                                        "content": "How should we handle vector memory?",
                                        "created_at": "2026-05-16T00:00:01+00:00",
                                    },
                                    {
                                        "id": "m2",
                                        "role": "assistant",
                                        "content": "Start with SQLite search before adding embeddings.",
                                        "created_at": "2026-05-16T00:00:02+00:00",
                                    },
                                ],
                            }
                        ]
                    }
                ),
                encoding="utf-8",
            )

            imported = load_generic_json(path)
            with ChatStore(db_path) as store:
                for imported_conversation in imported:
                    store.upsert_conversation(imported_conversation.conversation)
                    store.upsert_messages(imported_conversation.messages)
                packet = build_context_packet(
                    store,
                    "What did ChatGPT say about SQLite memory?",
                    target_model="gemini",
                    source_model="chatgpt",
                )

            self.assertEqual(len(packet.hits), 2)
            self.assertIn("Roadmap notes", packet.prompt)
            self.assertIn("Start with SQLite search", packet.prompt)
            self.assertIn("What did ChatGPT say", packet.prompt)

    def test_imports_chatgpt_export_mapping(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "conversations.json"
            path.write_text(
                json.dumps(
                    [
                        {
                            "id": "abc",
                            "title": "Deployment question",
                            "create_time": 1778889600,
                            "mapping": {
                                "node-1": {
                                    "message": {
                                        "id": "msg-1",
                                        "author": {"role": "user"},
                                        "create_time": 1778889601,
                                        "content": {"parts": ["How do I deploy this?"]},
                                    }
                                },
                                "node-2": {
                                    "message": {
                                        "id": "msg-2",
                                        "author": {"role": "assistant"},
                                        "create_time": 1778889602,
                                        "content": {"parts": ["Use the package CLI first."]},
                                    }
                                },
                            },
                        }
                    ]
                ),
                encoding="utf-8",
            )

            imported = load_chatgpt_export(path)

            self.assertEqual(len(imported), 1)
            self.assertEqual(imported[0].conversation.source_model, "chatgpt")
            self.assertEqual(imported[0].conversation.title, "Deployment question")
            self.assertEqual([message.role for message in imported[0].messages], ["user", "assistant"])
            self.assertEqual(imported[0].messages[1].content, "Use the package CLI first.")

    def test_search_can_filter_by_source_model(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            db_path = Path(directory) / "context.sqlite3"
            generic_path = Path(directory) / "generic.json"
            generic_path.write_text(
                json.dumps(
                    [
                        {
                            "id": "chatgpt-one",
                            "source_model": "chatgpt",
                            "title": "ChatGPT plan",
                            "created_at": "2026-05-16T00:00:00+00:00",
                            "messages": [{"id": "c1", "role": "assistant", "content": "Use sqlite."}],
                        },
                        {
                            "id": "claude-one",
                            "source_model": "claude",
                            "title": "Claude plan",
                            "created_at": "2026-05-16T00:01:00+00:00",
                            "messages": [{"id": "x1", "role": "assistant", "content": "Use sqlite differently."}],
                        },
                    ]
                ),
                encoding="utf-8",
            )
            imported = load_generic_json(generic_path)

            with ChatStore(db_path) as store:
                for imported_conversation in imported:
                    store.upsert_conversation(imported_conversation.conversation)
                    store.upsert_messages(imported_conversation.messages)
                hits = store.search("sqlite", source_model="chatgpt")

            self.assertEqual(len(hits), 1)
            self.assertEqual(hits[0].message.source_model, "chatgpt")


if __name__ == "__main__":
    unittest.main()
