---
pi_routine: "2"
id: ui-ux-for-product-managers
version: 1
intent: Turn business requirements into design-ready context and unblock
  PM↔Designer collaboration
tags:
  - ux
  - pm
  - discovery
  - collaboration
  - spec
references:
  - ui-ux-metrics-for-pms
  - ui-ux-design-process-5-stages
  - ui-ux-ui-vs-ux-clarifier
---

> **Depends on prior routines:** `.pi/routines/ui-ux-metrics-for-pms.v*.md`, `.pi/routines/ui-ux-design-process-5-stages.v*.md`, `.pi/routines/ui-ux-ui-vs-ux-clarifier.v*.md`
> Execute those routine files first (in order if numbered), then this one.

# Pi Execution Routine: ui-ux-for-product-managers

> **Target:** Any coding agent (Cursor, Claude Code, Windsurf, etc.)
> **Mode:** Specification only — the executor applies changes; Pi does not run commands.

## Context

### Existing patterns (from repo analysis)
_(none inferred — follow system style and repo conventions.)_

### Critical constraints
- ✓ MUST: Problem framing before solution framing
- ✓ MUST: Shared source of truth for journeys and research
- ✗ MUST NOT: Over-prescribe UI details without user problem context
- ◆ CONVENTION: Anchor feedback in outcomes + tradeoffs, not taste.

## Related Routines
Before this routine, the coding agent should have completed (or read) these saved routines under `.pi/routines/`:
1. `ui-ux-metrics-for-pms` — see `.pi/routines/ui-ux-metrics-for-pms.v*.md`
2. `ui-ux-design-process-5-stages` — see `.pi/routines/ui-ux-design-process-5-stages.v*.md`
3. `ui-ux-ui-vs-ux-clarifier` — see `.pi/routines/ui-ux-ui-vs-ux-clarifier.v*.md`
This document focuses on **integration / glue**; do not duplicate steps already specified there.

## Files This Routine Creates or Modifies
_(No explicit manifest — infer from phases below; prefer multiple focused files over one monolithic file.)_

## Sprint kickoff: convert spec friction into shared context
<!-- phase_id: kickoff -->
### Step core-questions
**Action:** `verify`

Answer (or explicitly mark unknown) before design starts: Who’s the user? What problem are we solving? Why now? What constraints are real (time, legal, tech, ops)? What does success look like in measurable terms?

### Step write-problem-brief
**Action:** `verify`

Create a 1-page brief: (1) user + context, (2) job-to-be-done, (3) current pain/friction, (4) desired outcome, (5) constraints, (6) non-goals, (7) risks/unknowns, (8) acceptance signals.

### Step lead-with-user-problems
**Action:** `verify`

Bring designers the underlying problem, not a UI solution. Ask: 'What are the user goals and failure modes?' then let design propose multiple flows.

### Step involve-design-early
**Action:** `verify`

Include design in discovery (user interviews, reviewing support tickets, analytics review). Designers spot assumptions earlier than a handoff at wireframe time.

### Step source-of-truth
**Action:** `verify`

Keep one living artifact for journeys + decisions (FigJam/Figma/file). Avoid '5 versions of the flow'. If the source of truth changes, link it in the ticket and kill older copies.

### Step continuous-feedback
**Action:** `verify`

Run low-stakes, frequent check-ins. Give feedback early, anchored in outcomes: 'Does this reduce onboarding friction?' Avoid 'I don’t like it' feedback unless tied to user impact.

## Validation checklist
- [ ] Types / lint / tests pass per project standards
