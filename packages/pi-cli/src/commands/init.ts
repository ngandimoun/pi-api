import fs from "node:fs/promises";
import path from "node:path";
import chalk from "chalk";
import fg from "fast-glob";
import { PI_CACHE_DIR, PI_CONSTITUTION_FILE, PI_RESONANCE_DIR, PI_ROUTINES_DIR, SYSTEM_STYLE_FILE } from "../lib/constants.js";
import { showHokageArt } from "../lib/anime-art.js";
import { defaultPiConfigJson } from "../lib/pi-project-config.js";
import {
  detectFrameworksFromDeps,
  mergePackageDeps,
  type FrameworkDetection,
} from "../lib/stack-detection.js";
import { installGitHooks } from "../lib/git-hooks-installer.js";
import { generateCiConfig, type CiProvider } from "../lib/ci-generator.js";
import { getPersona } from "../lib/config.js";
import { formatCommandBlock } from "../lib/persona.js";
import { readPiProjectConfig } from "../lib/pi-project-config.js";

export type RunInitOpts = {
  /** Skip banner + long footer (e.g. when `pi-hokage` already printed progress). */
  quiet?: boolean;
  /** Install Pi-managed git hooks after scaffold. */
  withHooks?: boolean;
  /** Generate CI configs for these providers. */
  ci?: CiProvider[];
};

export function parseCiProviders(raw: string | string[] | undefined): CiProvider[] {
  const parts: string[] = [];
  if (Array.isArray(raw)) {
    for (const r of raw) parts.push(...String(r).split(","));
  } else if (raw) {
    parts.push(...String(raw).split(","));
  }
  const out: CiProvider[] = [];
  for (const part of parts) {
    const p = part.trim().toLowerCase();
    if (p === "github" || p === "gitlab" || p === "circle") out.push(p);
  }
  return out;
}


async function detectFrameworks(cwd: string): Promise<{
  frameworks: FrameworkDetection[];
  deps: Record<string, string>;
}> {
  try {
    const raw = await fs.readFile(path.join(cwd, "package.json"), "utf8");
    const pkg = JSON.parse(raw) as Record<string, unknown>;
    const deps = mergePackageDeps(pkg);
    const frameworks = detectFrameworksFromDeps(deps);

    try {
      await fs.access(path.join(cwd, "components.json"));
      if (!frameworks.some((f) => f.name === "shadcn/ui")) {
        frameworks.push({ name: "shadcn/ui" });
      }
    } catch {
      /* no components.json */
    }

    return { frameworks, deps };
  } catch {
    return { frameworks: [], deps: {} };
  }
}

async function scanCodebaseQuick(cwd: string): Promise<{
  componentCount: number;
  apiRouteCount: number;
  totalFiles: number;
}> {
  try {
    const allFiles = await fg("**/*.{ts,tsx,js,jsx}", {
      cwd,
      ignore: ["**/node_modules/**", "**/.next/**", "**/dist/**", "**/.pi/**"],
    });

    const componentFiles = allFiles.filter(
      (f) => f.endsWith(".tsx") || f.endsWith(".jsx")
    );
    const apiRoutes = allFiles.filter(
      (f) => f.includes("/api/") && (f.endsWith("route.ts") || f.endsWith("route.js"))
    );

    return {
      componentCount: componentFiles.length,
      apiRouteCount: apiRoutes.length,
      totalFiles: allFiles.length,
    };
  } catch {
    return { componentCount: 0, apiRouteCount: 0, totalFiles: 0 };
  }
}

