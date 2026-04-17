---
pi_routine: "2"
id: chakra-ui-vs-tailwind
version: 1
intent: Decide between Chakra UI and Tailwind CSS for a product team
tags:
  - chakra
  - tailwind
  - comparison
  - responsive
  - a11y
  - theming
references:
  - chakra-ui-runtime-tradeoffs
---

> **Depends on prior routines:** `.pi/routines/chakra-ui-runtime-tradeoffs.v*.md`
> Execute those routine files first (in order if numbered), then this one.

# Pi Execution Routine: chakra-ui-vs-tailwind

> **Target:** Any coding agent (Cursor, Claude Code, Windsurf, etc.)
> **Mode:** Specification only — the executor applies changes; Pi does not run commands.

## Context

### Existing patterns (from repo analysis)
_(none inferred — follow system style and repo conventions.)_

### Critical constraints
- ✓ MUST: Choose based on team ergonomics + design needs + performance constraints
- ✗ MUST NOT: Assume Tailwind includes accessibility behaviors (it doesn't)
- ◆ CONVENTION: If using Tailwind, budget time for semantics/a11y/composition; if Chakra, budget for runtime overhead.

## Related Routines
Before this routine, the coding agent should have completed (or read) these saved routines under `.pi/routines/`:
1. `chakra-ui-runtime-tradeoffs` — see `.pi/routines/chakra-ui-runtime-tradeoffs.v*.md`
This document focuses on **integration / glue**; do not duplicate steps already specified there.

## Files This Routine Creates or Modifies
_(No explicit manifest — infer from phases below; prefer multiple focused files over one monolithic file.)_

## Comparison (compressed)
<!-- phase_id: comparison -->
### Step overview
**Action:** `verify`

Tailwind = CSS utility framework; you assemble semantics, accessibility behaviors, composition patterns yourself. Chakra = React component system with prop-based styling + many UX/a11y details handled for you.

### Step learning-curve
**Action:** `verify`

Learning curve: Tailwind is easy for Bootstrap-like CSS users; Chakra is intuitive for CSS-in-JS/styled-system users due to CSS-like style props and readable component APIs.

### Step responsive
**Action:** `verify`

Responsive styles: Tailwind uses breakpoint prefixes and class strings; Chakra supports array/object responsive props for many style props.

### Step overrides
**Action:** `verify`

Style overrides: Tailwind often requires class override strategy or custom CSS; Chakra overrides are typically just prop overrides and theme extensions.

### Step a11y
**Action:** `verify`

Accessibility: Tailwind doesn't enforce semantics/ARIA/keyboard behavior; Chakra includes accessible defaults for many components but you can still break them—re-test flows.

**Validation:**
- pi validate

### Step dark-mode
**Action:** `verify`

Dark mode: both can do it; Chakra supports color mode patterns out of the box and lets you author light/dark experiences in theme tokens.

## Validation checklist
- [ ] Types / lint / tests pass per project standards
