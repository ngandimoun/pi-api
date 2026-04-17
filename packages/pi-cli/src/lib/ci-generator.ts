import fs from "node:fs/promises";
import path from "node:path";

export type CiProvider = "github" | "gitlab" | "circle";

const PI_CI_MARKER = "# @pi-api/cli generated";

const BASH_RUN_PI = `run_pi() {
  if [ -f pnpm-lock.yaml ]; then pnpm dlx @pi-api/cli@latest "$@";
  elif [ -f bun.lockb ] || [ -f bun.lock ]; then bunx @pi-api/cli@latest "$@";
  elif [ -f yarn.lock ]; then yarn dlx @pi-api/cli@latest "$@";
  else npx --yes @pi-api/cli@latest "$@";
  fi
}`;

const BASH_INSTALL_DEPS = `install_deps() {
  set -euo pipefail
  if [ ! -f package.json ]; then
    echo "No package.json in \\$PWD — skipping Node install (polyglot / non-JS package)."
    return 0
  fi
  if [ -f pnpm-lock.yaml ]; then
    corepack enable
    pnpm install --frozen-lockfile || pnpm install
  elif [ -f bun.lockb ] || [ -f bun.lock ]; then
    bun install
  elif [ -f yarn.lock ]; then
    corepack enable
    yarn install --immutable || yarn install
  elif [ -f package-lock.json ]; then
    npm ci
  else
    npm install || true
  fi
}`;

function githubWorkflow(): string {
  return `${PI_CI_MARKER}
name: Pi validate

on:
  pull_request:
  push:
    branches: [main, master]

# PI_CLI_ROOT: working-directory for install + validate (monorepo package).
# PI_DOT_PI_ROOT: where .pi lives for actions/cache (often "." even when PI_CLI_ROOT is apps/web).
env:
  PI_CLI_ROOT: .
  PI_DOT_PI_ROOT: .

jobs:
  pi-validate:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write
    defaults:
      run:
        working-directory: \${{ env.PI_CLI_ROOT }}
    steps:
      - uses: actions/checkout@v4

      - uses: oven-sh/setup-bun@v2
        if: hashFiles('**/bun.lockb') != '' || hashFiles('**/bun.lock') != ''
        with:
          bun-version: latest

      - uses: pnpm/action-setup@v4
        if: hashFiles('**/pnpm-lock.yaml') != ''
        with:
          version: 9

      - name: Cache .pi
        uses: actions/cache@v4
        with:
          path: \${{ env.PI_DOT_PI_ROOT }}/.pi
          key: pi-\${{ runner.os }}-\${{ hashFiles('**/pnpm-lock.yaml', '**/package-lock.json', '**/yarn.lock', '**/bun.lockb', '**/bun.lock', '.pi/system-style.json', '.pi/rules.json') }}
          restore-keys: |
            pi-\${{ runner.os }}-

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: "20"

      - name: Install dependencies
        shell: bash
        run: |
          ${BASH_INSTALL_DEPS}
          install_deps

      - name: Pi validate (strict)
        id: pi_validate
        env:
          PI_API_KEY: \${{ secrets.PI_API_KEY }}
        shell: bash
        run: |
          set -euo pipefail
          ${BASH_RUN_PI}
          set -o pipefail
          run_pi validate --strict --require-learn --no-auto 2>&1 | tee validate.log
          exit \${PIPESTATUS[0]}

      - name: Write PR comment body
        if: always() && github.event_name == 'pull_request'
        shell: bash
        env:
          PI_CLI_ROOT: \${{ env.PI_CLI_ROOT }}
        run: |
          set -euo pipefail
          root="$GITHUB_WORKSPACE"
          cpath="$root/pi-pr-comment.md"
          echo "## Pi validate" > "$cpath"
          echo "" >> "$cpath"
          echo "Step outcome: \${{ steps.pi_validate.outcome }}" >> "$cpath"
          echo "" >> "$cpath"
          echo 'Log (tail):' >> "$cpath"
          echo '\`\`\`' >> "$cpath"
          vlog="$root/$PI_CLI_ROOT/validate.log"
          if [ -f "$vlog" ]; then tail -n 200 "$vlog" >> "$cpath"; else echo "(no validate.log)" >> "$cpath"; fi
          echo '\`\`\`' >> "$cpath"

      - name: Post PR comment
        if: always() && github.event_name == 'pull_request'
        uses: marocchino/sticky-pull-request-comment@v2
        with:
          header: pi-validate
          path: pi-pr-comment.md
          GITHUB_TOKEN: \${{ secrets.GITHUB_TOKEN }}
`;
}

function gitlabCi(): string {
  return `${PI_CI_MARKER}
pi-validate:
  image: node:20-bookworm
  variables:
    NPM_CONFIG_LEGACY_PEER_DEPS: "true"
    PI_CLI_ROOT: "."
    PI_DOT_PI_ROOT: "."
  before_script:
    - cd "\${PI_CLI_ROOT:-.}"
    - npm install -g bun@latest || true
    - |
      ${BASH_INSTALL_DEPS}
      install_deps
  script:
    - cd "\${PI_CLI_ROOT:-.}"
    - |
      ${BASH_RUN_PI}
      run_pi validate --strict --require-learn --no-auto
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH
`;
}

