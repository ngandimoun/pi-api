import { tasks } from "@trigger.dev/sdk/v3";
import crypto from "crypto";
import { z } from "zod";

import { apiError, apiSuccess } from "@/lib/api-response";

function requireAdminToken(): string {
  const token = process.env.PI_INTERNAL_ADMIN_TOKEN?.trim();
  if (!token) {
    throw new Error("Missing PI_INTERNAL_ADMIN_TOKEN.");
  }
  return token;
}

function verifyAdminAuth(request: Request): boolean {
  const token = requireAdminToken();
  const header = request.headers.get("x-pi-admin-token")?.trim() ?? "";
  return header.length > 0 && header === token;
}

const bodySchema = z.object({
  dry_run: z.boolean().optional(),
  batch_size: z.number().int().min(100).max(50000).optional(),
});

/**
 * Internal, admin-only endpoint to trigger ads cache cleanup.
 *
 * Auth:
 * - `X-Pi-Admin-Token: <PI_INTERNAL_ADMIN_TOKEN>`
 *
 * This endpoint is intentionally not part of the public OpenAI-compatible surface.
 */
export async function POST(request: Request) {
  const requestId = `req_pi_${crypto.randomUUID()}`;

  try {
    if (!verifyAdminAuth(request)) {
      return apiError(
        "admin_unauthorized",
        "Unauthorized. Provide X-Pi-Admin-Token.",
        401,
        requestId,
        "authentication_error"
      );
    }

    let body: unknown = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return apiError(
        "invalid_request_body",
        parsed.error.issues[0]?.message ?? "Invalid request payload.",
        400,
        requestId
      );
    }

    await tasks.trigger("ads-cache-cleanup", {
      dryRun: parsed.data.dry_run === true,
      batchSize: parsed.data.batch_size,
    });

    return apiSuccess(
      {
        triggered: true,
        task: "ads-cache-cleanup",
        dry_run: parsed.data.dry_run === true,
        batch_size: parsed.data.batch_size ?? null,
      },
      "internal.task_trigger",
      requestId
    );
  } catch (error) {
    console.error("[internal.ads_cache.cleanup] failed", { requestId, error });
    return apiError(
      "internal_admin_endpoint_failed",
      "Internal admin endpoint failed.",
      500,
      requestId,
      "api_error"
    );
  }
}

