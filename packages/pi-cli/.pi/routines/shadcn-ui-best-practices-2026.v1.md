---
pi_routine: "2"
id: shadcn-ui-best-practices-2026
version: 1
intent: Apply real-world best practices for shadcn/ui in production apps
tags:
  - shadcn
  - best-practices
  - a11y
  - performance
  - tokens
references:
  - shadcn-ui-ecosystem-libraries
  - shadcn-ui-blocks-guide
---

> **Depends on prior routines:** `.pi/routines/shadcn-ui-ecosystem-libraries.v*.md`, `.pi/routines/shadcn-ui-blocks-guide.v*.md`
> Execute those routine files first (in order if numbered), then this one.

# Pi Execution Routine: shadcn-ui-best-practices-2026

> **Target:** Any coding agent (Cursor, Claude Code, Windsurf, etc.)
> **Mode:** Specification only — the executor applies changes; Pi does not run commands.

## Context
**Framework / stack:** shadcn/ui

### Existing patterns (from repo analysis)
_(none inferred — follow system style and repo conventions.)_

### Critical constraints
- ✓ MUST: Tokens early
- ✓ MUST: Blocks > screens
- ✓ MUST: Keep a11y untouched
- ✗ MUST NOT: 12+ variants everywhere
- ✗ MUST NOT: Conditional class soup without CVA
- ✗ MUST NOT: React state for simple hover interactions
- ◆ CONVENTION: Prefer CSS for interactions; keep JS for real state.

## Related Routines
Before this routine, the coding agent should have completed (or read) these saved routines under `.pi/routines/`:
1. `shadcn-ui-ecosystem-libraries` — see `.pi/routines/shadcn-ui-ecosystem-libraries.v*.md`
2. `shadcn-ui-blocks-guide` — see `.pi/routines/shadcn-ui-blocks-guide.v*.md`
This document focuses on **integration / glue**; do not duplicate steps already specified there.

## Files This Routine Creates or Modifies
_(No explicit manifest — infer from phases below; prefer multiple focused files over one monolithic file.)_

## Best practices checklist
<!-- phase_id: discipline -->
### Step source-not-dep
**Action:** `verify`

Treat shadcn as source code, not a dependency: you own the API, upgrades, and breaking changes. Update intentionally.

### Step tokens-early
**Action:** `verify`

Design tokens early: CSS variables for radius/colors/foregrounds; map to Tailwind; keep theme changes cheap and consistent.

### Step product-primitives
**Action:** `verify`

Build product-specific primitives (thin wrappers) instead of importing Button/Dialog everywhere. This is where you add analytics, loading, permissions, and consistent class tweaks.

### Step compose-blocks
**Action:** `verify`

Compose blocks (pricing section, auth forms, dashboard cards) rather than whole screens; reuse improves consistency and cuts page complexity.

### Step a11y-untouched
**Action:** `verify`

Keep accessibility untouched: don’t break `asChild`, don’t wrap interactive elements improperly, don’t remove focus styles. Re-test keyboard flows after semantic changes.

**Validation:**
- pi validate (a11y-images + semantic UX checks)

### Step avoid-over-styling
**Action:** `verify`

Avoid over-styling: keep variants minimal; push layout responsibility up to container components; avoid heavy conditional Tailwind strings without structure.

### Step performance-css
**Action:** `verify`

Performance: less JS, more CSS. Prefer group-hover, transitions, and Radix behavior over stateful hover toggles. Virtualize large tables/lists.

### Step document-decisions
**Action:** `verify`

Document your component decisions because you own them: why it exists, when to use it, when not to. A small README in components/ saves future time.

## Validation checklist
- [ ] Types / lint / tests pass per project standards
