import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import type { RuleViolation } from "./violation-types.js";

export type PiCustomRuleModule = {
  id: string;
  /** Return findings for this file (text-based; optional language hint). */
  check: (args: { filePath: string; content: string; cwd: string }) => RuleViolation[];
};

/** Helper for `.pi/rules/*.mjs` authors */
export function defineRule(m: PiCustomRuleModule): PiCustomRuleModule {
  return m;
}

/**
 * Load ESM modules from `.pi/rules/*.mjs` exporting `{ id, check }` as default.
 * TypeScript sources are not executed; compile to `.mjs` or use plain JS.
 */
export async function loadCustomRuleModules(cwd: string): Promise<PiCustomRuleModule[]> {
  const dir = path.join(cwd, ".pi", "rules");
  let names: string[] = [];
  try {
    names = await fs.readdir(dir);
  } catch {
    return [];
  }
  const mods: PiCustomRuleModule[] = [];
  for (const n of names) {
    if (!n.endsWith(".mjs") && !n.endsWith(".js")) continue;
    if (n.endsWith(".test.js") || n.endsWith(".spec.js")) continue;
    const abs = path.join(dir, n);
    try {
      const href = pathToFileURL(abs).href;
      const imp = (await import(href)) as { default?: PiCustomRuleModule };
      const d = imp.default;
      if (d && typeof d.id === "string" && typeof d.check === "function") {
        mods.push(d);
      }
    } catch {
      /* skip invalid modules */
    }
  }
  return mods;
}

export async function runCustomRules(
  cwd: string,
  absFiles: string[],
  mods: PiCustomRuleModule[]
): Promise<RuleViolation[]> {
  if (!mods.length) return [];
  const out: RuleViolation[] = [];
  for (const file of absFiles) {
    let content: string;
    try {
      content = await fs.readFile(file, "utf8");
    } catch {
      continue;
    }
    for (const m of mods) {
      try {
        out.push(...m.check({ filePath: file, content, cwd }));
      } catch {
        /* rule threw */
      }
    }
  }
  return out;
}
