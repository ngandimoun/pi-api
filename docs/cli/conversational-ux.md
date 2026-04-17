# Pi CLI Conversational UX

This document describes the conversational Staff Engineer experience in Pi CLI — the features that make talking to Pi feel like pair-programming with an experienced architect.

## Vision

Pi should feel like the conversation you just had while building it:
- **Propose an idea** → Pi challenges it with evidence from your codebase
- **Debate tradeoffs** → Pi references past decisions and existing patterns  
- **Reach consensus** → Pi generates executable blueprint
- **No manual context** → Pi auto-detects when it needs to learn your repo

## Features

### 1. Natural Language Entry Point

**Usage:**
```bash
pi "add billing with Stripe"
pi "should we use Redis or in-memory cache?"
pi "refactor auth to use middleware"
```

**How it works:**
- **No subcommand needed** — just talk to Pi naturally
- **Auto-routing** — Pi detects whether you need:
  - `resonate` (architecture discussion)
  - `routine` (generate implementation spec)
  - `validate` (check existing code)
- **Session resumption** — Pi remembers in-flight conversations and offers to continue
- **Multilingual** — Works in any language (polyglot router translates to English)

**Implementation:**
- `packages/pi-cli/src/lib/omni-router.ts` — Main routing logic
- `packages/pi-cli/src/lib/intent-classifier.ts` — Heuristic classification
- `packages/pi-cli/src/lib/execution-planner.ts` — Multi-step plan generation

---

### 2. Proactive Context Injection

**Problem:** Users forget to run `pi learn` before starting

**Solution:** Pi auto-detects stale context and suggests refreshing

**Triggers:**
- No `system-style.json` exists → Critical: blocks until learn runs
- System style >7 days old → Warning with suggestion
- `package.json` changed recently → Suggests re-running learn
- Minimal system style data → Suggests `--with-graph`

**UX Example:**
```
⚠️  Context may be stale
   • System style is 12 days old
   • Dependencies changed since last learn

💡 Suggestions:
   Run `pi learn` to refresh codebase understanding

? Run `pi learn` now to build context? (Y/n)
```

**Implementation:**
- `packages/pi-cli/src/lib/context-health.ts` — Health checks
- Integrated into `omni-router.ts` and `resonate.ts`

---

### 3. Rich CLI Status Display

**Before:**
```
... waiting for workflow (23s, tick 12)
```

**After:**
```
🧠 Analyzing your request
  Understanding what you want to build...
  ✓ Intent classified (0.8s)

📚 Loading codebase context
  Pulling system style, memory, and repo metadata...
  ✓ Context loaded (1.2s)

🔍 Querying dependency graph
  Checking import graph for blast radius...
  ✓ Found 12 affected files (0.5s)

⚖️  Evaluating tradeoffs
  Weighing different approaches and their implications...
  ✓ Complete (3.1s)

⏱️  Total: 5.6s
```

**Modes:**
- **Minimal** (non-TTY / quiet mode) — dots only
- **Rich** (default) — phase labels + timing
- **Verbose** (`--deep`, `--verbose`) — sub-actions logged

**Phases tracked:**
- `analyzing-intent`
- `loading-context`
- `querying-graph`
- `reading-codebase`
- `checking-patterns`
- `evaluating-tradeoffs`
- `generating-plan`
- `validating-approach`

**Implementation:**
- `packages/pi-cli/src/lib/rich-status.ts` — `RichStatusDisplay` class
- `packages/pi-cli/src/lib/workflow-client.ts` — Enhanced spinner with frames

---

### 4. Persistent Multi-Session Learning

**Problem:** Pi forgets architectural decisions across sessions

**Solution:** Cross-session pattern learning with confidence scoring

**What Pi learns:**
- **Tech choices** — "Last time you added billing, you used Trigger.dev webhooks"
- **Code patterns** — "Your team prefers Server Actions over API routes"
- **Constraints** — "Always use Supabase RLS for auth, never custom middleware"
- **Team preferences** — "Use Zustand for client state, not Redux"

