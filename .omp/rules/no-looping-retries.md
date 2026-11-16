---
name: no-looping-retries
description: "Never repeat a tool call that already ran or already failed earlier in the conversation — vary the approach or advance the task instead"
question: "Did this tool call repeat a call (same file path, same command, same query, or a trivially varied path) that already ran or already failed earlier in this conversation, without new information that justifies running it again?"
scope: "tool"
---

Before emitting a tool call, check the transcript for an identical or near-identical call.

- **Already failed** (e.g. `read skill://agent-browser` → E_NOT_FOUND, then `read skill://agent-browser/SKILL.md` → E_NOT_FOUND): a trivially varied retry is a loop. Change the approach entirely (different tool, different source, or drop it as unavailable) instead of re-asking.
- **Already succeeded** (a file already read, a directory already listed, a brief already loaded by `impeccable context`): reuse the result in context. Do not re-read, re-grep, or re-run setup to re-establish ground you already have.
- When context is re-injected mid-session (skill blocks, system reminders), that is not a reason to restart exploration from step one.

Looping burns the turn without advancing. After any tool call, the next call must move the task forward — edit, verify, or ask the user the question the workflow actually owes them (e.g. the impeccable direction/scope question), never re-collect the same material.