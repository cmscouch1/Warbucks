"""Command line interface for Warbucks."""

from __future__ import annotations

import argparse
import json
import os
import sys
import uuid
from pathlib import Path

from warbucks.context import build_context_packet
from warbucks.gemini import GeminiError, ask_gemini
from warbucks.importers import ImportedConversation, load_chatgpt_export, load_generic_json
from warbucks.models import ChatMessage, Conversation, Role, utc_now_iso
from warbucks.store import DEFAULT_DB_PATH, ChatStore


def main(argv: list[str] | None = None) -> int:
    parser = _build_parser()
    args = parser.parse_args(argv)
    return args.handler(args)


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="warbucks",
        description="Local context bridge for chats across connected AI models.",
    )
    parser.add_argument(
        "--db",
        type=Path,
        default=DEFAULT_DB_PATH,
        help=f"SQLite database path. Defaults to {DEFAULT_DB_PATH}.",
    )
    subparsers = parser.add_subparsers(required=True)

    import_parser = subparsers.add_parser("import", help="Import chat history JSON.")
    import_parser.add_argument("path", type=Path, help="Path to the export JSON file.")
    import_parser.add_argument(
        "--format",
        choices=("chatgpt", "generic"),
        required=True,
        help="Input format to import.",
    )
    import_parser.add_argument(
        "--source-model",
        default="chatgpt",
        help="Source model label for ChatGPT exports.",
    )
    import_parser.set_defaults(handler=_handle_import)

    add_parser = subparsers.add_parser("add", help="Add one message manually.")
    add_parser.add_argument("--source-model", required=True, help="Model/provider that produced the message.")
    add_parser.add_argument("--role", default="user", choices=("system", "user", "assistant", "tool", "unknown"))
    add_parser.add_argument("--content", required=True, help="Message text, or '-' to read stdin.")
    add_parser.add_argument("--conversation-id", help="Existing or new conversation id.")
    add_parser.add_argument("--title", default="Manual context", help="Conversation title for new conversations.")
    add_parser.set_defaults(handler=_handle_add)

    list_parser = subparsers.add_parser("list", help="List stored conversations.")
    list_parser.add_argument("--source-model", help="Only list conversations from this model/provider.")
    list_parser.set_defaults(handler=_handle_list)

    search_parser = subparsers.add_parser("search", help="Search stored chat context.")
    search_parser.add_argument("query", help="Search text.")
    search_parser.add_argument("--source-model", help="Only search one model/provider.")
    search_parser.add_argument("--limit", type=int, default=8)
    search_parser.add_argument("--json", action="store_true", help="Emit machine-readable JSON.")
    search_parser.set_defaults(handler=_handle_search)

    context_parser = subparsers.add_parser("context", help="Build a prompt for another model.")
    context_parser.add_argument("question", help="Question to ask with retrieved context.")
    context_parser.add_argument("--source-model", default="chatgpt", help="Model/provider to retrieve context from.")
    context_parser.add_argument("--target-model", default="gemini", help="Model/provider that will answer.")
    context_parser.add_argument("--limit", type=int, default=8)
    context_parser.set_defaults(handler=_handle_context)

    ask_parser = subparsers.add_parser(
        "ask-gemini",
        help="Ask Gemini using retrieved context from another model's chats.",
    )
    ask_parser.add_argument("question", help="Question to ask Gemini.")
    ask_parser.add_argument("--source-model", default="chatgpt", help="Model/provider to retrieve context from.")
    ask_parser.add_argument("--limit", type=int, default=8)
    ask_parser.add_argument(
        "--gemini-model",
        default=os.environ.get("GEMINI_MODEL"),
        help="Gemini model name. Defaults to GEMINI_MODEL or the package default.",
    )
    ask_parser.add_argument(
        "--print-prompt-on-missing-key",
        action=argparse.BooleanOptionalAction,
        default=True,
        help="Print the grounded prompt if GEMINI_API_KEY is not configured.",
    )
    ask_parser.set_defaults(handler=_handle_ask_gemini)

    return parser


