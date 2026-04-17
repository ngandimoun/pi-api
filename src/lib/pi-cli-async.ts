/**
 * Async Pi CLI API: optional 202 + Trigger.dev workflow execution.
 * Only explicit `?async=true` enables async (keeps older clients compatible).
 */
export function parsePiCliAsyncFlag(request: Request): boolean {
  const url = new URL(request.url);
  return url.searchParams.get("async") === "true";
}
