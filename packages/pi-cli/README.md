# `@pi-api/cli`

Pi CLI — **Hokage Edition**: `pi learn`, `pi resonate`, `pi prompt`, `pi routine`, `pi validate`, plus the `pi-hokage` onboarding wizard.

## Install

```bash
# Recommended: summon the Hokage (also published as `pi-hokage`)
bunx pi-hokage@latest
npx pi-hokage@latest
pnpx pi-hokage@latest
yarn dlx pi-hokage@latest

# Or install the CLI package directly
npm install -g @pi-api/cli
```

### Non-interactive / CI install

```bash
# Zero prompts — accepts smart defaults for every step
npx pi-hokage@latest --yes \
  --api-key=$PI_API_KEY \
  --base-url=https://pi.yourco.com \
  --persona=expert
```

Flags: `-y` / `--yes`, `--api-key=<key>` (or `PI_API_KEY`), `--base-url=<url>` (or `PI_CLI_BASE_URL`), `--persona=<newbie|normal|expert|designer|pm>`, `-h` / `--help`.

In `--yes` mode: Pi runs `pi init`, `pi learn`, installs git hooks, generates CI configs when it detects `.github/` or `.gitlab-ci.yml`, adds a README badge if a README exists, and skips the watch daemon + global install prompts.

## Personas

During `pi-hokage`, Pi asks how you want to be spoken to. The choice is persisted in `~/.config/pi/config.json`, sent on every API call as `X-Pi-Persona`, and consumed by the Mastra agents (`cli-resonate`, `cli-architect`, `cli-enforcer`) so responses adapt to your level and role.

| Persona    | Who it's for                  | Effect on Pi responses                                                                 |
|------------|-------------------------------|----------------------------------------------------------------------------------------|
| `newbie`   | New to coding / to this stack | Explains every command, expected outcome, prerequisites, and how to verify            |
| `normal`   | Default                        | Balanced explanations; skips definitions for common terms                              |
| `expert`   | Senior engineers               | Terse; paths, diffs, exit codes only; no hand-holding                                  |
| `designer` | UI/UX focused                  | Frames everything as components, tokens, spacing, accessibility; biases UI templates   |
| `pm`       | Product managers               | Acceptance criteria, user-visible behavior, test plans; hides implementation detail    |

Resolution order: `PI_PERSONA` env var > `persona` in `.pi/config.json` (team/project override) > `persona` in `~/.config/pi/config.json` (wizard) > `"normal"`.

Change it later: re-run `pi-hokage` or export `PI_PERSONA=expert` in your shell.

## Env

- `PI_API_KEY` — Pi API key (`pi_...`), or configure via `pi auth login` / `pi-hokage`.
- `PI_CLI_BASE_URL` — API origin (default `http://localhost:3000`).
- `PI_PERSONA` — override the configured persona for the current shell (one of `newbie` / `normal` / `expert` / `designer` / `pm`). See the **Personas** section below.
- `PI_CLI_ASYNC` — set to `true` to always use async workflows (`?async=true`) for learn / validate / routine (optional; can use `--async` per command instead).
- `PI_CLI_AUTO_SYNC` — set to `true` to always run `pi sync` before validate when an API key is present (optional; by default sync also runs when `.pi/system-style.json` is missing).
- `PI_CLI_NO_AGENTIC_INJECT` — set to `1` to skip merging Pi’s marked section into `.cursorrules`, `CLAUDE.md`, `.clinerules`, and `.windsurf/rules/pi-context.md` after `pi learn` / `pi routine`.
- **Pi watch (daemon / observable)** — `PI_CLI_WATCH_HEARTBEAT_MS` (default 10000), `PI_CLI_WATCH_STALE_MS` (default 45000, used by `pi watch --status`), `PI_CLI_WATCH_LOG_MAX_BYTES` (~1.5MB, log rotation), `PI_CLI_WATCH_DEBOUNCE_MS` (file watcher debounce).

## CI templates

Generated workflows are documented in [`docs/cli/ci.md`](../../docs/cli/ci.md) (package managers, monorepo `PI_CLI_ROOT`, `.pi` cache caveats, secrets).

## File layout and agent handoff

- **Cloud generates, CLI writes** — routines and `system-style.json` are persisted under **`.pi/`** by the local CLI after API responses.
- **Token-aware IDE hints** — after `pi learn` or `pi routine`, the CLI updates a small auto-managed block in common agent config files (only when those files already exist, except `.clinerules` / `.windsurf/rules/pi-context.md` which are Pi-specific). Routine paths injected for a run are **primary + references + optional API id lists**, never the whole `routines/` folder.
- **Details:** see [`docs/cli/file-management-architecture.md`](../../docs/cli/file-management-architecture.md).

## Universal entrypoint (Omni-Router)

Run natural language **without** a subcommand:

```bash
pi "audit my uncommitted changes"
pi "construire un tableau de bord avec Recharts"   # any language — server normalizes intent
```

Behavior:

1. **Multilingual** — calls the NLP plan API (`pi remind` uses the same planner). Detected locale + normalized (English) intent are logged when non-English.
2. **VCS-aware fallbacks** — if the API is offline, local heuristics use your working tree (Git, GitLab/Bitbucket/Gerrit hosts, Perforce via `p4`, etc.; see `pi vcs`).
3. **Multi-step chains** — e.g. `validate → fix` when the plan or heuristics call for it. You’ll see `◐ Execution plan: validate → fix`.

Flags: `--force-resonate`, `--force-routine` (same as before).

