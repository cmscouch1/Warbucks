"""Core data structures for chat context."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Literal

Role = Literal["system", "user", "assistant", "tool", "unknown"]


def utc_now_iso() -> str:
    """Return a stable UTC timestamp for storage."""

    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


@dataclass(frozen=True)
class Conversation:
    """A conversation owned by one source model or provider."""

    id: str
    source_model: str
    title: str
    created_at: str


@dataclass(frozen=True)
class ChatMessage:
    """One message inside a model conversation."""

    id: str
    conversation_id: str
    source_model: str
    role: Role
    content: str
    created_at: str


@dataclass(frozen=True)
class ContextHit:
    """A retrieved message plus its parent conversation metadata."""

    message: ChatMessage
    conversation: Conversation


@dataclass(frozen=True)
class ContextPacket:
    """Grounding context for asking one model about another model's chat."""

    question: str
    target_model: str
    source_model: str | None
    hits: tuple[ContextHit, ...]
    prompt: str
