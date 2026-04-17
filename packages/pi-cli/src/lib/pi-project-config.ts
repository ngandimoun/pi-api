import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

import { PERSONA_IDS, type PiPersona } from "./config.js";
import type { VcsType } from "./vcs/types.js";

const PersonaSchema = z.enum(PERSONA_IDS);

const PiConfigSchema = z.object({
  version: z.number().optional(),
  vcs: z
    .object({
      type: z.enum(["auto", "git", "gitlab", "bitbucket", "gerrit", "perforce", "unknown"]).optional(),
      perforce: z
        .object({
          p4port: z.string().optional(),
          p4client: z.string().optional(),
        })
        .optional(),
    })
    .optional(),
  persona: PersonaSchema.optional(),
});

export type PiProjectConfig = z.infer<typeof PiConfigSchema>;

const DEFAULT_CONFIG: PiProjectConfig = {
  version: 2,
  vcs: { type: "auto" },
};

export async function readPiProjectConfig(cwd: string): Promise<PiProjectConfig> {
  const p = path.join(cwd, ".pi", "config.json");
  try {
    const raw = await fs.readFile(p, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    const r = PiConfigSchema.safeParse(parsed);
    if (r.success) return { ...DEFAULT_CONFIG, ...r.data };
  } catch {
    // missing or invalid
  }
  return DEFAULT_CONFIG;
}

export function resolveVcsTypeFromConfig(cfg: PiProjectConfig): VcsType | "auto" {
  const t = cfg.vcs?.type;
  if (!t || t === "auto") return "auto";
  return t as VcsType;
}

export function resolvePersonaFromConfig(cfg: PiProjectConfig): PiPersona | undefined {
  return cfg.persona;
}

export function defaultPiConfigJson(): string {
  return JSON.stringify(DEFAULT_CONFIG, null, 2);
}
