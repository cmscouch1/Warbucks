"""Minimal Gemini REST client used by the CLI."""

from __future__ import annotations

import json
import os
import urllib.error
import urllib.parse
import urllib.request

DEFAULT_GEMINI_MODEL = "gemini-1.5-flash"


class GeminiError(RuntimeError):
    """Raised when Gemini cannot return a usable response."""


def ask_gemini(
    prompt: str,
    *,
    api_key: str | None = None,
    model: str | None = None,
    timeout: int = 60,
) -> str:
    """Send a prompt to Gemini through the public REST API."""

    resolved_key = api_key or os.environ.get("GEMINI_API_KEY")
    if not resolved_key:
        raise GeminiError("GEMINI_API_KEY is not set.")

    resolved_model = model or os.environ.get("GEMINI_MODEL") or DEFAULT_GEMINI_MODEL
    model_path = urllib.parse.quote(resolved_model, safe="")
    url = (
        "https://generativelanguage.googleapis.com/v1beta/models/"
        f"{model_path}:generateContent?key={urllib.parse.quote(resolved_key, safe='')}"
    )
    payload = {
        "contents": [
            {
                "role": "user",
                "parts": [{"text": prompt}],
            }
        ]
    }
    request = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            body = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")
        raise GeminiError(f"Gemini request failed with HTTP {error.code}: {detail}") from error
    except urllib.error.URLError as error:
        raise GeminiError(f"Gemini request failed: {error}") from error

    text = _extract_text(body)
    if not text:
        raise GeminiError(f"Gemini returned no text: {json.dumps(body, sort_keys=True)}")
    return text


def _extract_text(body: object) -> str:
    if not isinstance(body, dict):
        return ""
    candidates = body.get("candidates", [])
    if not isinstance(candidates, list):
        return ""
    chunks: list[str] = []
    for candidate in candidates:
        if not isinstance(candidate, dict):
            continue
        content = candidate.get("content", {})
        if not isinstance(content, dict):
            continue
        parts = content.get("parts", [])
        if not isinstance(parts, list):
            continue
        for part in parts:
            if isinstance(part, dict) and isinstance(part.get("text"), str):
                chunks.append(part["text"])
    return "\n".join(chunks).strip()
