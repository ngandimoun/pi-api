# pi-hokage

**The Pi CLI Hokage wizard** — summons the full Pi CLI onboarding experience.

This is a lightweight wrapper that installs and runs `@pi-api/cli/hokage`, the interactive setup wizard for Pi CLI. It handles API key configuration, persona selection, project initialization, codebase learning, git hooks, CI scaffolding, and more.

## Installation

Run it directly (no install required):

```bash
npx pi-hokage@latest
```

Or install globally:

```bash
npm install -g pi-hokage
pi-hokage
```

## Flags

- `-y, --yes` — Non-interactive mode (accepts defaults for all prompts)
- `--api-key=<key>` — Pi API key (or set `PI_API_KEY` env var)
- `--base-url=<url>` — Pi API base URL (default: `https://piii-black.vercel.app`)
- `--persona=<id>` — One of: `newbie`, `normal`, `expert`, `designer`, `pm`
- `-h, --help` — Show help

## Examples

```bash
# Interactive wizard
npx pi-hokage@latest

# Non-interactive (CI-friendly)
npx pi-hokage@latest --yes --api-key=$PI_API_KEY --persona=expert

# Custom base URL
npx pi-hokage@latest --base-url=http://localhost:3000
```

## Full documentation

For the complete Pi CLI reference, see the main `@pi-api/cli` package:

- [npm: @pi-api/cli](https://www.npmjs.com/package/@pi-api/cli)
- [GitHub: ngandimoun/pi-api](https://github.com/ngandimoun/pi-api)

## License

MIT License — Copyright (c) 2026 Chris NGANDIMOUN
