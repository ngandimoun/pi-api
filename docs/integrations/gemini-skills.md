---
title: Gemini Skills (Agent Skills) — piii
last_reviewed: 2026-03-26
official:
  - https://github.com/google-gemini/gemini-skills
---

# Gemini Skills (Agent Skills)

This repo vendors **Agent Skills** to keep Gemini SDK/API usage current (closing the knowledge gap as SDKs evolve).

## What’s installed in this repo

- **`gemini-interactions-api`**: `.agents/skills/gemini-interactions-api/SKILL.md`

Use it when building Gemini-powered endpoints: Interactions API, tool/function calling, structured output, streaming, background tasks, multimodal, image generation.

## Cursor enforcement

Cursor is configured to require loading the skill before implementing Gemini work:
- `.cursor/rules/gemini-skills.mdc`

For native Gemini image generation/editing also follow:
- `.cursor/rules/nano-banana-image-generation.mdc`
- `docs/integrations/nano-banana-gemini-image.md`

## Update the vendored skill

Run:

```bash
npm run skills:update
```

This refreshes `.agents/skills/gemini-interactions-api/` from upstream (`google-gemini/gemini-skills`) in a deterministic way.

## Enterprise API constraints

When exposing HTTP APIs, keep the **public API** OpenAI-compatible per `.cursorrules` (Zod contracts, docs-driven development, 202 job patterns for long work), even if the internal Gemini integration uses provider-specific SDKs.

