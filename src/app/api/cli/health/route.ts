import { buildPiCliHealthSnapshot } from "@/lib/pi-health-cli";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Public readiness probe for Pi CLI Hokage Mastra wiring.
 *
 * Returns only booleans + env presence — never leaks secret values. Intended for:
 *   - `pi doctor` server-readiness block
 *   - uptime monitors / Vercel deployment checks
 *   - CI preflight before running Mastra-backed workflows
 *
 * `ok === true` means CLI-ready: default model set, Postgres reachable,
 * workflow mode enabled, Gemini key present (does not require Stripe/Unkey for local dev).
 *
 * Uses `buildPiCliHealthSnapshot` (no `@/mastra` import) so this route stays under Vercel's
 * serverless bundle size limit; workflow/agent keys are a static registry aligned with `src/mastra/index.ts`.
 */
export async function GET() {
  const snapshot = await buildPiCliHealthSnapshot();
  const response = NextResponse.json(snapshot, { status: snapshot.ok ? 200 : 503 });
  response.headers.set("Cache-Control", "no-store, max-age=0");
  return response;
}
