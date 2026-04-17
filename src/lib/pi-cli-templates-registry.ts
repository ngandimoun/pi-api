import { routineTemplateSchema, type RoutineTemplate } from "pi-routine-spec";

/** Ephemeral registry for POST /api/cli/templates (survives until server cold start). */
const memoryTemplates = new Map<string, RoutineTemplate>();

export function registerCliTemplateTemplate(t: RoutineTemplate): void {
  memoryTemplates.set(t.id, t);
}

export function getCliTemplateFromRegistry(id: string): RoutineTemplate | undefined {
  return memoryTemplates.get(id);
}

export function listCliTemplatesFromRegistry(): RoutineTemplate[] {
  return [...memoryTemplates.values()].sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * Optional JSON array from env (deployment-time community templates).
 */
function templatesFromEnv(): RoutineTemplate[] {
  const raw = process.env.PI_CLI_TEMPLATE_REGISTRY_JSON?.trim();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return routineTemplateSchema.array().parse(parsed);
  } catch {
    return [];
  }
}

export function listAllRemoteCliTemplates(): RoutineTemplate[] {
  const fromEnv = templatesFromEnv();
  const fromMemory = listCliTemplatesFromRegistry();
  const merged = new Map<string, RoutineTemplate>();
  for (const t of fromEnv) merged.set(t.id, t);
  for (const t of fromMemory) merged.set(t.id, t);
  return [...merged.values()].sort((a, b) => a.id.localeCompare(b.id));
}

export function getRemoteCliTemplateById(id: string): RoutineTemplate | undefined {
  return getCliTemplateFromRegistry(id) ?? templatesFromEnv().find((t) => t.id === id);
}