function buildConstitutionDefaults(frameworks: FrameworkDetection[]): string {
  const lines = [
    "# Pi Constitution",
    "",
    "Non-negotiable architectural rules for this project.",
    "Pi will enforce these during `pi resonate` and `pi validate`.",
    "",
    "## General",
    "",
    "- All code must be TypeScript with strict mode enabled.",
    "- No `any` types unless explicitly justified with a comment.",
    "- All exported functions must have return types.",
    "",
  ];

  const names = new Set(frameworks.map((f) => f.name));

  if (names.has("Next.js")) {
    lines.push(
      "## Next.js",
      "",
      "- Use Server Components by default. Only add \"use client\" when interactive state is required.",
      "- Mutations must use Server Actions or API route handlers — never client-side fetch to internal endpoints.",
      "- Layouts must remain Server Components. Use a dedicated `<Providers>` client wrapper for context.",
      "- All API routes must validate input with Zod.",
      ""
    );
  }

  if (names.has("React")) {
    lines.push(
      "## React",
      "",
      "- Prefer composition over inheritance.",
      "- Custom hooks must start with `use` and be in dedicated files.",
      "- Memoize expensive computations; do not over-optimize trivially cheap renders.",
      ""
    );
  }

  if (names.has("Prisma") || names.has("Drizzle ORM") || names.has("Supabase")) {
    lines.push(
      "## Database",
      "",
      "- All schema changes require a migration file.",
      "- Never expose raw database errors to the client.",
      "- Use transactions for multi-table mutations.",
      ""
    );
  }

  if (names.has("Stripe")) {
    lines.push(
      "## Payments",
      "",
      "- Stripe webhook handlers must verify signatures using the raw request body.",
      "- Never trust client-side price calculations — always validate server-side.",
      ""
    );
  }

  if (names.has("shadcn/ui") || names.has("Radix UI")) {
    lines.push(
      "## shadcn / Radix",
      "",
      "- Prefer composable primitives; keep behavior accessible (keyboard, focus, ARIA).",
      "- Use the project's `cn()` / class merge helper for Tailwind class composition.",
      ""
    );
  }

  if (names.has("Chakra UI")) {
    lines.push(
      "## Chakra UI",
      "",
      "- Use semantic tokens and theme for colors — avoid hardcoded hex in components.",
      "- Respect ColorMode: test light/dark or use `useColorMode` consistently.",
      ""
    );
  }

  if (names.has("Material UI")) {
    lines.push(
      "## Material UI",
      "",
      "- Prefer MUI theming (`theme`, `sx`, or styled) over one-off inline styles.",
      "- Use the v5+ `slot` / composition patterns where applicable for customization.",
      ""
    );
  }

  if (names.has("Mantine")) {
    lines.push(
      "## Mantine",
      "",
      "- Configure MantineProvider once at the app root; avoid duplicate providers.",
      "- Use Mantine form + zod (or project validator) for complex forms.",
      ""
    );
  }

  if (names.has("Headless UI")) {
    lines.push(
      "## Headless UI",
      "",
      "- Pair unstyled primitives with your design system; do not strip accessibility props.",
      "- Manage open/close state explicitly for dialogs, menus, and listbox.",
      ""
    );
  }

  if (names.has("Vercel AI SDK")) {
    lines.push(
      "## AI (Vercel AI SDK)",
      "",
      "- Stream responses where UX allows; handle errors and cancellation cleanly.",
      "- Never send secrets or PII to the model; validate tool inputs with Zod.",
      "- Rate-limit and monitor token usage for user-facing endpoints.",
      ""
    );
  }

  if (names.has("LangChain")) {
    lines.push(
      "## LangChain",
      "",
      "- Keep chains and tools typed; version prompts and document expected outputs.",
      "- Isolate retrieval and tool side effects from UI layers.",
      ""
    );
  }

  if (names.has("OpenAI SDK") || names.has("Anthropic SDK") || names.has("Google Generative AI")) {
    lines.push(
      "## LLM SDKs",
      "",
      "- Use environment-driven API keys; never commit keys or log full prompts with secrets.",
      "- Handle rate limits and retries with backoff; surface user-friendly errors.",
      ""
    );
  }

  if (names.has("Mastra")) {
    lines.push(
      "## Mastra (agents & workflows)",
      "",
      "- Prefer workflows for deterministic multi-step pipelines; agents for open-ended tasks.",
      "- Tools must be typed (Zod) and return structured output.",
      "- Keep model selection environment-driven (`PI_MASTRA_DEFAULT_MODEL` / project conventions).",
      ""
    );
  }

  if (names.has("Express") || names.has("Fastify") || names.has("NestJS") || names.has("Hono")) {
    lines.push(
      "## HTTP backend",
      "",
      "- Validate all inputs at the boundary (Zod or framework equivalent).",
      "- Centralize error handling and consistent JSON error shapes.",
      "- Authenticate before authorization; log without leaking secrets.",
      ""
    );
  }

  if (names.has("tRPC")) {
    lines.push(
      "## tRPC",
      "",
      "- Define procedures with explicit input/output types; use middleware for auth.",
      "- Do not expose internal errors to clients — map to safe error codes.",
      ""
    );
  }

  if (
    names.has("Mongoose") ||
    names.has("TypeORM") ||
    names.has("Sequelize") ||
    names.has("Knex")
  ) {
    lines.push(
      "## SQL/ODM (beyond Prisma/Drizzle)",
      "",
      "- Migrations or tracked schema changes required for production.",
      "- Parameterize queries; never concatenate user input into raw SQL.",
      ""
    );
  }

  lines.push(
    "## Security",
    "",
    "- No secrets in source code. All credentials via environment variables.",
    "- Sanitize all user input before database queries.",
    "- API routes must authenticate requests before processing.",
    ""
  );

  return lines.join("\n");
}

