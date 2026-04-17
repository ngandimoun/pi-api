# Pi CLI — universal VCS support

Pi CLI uses a small **adapter layer** so the same commands work across Git worktrees and other providers where we can supply a compatible surface.

## Adapters

| Adapter | When used |
|---------|-----------|
| `git` | `.git` present and origin is generic or undetected |
| `gitlab` | `origin` URL contains `gitlab` |
| `bitbucket` | `origin` URL contains `bitbucket` |
| `gerrit` | `origin` URL contains `gerrit` or `review.` |
| `perforce` | `P4CONFIG` / `.p4config` in the repo root, or `p4 info` succeeds |
| `unknown` | No VCS matched — commands degrade gracefully (empty diffs) |

GitLab, Bitbucket, and Gerrit use the **same local Git operations** as `git`; the label reflects **host detection** for messaging and future API hooks.

## Operations

Each adapter implements:

- Current branch / workspace label  
- Changed paths vs a ref (`HEAD` for Git)  
- Pending (working) changes  
- Unified diff hunks (`committed` vs `pending` / staged)  
- Last commit / changelist message (best effort)

## Configuration

On `pi init`, a default **`.pi/config.json`** is created if missing:

```json
{
  "version": 2,
  "vcs": {
    "type": "auto"
  }
}
```

Override detection:

```json
{
  "version": 2,
  "vcs": {
    "type": "perforce",
    "perforce": {
      "p4port": "ssl:helix:1666",
      "p4client": "my-client"
    }
  }
}
```

Set `"type"` to `git`, `gitlab`, `bitbucket`, `gerrit`, `perforce`, or `unknown`. Use `"auto"` to let the CLI detect (default).

Environment variables for Helix / Perforce are still read by the `p4` binary (`P4PORT`, `P4CLIENT`, etc.).

## Diagnostics

```bash
pi vcs
```

Shows detected type, active adapter name, capabilities, and current branch/workspace.

## Limitations

- **Perforce** integration is **CLI-based** (`p4`). Ensure `p4` is on `PATH` and the workspace is configured.
- **Gerrit / GitLab / Bitbucket** server APIs (reviews, MRs) are **not** required for local `pi validate` / `pi learn` style flows; only local Git operations are used unless extended later.
