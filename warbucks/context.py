"""Context packet construction for cross-model questions."""

from __future__ import annotations

from warbucks.models import ContextHit, ContextPacket
from warbucks.store import ChatStore


def build_context_packet(
    store: ChatStore,
    question: str,
    *,
    target_model: str = "gemini",
    source_model: str | None = "chatgpt",
    limit: int = 8,
    max_chars_per_hit: int = 1200,
) -> ContextPacket:
    """Build a grounded prompt from relevant messages in another model's chats."""

    hits = tuple(store.search(question, source_model=source_model, limit=limit))
    prompt = render_prompt(
        question,
        target_model=target_model,
        source_model=source_model,
        hits=hits,
        max_chars_per_hit=max_chars_per_hit,
    )
    return ContextPacket(
        question=question,
        target_model=target_model,
        source_model=source_model,
        hits=hits,
        prompt=prompt,
    )


def render_prompt(
    question: str,
    *,
    target_model: str,
    source_model: str | None,
    hits: tuple[ContextHit, ...],
    max_chars_per_hit: int = 1200,
) -> str:
    source_label = source_model or "connected model"
    header = (
        f"You are {target_model}. Answer the user's question using the supplied "
        f"context retrieved from {source_label} chats. If the context is insufficient, "
        "say what is missing instead of inventing details."
    )
    if not hits:
        context = "No matching chat context was found."
    else:
        context = "\n\n".join(_format_hit(hit, index, max_chars_per_hit) for index, hit in enumerate(hits, 1))
    return (
        f"{header}\n\n"
        "Retrieved chat context:\n"
        f"{context}\n\n"
        "User question:\n"
        f"{question}\n\n"
        "Answer:"
    )


def _format_hit(hit: ContextHit, index: int, max_chars: int) -> str:
    content = hit.message.content.strip()
    if len(content) > max_chars:
        content = f"{content[: max_chars - 3].rstrip()}..."
    return (
        f"[{index}] {hit.conversation.title} "
        f"({hit.message.source_model}, {hit.message.role}, {hit.message.created_at})\n"
        f"{content}"
    )