**Storage:**
```typescript
{
  pattern_id: "abc123-billing-1234567890",
  cwd_fingerprint: "hash-of-repo-path",
  pattern_type: "tech_choice",
  category: "billing",
  description: "Use Trigger.dev for webhook processing with Stripe",
  confidence: 0.8,
  evidence: [".pi/resonance/billing-2026-04-15.md", "src/trigger/stripe-webhook.ts"],
  learned_at: 1713196800000,
  last_reinforced: 1713196800000,
  reinforcement_count: 3
}
```

**Confidence scoring:**
- Initial pattern: 0.5
- Each reinforcement: +0.1 (max 1.0)
- Sorted by `confidence * recency`

**Categories auto-detected:**
- billing, auth, webhooks, database, api_routes, state_management, caching, notifications

**UX Example:**
```
💡 Recalling past patterns:
   • Use Trigger.dev for webhook processing with Stripe (80% confidence)
   • Always validate webhook signatures before processing (95% confidence)
```

**Implementation:**
- `packages/pi-cli/src/lib/session-learning.ts` — Pattern recording & recall
- Integrated into `resonate.ts` — learns from completed sessions
- Stored in `~/.config/pi/learnings.json` (Conf library)

---

### 5. Inline Tool Call Visibility

**Problem:** Users don't know what Pi is doing behind the scenes

**Solution:** Live logging of tool executions with rich formatting

**UX Example:**
```
📋 query-system-style
  → Checking conventions for auth patterns...
  ✓ Found 3 auth-related rules (0.23s)

🔍 query-dependency-graph "src/lib/auth.ts"
  → Tracing dependents of auth module...
  ✓ 12 files import this module (0.51s)

🔬 extract-ast-snippet "src/middleware/auth.ts"
  → Parsing middleware signature...
  ✓ Extracted 3 function signatures (0.18s)

💥 blast-radius
  → Analyzing impact of changing auth interface...
  ✓ High impact: 12 files, 5 tests affected (0.89s)
```

**Tool icons:**
- 📋 `query-system-style`
- 🔍 `query-dependency-graph`
- 🔬 `extract-ast-snippet`
- 💥 `blast-radius`
- 🔎 `prerequisite-scanner`
- 🏗️ `architectural-boundary`

**Features:**
- Timing per tool call
- Parameter preview (truncated)
- Success/error status
- Progress updates during execution

**Implementation:**
- `packages/pi-cli/src/lib/tool-call-logger.ts` — `ToolCallLogger` class
- `withToolCallLogging()` helper for wrapping async tool calls
- Global logger initialized in `resonate.ts`

---

## Adoption Path

### For New Users

1. **First command:**
   ```bash
   pi "add user authentication"
   ```

2. **Pi responds:**
   ```
   ⚠️  Context may be stale
      • Pi hasn't learned your codebase yet
   
   💡 Suggestions:
      Run `pi learn` to scan your repo (takes ~10s)
   
   ? Run `pi learn` now to build context? (Y)
   ```

3. **After learn:**
   ```
   💬 Pi is analyzing your request...
   
   🧠 Analyzing your request
     Understanding what you want to build...
   
   🤖 Pi (Staff Engineer):
   I see you want to add authentication. Looking at your stack:
   - Next.js App Router
   - Supabase (detected from imports)
   
   Before we architect this, I have questions:
   1. Do you need social login (Google/GitHub)?
   2. Are you using Supabase Auth or custom?
   3. Session storage: cookies or JWT?
   ```

4. **Multi-turn conversation continues...**

### For Returning Users

```bash
pi "add billing"

💡 Recalling past patterns:
   • Last time: used Trigger.dev for webhooks (80% confidence)
   • Team preference: Server Actions over API routes (95% confidence)

🤖 Pi:
Based on your past billing work, I recommend:
- Stripe for payments (you're already using it)
- Trigger.dev webhook handler (pattern from last month)
- Server Actions for checkout flow (team convention)

Should we follow this pattern or explore alternatives?
```

