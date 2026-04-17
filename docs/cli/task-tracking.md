# Pi CLI — task tracking

The CLI records **best-effort task trees** for major commands so you can see what ran and where work stopped.

## Storage

- Tasks are stored in the user config store: `~/.config/pi/tasks.json` (via `conf`).
- Each task has a `cwd_fingerprint` (hash of the resolved repo path) so listings are scoped per machine/path.

## Commands

| Command | Purpose |
|--------|---------|
| `pi tasks` | List **active** tasks (pending / running) for the current repo |
| `pi tasks show <task_id>` | Print task JSON and step list |
| `pi tasks tree <root_task_id>` | Print a task hierarchy |
| `pi tasks clean` | Prune old completed tasks |
| `pi tasks resume [session_id]` | Show sessions with in-progress work and suggest `pi resume <runId>` or `pi resonate … --session …` |

## Instrumented commands

Parent tasks and steps are created for:

- `pi validate` / `pi check`
- `pi learn`
- `pi routine` (generate path)
- `pi prompt` / `pi p`
- `pi fix`
- `pi sync`
- `pi resonate`

## Sessions vs tasks

- **`pi sessions`** — omnirouter / resonate **chat** sessions (transcript + thread id).
- **`pi tasks`** — structured **steps** inside CLI commands (preflight, API, write, etc.).

Use **`pi tasks resume`** to connect workflow run ids with resonate sessions when present.

## Relationship to `pi resume`

- **`pi resume <runId>`** — resumes a **suspended Mastra workflow** (unchanged).
- **`pi tasks resume`** — helps you find **where you stopped** and which `runId` or `--session` to use next.

## After a disconnect or timeout

If the network drops while `pi validate`, `pi learn`, or `pi routine` is polling a cloud workflow, the CLI:

1. **Keeps the last `run_id` on the root task** (when async was used).
2. Prints a **“Pick up where you left off”** block with:
   - `pi resume <runId>` — server-side workflow may still be running or suspended
   - `pi trace <runId>` — inspect state
   - `pi tasks` — see recorded steps
   - `pi tasks resume` — match sessions to checkpoints

You do **not** need to redo local scans from scratch: reconnect and use `pi resume` with the id from the error output or from `pi tasks`.

`pi tasks` also prints a short reminder when listing active work so you know where to continue without starting over.