export async function runInit(cwd: string, opts?: RunInitOpts): Promise<void> {
  // Create directory structure
  await fs.mkdir(path.join(cwd, ".pi"), { recursive: true });
  await fs.mkdir(path.join(cwd, PI_CACHE_DIR), { recursive: true });
  await fs.mkdir(path.join(cwd, PI_ROUTINES_DIR), { recursive: true });
  await fs.mkdir(path.join(cwd, PI_RESONANCE_DIR), { recursive: true });

  const configPath = path.join(cwd, ".pi", "config.json");
  try {
    await fs.access(configPath);
  } catch {
    await fs.writeFile(configPath, defaultPiConfigJson(), "utf8");
  }

  const rulesPath = path.join(cwd, ".pi", "rules.json");
  try {
    await fs.access(rulesPath);
  } catch {
    await fs.writeFile(rulesPath, JSON.stringify({ rules: {}, ignorePatterns: [] }, null, 2) + "\n", "utf8");
  }

  // system-style.json stub
  const stylePath = path.join(cwd, SYSTEM_STYLE_FILE);
  try {
    await fs.access(stylePath);
  } catch {
    await fs.writeFile(
      stylePath,
      JSON.stringify(
        {
          version: 0,
          note: "Run `pi learn` to populate system-style.json",
        },
        null,
        2
      ),
      "utf8"
    );
  }

  // Framework detection
  const { frameworks } = await detectFrameworks(cwd);

  // Constitution scaffolding
  const constitutionPath = path.join(cwd, PI_CONSTITUTION_FILE);
  try {
    await fs.access(constitutionPath);
  } catch {
    const constitution = buildConstitutionDefaults(frameworks);
    await fs.writeFile(constitutionPath, constitution, "utf8");
  }

  // Quick codebase scan
  const scan = await scanCodebaseQuick(cwd);

  // Welcome output
  if (!opts?.quiet) {
    showHokageArt();

    console.log(chalk.green("✓"), `.pi/ initialized at ${path.join(cwd, ".pi")}`);
    console.log("");

    if (frameworks.length > 0) {
      console.log(chalk.bold("Detected stack:"));
      for (const f of frameworks) {
        console.log(`  ${chalk.cyan(">")} ${f.name}${f.version ? chalk.dim(` (${f.version})`) : ""}`);
      }
      console.log("");
    }

    if (scan.totalFiles > 0) {
      console.log(chalk.bold("Codebase map:"));
      console.log(`  ${chalk.cyan(String(scan.totalFiles))} source files`);
      console.log(`  ${chalk.cyan(String(scan.componentCount))} components (tsx/jsx)`);
      console.log(`  ${chalk.cyan(String(scan.apiRouteCount))} API routes`);
      console.log("");
    }
  } else {
    console.log(chalk.green("✓"), `.pi/ initialized at ${path.join(cwd, ".pi")}`);
  }

  if (opts?.withHooks) {
    const hookRes = await installGitHooks(cwd);
    if (hookRes.warnings.length) {
      for (const w of hookRes.warnings) console.log(chalk.yellow("⚠"), w);
    }
    if (hookRes.paths.length) {
      console.log(chalk.cyan("Git hooks:"), chalk.dim(hookRes.manager === "none" ? "direct .git/hooks" : hookRes.manager));
      for (const p of hookRes.paths) console.log(chalk.dim(`  ${p}`));
    }
    console.log("");
  }

  if (opts?.ci?.length) {
    for (const provider of opts.ci) {
      const gen = await generateCiConfig(cwd, provider);
      for (const n of gen.notes) console.log(chalk.dim(`  CI (${provider}): ${n}`));
      for (const c of gen.created) console.log(chalk.green("✓ CI"), chalk.dim(c));
      for (const s of gen.skipped) console.log(chalk.yellow("⚠ CI skipped"), chalk.dim(s));
      console.log("");
    }
  }

  if (!opts?.quiet) {
    const projectCfg = await readPiProjectConfig(cwd);
    const persona = getPersona(projectCfg.persona);
    console.log(chalk.bold("Ready to reason with you."));
    console.log(
      formatCommandBlock(persona, [
        ["pi learn", "scan the repo so Pi understands your code patterns"],
        ["pi resonate", "debate architecture with Pi before you write code"],
        ["pi resonate --workflow", "run the full Socratic loop (explore → challenge → decision)"],
        ["pi validate", "check current changes against your constitution and rules"],
        ["pi routine", "generate a step-by-step build spec Pi can execute"],
      ]),
    );
    console.log("");
    console.log(chalk.dim(`Try: pi resonate "add a user profile page"`));
  }
}
