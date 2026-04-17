import Conf from "conf";
import { homedir } from "node:os";
import path from "node:path";

export const PERSONA_IDS = ["newbie", "normal", "expert", "designer", "pm"] as const;
export type PiPersona = (typeof PERSONA_IDS)[number];

export function isPiPersona(value: unknown): value is PiPersona {
  return typeof value === "string" && (PERSONA_IDS as readonly string[]).includes(value);
}

export type PiGlobalConfig = {
  apiKey?: string;
  organizationId?: string;
  baseUrl?: string;
  persona?: PiPersona;
  personaSetAt?: string;
};

const schema = {
  apiKey: { type: "string" as const },
  organizationId: { type: "string" as const },
  baseUrl: { type: "string" as const },
  persona: { type: "string" as const, enum: [...PERSONA_IDS] },
  personaSetAt: { type: "string" as const },
};

export function getGlobalConfigStore(): Conf<PiGlobalConfig> {
  return new Conf<PiGlobalConfig>({
    projectName: "pi-cli",
    cwd: path.join(homedir(), ".config", "pi"),
    schema,
    defaults: {},
  });
}

export function getBaseUrl(): string {
  const fromEnv = process.env.PI_CLI_BASE_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  const store = getGlobalConfigStore();
  const fromFile = store.get("baseUrl")?.trim();
  if (fromFile) return fromFile.replace(/\/$/, "");
  return "http://localhost:3000";
}

export function getApiKey(): string | undefined {
  const fromEnv = process.env.PI_API_KEY?.trim();
  if (fromEnv) return fromEnv;
  return getGlobalConfigStore().get("apiKey");
}

export function setGlobalConfig(partial: Partial<PiGlobalConfig>): void {
  const store = getGlobalConfigStore();
  if (partial.apiKey !== undefined) store.set("apiKey", partial.apiKey);
  if (partial.organizationId !== undefined) store.set("organizationId", partial.organizationId);
  if (partial.baseUrl !== undefined) store.set("baseUrl", partial.baseUrl);
  if (partial.persona !== undefined) store.set("persona", partial.persona);
  if (partial.personaSetAt !== undefined) store.set("personaSetAt", partial.personaSetAt);
}

export function getOrganizationId(): string | undefined {
  return getGlobalConfigStore().get("organizationId");
}

export function clearGlobalConfig(): void {
  getGlobalConfigStore().clear();
}

/**
 * Resolution order: env (PI_PERSONA) > project (.pi/config.json, injected by caller)
 * > global (~/.config/pi) > "normal" default.
 *
 * Note: project-level override is read asynchronously via `readPiProjectConfig`
 * and therefore must be passed in by callers that can await. This sync helper
 * handles env + global only.
 */
export function getPersona(projectOverride?: PiPersona): PiPersona {
  const fromEnv = process.env.PI_PERSONA?.trim().toLowerCase();
  if (isPiPersona(fromEnv)) return fromEnv;
  if (projectOverride && isPiPersona(projectOverride)) return projectOverride;
  const fromStore = getGlobalConfigStore().get("persona");
  if (isPiPersona(fromStore)) return fromStore;
  return "normal";
}
