import { buildPiHealthSnapshot } from "@/lib/pi-health";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Production-oriented readiness for the full Pi API (Unkey + Stripe webhook + Mastra + Postgres).
 * Stricter than `GET /api/cli/health` (which stays friendly for local `pi doctor`).
 */
export async function GET() {
  const snapshot = await buildPiHealthSnapshot({ object: "pi_health" });
  const response = NextResponse.json(snapshot, { status: snapshot.ok ? 200 : 503 });
  response.headers.set("Cache-Control", "no-store, max-age=0");
  return response;
}
