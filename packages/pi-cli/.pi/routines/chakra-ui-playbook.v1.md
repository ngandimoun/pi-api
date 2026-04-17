---
pi_routine: "2"
id: chakra-ui-playbook
version: 1
intent: Use Chakra UI effectively (and decide when not to) without loading long docs
tags:
  - chakra
  - ui
  - playbook
  - comparison
  - a11y
  - theming
  - token-safe
references:
  - chakra-ui-principles
  - chakra-ui-vs-tailwind
  - chakra-ui-vs-mui
  - chakra-ui-vs-ant-design
  - chakra-ui-vs-theme-ui
  - chakra-ui-runtime-tradeoffs
  - chakra-ui-best-practices
---

> **Depends on prior routines:** `.pi/routines/chakra-ui-principles.v*.md`, `.pi/routines/chakra-ui-vs-tailwind.v*.md`, `.pi/routines/chakra-ui-vs-mui.v*.md`, `.pi/routines/chakra-ui-vs-ant-design.v*.md`, `.pi/routines/chakra-ui-vs-theme-ui.v*.md`, `.pi/routines/chakra-ui-runtime-tradeoffs.v*.md`, `.pi/routines/chakra-ui-best-practices.v*.md`
> Execute those routine files first (in order if numbered), then this one.

# Pi Execution Routine: chakra-ui-playbook

> **Target:** Any coding agent (Cursor, Claude Code, Windsurf, etc.)
> **Mode:** Specification only — the executor applies changes; Pi does not run commands.

## Context
**Framework / stack:** Chakra UI

### Existing patterns (from repo analysis)
_(none inferred — follow system style and repo conventions.)_

### Critical constraints
- ✓ MUST: Style props for overrides
- ✓ MUST: Composition patterns
- ✓ MUST: Accessible defaults + focus management
- ✗ MUST NOT: Duplicate existing Pi templates/rules (reuse them)
- ✗ MUST NOT: Ignore Chakra's runtime cost for highly dynamic UIs
- ◆ CONVENTION: Keep routing token-safe: install hub + only needed leaf modules.
- ◆ CONVENTION: Prefer `pi validate` for a11y/tokens checks before inventing new UI heuristics.

## Related Routines
Before this routine, the coding agent should have completed (or read) these saved routines under `.pi/routines/`:
1. `chakra-ui-principles` — see `.pi/routines/chakra-ui-principles.v*.md`
2. `chakra-ui-vs-tailwind` — see `.pi/routines/chakra-ui-vs-tailwind.v*.md`
3. `chakra-ui-vs-mui` — see `.pi/routines/chakra-ui-vs-mui.v*.md`
4. `chakra-ui-vs-ant-design` — see `.pi/routines/chakra-ui-vs-ant-design.v*.md`
5. `chakra-ui-vs-theme-ui` — see `.pi/routines/chakra-ui-vs-theme-ui.v*.md`
6. `chakra-ui-runtime-tradeoffs` — see `.pi/routines/chakra-ui-runtime-tradeoffs.v*.md`
7. `chakra-ui-best-practices` — see `.pi/routines/chakra-ui-best-practices.v*.md`
This document focuses on **integration / glue**; do not duplicate steps already specified there.

## Files This Routine Creates or Modifies
_(No explicit manifest — infer from phases below; prefer multiple focused files over one monolithic file.)_

## Pick the right Chakra module
<!-- phase_id: route -->
### Step principles
**Action:** `verify`

If you need Chakra’s core design principles (style props, simplicity, composition, accessibility, dark mode, naming props), open `chakra-ui-principles`.

### Step comparison-tailwind
**Action:** `verify`

If you're deciding between Chakra and Tailwind, open `chakra-ui-vs-tailwind` (learning curve, responsive styles, overrides, a11y responsibilities, dark mode).

### Step comparison-mui-ant-themeui
**Action:** `verify`

If you're deciding vs Material UI / Ant Design / Theme UI, open `chakra-ui-vs-mui`, `chakra-ui-vs-ant-design`, and/or `chakra-ui-vs-theme-ui`.

### Step runtime-tradeoff
**Action:** `verify`

If performance is a concern (high-frequency updates, huge tables), open `chakra-ui-runtime-tradeoffs` and weigh CSS-in-JS costs vs alternatives.

### Step reuse-existing-pi-assets
**Action:** `verify`

Avoid duplication: you already ship `chakra-ui-card-component` and validate rules like `a11y-images` and `no-hardcoded-hex`. Prefer running `pi validate` before adding custom UI rules.

**Validation:**
- pi validate

## Validation checklist
- [ ] Types / lint / tests pass per project standards
