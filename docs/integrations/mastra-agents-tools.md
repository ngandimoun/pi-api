---
title: Mastra Agents + Tools — patterns for piii
last_reviewed: 2026-03-26
official:
  - https://mastra.ai/docs/agents/overview
  - https://mastra.ai/docs/agents/using-tools
  - https://mastra.ai/docs/workflows/overview
---

# Mastra Agents + Tools in piii

Use Mastra **Agents** for open-ended tasks and Mastra **Tools** for deterministic operations. Compose them into **Workflows** when control flow is known.

## When to use what

- **Agents**: open-ended reasoning; decides which tools to call and when to stop.
- **Tools**: typed, deterministic operations (DB/API calls, parsing, validation). Tools should not “guess” external state.
- **Workflows**: deterministic multi-step pipelines with explicit ordering, branching, retries, suspend/resume.

## Repo structure

- Tools: `src/mastra/tools/*`
  - Example: `src/mastra/tools/demo-weather-tool.ts`
- Agents: `src/mastra/agents/*`
  - Example: `src/mastra/agents/demo-agent.ts`
- Mastra singleton: `src/mastra/index.ts`

## Model configuration (no hardcoding)

Agents should not hardcode model IDs. Set:

- `PI_MASTRA_DEFAULT_MODEL`

Dev fallback logic lives in `src/mastra/model.ts`.

## Skills (required for AI-assisted development)

- Vendored Mastra skill: `.agents/skills/mastra/SKILL.md`
- Embedded docs (preferred source of truth): `node_modules/@mastra/core/dist/docs/**`

If a Mastra agent/tool/workflow step uses Gemini, also apply:
- `.agents/skills/gemini-interactions-api/SKILL.md`

## Enterprise API constraints

Public HTTP endpoints must remain **OpenAI-compatible** per `.cursorrules` (Zod validation, docs-driven development, 202 jobs for long work).

