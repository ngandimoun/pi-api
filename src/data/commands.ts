export type CommandAccent = "shu" | "asagi" | "kincha" | "matcha" | "fuji";
export type CommandCategory =
  | "Entry"
  | "Context"
  | "Plan"
  | "Ship"
  | "Govern"
  | "Automate"
  | "Ops"
  | "Account";

export interface CommandEntry {
  name: string;
  aliases?: string[];
  category: CommandCategory;
  summary: string;
  usage: string;
  flags?: Array<{ flag: string; description: string }>;
  example?: string;
  evidence: string;
  accent: CommandAccent;
}

export const COMMANDS: CommandEntry[] = [
  {
    name: 'pi "<text>"',
    aliases: ["pi remind"],
    category: "Entry",
    accent: "shu",
    summary:
      "Omni-router entry: translates, resumes session, routes to real subcommands. Any non-reserved first arg hits the NL planner.",
    usage: 'pi "fix the lint errors and re-run validate"',
    example: 'pi "lance une vérification et corrige" # multilingual ok',
    evidence: "packages/pi-cli/src/index.ts, lib/omni-router.ts",
  },
  {
    name: "pi init",
    category: "Context",
    accent: "asagi",
    summary: "Scaffold .pi/, default config, constitution template, optional hooks and CI.",
    usage: "pi init --with-hooks --ci github",
    flags: [
      { flag: "--with-hooks", description: "Install pre-commit + pre-push pi validate" },
      { flag: "--ci <provider>", description: "github | gitlab | circle — generate workflow" },
      { flag: "--constitution", description: "Seed .pi/constitution.md template" },
    ],
    evidence: "packages/pi-cli/src/commands/init.ts",
  },
  {
    name: "pi learn",
    category: "Context",
    accent: "kincha",
    summary: "Scan repo, build system-style fingerprint, redact secrets, optional graph.",
    usage: "pi learn --with-graph",
    flags: [
      { flag: "--with-graph", description: "Also sample a dependency graph" },
      { flag: "--async", description: "Run via Mastra workflow, poll for completion" },
    ],
    evidence: "packages/pi-cli/src/commands/learn.ts",
  },
  {
    name: "pi sync",
    category: "Context",
    accent: "asagi",
    summary: "Pull team system_style + optional graph snapshot from the API into .pi/.",
    usage: "pi sync",
    evidence: "packages/pi-cli/src/commands/sync.ts",
  },
  {
    name: "pi resonate",
    aliases: ["pi reso"],
    category: "Plan",
    accent: "fuji",
    summary:
      "Staff-Engineer multi-turn architect session. Emits markdown + optional .pi-plan.md.",
    usage: 'pi resonate "break up the checkout service"',
    flags: [
      { flag: "--workflow", description: "Run via Mastra (suspend/resume aware)" },
      { flag: "--deep", description: "Enable deep staged-to-detail mode" },
      { flag: "--plan", description: "Emit .pi-plan.md for pi execute" },
    ],
    evidence: "packages/pi-cli/src/commands/resonate.ts",
  },
  {
    name: "pi resonate-approve",
    category: "Plan",
    accent: "fuji",
    summary: "Approve a team system-style draft with an elevated key.",
    usage: "pi resonate-approve <draftId>",
    evidence: "packages/pi-cli/src/index.ts",
  },
  {
    name: "pi prompt",
    aliases: ["pi p"],
    category: "Plan",
    accent: "asagi",
    summary:
      "Compile a codebase-aware, paste-ready prompt with preflight + cache + clipboard.",
    usage: 'pi p "refactor auth context to Supabase SSR"',
    evidence: "packages/pi-cli/src/commands/prompt.ts",
  },
  {
    name: "pi routine",
    aliases: ["pi r"],
    category: "Ship",
    accent: "shu",
    summary:
      "Generate v2 routine markdown. Subcommands: templates, import, index, stats, search, next, list, --show, --upgrade.",
    usage: 'pi routine "ship Stripe checkout + webhook"',
    flags: [
      { flag: "--show <slug>", description: "Print a routine's markdown" },
      { flag: "--upgrade", description: "Upgrade routine to latest spec" },
      { flag: "--inject-ide <list>", description: "cursor,claude,cline,windsurf" },
    ],
    evidence: "packages/pi-cli/src/commands/routine.ts, routine-next.ts, template.ts",
  },
  {
    name: "pi execute",
    aliases: ["pi x"],
    category: "Ship",
    accent: "shu",
    summary: "List or complete numbered steps in .pi-plan.md; append command receipts.",
    usage: "pi execute 3",
    evidence: "packages/pi-cli/src/commands/execute.ts",
  },
  {
    name: "pi validate",
    aliases: ["pi check"],
    category: "Govern",
    accent: "matcha",
    summary:
      "Deterministic + cloud validation. Sharingan/ts-morph rules, polyglot scans, Rasengan cache.",
    usage: "pi validate --hunks-only --async",
    flags: [
      { flag: "--hunks-only", description: "Validate only changed hunks (fast path)" },
      { flag: "--async", description: "Run via workflow + poll" },
      { flag: "--json", description: "Machine-readable output" },
      { flag: "--patches", description: "Emit patches for pi fix" },
    ],
    evidence: "packages/pi-cli/src/commands/validate.ts",
  },
  {
    name: "pi fix",
    category: "Govern",
    accent: "shu",
    summary: "Apply deterministic patches (safe by default). Interactive mode available.",
    usage: "pi fix --interactive --min-confidence 0.9",
    flags: [
      { flag: "--interactive", description: "Prompt before each patch" },
      { flag: "--min-confidence <n>", description: "Filter patches (0..1)" },
      { flag: "--dry-run", description: "Print patches, apply nothing" },
    ],
    evidence: "packages/pi-cli/src/commands/fix.ts",
  },
  {
    name: "pi watch",
    category: "Govern",
    accent: "matcha",
    summary: "Chokidar watcher + optional daemon (PID, heartbeat, rotating logs).",
    usage: "pi watch --daemon",
    flags: [
      { flag: "--daemon", description: "Run detached, write .pi/watch.log" },
      { flag: "--paths <glob>", description: "Override the default watch paths" },
    ],
    evidence: "packages/pi-cli/src/commands/watch.ts",
  },
  {
    name: "pi flow",
    category: "Automate",
    accent: "fuji",
    summary: "Named pipelines: setup, check-and-fix, full-check.",
    usage: "pi flow full-check",
    evidence: "packages/pi-cli/src/commands/flow.ts",
  },
  {
    name: "pi doctor",
    category: "Ops",
    accent: "shu",
    summary:
      "API health, .pi artifacts, polyglot hints, Sharingan boundary demo, hooks/CI detection, watch status.",
    usage: "pi doctor --fix",
    flags: [{ flag: "--fix", description: "Run remediation inline" }],
    evidence: "packages/pi-cli/src/commands/doctor.ts",
  },
  {
    name: "pi resume",
    category: "Ops",
    accent: "kincha",
    summary: "Poll workflow until found; hints resume for suspended runs.",
    usage: "pi resume <runId>",
    evidence: "packages/pi-cli/src/commands/execute.ts",
  },
  {
    name: "pi trace",
    category: "Ops",
    accent: "kincha",
    summary: "Fetch workflow snapshot and debug links from API.",
    usage: "pi trace <runId>",
    evidence: "packages/pi-cli/src/commands/trace.ts",
  },
  {
    name: "pi tasks",
    category: "Ops",
    accent: "kincha",
    summary: "List, show, tree, clean, resume local task records in ~/.config/pi/tasks.json.",
    usage: "pi tasks tree",
    evidence: "packages/pi-cli/src/commands/tasks.ts",
  },
  {
    name: "pi sessions",
    category: "Ops",
    accent: "kincha",
    summary: "List or forget omnirouter / resonate sessions.",
    usage: "pi sessions list",
    evidence: "packages/pi-cli/src/commands/sessions.ts",
  },
  {
    name: "pi vcs",
    category: "Ops",
    accent: "asagi",
    summary: "Print detected VCS type, adapter name, and capabilities.",
    usage: "pi vcs",
    evidence: "packages/pi-cli/src/commands/vcs-cmd.ts",
  },
  {
    name: "pi cache",
    category: "Ops",
    accent: "asagi",
    summary: "Clear Rasengan L1/L2 or show validate API budget stats.",
    usage: "pi cache clear",
    evidence: "packages/pi-cli/src/commands/cache.ts, lib/token-budget.ts",
  },
  {
    name: "pi badge",
    category: "Ops",
    accent: "kincha",
    summary: "Insert or refresh Pi-validated README badge.",
    usage: "pi badge --refresh",
    evidence: "packages/pi-cli/src/commands/badge.ts",
  },
  {
    name: "pi intent",
    category: "Ops",
    accent: "fuji",
    summary: "Debug: print intent DSL (Byakugan) for a query.",
    usage: 'pi intent "validate my code"',
    evidence: "packages/pi-cli/src/index.ts",
  },
  {
    name: "pi auth-login",
    aliases: ["pi auth-logout", "pi auth-status"],
    category: "Account",
    accent: "shu",
    summary: "Save, verify, or clear your Pi API key globally.",
    usage: "pi auth-login",
    evidence: "packages/pi-cli/src/commands/auth.ts",
  },
];

export const CATEGORIES: CommandCategory[] = [
  "Entry",
  "Context",
  "Plan",
  "Ship",
  "Govern",
  "Automate",
  "Ops",
  "Account",
];
