/**
 * Resolves whether a Pi CLI request should fail-closed when the Mastra workflow
 * path is requested but the workflow (or Trigger.dev queue) is unavailable.
 *
 * Resolution order (highest priority wins):
 *   1. Request header `X-Pi-Fail-Closed: true|false`
 *   2. Query string `?strict=true|false`
 *   3. Env `PI_CLI_FAIL_CLOSED === "true"` (default for production)
 *   4. Otherwise `false` (preserves legacy silent-fallback behavior)
 *
 * When strict mode is ON and a workflow run cannot complete successfully, routes
 * should return `503 workflow_unavailable` (or `503 workflow_disabled` when
 * `isPiCliWorkflowModeEnabled()` is false) instead of silently degrading to the
 * legacy Gemini `generateObject` path.
 */

type RequestLike = {
  headers: Headers;
  url?: string;
};

function parseBool(raw: string | null | undefined): boolean | null {
  if (raw === null || raw === undefined) return null;
  const lower = raw.trim().toLowerCase();
  if (lower === "true" || lower === "1" || lower === "yes") return true;
  if (lower === "false" || lower === "0" || lower === "no") return false;
  return null;
}

export function isPiCliFailClosed(request: RequestLike): boolean {
  const headerValue = parseBool(request.headers.get("x-pi-fail-closed"));
  if (headerValue !== null) return headerValue;

  if (request.url) {
    try {
      const queryValue = parseBool(new URL(request.url).searchParams.get("strict"));
      if (queryValue !== null) return queryValue;
    } catch {
      /* malformed URL — ignore and fall through to env default */
    }
  }

  return process.env.PI_CLI_FAIL_CLOSED === "true";
}
