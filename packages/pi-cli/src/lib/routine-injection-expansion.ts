import fs from "node:fs/promises";
import path from "node:path";
import { routineSpecToMarkdown } from "pi-routine-spec";

import { PI_ROUTINES_DIR } from "./constants.js";
import { getEmbeddedTemplateById } from "./embedded-templates.js";

export type HubExpansionRule =
  | { maxReferences: number }
  | { explicitReferenceIds: string[] };

/** Curated hubs only — never expand mega-hubs like `ui-ux-playbook` here. */
export const HUB_INJECTION_EXPANSION: Record<string, HubExpansionRule> = {
  "react-view-transitions-playbook": {
    explicitReferenceIds: [
      "react-view-transitions-css-recipes",
      "react-view-transitions-implementation-workflow",
    ],
  },
  "shadcn-ui-playbook": { maxReferences: 3 },
};

/**
 * After intent/API suggestions, insert high-priority leaf ids for known hubs
 * (immediately after each hub id), deduped globally, preserving first-seen order.
 */
export function expandExtraRoutineIdsForInjection(extraIds: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();

  const add = (id: string) => {
    const x = id.trim();
    if (!x || seen.has(x)) return;
    seen.add(x);
    out.push(x);
  };

  for (const id of extraIds) {
    add(id);
    const rule = HUB_INJECTION_EXPANSION[id];
    if (!rule) continue;

    const emb = getEmbeddedTemplateById(id);
    const refs = emb?.routine_spec?.metadata?.references ?? [];

    if ("explicitReferenceIds" in rule) {
      for (const r of rule.explicitReferenceIds) add(r);
    } else {
      const n = rule.maxReferences;
      for (const r of refs.slice(0, n)) add(r);
    }
  }

  return out;
}

/** Write embedded JSON templates as `.pi/routines/*.md` when missing (idempotent). */
export async function ensureEmbeddedRoutinesOnDisk(cwd: string, ids: string[]): Promise<void> {
  if (!ids.length) return;
  const dir = path.join(cwd, PI_ROUTINES_DIR);
  await fs.mkdir(dir, { recursive: true });

  for (const id of ids) {
    const embedded = getEmbeddedTemplateById(id);
    if (!embedded) continue;

    const spec = embedded.routine_spec;
    const ver = spec.metadata.version ?? 1;
    const slug = spec.metadata.id;
    const outPath = path.join(dir, `${slug}.v${ver}.md`);

    try {
      await fs.access(outPath);
      continue;
    } catch {
      // write it
    }

    const md = routineSpecToMarkdown(spec);
    await fs.writeFile(outPath, md, "utf8");
  }
}
