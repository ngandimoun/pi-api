---
pi_routine: "2"
id: ui-ux-playbook
version: 1
intent: Use the right UI/UX principles module for the current task without
  loading a giant doc
tags:
  - ui
  - ux
  - playbook
  - routing
  - token-safe
references:
  - ui-ux-for-product-managers
  - ui-ux-metrics-for-pms
  - ui-ux-design-process-5-stages
  - ui-ux-ui-vs-ux-clarifier
  - ui-ux-ui-principles-7
  - ui-ux-aesthetic-usability-effect
  - ui-ux-visual-design-principles-12
  - ui-ux-principles-2026
  - frontend-design-distinctive-ui-skill
  - ui-ux-color-theory-basics
---

> **Depends on prior routines:** `.pi/routines/ui-ux-for-product-managers.v*.md`, `.pi/routines/ui-ux-metrics-for-pms.v*.md`, `.pi/routines/ui-ux-design-process-5-stages.v*.md`, `.pi/routines/ui-ux-ui-vs-ux-clarifier.v*.md`, `.pi/routines/ui-ux-ui-principles-7.v*.md`, `.pi/routines/ui-ux-aesthetic-usability-effect.v*.md`, `.pi/routines/ui-ux-visual-design-principles-12.v*.md`, `.pi/routines/ui-ux-principles-2026.v*.md`, `.pi/routines/frontend-design-distinctive-ui-skill.v*.md`, `.pi/routines/ui-ux-color-theory-basics.v*.md`
> Execute those routine files first (in order if numbered), then this one.

# Pi Execution Routine: ui-ux-playbook

> **Target:** Any coding agent (Cursor, Claude Code, Windsurf, etc.)
> **Mode:** Specification only — the executor applies changes; Pi does not run commands.

## Context

### Existing patterns (from repo analysis)
_(none inferred — follow system style and repo conventions.)_

### Critical constraints
- ✓ MUST: pi validate (use existing built-in checks before inventing new rules)
- ✗ MUST NOT: Bulk-load every .pi/routines file into an agent context
- ◆ CONVENTION: Keep only the hub + a few referenced leaves in active agent context (cap is enforced by Pi CLI).

## Related Routines
Before this routine, the coding agent should have completed (or read) these saved routines under `.pi/routines/`:
1. `ui-ux-for-product-managers` — see `.pi/routines/ui-ux-for-product-managers.v*.md`
2. `ui-ux-metrics-for-pms` — see `.pi/routines/ui-ux-metrics-for-pms.v*.md`
3. `ui-ux-design-process-5-stages` — see `.pi/routines/ui-ux-design-process-5-stages.v*.md`
4. `ui-ux-ui-vs-ux-clarifier` — see `.pi/routines/ui-ux-ui-vs-ux-clarifier.v*.md`
5. `ui-ux-ui-principles-7` — see `.pi/routines/ui-ux-ui-principles-7.v*.md`
6. `ui-ux-aesthetic-usability-effect` — see `.pi/routines/ui-ux-aesthetic-usability-effect.v*.md`
7. `ui-ux-visual-design-principles-12` — see `.pi/routines/ui-ux-visual-design-principles-12.v*.md`
8. `ui-ux-principles-2026` — see `.pi/routines/ui-ux-principles-2026.v*.md`
9. `frontend-design-distinctive-ui-skill` — see `.pi/routines/frontend-design-distinctive-ui-skill.v*.md`
10. `ui-ux-color-theory-basics` — see `.pi/routines/ui-ux-color-theory-basics.v*.md`
This document focuses on **integration / glue**; do not duplicate steps already specified there.

## Files This Routine Creates or Modifies
_(No explicit manifest — infer from phases below; prefer multiple focused files over one monolithic file.)_

## Pick the right module (fast routing)
<!-- phase_id: route -->
### Step pm-designer-pushback
**Action:** `verify`

If you’re in sprint kickoff and design is pushing back on a feature spec, open `ui-ux-for-product-managers` + `ui-ux-design-process-5-stages` and rewrite the spec as: user→problem→why→constraints→success metrics.

### Step need-metrics
**Action:** `verify`

If stakeholders need evidence, open `ui-ux-metrics-for-pms` and pick 2–3 measurable outcomes (task success rate, time on task, CSAT/NPS) tied to the roadmap decision.

### Step need-ui-principles
**Action:** `verify`

If the team needs interface-level guardrails, open `ui-ux-ui-principles-7` (checklist) + `ui-ux-visual-design-principles-12` (composition) and apply them directly to the current flow.

### Step need-polish-not-generic
**Action:** `verify`

If you need distinctive, production-grade UI (avoid 'AI slop'), open `frontend-design-distinctive-ui-skill` and use it as an agent prompt prefix (typography, color tokens, motion, backgrounds, constraints).

### Step existing-pi-checks
**Action:** `verify`

Before adding new heuristics, run `pi validate` and use the existing checks: semantic: `ux-copy-tone`, `animation-ux`, `navigation-ia`; deterministic: `a11y-images`, `no-hardcoded-hex`, `no-z-index-chaos`, `no-magic-dimensions`, `no-inline-style-object`.

**Validation:**
- pi validate

## Validation checklist
- [ ] Types / lint / tests pass per project standards
