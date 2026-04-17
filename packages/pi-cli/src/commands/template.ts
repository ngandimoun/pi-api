import fs from "node:fs/promises";
import path from "node:path";
import chalk from "chalk";
import { routineTemplateSchema, routineSpecToMarkdown, type RoutineTemplate } from "pi-routine-spec";

import { PiApiClient } from "../lib/api-client.js";
import { injectPiContextToAllIDEs } from "../lib/agentic-ide-injector.js";
import { mergePrimaryAndReferenceRoutinePaths } from "../lib/routine-context-detector.js";
import {
  ensureEmbeddedRoutinesOnDisk,
  expandExtraRoutineIdsForInjection,
} from "../lib/routine-injection-expansion.js";
import { getRoutineIndex, rebuildRoutineIndex } from "../lib/routine-index.js";
import { EMBEDDED_ROUTINE_TEMPLATES, getEmbeddedTemplateById } from "../lib/embedded-templates.js";
import { PI_ROUTINES_DIR } from "../lib/constants.js";

function isHttpUrl(s: string): boolean {
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

async function fetchRemoteTemplate(client: PiApiClient, id: string): Promise<RoutineTemplate | undefined> {
  try {
    return await client.templateGet(id);
  } catch {
    return undefined;
  }
}

async function fetchTemplateList(client: PiApiClient): Promise<RoutineTemplate[]> {
  try {
    return await client.templatesList();
  } catch {
    return [];
  }
}

async function fetchUrlTemplate(url: string): Promise<RoutineTemplate> {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching template URL`);
  const json = (await res.json()) as unknown;
  return routineTemplateSchema.parse(json);
}

/**
 * Resolve template: embedded → registry → URL.
 */
export async function resolveRoutineTemplate(
  idOrUrl: string,
  client: PiApiClient
): Promise<RoutineTemplate> {
  const trimmed = idOrUrl.trim();
  const embedded = getEmbeddedTemplateById(trimmed);
  if (embedded) return embedded;

  if (isHttpUrl(trimmed)) {
    return fetchUrlTemplate(trimmed);
  }

  const remote = await fetchRemoteTemplate(client, trimmed);
  if (remote) return remote;

  if (isHttpUrl(`https://${trimmed}`)) {
    return fetchUrlTemplate(`https://${trimmed}`);
  }

  throw new Error(
    `Unknown template "${trimmed}". Try \`pi routine templates\` or pass a raw JSON URL.`
  );
}

export async function runRoutineTemplatesList(cwd: string, _json?: boolean): Promise<void> {
  const client = new PiApiClient();
  const remote = await fetchTemplateList(client);
  const merged = new Map<string, RoutineTemplate>();
  for (const t of EMBEDDED_ROUTINE_TEMPLATES) merged.set(t.id, t);
  for (const t of remote) {
    if (!merged.has(t.id)) merged.set(t.id, t);
  }
  const all = [...merged.values()].sort((a, b) => a.id.localeCompare(b.id));

  console.log(chalk.bold.cyan("\nPi routine templates (embedded + registry)\n"));
  for (const t of all) {
    const src = EMBEDDED_ROUTINE_TEMPLATES.some((e) => e.id === t.id) ? chalk.green("embedded") : chalk.magenta("registry");
    console.log(`${chalk.bold(t.id)}  ${src}`);
    console.log(chalk.dim(`  ${t.name} · ${t.category} · ${t.stack.join(", ")}`));
    console.log(chalk.gray(`  ${t.description}`));
    console.log("");
  }
  console.log(
    chalk.gray(`Run: pi routine import <id> [--inject]   (or pass https://... to a JSON template)`)
  );
  void cwd;
}

export type RoutineTemplateImportOpts = {
  /** Update IDE Pi block with this routine (+ hub expansion) after import. */
  inject?: boolean;
};

export async function runRoutineTemplateImport(
  cwd: string,
  idOrUrl: string,
  opts?: RoutineTemplateImportOpts
): Promise<void> {
  const client = new PiApiClient();
  const template = await resolveRoutineTemplate(idOrUrl, client);
  const spec = template.routine_spec;
  const version = spec.metadata.version ?? 1;
  const slug = spec.metadata.id;
  const markdown = routineSpecToMarkdown(spec);

  const dir = path.join(cwd, PI_ROUTINES_DIR);
  await fs.mkdir(dir, { recursive: true });
  const outPath = path.join(dir, `${slug}.v${version}.md`);
  await fs.writeFile(outPath, markdown, "utf8");
  console.log(chalk.green("✓"), "Imported template as routine:", path.relative(cwd, outPath));

  if (opts?.inject && process.env.PI_CLI_NO_AGENTIC_INJECT !== "1") {
    try {
      const extraIds = expandExtraRoutineIdsForInjection([slug]);
      await ensureEmbeddedRoutinesOnDisk(cwd, extraIds);
      await rebuildRoutineIndex(cwd);
      const entries = await getRoutineIndex(cwd);
      const routineRelPaths = mergePrimaryAndReferenceRoutinePaths(slug, version, entries, extraIds);
      const inj = await injectPiContextToAllIDEs(cwd, { mode: "explicit", routineRelPaths });
      if (inj.filesWritten.length) {
        console.log(chalk.dim("Agentic IDE hints updated:"), inj.filesWritten.join(", "));
      }
    } catch {
      /* non-fatal */
    }
  }
}
