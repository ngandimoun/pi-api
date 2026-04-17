import * as p from "@clack/prompts";
import { isCancel } from "@clack/prompts";
import chalk from "chalk";
import { execa } from "execa";
import fs from "node:fs/promises";
import path from "node:path";
import { PiApiClient } from "./lib/api-client.js";
import {
  getApiKey,
  getBaseUrl,
  isPiPersona,
  setGlobalConfig,
  type PiPersona,
} from "./lib/config.js";
import { showHokageArt } from "./lib/anime-art.js";
import clipboardy from "clipboardy";
import { runInit } from "./commands/init.js";
import { runLearn } from "./commands/learn.js";
import { startWatchDaemon } from "./commands/watch.js";
import { addBadgeToReadme } from "./lib/badge-generator.js";
import { generateCiConfig, type CiProvider } from "./lib/ci-generator.js";
import { installGitHooks } from "./lib/git-hooks-installer.js";
import { clearVcsAdapterCache, getVcs } from "./lib/vcs/index.js";
import { SYSTEM_STYLE_FILE } from "./lib/constants.js";
import { formatCommandBlock, listPersonas, PERSONAS } from "./lib/persona.js";
import { renderRecapCard, shouldUseColor, shouldUseUnicode } from "./lib/ui/chat-ui.js";

/** Parsed CLI flags for the hokage wizard. */
export type HokageFlags = {
  yes: boolean;
  apiKey?: string;
  baseUrl?: string;
  persona?: PiPersona;
  help: boolean;
};

export function parseHokageFlags(argv: readonly string[]): HokageFlags {
  const out: HokageFlags = { yes: false, help: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--yes" || a === "-y") {
      out.yes = true;
      continue;
    }
    if (a === "--help" || a === "-h") {
      out.help = true;
      continue;
    }
    const eq = a.indexOf("=");
    const key = eq >= 0 ? a.slice(0, eq) : a;
    const val = eq >= 0 ? a.slice(eq + 1) : argv[i + 1];
    const consumed = eq >= 0 ? 0 : 1;
    switch (key) {
      case "--api-key":
        out.apiKey = val;
        i += consumed;
        break;
      case "--base-url":
        out.baseUrl = val;
        i += consumed;
        break;
      case "--persona": {
        const v = val?.trim().toLowerCase();
        if (isPiPersona(v)) out.persona = v;
        i += consumed;
        break;
      }
      default:
        break;
    }
  }
  return out;
}

