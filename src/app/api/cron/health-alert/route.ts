import { type NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Vercel Cron: probe `/api/health` and POST to `ALERT_WEBHOOK_URL` when unhealthy.
 * Set `CRON_SECRET` in Vercel and the same value in the cron `Authorization` header (Vercel secures cron invocations).
 */
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (cronSecret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return new NextResponse("Unauthorized", { status: 401 });
    }
  } else if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "CRON_SECRET is required in production to invoke this route." },
      { status: 503 },
    );
  }

  const base =
    process.env.PI_APP_BASE_URL?.replace(/\/$/, "") ||
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null);

  if (!base) {
    return NextResponse.json({ error: "No base URL (PI_APP_BASE_URL / VERCEL_URL)." }, { status: 503 });
  }

  const healthUrl = `${base}/api/health`;
  let ok = false;
  let payload: unknown;
  try {
    const res = await fetch(healthUrl, { cache: "no-store", next: { revalidate: 0 } });
    payload = await res.json().catch(() => ({}));
    ok = Boolean((payload as { ok?: boolean })?.ok) && res.ok;
  } catch (e) {
    payload = { error: e instanceof Error ? e.message : "fetch_failed" };
  }

  const webhook = process.env.ALERT_WEBHOOK_URL?.trim();
  if (!ok && webhook) {
    const text = `[Pi API] Health check failed\nURL: ${healthUrl}\nPayload: ${JSON.stringify(payload).slice(0, 4000)}`;
    try {
      await fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
    } catch {
      /* best-effort */
    }
  }

  return NextResponse.json({
    object: "pi_health_cron",
    probed: healthUrl,
    ok,
    alerted: Boolean(!ok && webhook),
    generated_at: Math.floor(Date.now() / 1000),
  });
}
