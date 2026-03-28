---
title: Mastra (agents + workflows) — integration for piii
last_reviewed: 2026-03-26
official:
  - https://mastra.ai/docs
  - https://mastra.ai/docs/workflows/overview
  - https://github.com/mastra-ai/skills
---

# Mastra in this repo

Mastra is the **internal orchestration layer** for future agentic APIs in `piii`. Public HTTP endpoints remain **OpenAI-compatible** per `.cursorrules`; Mastra is used behind those routes to run agents and workflows reliably.

## Where Mastra code lives

- `src/mastra/index.ts` — exports the `mastra` singleton (registers workflows/agents)
- `src/mastra/workflows/*` — deterministic pipelines (preferred for multi-step tasks)
- `src/mastra/agents/*` — autonomous reasoning when needed
- `src/mastra/tools/*` — reusable, typed tool calls

Starter example:
- `src/mastra/workflows/uppercase-workflow.ts`

## When to use workflows vs agents

- **Use Workflows** when the process is defined upfront and needs explicit control flow:
  - step-by-step pipelines, validation gates, retries, branching/parallelism
  - suspend/resume (human-in-the-loop), snapshots/time-travel debugging
  - streaming progress from the workflow execution lifecycle
- **Use Agents** when the task is open-ended and requires reasoning/decision-making, ideally as a **single step** inside a workflow (not the whole pipeline).

## Skills (required for AI-assisted development)

This repo vendors skills to keep code generation aligned with current Mastra/Gemini APIs.

### Vendored Mastra skill

- `.agents/skills/mastra/SKILL.md`

Update it with:

```bash
npm run mastra:skills:update
```

### Vendored Gemini skill

- `.agents/skills/gemini-interactions-api/SKILL.md`

Update it with:

```bash
npm run skills:update
```

## Cursor enforcement

Cursor rules enforce using skills and the workflow-first default:

- `.cursor/rules/mastra.mdc`
- `.cursor/rules/gemini-skills.mdc`

