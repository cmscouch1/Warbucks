# Warbucks

Warbucks is a local-first tool package for making chats from one AI model
available as context to another model.

Example: import a ChatGPT export, then ask Gemini a question that is grounded in
the relevant ChatGPT messages.

## Install

```bash
python3 -m pip install -e .
```

The package only uses the Python standard library.

## Import chat history

Import a ChatGPT `conversations.json` export:

```bash
warbucks import --format chatgpt ~/Downloads/conversations.json
```

Or import a generic JSON file:

```bash
warbucks import --format generic ./my-chats.json
```

Generic files can be either a top-level list or an object with a
`conversations` list:

```json
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
          "content": "How should we share context across models?",
          "created_at": "2026-05-16T00:00:01+00:00"
        }
      ]
    }
  ]
}
```

## Ask Gemini about ChatGPT context

Preview the grounded prompt:

```bash
warbucks context "What did I ask ChatGPT about shared context?"
```

Send the grounded prompt to Gemini:

```bash
export GEMINI_API_KEY="..."
warbucks ask-gemini "What did I ask ChatGPT about shared context?"
```

If `GEMINI_API_KEY` is not set, `ask-gemini` prints the exact prompt so it can
be pasted into Gemini manually.

## Other commands

Add a single message manually:

```bash
warbucks add --source-model chatgpt --role user --content "My original question"
```

Search stored chats:

```bash
warbucks search "shared context" --source-model chatgpt
```

List imported conversations:

```bash
warbucks list
```

## Storage

By default, Warbucks stores context locally in:

```text
~/.warbucks/chat_context.sqlite3
```

Use `--db ./path/to/context.sqlite3` to choose a different database.
