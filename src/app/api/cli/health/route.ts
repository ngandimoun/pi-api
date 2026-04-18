import { buildPiHealthSnapshot } from "@/lib/pi-health";
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
 */
export async function GET() {
  const snapshot = await buildPiHealthSnapshot({ object: "pi_cli_health" });
  const response = NextResponse.json(snapshot, { status: snapshot.ok ? 200 : 503 });
  response.headers.set("Cache-Control", "no-store, max-age=0");
  return response;
}
