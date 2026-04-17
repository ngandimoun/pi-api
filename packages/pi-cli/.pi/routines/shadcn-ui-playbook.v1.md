---
pi_routine: "2"
id: shadcn-ui-playbook
version: 1
intent: Apply shadcn/ui principles and scaling patterns without loading long docs
tags:
  - shadcn
  - ui
  - radix
  - tailwind
  - tokens
  - playbook
  - token-safe
references:
  - shadcn-ui-principles-aesthetic
  - shadcn-ui-best-practices-2026
  - shadcn-ui-structure-for-scale
  - shadcn-ui-blocks-guide
  - shadcn-ui-ecosystem-libraries
---

> **Depends on prior routines:** `.pi/routines/shadcn-ui-principles-aesthetic.v*.md`, `.pi/routines/shadcn-ui-best-practices-2026.v*.md`, `.pi/routines/shadcn-ui-structure-for-scale.v*.md`, `.pi/routines/shadcn-ui-blocks-guide.v*.md`, `.pi/routines/shadcn-ui-ecosystem-libraries.v*.md`
> Execute those routine files first (in order if numbered), then this one.

# Pi Execution Routine: shadcn-ui-playbook

> **Target:** Any coding agent (Cursor, Claude Code, Windsurf, etc.)
> **Mode:** Specification only — the executor applies changes; Pi does not run commands.

## Context
**Framework / stack:** shadcn/ui

### Existing patterns (from repo analysis)
_(none inferred — follow system style and repo conventions.)_

### Critical constraints
- ✓ MUST: Open code ownership model (copy source into repo)
- ✓ MUST: CSS variables + tokens for theming
- ✓ MUST: Radix accessibility preserved
- ✗ MUST NOT: Treat shadcn as a black-box dependency
- ✗ MUST NOT: Break focus/ARIA semantics when customizing
- ◆ CONVENTION: Prefer composing blocks from primitives, not duplicating entire screens.
- ◆ CONVENTION: Keep routing token-safe: install hub + only needed leaf modules.

## Related Routines
Before this routine, the coding agent should have completed (or read) these saved routines under `.pi/routines/`:
1. `shadcn-ui-principles-aesthetic` — see `.pi/routines/shadcn-ui-principles-aesthetic.v*.md`
2. `shadcn-ui-best-practices-2026` — see `.pi/routines/shadcn-ui-best-practices-2026.v*.md`
3. `shadcn-ui-structure-for-scale` — see `.pi/routines/shadcn-ui-structure-for-scale.v*.md`
4. `shadcn-ui-blocks-guide` — see `.pi/routines/shadcn-ui-blocks-guide.v*.md`
5. `shadcn-ui-ecosystem-libraries` — see `.pi/routines/shadcn-ui-ecosystem-libraries.v*.md`
This document focuses on **integration / glue**; do not duplicate steps already specified there.

## Files This Routine Creates or Modifies
_(No explicit manifest — infer from phases below; prefer multiple focused files over one monolithic file.)_

## Pick the right shadcn module
<!-- phase_id: route -->
### Step principles
**Action:** `verify`

If you need the aesthetic + UX philosophy (minimalism, defaults, shadows, accessibility), open `shadcn-ui-principles-aesthetic`.

### Step scale-structure
**Action:** `verify`

If you need long-term maintainability guidance (source ownership, versioning, folder layout, tokens), open `shadcn-ui-structure-for-scale` + `shadcn-ui-best-practices-2026`.

### Step blocks
**Action:** `verify`

If you want to ship faster using composable sections (auth, dashboards, tables, settings pages), open `shadcn-ui-blocks-guide`.

### Step ecosystem
**Action:** `verify`

If you need derived libraries + free tiers and when to use them (CVA, tailwind-merge, Lucide, RHF+Zod, Sonner, Framer Motion; plus block registries), open `shadcn-ui-ecosystem-libraries`.

### Step reuse-existing-pi-assets
**Action:** `verify`

Avoid duplication: you already ship implementation templates like `shadcn-card-component` and validate rules like `a11y-images` and `no-hardcoded-hex`. Prefer `pi validate` before inventing new UI heuristics.

**Validation:**
- pi validate

## Validation checklist
- [ ] Types / lint / tests pass per project standards
