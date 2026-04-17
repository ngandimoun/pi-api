# Pi CLI in CI

Generated workflows from `pi init --ci <provider>` or **pi-hokage** are **starting points**. Adjust them for your package manager, monorepo layout, and caching policy.

## Package managers

Templates detect lockfiles and pick install + `pi` invocation:

| Lockfile        | Install              | Pi runner        |
|----------------|----------------------|------------------|
| `pnpm-lock.yaml` | `pnpm install`       | `pnpm dlx @pi-api/cli` |
| `bun.lock` / `bun.lockb` | `bun install` via [oven-sh/setup-bun](https://github.com/oven-sh/setup-bun) | `bunx @pi-api/cli` |
| `yarn.lock`    | `yarn install`       | `yarn dlx @pi-api/cli` |
| `package-lock.json` / none | `npm ci` / `npm install` | `npx @pi-api/cli` |

Global `npm install -g @pi-api/cli` is **not** required in the GitHub template.

## Monorepos and `.pi` location (GitHub)

Set `env.PI_CLI_ROOT` to your package directory (e.g. `apps/web`). Steps use `defaults.run.working-directory` so `validate.log` and `node_modules` resolve correctly.

Set `env.PI_DOT_PI_ROOT` to the directory that contains `.pi` for caching (often `.` at the repo root even when `PI_CLI_ROOT` points at a nested package).

- **Cache**: `path: ${{ env.PI_DOT_PI_ROOT }}/.pi` — use `PI_DOT_PI_ROOT: .` when constitution DNA lives at the repo root; use the same as `PI_CLI_ROOT` only if `.pi` is inside that package.
- **PR comment**: The workflow writes `pi-pr-comment.md` at the **repository root** so the sticky comment action always finds it; the log is read from `$GITHUB_WORKSPACE/$PI_CLI_ROOT/validate.log`.

## Polyglot / no `package.json` in `PI_CLI_ROOT`

If the job’s working directory has **no** `package.json`, the generated install step **skips** Node/pnpm/yarn/npm install and still runs `pi validate` via `pnpm dlx` / `bunx` / `yarn dlx` / `npx` from whichever lockfile exists (or `npx` as fallback). Adjust `PI_CLI_ROOT` or split jobs if you need installs in another language stack.

## Caching `.pi`

GitHub Actions restores `.pi` before validate to speed cold runs. **Stale DNA risk**: if you change stack or conventions, bump cache or run `pi learn` in CI before validate, or narrow the cache key. When in doubt, delete the cache bucket for that branch.

## Team alignment

Before “cloud constitution” features:

- Run **`pi sync`** to pull shared artifacts into `.pi/`.
- Point routine discovery at your registry via **`.pi/config.json`** (see [file-management-architecture.md](./file-management-architecture.md)).

## Secrets

- **GitHub**: repository secret `PI_API_KEY`. Optional: `PI_CLI_BASE_URL` if not default.
- **GitLab / CircleCI**: set the same variables in project CI settings.
