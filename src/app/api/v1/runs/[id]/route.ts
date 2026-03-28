import { z } from "zod";

import { apiError, apiSuccess } from "@/lib/api-response";
import { withApiAuth } from "@/lib/auth";
import { getServiceSupabaseClient } from "@/lib/supabase";

const paramsSchema = z.object({
  id: z.string().uuid(),
});

const querySchema = z.object({
  wait_for_completion: z
    .string()
    .transform((value) => value === "true")
    .optional(),
  timeout_seconds: z.coerce.number().int().min(1).max(30).optional(),
});

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTerminalRunStatus(status: string) {
  return status === "completed" || status === "failed" || status === "cancelled";
}

function toUnixTimestamp(value: string): number {
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) {
    return Math.floor(Date.now() / 1000);
  }
  return Math.floor(ms / 1000);
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
 * Retrieve a pipeline run and optionally wait for completion.
 */
export const GET = withApiAuth(async (request, context) => {
  const resolvedParams = await resolveRouteParams(context.params);
  const parsedParams = paramsSchema.safeParse(resolvedParams ?? {});
  if (!parsedParams.success) {
    return apiError("invalid_run_id", "Run id must be a valid UUID.", 400, request.requestId);
  }

  const url = new URL(request.url);
  const parsedQuery = querySchema.safeParse({
    wait_for_completion: url.searchParams.get("wait_for_completion") ?? undefined,
    timeout_seconds: url.searchParams.get("timeout_seconds") ?? undefined,
  });
  if (!parsedQuery.success) {
    return apiError("invalid_query_params", "Invalid query parameters.", 400, request.requestId);
  }

  const supabase = getServiceSupabaseClient();
  const waitForCompletion = parsedQuery.data.wait_for_completion === true;
  const timeoutSeconds = parsedQuery.data.timeout_seconds ?? 20;
  const deadlineMs = Date.now() + timeoutSeconds * 1000;

  let run: Record<string, unknown> | null = null;
  while (Date.now() <= deadlineMs) {
    const { data, error } = await supabase
      .from("runs")
      .select("*")
      .eq("id", parsedParams.data.id)
      .maybeSingle();

    if (error) {
      return apiError("run_lookup_failed", "Failed to fetch run.", 500, request.requestId, "api_error");
    }
    if (!data || typeof data !== "object") {
      return apiError("run_not_found", "Run not found.", 404, request.requestId);
    }
    if (data.org_id !== request.organizationId) {
      return apiError("run_not_found", "Run not found.", 404, request.requestId);
    }

    run = data as Record<string, unknown>;
    if (!waitForCompletion || isTerminalRunStatus(String(data.status))) {
      break;
    }
    await sleep(1000);
  }

  if (!run) {
    return apiError("run_not_found", "Run not found.", 404, request.requestId);
  }

  return apiSuccess(
    {
      ...run,
      created_at: toUnixTimestamp(String(run.created_at)),
      updated_at: toUnixTimestamp(String(run.updated_at)),
    },
    "run",
    request.requestId
  );
});
