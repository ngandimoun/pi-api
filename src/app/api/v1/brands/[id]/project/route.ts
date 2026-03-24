import { z } from "zod";

import { apiError, apiSuccess } from "@/lib/api-response";
import { withApiAuth } from "@/lib/auth";
import { generateDynamicProjection } from "@/lib/dynamic-projection";
import { getServiceSupabaseClient } from "@/lib/supabase";

const paramsSchema = z.object({
  id: z.string().uuid(),
});

type AbuseState = {
  count: number;
  windowStartedAt: number;
};

const abuseByDeveloper = new Map<string, AbuseState>();

function getProjectionMaxUseCaseChars(): number {
  const parsed = Number(process.env.GOOGLE_BRAND_PROJECTION_MAX_USE_CASE_CHARS ?? "700");
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 700;
}

function getProjectionMaxBodyBytes(): number {
  const parsed = Number(process.env.GOOGLE_BRAND_PROJECTION_MAX_BODY_BYTES ?? "8192");
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 8192;
}

function getProjectionAbuseWindowMs(): number {
  const parsed = Number(process.env.GOOGLE_BRAND_PROJECTION_ABUSE_WINDOW_MS ?? "600000");
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 600000;
}

function getProjectionAbuseMaxViolations(): number {
  const parsed = Number(process.env.GOOGLE_BRAND_PROJECTION_ABUSE_MAX_VIOLATIONS ?? "3");
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 3;
}

function registerAbuseViolation(developerId: string): number {
  const now = Date.now();
  const windowMs = getProjectionAbuseWindowMs();
  const current = abuseByDeveloper.get(developerId);
  if (!current || now - current.windowStartedAt > windowMs) {
    abuseByDeveloper.set(developerId, { count: 1, windowStartedAt: now });
    return 1;
  }
  const nextCount = current.count + 1;
  abuseByDeveloper.set(developerId, { ...current, count: nextCount });
  return nextCount;
}

const bodySchema = z.object({
  use_case: z.string().trim().min(1).max(getProjectionMaxUseCaseChars()),
});

async function resolveRouteParams(
  params: unknown
): Promise<Record<string, string | string[]> | undefined> {
  if (!params) {
    return undefined;
  }
  if (typeof (params as Promise<unknown>).then === "function") {
    const awaited = await (params as Promise<unknown>);
    if (awaited && typeof awaited === "object") {
      return awaited as Record<string, string | string[]>;
    }
    return undefined;
  }
  if (typeof params === "object") {
    return params as Record<string, string | string[]>;
  }
  return undefined;
}

/**
 * Projects stored brand DNA into a dynamic use-case payload.
 */
export const POST = withApiAuth(async (request, context) => {
  const maxBodyBytes = getProjectionMaxBodyBytes();
  const contentLengthHeader = request.headers.get("content-length");
  const declaredContentLength = Number(contentLengthHeader ?? "0");
  if (Number.isFinite(declaredContentLength) && declaredContentLength > maxBodyBytes) {
    const violations = registerAbuseViolation(request.developerId);
    if (violations > getProjectionAbuseMaxViolations()) {
      return apiError(
        "projection_abuse_threshold_exceeded",
        "Too many abusive projection requests in the current time window.",
        429,
        request.requestId,
        "rate_limit_error"
      );
    }
    return apiError(
      "projection_request_too_large",
      `Projection request body is too large. Max allowed is ${maxBodyBytes} bytes.`,
      400,
      request.requestId
    );
  }

  const resolvedParams = await resolveRouteParams(context.params);
  const parsedParams = paramsSchema.safeParse(resolvedParams ?? {});
  if (!parsedParams.success) {
    return apiError(
      "invalid_brand_id",
      "Brand id must be a valid UUID.",
      400,
      request.requestId
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError(
      "invalid_json_body",
      "Request body must be valid JSON.",
      400,
      request.requestId
    );
  }
  const parsedBody = bodySchema.safeParse(body);
  if (!parsedBody.success) {
    return apiError(
      "invalid_request_body",
      parsedBody.error.issues[0]?.message ?? "Invalid request payload.",
      400,
      request.requestId
    );
  }

  const supabase = getServiceSupabaseClient();
  const { data: brand, error: brandError } = await supabase
    .from("brands")
    .select("id,org_id,brand_dna")
    .eq("id", parsedParams.data.id)
    .maybeSingle();

  if (brandError) {
    return apiError(
      "brand_lookup_failed",
      "Failed to fetch brand.",
      500,
      request.requestId,
      "api_error"
    );
  }
  if (!brand || brand.org_id !== request.organizationId) {
    return apiError("brand_not_found", "Brand not found.", 404, request.requestId);
  }

  let projected: Record<string, unknown>;
  try {
    projected = await generateDynamicProjection({
      useCase: parsedBody.data.use_case,
      brandDna: brand.brand_dna,
    });
  } catch (error) {
    console.error("[brands.project] projection_failed", {
      requestId: request.requestId,
      brandId: parsedParams.data.id,
      orgId: request.organizationId,
      useCase: parsedBody.data.use_case,
      error,
    });
    return apiError(
      "projection_generation_failed",
      "Failed to generate projected payload for requested use_case.",
      502,
      request.requestId,
      "api_error"
    );
  }

  const requestBytes = Number.isFinite(declaredContentLength)
    ? Math.max(0, Math.floor(declaredContentLength))
    : JSON.stringify(body).length;
  const projectionMeta =
    projected.meta && typeof projected.meta === "object"
      ? (projected.meta as Record<string, unknown>)
      : {};
  const guardrailsMeta = {
    request_body_bytes: requestBytes,
    max_body_bytes: maxBodyBytes,
    use_case_chars: parsedBody.data.use_case.length,
    max_use_case_chars: getProjectionMaxUseCaseChars(),
  };
  const projectedForTracking: Record<string, unknown> = {
    ...projected,
    meta: {
      ...projectionMeta,
      guardrails: guardrailsMeta,
    },
  };

  void supabase
    .from("projected_payloads")
    .insert({
      brand_id: parsedParams.data.id,
      org_id: request.organizationId,
      developer_id: request.developerId,
      use_case: parsedBody.data.use_case,
      is_wildcard: true,
      clean_payload: projectedForTracking,
    })
    .then(({ error }) => {
      if (error) {
        console.error("[brands.project] tracking_insert_failed", {
          requestId: request.requestId,
          brandId: parsedParams.data.id,
          useCase: parsedBody.data.use_case,
          error,
        });
      }
    });

  return apiSuccess(
    {
      use_case: parsedBody.data.use_case,
      is_wildcard: true,
      payload: projected,
    },
    "brand.projection",
    request.requestId
  );
});
