/**
 * Shared helpers for Pi CLI API routes (server-only).
 */
export function resolveOrganizationIdFromUnkeyData(data: unknown): string | null {
  if (!data || typeof data !== "object") {
    return null;
  }

  const record = data as Record<string, unknown>;
  const meta = record.meta as Record<string, unknown> | undefined;
  const identity = record.identity as Record<string, unknown> | undefined;

  const fromMeta = meta?.organization_id;
  if (typeof fromMeta === "string" && fromMeta.length > 0) {
    return fromMeta;
  }

  const fromIdentity = identity?.externalId;
  if (typeof fromIdentity === "string" && fromIdentity.length > 0) {
    return fromIdentity;
  }

  const ownerId = record.ownerId;
  if (typeof ownerId === "string" && ownerId.length > 0) {
    return ownerId;
  }

  return null;
}