function circleConfig(): string {
  return `${PI_CI_MARKER}
version: 2.1
jobs:
  pi-validate:
    docker:
      - image: cimg/node:20.0
    steps:
      - checkout
      - run:
          name: Install Bun + deps + Pi validate
          environment:
            PI_CLI_ROOT: "."
          command: |
            set -euo pipefail
            cd "\${PI_CLI_ROOT:-.}"
            sudo npm install -g bun@latest || true
            ${BASH_INSTALL_DEPS}
            install_deps
            ${BASH_RUN_PI}
            run_pi validate --strict --require-learn --no-auto

workflows:
  pi:
    jobs:
      - pi-validate
`;
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

export type GenerateCiResult = {
  provider: CiProvider;
  created: string[];
  skipped: string[];
  notes: string[];
};

export async function detectExistingPiCi(cwd: string): Promise<string[]> {
  const hits: string[] = [];
  const gh = path.join(cwd, ".github", "workflows");
  try {
    const files = await fs.readdir(gh);
    for (const f of files) {
      if (!f.endsWith(".yml") && !f.endsWith(".yaml")) continue;
      const p = path.join(gh, f);
      const raw = await fs.readFile(p, "utf8");
      if (raw.includes(PI_CI_MARKER) || raw.includes("pi validate")) hits.push(p);
    }
  } catch {
    /* no workflows dir */
  }
  const gl = path.join(cwd, ".gitlab-ci.yml");
  if (await pathExists(gl)) {
    const raw = await fs.readFile(gl, "utf8");
    if (raw.includes(PI_CI_MARKER) || raw.includes("pi validate")) hits.push(gl);
  }
  const cc = path.join(cwd, ".circleci", "config.yml");
  if (await pathExists(cc)) {
    const raw = await fs.readFile(cc, "utf8");
    if (raw.includes(PI_CI_MARKER) || raw.includes("pi validate")) hits.push(cc);
  }
  return hits;
}

export async function generateCiConfig(cwd: string, provider: CiProvider): Promise<GenerateCiResult> {
  const created: string[] = [];
  const skipped: string[] = [];
  const notes: string[] = [];

  if (provider === "github") {
    const dir = path.join(cwd, ".github", "workflows");
    await fs.mkdir(dir, { recursive: true });
    const out = path.join(dir, "pi-validate.yml");
    if (await pathExists(out)) {
      const prev = await fs.readFile(out, "utf8");
      if (prev.includes(PI_CI_MARKER)) {
        await fs.writeFile(out, githubWorkflow(), "utf8");
        created.push(out);
      } else {
        skipped.push(out);
        notes.push("pi-validate.yml exists (not Pi-managed); left unchanged. Remove it or merge manually.");
      }
    } else {
      await fs.writeFile(out, githubWorkflow(), "utf8");
      created.push(out);
    }
    notes.push(
      "Secrets: PI_API_KEY. Monorepo: set PI_CLI_ROOT; if .pi is at repo root set PI_DOT_PI_ROOT to \".\" and PI_CLI_ROOT to your app path."
    );
    return { provider, created, skipped, notes };
  }

  if (provider === "gitlab") {
    const out = path.join(cwd, ".gitlab-ci.yml");
    if (await pathExists(out)) {
      const prev = await fs.readFile(out, "utf8");
      if (prev.includes(PI_CI_MARKER)) {
        await fs.writeFile(out, gitlabCi(), "utf8");
        created.push(out);
      } else {
        const appendPath = path.join(cwd, ".gitlab-ci-pi.yml");
        await fs.writeFile(appendPath, `\n${gitlabCi()}\n`, "utf8");
        created.push(appendPath);
        notes.push(
          "Existing .gitlab-ci.yml not overwritten. Wrote .gitlab-ci-pi.yml — include it from your root config (e.g. include: local: .gitlab-ci-pi.yml) or merge the job manually."
        );
      }
    } else {
      await fs.writeFile(out, gitlabCi(), "utf8");
      created.push(out);
    }
    notes.push("Configure CI/CD variables PI_API_KEY and optionally PI_CLI_BASE_URL in GitLab.");
    return { provider, created, skipped, notes };
  }

  const dir = path.join(cwd, ".circleci");
  await fs.mkdir(dir, { recursive: true });
  const out = path.join(dir, "config.yml");
  if (await pathExists(out)) {
    const prev = await fs.readFile(out, "utf8");
    if (prev.includes(PI_CI_MARKER)) {
      await fs.writeFile(out, circleConfig(), "utf8");
      created.push(out);
    } else {
      const alt = path.join(dir, "config-pi.yml");
      await fs.writeFile(alt, circleConfig(), "utf8");
      created.push(alt);
      notes.push(
        "Existing .circleci/config.yml not overwritten. Wrote .circleci/config-pi.yml — merge into your workflow or replace when ready."
      );
    }
  } else {
    await fs.writeFile(out, circleConfig(), "utf8");
    created.push(out);
  }
  notes.push("Set CircleCI project environment variables PI_API_KEY and PI_CLI_BASE_URL.");
  return { provider, created, skipped, notes };
}
