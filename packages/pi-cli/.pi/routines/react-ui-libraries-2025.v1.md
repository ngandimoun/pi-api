---
pi_routine: "2"
id: react-ui-libraries-2025
version: 1
intent: Choose a React UI library in 2025 based on project constraints and
  desired ownership
tags:
  - react
  - ui-library
  - comparison
  - "2025"
  - frontend
references:
  - shadcn-ui-playbook
  - chakra-ui-playbook
  - mui-customization-slot-strategy
---

> **Depends on prior routines:** `.pi/routines/shadcn-ui-playbook.v*.md`, `.pi/routines/chakra-ui-playbook.v*.md`, `.pi/routines/mui-customization-slot-strategy.v*.md`
> Execute those routine files first (in order if numbered), then this one.

# Pi Execution Routine: react-ui-libraries-2025

> **Target:** Any coding agent (Cursor, Claude Code, Windsurf, etc.)
> **Mode:** Specification only — the executor applies changes; Pi does not run commands.

## Context

### Existing patterns (from repo analysis)
_(none inferred — follow system style and repo conventions.)_

### Critical constraints
- ✓ MUST: Pick based on ownership model, a11y needs, customization depth, and performance constraints
- ✗ MUST NOT: Choose purely on aesthetics; consider long-term maintainability and DX
- ◆ CONVENTION: If you adopt a library, document the rationale + exit strategy in your repo.

## Related Routines
Before this routine, the coding agent should have completed (or read) these saved routines under `.pi/routines/`:
1. `shadcn-ui-playbook` — see `.pi/routines/shadcn-ui-playbook.v*.md`
2. `chakra-ui-playbook` — see `.pi/routines/chakra-ui-playbook.v*.md`
3. `mui-customization-slot-strategy` — see `.pi/routines/mui-customization-slot-strategy.v*.md`
This document focuses on **integration / glue**; do not duplicate steps already specified there.

## Files This Routine Creates or Modifies
_(No explicit manifest — infer from phases below; prefer multiple focused files over one monolithic file.)_

## 2025 library chooser (compressed)
<!-- phase_id: chooser -->
### Step mui
**Action:** `verify`

Material UI (MUI): comprehensive Material Design components, strong theming/tokens, strong community. Best when you want a feature-rich kit and accept/embrace Material-ish defaults (or you’re willing to customize deeply).

### Step chakra
**Action:** `verify`

Chakra UI: prop-based styling, accessibility defaults, strong DX, easy responsive styling and dark mode. Watch CSS-in-JS runtime footprint for highly dynamic UIs.

### Step radix
**Action:** `verify`

Radix UI: headless accessible primitives (behavior, focus, keyboard). Best when you want full styling control and to build a custom design system.

### Step shadcn
**Action:** `verify`

shadcn/ui: copy-source components (Radix + Tailwind). Best when you want ownership, scalable customization, and no runtime dependency lock-in.

### Step ant
**Action:** `verify`

Ant Design: enterprise-oriented, data-heavy components (tables/forms/i18n). Best for complex admin/enterprise apps where the design language is acceptable.

### Step mantine
**Action:** `verify`

Mantine: large component set + hooks, TypeScript-friendly, dark mode. Good productivity choice when you want a complete kit with less enterprise lock-in.

### Step blueprint
**Action:** `verify`

Blueprint: dense desktop-style UIs (overlays, pickers). Best for high information density dashboards and complex interaction-heavy tools.

### Step heroui
**Action:** `verify`

HeroUI (NextUI): lightweight, modern components with dark mode; good for teams optimizing for performance and clean defaults.

### Step daisyui
**Action:** `verify`

DaisyUI: Tailwind extension with semantic class names + themes. Best for rapid prototyping when you already love Tailwind and want speed.

### Step aceternity
**Action:** `verify`

Aceternity UI: animation-rich components (often Framer Motion) for marketing/landing experiences. Use selectively so motion enhances usability, not distracts.

## Validation checklist
- [ ] Types / lint / tests pass per project standards
