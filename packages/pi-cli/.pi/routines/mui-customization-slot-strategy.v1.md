---
pi_routine: "2"
id: mui-customization-slot-strategy
version: 1
intent: Choose the right customization strategy for complex UI components
  without exploding API surface area
tags:
  - mui
  - customization
  - slots
  - theming
  - componentsProps
  - scaling
references: []
---

# Pi Execution Routine: mui-customization-slot-strategy

> **Target:** Any coding agent (Cursor, Claude Code, Windsurf, etc.)
> **Mode:** Specification only — the executor applies changes; Pi does not run commands.

## Context
**Framework / stack:** Material UI

### Existing patterns (from repo analysis)
_(none inferred — follow system style and repo conventions.)_

### Critical constraints
- ✓ MUST: Use slots to replace independent internal parts (icons/panels/toolbars)
- ✓ MUST: Use slotProps/componentsProps to pass scoped props
- ✗ MUST NOT: Add endless props for every micro-customization (doesn't scale)
- ◆ CONVENTION: Prefer scoping: props for a slot live together; keep TypeScript autocomplete effective.

## Files This Routine Creates or Modifies
_(No explicit manifest — infer from phases below; prefer multiple focused files over one monolithic file.)_

## Style modification options
<!-- phase_id: style -->
### Step css-specificity
**Action:** `verify`

Good old CSS: override default styles with more specific selectors (e.g., two classes beats one). Works well for visual tweaks but can get messy at scale.

### Step css-in-js
**Action:** `verify`

Let JS generate CSS: co-locate styling with components (theme/sx/styled). Improves ergonomics but still needs discipline to avoid scattered one-off styling.

## Logic modification options (what scales?)
<!-- phase_id: logic -->
### Step add-prop
**Action:** `verify`

Add a prop when it impacts the whole component. Works for simple components, but complex components will explode API surface if you add a prop for every case.

### Step headless-hooks
**Action:** `verify`

Headless approach: expose hooks for features (filtering/sorting/etc.) and let teams build UI. Maximum scalability + control, but highest build effort.

### Step subcomponents
**Action:** `verify`

Subdivide into subcomponents: high flexibility but easy to misuse (wrong nesting/order can break behavior). Good for full-app frameworks, riskier for low-level building blocks.

## Slot strategy (the scalable middle path)
<!-- phase_id: slots -->
### Step override-slot
**Action:** `verify`

Override internal parts via slots (e.g., replace a delete icon in a filter panel). Use when the internal part is independent and commonly swapped.

### Step slot-props
**Action:** `verify`

Pass props to existing internal slots via slotProps/componentsProps (e.g., configure filter panel behavior without rewriting the whole panel). This keeps customizations scoped and TypeScript-friendly.

### Step when-to-add-slots
**Action:** `verify`

Add slots for icons and semi-independent panels/menus/toolbars. Add props only when they affect the entire component. Use headless hooks only when you truly need to rebuild the UI from scratch.

## Validation checklist
- [ ] Types / lint / tests pass per project standards