## Implicit preflight (dependency chaining)

Several commands **hydrate context** before doing work (unless you opt out):

| Command | Auto behavior |
|--------|----------------|
| `pi validate` / `pi check` | `pi init` if `.pi/` missing → `pi sync` when API key exists and style is missing (or `PI_CLI_AUTO_SYNC=true`) → `pi learn` if rules still missing |
| `pi fix` | `pi init` if needed → deterministic “validate-style” scan, then autofix |
| `pi prompt` / `pi p`, `pi routine "<intent>"` | `pi init` → optional `pi sync` → `pi learn` if needed (API errors are warned, not fatal) |
| `pi resonate`, `pi watch` | `pi init` if `.pi/` missing |

**Opt out:** `--no-auto` on `validate`, `check`, `fix`, `prompt`, `p`, `routine` (generate path), `resonate`, `watch`. For validate / routine / prompt you can also use `--skip-learn` or `--skip-sync` to fine-tune.

## Universal VCS

- **`pi vcs`** — prints detected provider (Git / GitLab / Bitbucket / Gerrit / Perforce / unknown) and adapter capabilities.
- **Config** — optional `.pi/config.json` with `"vcs": { "type": "auto" | "git" | "perforce" | ... }` (created by `pi init` if missing). See [`docs/cli/vcs-support.md`](../../docs/cli/vcs-support.md).

## Agent task tracking

- **`pi tasks`** — list active (pending/running) tasks for this repo.
- **`pi tasks show <task_id>`** / **`pi tasks tree <root_id>`** — inspect steps.
- **`pi tasks clean`** — prune old completed tasks.
- **`pi tasks resume [session_id]`** — show where work stopped and suggest `pi resume <runId>` or `pi resonate … --session …`.
- **Dropped connection / timeout** — async `validate` / `learn` / `routine` print a **“Pick up where you left off”** block with `pi resume <runId>`; `pi tasks` repeats the resume line when a workflow id is stored so you do not restart from scratch.
- Details: [`docs/cli/task-tracking.md`](../../docs/cli/task-tracking.md).

## Commands

- `pi init` — create `.pi/` scaffold. **`--with-hooks`** installs Pi-managed Git hooks (pre-commit / pre-push). **`--ci github`** / **`--ci gitlab`** / **`--ci circle`** (repeatable) writes CI templates (`pi-hokage` can do the same interactively).
- `pi watch` — realtime deterministic checks on save. **`--daemon`** spawns a child with **`.pi/.watch.lock`**, **`.pi/.watch-health.json`**, **`.pi/logs/watch.log`** (rotating), and **`.pi/.watch-pid.json`**. **`--status`** uses heartbeat freshness (not only `kill -0`). **`--stop`** clears state. **`--foreground`** runs in this terminal with log + heartbeat; **`--daemon --foreground`** runs the daemon inline (debug).
- `pi badge` — insert or refresh a Pi badge in `README.md` (`--dry-run`, `--copy`, optional **`--dynamic-url`**).
- `pi learn` — structural scan → `.pi/system-style.json` (`--with-graph`, `--async`, `--dry-run`)
- `pi resonate "<intent>"` — **Staff Engineer** multi-turn terminal session: challenges your feature idea using repo + `system-style.json` + optional `.pi/constitution.md` (no code generation). Saves `.pi/resonance/<slug>-<date>.md` (decisions, claims, exit criteria) for handoff to `pi routine` or Cursor. Flags: **`--mode explore|challenge|decision`**, **`--staged`** (diff-aware), **`--deep`** (excerpts + follow-up pulls from `files_likely_touched`), **`--resume <file>`**, **`--export`** (print `pi routine` handoff), **`--with-violations <validate.json>`**, **`--no-save`**. **`--with-excerpts`** is an alias for **`--deep`**.
- `pi prompt "<intent>"` (alias: **`pi p`**) — **Prompt compiler**: turns a vague request into a paste-ready, codebase-aware instruction for Cursor / Claude / Windsurf (uses `system-style.json` + repo context + server memory/graph). Shows **context quality**, a **memory highlight**, **diff vs last run** (`.pi/prompt-cache/`), **next-step** hints (`pi routine` / `pi validate`), and optional **y/n feedback** (stored in Pi memory). **`--raw`** prints prompt only; **`--no-copy`** skips clipboard; **`--with-excerpts`** sends redacted snippets for deeper hints.
- `pi routine "<intent>"` — **Architect** routine → `.pi/routines/<slug>.v<n>.md` (Pi routine v2: YAML + **`files_manifest`** + phased steps). Sends local repo context (paths, import histogram, **metadata for v2 routines** for smarter matching); **`--with-excerpts`** adds redacted snippets for AST. **`--format cursor,claude,windsurf`** also writes agent rule files. **`--list`** / **`--tags`** / **`--show`** / **`--upgrade <file>`** manage the library. Generation is **v2-only** (no legacy Markdown fallback server-side).
- `pi validate [intent]` / `pi check [intent]` — Sharingan deterministic rules + cloud semantic merge (`--async`, `--hunks-only`, `--staged`). When issues are found, suggests **`pi prompt "fix these …"`**.
- `pi intent "<query>"` — Byakugan intent DSL (debug)
- `pi auth-status` / `pi auth-login --api-key ...` / `pi auth-logout` — credentials
- `pi tasks` / `pi vcs` — task audit trail and VCS diagnostics (see sections above)

See the Pi API docs for HTTP counterparts under `/api/cli/*` (including `/api/cli/workflow/poll` for async runs).
