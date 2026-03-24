import { z } from "zod";

import { apiError, apiSuccess } from "@/lib/api-response";
import { withApiAuth } from "@/lib/auth";
import { getServiceSupabaseClient } from "@/lib/supabase";

const paramsSchema = z.object({
  id: z.string().uuid(),
});

const querySchema = z.object({
  expand: z.enum(["brand"]).optional(),
  include: z.enum(["brand"]).optional(),
  fields: z.string().trim().min(1).optional(),
  wait_for_completion: z
    .string()
    .transform((value) => value === "true")
    .optional(),
  timeout_seconds: z.coerce.number().int().min(1).max(30).optional(),
});

const jobFieldAllowList = new Set([
  "id",
  "org_id",
  "type",
  "status",
  "payload",
  "result_url",
  "error_log",
  "created_at",
  "updated_at",
]);

function parseFields(raw: string | undefined): string[] {
  if (!raw) {
    return ["*"];
  }
  const parsed = raw
    .split(",")
    .map((field) => field.trim())
    .filter((field) => field.length > 0 && jobFieldAllowList.has(field));
  return parsed.length > 0 ? parsed : ["*"];
}

function toUnixTimestamp(value: string): number {
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) {
    return Math.floor(Date.now() / 1000);
  }
  return Math.floor(ms / 1000);
}

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function isTerminalStatus(status: string): boolean {
  return status === "completed" || status === "failed";
}

function parseBrandResult(resultUrl: string | null) {
  if (!resultUrl) {
    return null;
  }
  const match = /^brands\/([0-9a-fA-F-]{36})$/.exec(resultUrl);
  if (!match) {
    return null;
  }
  return {
    type: "brand" as const,
    id: match[1],
    url: resultUrl,
  };
}

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
 * Retrieve a single async job status/result by ID.
 * Returns 404 for cross-org access to avoid leaking job existence.
 */
export const GET = withApiAuth(async (request, context) => {
  const resolvedParams = await resolveRouteParams(context.params);
  const parsedParams = paramsSchema.safeParse(resolvedParams ?? {});
  if (!parsedParams.success) {
    return apiError(
      "invalid_job_id",
      "Job id must be a valid UUID.",
      400,
      request.requestId
    );
  }

  const url = new URL(request.url);
  const parsedQuery = querySchema.safeParse({
    expand: url.searchParams.get("expand") ?? undefined,
    include: url.searchParams.get("include") ?? undefined,
    fields: url.searchParams.get("fields") ?? undefined,
    wait_for_completion: url.searchParams.get("wait_for_completion") ?? undefined,
    timeout_seconds: url.searchParams.get("timeout_seconds") ?? undefined,
  });
  if (!parsedQuery.success) {
    return apiError(
      "invalid_expand_param",
      "expand must be 'brand' when provided.",
      400,
      request.requestId
    );
  }

  const includeBrand =
    parsedQuery.data.expand === "brand" || parsedQuery.data.include === "brand";
  const requestedFields = parseFields(parsedQuery.data.fields);
  const selectedFields = new Set(requestedFields);
  if (includeBrand || requestedFields.includes("*")) {
    selectedFields.add("result_url");
  }
  const selectClause =
    requestedFields.includes("*") ? "*" : Array.from(selectedFields).join(",");

  const supabase = getServiceSupabaseClient();
  const waitForCompletion = parsedQuery.data.wait_for_completion === true;
  const timeoutSeconds = parsedQuery.data.timeout_seconds ?? 20;
  const deadlineMs = Date.now() + timeoutSeconds * 1000;

  let job: Record<string, unknown> | null = null;
  while (Date.now() <= deadlineMs) {
    const { data: rawData, error } = await supabase
      .from("jobs")
      .select(selectClause)
      .eq("id", parsedParams.data.id)
      .maybeSingle();

    if (error) {
      return apiError(
        "job_lookup_failed",
        "Failed to fetch job.",
        500,
        request.requestId,
        "api_error"
      );
    }

    if (!rawData || typeof rawData !== "object") {
      return apiError("job_not_found", "Job not found.", 404, request.requestId);
    }
    const data = rawData as Record<string, unknown>;

    if (data.org_id !== request.organizationId) {
      console.warn("[jobs.get] cross_org_access_denied", {
        requestId: request.requestId,
        jobId: parsedParams.data.id,
        requesterOrgId: request.organizationId,
        ownerOrgId: data.org_id,
      });
      return apiError("job_not_found", "Job not found.", 404, request.requestId);
    }

    job = data;
    if (!waitForCompletion || isTerminalStatus(String(data.status))) {
      break;
    }
    await sleep(1000);
  }

  if (!job) {
    return apiError("job_not_found", "Job not found.", 404, request.requestId);
  }

  const resultRef = parseBrandResult((job.result_url as string | null) ?? null);

  console.info("[jobs.get] lookup_success", {
    requestId: request.requestId,
    jobId: job.id,
    orgId: request.organizationId,
    status: job.status,
    expand: parsedQuery.data.expand ?? null,
    include: parsedQuery.data.include ?? null,
    waitForCompletion,
    timeoutSeconds,
    selectClause,
  });

  let expanded: { brand?: Record<string, unknown> } | undefined;
  if (includeBrand && resultRef) {
    const { data: brand } = await supabase
      .from("brands")
      .select("*")
      .eq("id", resultRef.id)
      .eq("org_id", request.organizationId)
      .maybeSingle();
    if (brand) {
      expanded = {
        brand,
      };
    }
  }

  return apiSuccess(
    {
      ...job,
      created_at: toUnixTimestamp(String(job.created_at)),
      updated_at: toUnixTimestamp(String(job.updated_at)),
      ...(resultRef
        ? {
            job_result: {
              ...resultRef,
              ...(expanded?.brand ? { brand: expanded.brand } : {}),
            },
          }
        : {}),
      ...(expanded ? { expanded } : {}),
    },
    "job",
    request.requestId
  );
});
