import { NextResponse } from "next/server";
import { z } from "zod";

import { apiError, apiSuccessEnvelope } from "@/lib/api-response";
import { createPiApiKey } from "@/lib/unkey";

const bodySchema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
  })
  .strict();

type RateRecord = { count: number; resetAtMs: number };
const rateByIp = new Map<string, RateRecord>();

function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip") ?? "unknown";
}

function checkRateLimit(ip: string, limit: number, windowMs: number) {
  const now = Date.now();
  const current = rateByIp.get(ip);
  if (!current || now >= current.resetAtMs) {
    const next = { count: 1, resetAtMs: now + windowMs };
    rateByIp.set(ip, next);
    return { ok: true, remaining: limit - 1, resetAtMs: next.resetAtMs };
  }
  if (current.count >= limit) {
    return { ok: false, remaining: 0, resetAtMs: current.resetAtMs };
  }
  current.count += 1;
  return { ok: true, remaining: Math.max(limit - current.count, 0), resetAtMs: current.resetAtMs };
}

/**
 * Public endpoint to mint a free Pi API key.
 *
 * This intentionally does NOT require auth (no dashboard yet). Keys are minted via Unkey.
 * The raw key is returned once; clients must store it immediately.
 */
export async function POST(request: Request) {
  const requestId = `req_pi_${crypto.randomUUID()}`;

  const ip = getClientIp(request);
  const limit = checkRateLimit(ip, 5, 60_000);
  if (!limit.ok) {
    const retryAfter = Math.max(Math.ceil((limit.resetAtMs - Date.now()) / 1000), 1);
    const res = apiError(
      "keys_rate_limited",
      "Too many key generation attempts. Please wait and try again.",
      429,
      requestId,
      "rate_limit_error",
      {
        retry_after: retryAfter,
      }
    );
    res.headers.set("Retry-After", String(retryAfter));
    res.headers.set("X-Request-Id", requestId);
    return res;
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    const res = apiError(
      "invalid_json",
      "Request body must be valid JSON.",
      400,
      requestId,
      "invalid_request_error"
    );
    res.headers.set("X-Request-Id", requestId);
    return res;
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    const res = apiError(
      "invalid_body",
      parsed.error.issues[0]?.message ?? "Invalid request body.",
      400,
      requestId,
      "invalid_request_error",
      { issues: parsed.error.issues }
    );
    res.headers.set("X-Request-Id", requestId);
    return res;
  }

  const organizationId = crypto.randomUUID();

  try {
    const created = await createPiApiKey({
      organizationId,
      name: parsed.data.name,
    });

    const res = apiSuccessEnvelope({
      data: {
        key: created.key,
        key_id: created.keyId,
        organization_id: created.organizationId,
      },
      object: "api_key",
      requestId,
      status: "created",
      httpStatus: 201,
    });
    res.headers.set("X-Request-Id", requestId);
    res.headers.set("X-RateLimit-Limit", "5");
    res.headers.set("X-RateLimit-Remaining", String(limit.remaining));
    res.headers.set("X-RateLimit-Reset", String(Math.floor(limit.resetAtMs / 1000)));
    return res;
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to generate API key.";
    const res = apiError("keys_create_failed", message, 500, requestId, "api_error");
    res.headers.set("X-Request-Id", requestId);
    return res;
  }
}