function printHokageHelp(): void {
  console.log(
    [
      chalk.bold("pi-hokage") + " — Pi CLI onboarding wizard",
      "",
      "Usage:",
      "  npx pi-hokage@latest [flags]",
      "",
      "Flags:",
      "  -y, --yes               Non-interactive: accept smart defaults for every step.",
      "      --api-key=<key>     Pi API key (or set PI_API_KEY).",
      "      --base-url=<url>    Pi API base URL (or set PI_CLI_BASE_URL).",
      "      --persona=<id>      One of: newbie, normal, expert, designer, pm.",
      "  -h, --help              Show this help.",
      "",
      "Examples:",
      "  npx pi-hokage@latest",
      "  npx pi-hokage@latest --yes --persona=newbie --api-key=$PI_API_KEY",
    ].join("\n"),
  );
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function hasReadmeAtRoot(cwd: string): Promise<boolean> {
  try {
    const entries = await fs.readdir(cwd);
    return entries.some((e) => /^readme(\..*)?$/i.test(e));
  } catch {
    return false;
  }
}

async function detectDefaultCiProviders(cwd: string): Promise<CiProvider[]> {
  const picked: CiProvider[] = [];
  if (await pathExists(path.join(cwd, ".github"))) picked.push("github");
  if (await pathExists(path.join(cwd, ".gitlab-ci.yml"))) picked.push("gitlab");
  if (await pathExists(path.join(cwd, ".circleci", "config.yml"))) picked.push("circle");
  return picked;
}

/**
 * Check if system-style.json is missing or just a stub (needs pi learn).
 */
async function isSystemStyleStubOrMissing(cwd: string): Promise<boolean> {
  const stylePath = path.join(cwd, SYSTEM_STYLE_FILE);
  try {
    const content = await fs.readFile(stylePath, "utf8");
    const parsed = JSON.parse(content) as Record<string, unknown>;
    const isStub =
      typeof parsed.note === "string" && parsed.note.includes("Run `pi learn`");
    const isEmpty = Object.keys(parsed).length === 0;
    const isMinimal = Object.keys(parsed).length < 3;
    return isStub || isEmpty || isMinimal;
  } catch {
    return true;
  }
}

async function installGlobalCli(): Promise<void> {
  const ua = process.env.npm_config_user_agent ?? "";
  let cmd = "npm install -g @pi-api/cli@latest";
  if (ua.includes("bun")) cmd = "bun install -g @pi-api/cli@latest";
  else if (ua.includes("pnpm")) cmd = "pnpm add -g @pi-api/cli@latest";
  else if (ua.includes("yarn")) cmd = "yarn global add @pi-api/cli@latest";

  const spin = p.spinner();
  spin.start(chalk.yellow("Installing pi globally (optional jutsu)..."));
  try {
    await execa(cmd, { shell: true, stdio: "pipe" });
    spin.stop(chalk.green("✓ pi is on your PATH"));
  } catch (e) {
    spin.stop(chalk.yellow("Global install skipped (run npm install -g @pi-api/cli yourself if needed)."));
    if (e instanceof Error) console.error(chalk.gray(e.message));
  }
}

/**
 * Non-interactive path used by `--yes` or when stdin is not a TTY but the user
 * provided --api-key. Accepts the same smart defaults the interactive wizard
 * would pick when the developer presses Enter on every prompt.
 */
async function runHokageNonInteractive(flags: HokageFlags): Promise<void> {
  console.log(chalk.bold.cyan("pi-hokage"), chalk.dim("— non-interactive install"));

  const baseUrl = (flags.baseUrl ?? getBaseUrl()).replace(/\/$/, "");
  const apiKey = flags.apiKey ?? getApiKey();
  if (!apiKey) {
    console.error(
      chalk.red(
        "Missing API key. Pass --api-key=<key> or set PI_API_KEY when running in non-interactive mode.",
      ),
    );
    process.exitCode = 1;
    return;
  }

  const persona: PiPersona = flags.persona ?? "normal";

  try {
    const client = new PiApiClient({ apiKey, baseUrl });
    const verified = await client.verify();
    if (!verified.valid) {
      console.error(chalk.red("Summoning failed: invalid key"));
      process.exitCode = 1;
      return;
    }
    console.log(chalk.green("✓ Hokage authenticated"));

    setGlobalConfig({
      apiKey,
      organizationId: verified.organization_id ?? undefined,
      baseUrl,
      persona,
      personaSetAt: new Date().toISOString(),
    });
    console.log(chalk.green("✓ Persona:"), chalk.cyan(PERSONAS[persona].label));

    const cwd = process.cwd();

    try {
      clearVcsAdapterCache(cwd);
      const vcs = await getVcs(cwd);
      console.log(chalk.green(`✓ VCS: ${vcs.name}`));
    } catch {
      console.log(chalk.yellow("⚠ VCS detection skipped (non-fatal)"));
    }

    await runInit(cwd, { quiet: true });
    console.log(chalk.green("✓ Village protected (.pi/ scaffolded)"));

    const needsLearn = await isSystemStyleStubOrMissing(cwd);
    if (needsLearn) {
      try {
        await runLearn(cwd, undefined, { withGraph: false });
        console.log(chalk.green("✓ Codebase learned"));
      } catch (e) {
        console.log(chalk.yellow("⚠ Learn skipped:"), chalk.gray(e instanceof Error ? e.message : ""));
      }
    }

    try {
      const hr = await installGitHooks(cwd);
      if (hr.paths.length > 0 && !hr.warnings.some((w) => w.includes("No Git repository"))) {
        console.log(chalk.green("✓ Git hooks installed"));
      } else {
        console.log(chalk.yellow("⚠ Git hooks skipped (no git repo)"));
      }
    } catch {
      console.log(chalk.yellow("⚠ Git hooks skipped (non-fatal)"));
    }

    const ciDefaults = await detectDefaultCiProviders(cwd);
    for (const prov of ciDefaults) {
      try {
        const gr = await generateCiConfig(cwd, prov);
        for (const c of gr.created) console.log(chalk.green("✓"), chalk.dim(c));
      } catch {
        // non-fatal
      }
    }

    if (await hasReadmeAtRoot(cwd)) {
      const br = await addBadgeToReadme(cwd);
      if (br.action !== "skipped") {
        console.log(chalk.green(`✓ README ${br.action}`), chalk.dim(br.path));
      }
    }

    const nextCmd = needsLearn ? "pi learn" : "pi validate";
    console.log(
      chalk.bold.green("\nHokage installation complete."),
      chalk.dim(`Next: ${nextCmd}`),
    );
  } catch (e) {
    console.error(chalk.red("Summoning failed"));
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  }
}

export async function runHokageWizard(): Promise<void> {
  const flags = parseHokageFlags(process.argv.slice(2));
  if (flags.help) {
    printHokageHelp();
    return;
  }

  const nonInteractive = flags.yes || (!process.stdin.isTTY && !!flags.apiKey);
  if (nonInteractive) {
    await runHokageNonInteractive(flags);
    return;
  }

  if (!process.stdin.isTTY) {
    console.error(
      chalk.red("pi-hokage requires an interactive terminal (TTY). Run it in your shell, not a pipe."),
    );
    console.error(
      chalk.dim("Or pass --yes --api-key=<key> for a non-interactive install (CI-friendly)."),
    );
    process.exitCode = 1;
    return;
  }

  console.clear();
  showHokageArt();
  try {
    p.intro(chalk.bold.cyan("THE HOKAGE HAS ARRIVED"));
  } catch (e) {
    const err = e as NodeJS.ErrnoException;
    if (err?.code === "ERR_TTY_INIT_FAILED" || err?.syscall === "uv_tty_init") {
      console.error(chalk.red("Could not open an interactive terminal for prompts."));
      process.exitCode = 1;
      return;
    }
    throw e;
  }

  const existing = getApiKey();
  if (existing && !flags.apiKey) {
    const proceed = await p.confirm({
      message: "A Hokage already guards this village. Summon anyway?",
      initialValue: false,
    });
    if (isCancel(proceed) || !proceed) {
      p.outro(chalk.yellow("The Hokage respects your decision."));
      return;
    }
  }

  let baseUrl: string;
  if (flags.baseUrl) {
    baseUrl = flags.baseUrl.trim();
  } else {
    const baseUrlRaw = await p.text({
      message: "Pi API base URL:",
      initialValue: getBaseUrl(),
      placeholder: "http://localhost:3000",
    });
    if (isCancel(baseUrlRaw)) {
      p.cancel("Setup cancelled");
      return;
    }
    baseUrl = String(baseUrlRaw).trim() || getBaseUrl();
  }

  let apiKey: string;
  if (flags.apiKey) {
    apiKey = flags.apiKey;
  } else {
    const hasKey = await p.confirm({
      message: "Do you possess a Pi API key?",
      initialValue: true,
    });
    if (isCancel(hasKey) || !hasKey) {
      p.note(
        chalk.cyan("Visit your Pi deployment keys page or POST /api/keys to mint a key."),
        "Training Required",
      );
      p.cancel("Setup cancelled");
      return;
    }

    const apiKeyRaw = await p.password({
      message: "Enter your Pi API key:",
      validate: (v) => {
        if (!v?.trim()) return "Key is required";
        return;
      },
    });
    if (isCancel(apiKeyRaw)) {
      p.cancel("Setup cancelled");
      return;
    }
    apiKey = String(apiKeyRaw);
  }

  const spin = p.spinner();
  spin.start(chalk.yellow("Performing summoning jutsu..."));

  try {
    const client = new PiApiClient({ apiKey, baseUrl });
    const verified = await client.verify();
    if (!verified.valid) {
      spin.stop(chalk.red("Summoning failed: invalid key"));
      process.exitCode = 1;
      return;
    }
    spin.stop(chalk.green("Hokage authenticated"));

    // --- Persona (right after auth, so later prompts + agents can see it) ---
    let persona: PiPersona;
    if (flags.persona) {
      persona = flags.persona;
    } else {
      const picked = await p.select<PiPersona>({
        message: "How would you like Pi to talk to you?",
        options: listPersonas().map((meta) => ({
          value: meta.id,
          label: meta.longLabel,
          hint: meta.description,
        })),
        initialValue: "normal",
      });
      if (isCancel(picked)) {
        p.cancel("Setup cancelled");
        return;
      }
      persona = picked as PiPersona;
    }

    setGlobalConfig({
      apiKey,
      organizationId: verified.organization_id ?? undefined,
      baseUrl: baseUrl.replace(/\/$/, ""),
      persona,
      personaSetAt: new Date().toISOString(),
    });

    p.note(
      chalk.white(PERSONAS[persona].description),
      chalk.cyan(`Persona: ${PERSONAS[persona].label}`),
    );

    const cwd = process.cwd();
    spin.start(chalk.yellow("Detecting version control system..."));
    try {
      clearVcsAdapterCache(cwd);
      const vcs = await getVcs(cwd);
      spin.stop(chalk.green(`✓ VCS: ${vcs.name}`));
      if (vcs.name === "perforce") {
        p.note(
          chalk.yellow("Perforce / Helix Core detected. Ensure `p4` is configured for this workspace."),
          "VCS",
        );
      }
    } catch {
      spin.stop(chalk.yellow("VCS detection skipped (non-fatal)."));
    }

    spin.start(chalk.yellow("Establishing village defenses..."));
    await runInit(cwd, { quiet: true });
    spin.stop(chalk.green("Village protected"));

    const needsLearn = await isSystemStyleStubOrMissing(cwd);
    let learnCompleted = false;
    const setupSummary = {
      hooks: false,
      ci: [] as CiProvider[],
      watch: false,
      badge: false,
      team: false,
    };

    if (needsLearn) {
      p.note(
        chalk.yellow("Pi hasn't learned your codebase yet.\n\n") +
          chalk.white("Commands like ") +
          chalk.cyan("resonate") +
          chalk.white(", ") +
          chalk.cyan("routine") +
          chalk.white(", and ") +
          chalk.cyan("validate") +
          chalk.white(" will have\n") +
          chalk.white("reduced accuracy until Pi understands your project.\n\n") +
          chalk.dim("This scan takes ~10-30 seconds depending on repo size."),
        "Required: Learn Your Codebase",
      );

      const shouldLearn = await p.confirm({
        message: "Run `pi learn` now to build codebase context?",
        initialValue: true,
      });

      if (shouldLearn === true) {
        spin.start(chalk.yellow("Learning codebase patterns (shadow clone jutsu)..."));
        try {
          await runLearn(cwd, undefined, { withGraph: false });
          spin.stop(chalk.green("✓ Codebase learned"));
          learnCompleted = true;

          const deepLearn = await p.confirm({
            message: "Run deeper analysis with import graph? (adds ~10s)",
            initialValue: false,
          });
          if (deepLearn === true) {
            spin.start(chalk.yellow("Building import graph..."));
            try {
              await runLearn(cwd, undefined, { withGraph: true });
              spin.stop(chalk.green("✓ Import graph built"));
            } catch (e) {
              spin.stop(chalk.yellow("Graph build skipped (non-fatal)."));
              if (e instanceof Error) console.error(chalk.gray(e.message));
            }
          }
        } catch (e) {
          spin.stop(chalk.yellow("Learn failed — you can run `pi learn` manually later."));
          if (e instanceof Error) console.error(chalk.gray(e.message));
        }
      }
    }

    const hooksQ = await p.confirm({
      message: "Install Git hooks so `pi validate` runs before commit/push?",
      initialValue: true,
    });
    if (!isCancel(hooksQ) && hooksQ === true) {
      spin.start(chalk.yellow("Installing git hooks..."));
      try {
        const hr = await installGitHooks(cwd);
        spin.stop(chalk.green("✓ Git hooks configured"));
        setupSummary.hooks = hr.paths.length > 0 && !hr.warnings.some((w) => w.includes("No Git repository"));
        for (const w of hr.warnings) {
          if (w) console.log(chalk.yellow("⚠"), w);
        }
      } catch (e) {
        spin.stop(chalk.yellow("Git hooks skipped (non-fatal)."));
        if (e instanceof Error) console.error(chalk.gray(e.message));
      }
    }

    // CI: smarter defaults — pre-pick providers we already see in the repo.
    const ciDefaults = await detectDefaultCiProviders(cwd);
    const ciPick = await p.multiselect({
      message: "Generate CI workflow files?",
      options: [
        { value: "github", label: "GitHub Actions" },
        { value: "gitlab", label: "GitLab CI" },
        { value: "circle", label: "CircleCI" },
        { value: "_skip", label: "Skip CI generation" },
      ],
      initialValues: ciDefaults.length ? ciDefaults : ["_skip"],
      required: false,
    });
    if (!isCancel(ciPick) && Array.isArray(ciPick)) {
      const picked = (ciPick as string[]).filter((v) => v !== "_skip") as CiProvider[];
      if (picked.length) {
        spin.start(chalk.yellow("Writing CI configs..."));
        try {
          for (const prov of picked) {
            const gr = await generateCiConfig(cwd, prov);
            for (const n of gr.notes) console.log(chalk.dim(`  ${n}`));
            for (const c of gr.created) console.log(chalk.green("✓"), chalk.dim(c));
            for (const s of gr.skipped) console.log(chalk.yellow("⚠ skipped"), chalk.dim(s));
          }
          setupSummary.ci = picked;
          spin.stop(chalk.green("✓ CI scaffolded"));
        } catch (e) {
          spin.stop(chalk.yellow("CI generation skipped (non-fatal)."));
          if (e instanceof Error) console.error(chalk.gray(e.message));
        }
      }
    }

    const watchQ = await p.confirm({
      message: "Start `pi watch` as a background daemon? (validates TS/JS on save)",
      initialValue: false,
    });
    if (!isCancel(watchQ) && watchQ === true) {
      try {
        await startWatchDaemon(cwd, { noAuto: true });
        setupSummary.watch = true;
      } catch (e) {
        console.log(chalk.yellow("Watch daemon not started."), chalk.gray(e instanceof Error ? e.message : ""));
      }
    }

    // Badge: only prompt when a README actually exists at the repo root.
    if (await hasReadmeAtRoot(cwd)) {
      const badgeQ = await p.confirm({
        message: "Add a Pi badge to README.md?",
        initialValue: true,
      });
      if (!isCancel(badgeQ) && badgeQ === true) {
        const br = await addBadgeToReadme(cwd);
        if (br.action === "skipped") {
          console.log(chalk.dim(br.reason ?? "README badge skipped"));
        } else {
          console.log(chalk.green(`✓ README ${br.action}`), chalk.dim(br.path));
          setupSummary.badge = true;
        }
      }
    }

    if (verified.organization_id) {
      const teamQ = await p.confirm({
        message: "Your API key is org-scoped. Show team alignment tips?",
        initialValue: true,
      });
      if (!isCancel(teamQ) && teamQ === true) {
        setupSummary.team = true;
        p.note(
          chalk.white("Keep agents aligned with the team:\n") +
            chalk.cyan("  pi sync                 ") +
            chalk.dim("— pull shared artifacts into .pi/\n") +
            chalk.cyan("  pi routine templates    ") +
            chalk.dim("— discover shared routines\n") +
            chalk.cyan("  pi resonate-approve …   ") +
            chalk.dim("— approve team system-style drafts (lead keys)\n"),
          "Team brain",
        );
      }
    }

    // Default flipped to true: the point of the wizard is "Pi is ready everywhere".
    const install = await p.confirm({
      message: "Install `pi` globally so you can run it outside npx?",
      initialValue: true,
    });
    if (install === true) {
      await installGlobalCli();
    }

    p.note(
      chalk.white("Pi tracks work across commands.\n") +
        chalk.yellow("  pi tasks        ") +
        chalk.dim(" — list agent task steps\n") +
        chalk.yellow("  pi tasks resume ") +
        chalk.dim(" — where you left off\n") +
        chalk.yellow("  pi sessions     ") +
        chalk.dim(" — resonate / omnirouter sessions\n") +
        chalk.yellow("  pi vcs          ") +
        chalk.dim(" — VCS detection & capabilities\n") +
        chalk.yellow("  pi doctor       ") +
        chalk.dim(" — check Pi readiness"),
      "Agent tracking",
    );

    const nextCmd = needsLearn && !learnCompleted ? "pi learn" : "pi validate";
    try {
      await clipboardy.write(nextCmd);
    } catch {
      /* clipboard unavailable */
    }

    const check = shouldUseUnicode() ? "✓" : "[done]";
    const colorOn = shouldUseColor();
    const green = (s: string) => (colorOn ? chalk.green(s) : s);
    const dim = (s: string) => (colorOn ? chalk.dim(s) : s);

    const extras: string[] = [];
    if (setupSummary.hooks) extras.push(green(`${check} Git hooks — validate on commit/push`));
    if (setupSummary.ci.length) extras.push(green(`${check} CI — ${setupSummary.ci.join(", ")}`));
    if (setupSummary.watch) extras.push(green(`${check} Pi watch daemon`));
    if (setupSummary.badge) extras.push(green(`${check} README badge`));
    extras.push(green(`${check} Persona — ${PERSONAS[persona].label}`));

    if (!setupSummary.watch && learnCompleted) {
      extras.push(dim("Tip: run `pi watch` (or `pi watch --daemon`) for realtime feedback."));
    } else if (!setupSummary.watch) {
      extras.push(dim("Tip: after `pi learn`, run `pi watch` for realtime validation on save."));
    }
    extras.push(dim("Habit nudges: `pi doctor` (last validate / prompt on this machine)."));

    // Persona-adapted "Try:" block — always surfaced under extras.
    const tryBlock = formatCommandBlock(persona, [
      ['pi resonate "describe your feature"', "talk to Pi as a staff engineer about architecture intent"],
      ['pi routine "build a login form"', "generate a step-by-step routine Pi will follow"],
      ["pi validate", "run Pi's checks on your current changes"],
    ]);

    const intentText = learnCompleted
      ? "Hokage installation complete. Pi is ready."
      : needsLearn
        ? "Hokage installation complete — run `pi learn` before using Pi effectively."
        : "Hokage installation complete.";

    console.log("");
    console.log(
      renderRecapCard({
        intent: intentText,
        persona,
        nextCommand: nextCmd,
        clipboardCopied: true,
        extras: [
          ...extras,
          "",
          colorOn ? chalk.bold.white("Try:") : "Try:",
          tryBlock,
        ],
      })
    );
    p.outro(colorOn ? chalk.green("Ready.") : "Ready.");
  } catch (e) {
    spin.stop(chalk.red("Summoning failed"));
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  }
}

// Auto-run the wizard when invoked as the CLI entry point. Skip when the
// module is imported (e.g. under vitest) or when PI_HOKAGE_SKIP_AUTORUN=1 is
// set — tests need to import parseHokageFlags without triggering the wizard.
const isDirectRun = (() => {
  if (process.env.PI_HOKAGE_SKIP_AUTORUN === "1") return false;
  if (process.env.VITEST === "true" || process.env.NODE_ENV === "test") return false;
  try {
    const entry = process.argv[1] ?? "";
    const here = new URL(import.meta.url).pathname;
    return Boolean(entry) && (here.endsWith(entry) || entry.endsWith("hokage.js") || entry.endsWith("hokage.mjs"));
  } catch {
    return true;
  }
})();

if (isDirectRun) {
  runHokageWizard().catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });
}