def _handle_import(args: argparse.Namespace) -> int:
    if args.format == "chatgpt":
        imported = load_chatgpt_export(args.path, source_model=args.source_model)
    elif args.format == "generic":
        imported = load_generic_json(args.path)
    else:
        raise ValueError(f"Unsupported format: {args.format}")

    conversation_count, message_count = _save_imported(args.db, imported)
    print(f"Imported {message_count} messages across {conversation_count} conversations into {args.db}.")
    return 0


def _handle_add(args: argparse.Namespace) -> int:
    content = sys.stdin.read() if args.content == "-" else args.content
    content = content.strip()
    if not content:
        raise SystemExit("Cannot add an empty message.")

    created_at = utc_now_iso()
    conversation_id = args.conversation_id or str(uuid.uuid4())
    with ChatStore(args.db) as store:
        existing = store.get_conversation(conversation_id)
        if existing is None:
            store.upsert_conversation(
                Conversation(
                    id=conversation_id,
                    source_model=args.source_model,
                    title=args.title,
                    created_at=created_at,
                )
            )
        message = ChatMessage(
            id=str(uuid.uuid4()),
            conversation_id=conversation_id,
            source_model=args.source_model,
            role=args.role,
            content=content,
            created_at=created_at,
        )
        store.upsert_messages([message])
    print(f"Added message {message.id} to conversation {conversation_id}.")
    return 0


def _handle_list(args: argparse.Namespace) -> int:
    with ChatStore(args.db) as store:
        conversations = store.list_conversations(source_model=args.source_model)
    for conversation in conversations:
        print(
            f"{conversation.id}\t{conversation.source_model}\t"
            f"{conversation.created_at}\t{conversation.title}"
        )
    return 0


def _handle_search(args: argparse.Namespace) -> int:
    with ChatStore(args.db) as store:
        hits = store.search(args.query, source_model=args.source_model, limit=args.limit)
    if args.json:
        print(
            json.dumps(
                [
                    {
                        "conversation_id": hit.conversation.id,
                        "conversation_title": hit.conversation.title,
                        "message_id": hit.message.id,
                        "source_model": hit.message.source_model,
                        "role": hit.message.role,
                        "created_at": hit.message.created_at,
                        "content": hit.message.content,
                    }
                    for hit in hits
                ],
                indent=2,
            )
        )
        return 0

    for index, hit in enumerate(hits, 1):
        print(
            f"[{index}] {hit.conversation.title} "
            f"({hit.message.source_model}, {hit.message.role}, {hit.message.created_at})"
        )
        print(hit.message.content)
        print()
    return 0


def _handle_context(args: argparse.Namespace) -> int:
    with ChatStore(args.db) as store:
        packet = build_context_packet(
            store,
            args.question,
            target_model=args.target_model,
            source_model=args.source_model,
            limit=args.limit,
        )
    print(packet.prompt)
    return 0


def _handle_ask_gemini(args: argparse.Namespace) -> int:
    with ChatStore(args.db) as store:
        packet = build_context_packet(
            store,
            args.question,
            target_model="gemini",
            source_model=args.source_model,
            limit=args.limit,
        )
    try:
        print(ask_gemini(packet.prompt, model=args.gemini_model))
    except GeminiError as error:
        if "GEMINI_API_KEY" in str(error) and args.print_prompt_on_missing_key:
            print(packet.prompt)
            print("\nSet GEMINI_API_KEY to send this prompt directly to Gemini.", file=sys.stderr)
            return 0
        raise SystemExit(str(error)) from error
    return 0


def _save_imported(db_path: Path, imported: list[ImportedConversation]) -> tuple[int, int]:
    message_count = 0
    with ChatStore(db_path) as store:
        for imported_conversation in imported:
            store.upsert_conversation(imported_conversation.conversation)
            message_count += store.upsert_messages(imported_conversation.messages)
    return len(imported), message_count


if __name__ == "__main__":
    raise SystemExit(main())
