---
pi_routine: "2"
id: ui-ux-metrics-for-pms
version: 1
intent: Choose and use UX metrics that defend roadmap tradeoffs with evidence
tags:
  - ux
  - pm
  - metrics
  - usability
  - outcomes
references: []
---

# Pi Execution Routine: ui-ux-metrics-for-pms

> **Target:** Any coding agent (Cursor, Claude Code, Windsurf, etc.)
> **Mode:** Specification only — the executor applies changes; Pi does not run commands.

## Context

### Existing patterns (from repo analysis)
_(none inferred — follow system style and repo conventions.)_

### Critical constraints
- ✓ MUST: Track metrics per flow/feature, not only global averages
- ✗ MUST NOT: Treat CSAT/NPS as early warning signals (they’re lagging)
- ◆ CONVENTION: Define metric, segment, baseline, and target before claiming success.

## Files This Routine Creates or Modifies
_(No explicit manifest — infer from phases below; prefer multiple focused files over one monolithic file.)_

## Pick the right usability metrics (fast)
<!-- phase_id: select -->
### Step task-success-rate
**Action:** `verify`

Task success rate = % of users who complete the target action (checkout, onboarding, find setting). Measure per critical flow step; a high overall success rate can hide step-level friction.

### Step time-on-task
**Action:** `verify`

Time on task = duration to complete an action. Use alongside task success rate: slow success still indicates struggle. Segment by new vs returning users and by device/context.

### Step csat-nps
**Action:** `verify`

CSAT (moment) + NPS (relationship) capture sentiment. They lag; pair with behavior metrics so you catch friction before retention drops.

### Step tie-to-goals
**Action:** `verify`

Translate UX→product outcomes: onboarding friction → activation; checkout confusion → conversion; nav IA problems → support load + retention. Pick 2–3 metrics that map to the business decision being debated.

## Operationalize (so metrics change decisions)
<!-- phase_id: operationalize -->
### Step define-success
**Action:** `verify`

For each metric: define event(s), population, segmentation, baseline, and target. Decide what change would justify re-prioritizing the roadmap (and what wouldn’t).

### Step prototype-compare
**Action:** `verify`

Use prototypes to compare options and make tradeoffs visible: UX value vs effort. When possible, do a short usability test before committing engineering time.

## Validation checklist
- [ ] Types / lint / tests pass per project standards