---

## Technical Architecture

### Data Flow

```
User Input
    ↓
Omni Router (NL parsing)
    ↓
Context Health Check → Auto-suggest learn if stale
    ↓
Session Resume Check → Match existing conversation
    ↓
Pattern Recall → Load past decisions
    ↓
Rich Status Display (START)
    ↓
Resonate / Routine / Validate
    ↓
Tool Call Logging (live updates)
    ↓
Rich Status Display (PHASES)
    ↓
Response Generation
    ↓
Pattern Learning (record decision)
    ↓
Rich Status Display (COMPLETE)
```

### File Organization

```
packages/pi-cli/src/lib/
├── omni-router.ts           # Natural language entry point
├── context-health.ts        # Stale detection & auto-suggest
├── rich-status.ts           # Visual thinking indicators
├── tool-call-logger.ts      # Live tool execution logging
├── session-learning.ts      # Cross-session pattern recall
├── session-store.ts         # Multi-turn conversation storage
├── workflow-client.ts       # Enhanced workflow poller
└── intent-classifier.ts     # Heuristic intent detection

packages/pi-cli/src/commands/
└── resonate.ts              # Integrates all 5 features
```

### Configuration

**Environment Variables:**
- `PI_CLI_ENABLE_MEMORY=true` — Enable Mastra Memory (requires Postgres)
- `PI_CLI_MEMORY_RECALL_LIMIT=5` — Number of past patterns to recall
- `PI_CLI_STREAMING_THRESHOLD=200` — Files before switching to chunked scan
- `PI_CLI_NO_AGENTIC_INJECT=1` — Disable IDE hint injection

**User Config:**
- `~/.config/pi/sessions.json` — Active conversation threads
- `~/.config/pi/learnings.json` — Architectural patterns learned
- `.pi/system-style.json` — Codebase conventions (per repo)
- `.pi/resonance/*.md` — Saved architectural discussions

---

## Performance

### Benchmarks

**Cold start (no context):**
- Omni router: ~100ms
- Context health check: ~50ms
- Pattern recall: ~20ms
- **Total overhead: ~170ms**

**Warm start (context exists):**
- Omni router: ~80ms
- Pattern recall: ~15ms
- **Total overhead: ~95ms**

**Learn command:**
- Small repo (50 files): ~2s
- Medium repo (500 files): ~8s
- Large repo (2000+ files): switches to streaming (chunked scan)

---

## Future Enhancements

### Planned

1. **Voice input** — `pi --voice` for hands-free pair programming
2. **Multi-repo learning** — Share patterns across team's repos
3. **Confidence decay** — Old patterns lose confidence over time
4. **Pattern conflicts** — Detect when two patterns contradict
5. **Team voting** — Multiple devs reinforce/reject patterns

### Ideas

- **Auto-fix** — Pi suggests running `pi fix` after detecting violations
- **Live file watching** — `pi watch` triggers context refresh on package.json changes
- **Session replays** — Replay past resonance sessions for training
- **Pattern export** — Share learnings as `.pi/patterns.json` in repo

---

## Troubleshooting

### "Context may be stale" appears every time

**Cause:** System style file is genuinely old or empty

**Fix:**
```bash
pi learn --with-graph
```

### Tool call logging is too verbose

**Fix:**
```bash
export PI_CLI_TOOL_LOGGING=false
```

Or edit `~/.config/pi/config.json`:
```json
{
  "tool_logging": false
}
```

### Patterns not being recalled

**Check:**
1. Patterns stored: `cat ~/.config/pi/learnings.json`
2. Category detection: Does your intent include keywords? (billing, auth, etc.)
3. Confidence too low: Patterns below 0.3 confidence are filtered

### Omni router not triggering resonate

**Cause:** Intent doesn't match architecture signals

**Fix:** Force resonate mode:
```bash
pi --force-resonate "your intent"
```

Or use explicit command:
```bash
pi resonate "your intent"
```
