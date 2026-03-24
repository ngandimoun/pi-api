import { z } from "zod";

import { apiError, apiSuccess } from "@/lib/api-response";
import { withApiAuth } from "@/lib/auth";
import { getServiceSupabaseClient } from "@/lib/supabase";

const querySchema = z.object({
  query: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  expand: z.enum(["latest_job"]).optional(),
  include: z.enum(["latest_job"]).optional(),
  fields: z.string().trim().min(1).optional(),
});

const brandFieldAllowList = new Set([
  "id",
  "org_id",
  "domain",
  "name",
  "primary_hex",
  "secondary_hex",
  "logo_url",
  "font_file_url",
  "layout_rules",
  "brand_dna",
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
    .filter((field) => field.length > 0 && brandFieldAllowList.has(field));
  return parsed.length > 0 ? parsed : ["*"];
}

/**
 * List brands for the authenticated organization with optional fuzzy search.
 * Pagination uses limit/offset and returns has_more for Stripe-style list UX.
 */
export const GET = withApiAuth(async (request) => {
  const url = new URL(request.url);
  const parsedQuery = querySchema.safeParse({
    query: url.searchParams.get("query") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
    offset: url.searchParams.get("offset") ?? undefined,
    expand: url.searchParams.get("expand") ?? undefined,
    include: url.searchParams.get("include") ?? undefined,
    fields: url.searchParams.get("fields") ?? undefined,
  });

  if (!parsedQuery.success) {
    return apiError(
      "invalid_query_params",
      parsedQuery.error.issues[0]?.message ?? "Invalid query parameters.",
      400,
      request.requestId
    );
  }

  const { query, limit, offset } = parsedQuery.data;
  const includeLatestJob =
    parsedQuery.data.expand === "latest_job" ||
    parsedQuery.data.include === "latest_job";
  const requestedFields = parseFields(parsedQuery.data.fields);
  const selectedFields = new Set(requestedFields);
  if (includeLatestJob || requestedFields.includes("*")) {
    selectedFields.add("id");
  }
  const selectClause =
    requestedFields.includes("*") ? "*" : Array.from(selectedFields).join(",");
  const supabase = getServiceSupabaseClient();

  let countBuilder = supabase
    .from("brands")
    .select("id", { count: "exact", head: true })
    .eq("org_id", request.organizationId);

  let listBuilder = supabase
    .from("brands")
    .select(selectClause)
    .eq("org_id", request.organizationId)
    .order("created_at", { ascending: false });

  if (query) {
    const fuzzy = `%${query}%`;
    countBuilder = countBuilder.ilike("name", fuzzy);
    listBuilder = listBuilder.ilike("name", fuzzy);
  }

  listBuilder = listBuilder.range(offset, offset + limit - 1);

  const [{ count, error: countError }, { data, error: listError }] = await Promise.all([
    countBuilder,
    listBuilder,
  ]);

  if (countError || listError) {
    return apiError(
      "brands_list_failed",
      "Failed to list brands.",
      500,
      request.requestId,
      "api_error"
    );
  }

  const rows = ((data ?? []) as unknown[]).filter(
    (row): row is Record<string, unknown> => typeof row === "object" && row !== null
  );
  let enrichedRows = rows;
  if (includeLatestJob && rows.length > 0) {
    const brandIds = rows
      .map((row) => row.id)
      .filter((id): id is string => typeof id === "string");
    const { data: jobs } = await supabase
      .from("jobs")
      .select("*")
      .eq("org_id", request.organizationId)
      .eq("type", "brand_extraction")
      .order("created_at", { ascending: false });

    const latestByBrandId = new Map<string, Record<string, unknown>>();
    for (const job of jobs ?? []) {
      if (!job || typeof job !== "object" || typeof job.result_url !== "string") {
        continue;
      }
      const match = /^brands\/([0-9a-fA-F-]{36})$/.exec(job.result_url);
      if (!match) {
        continue;
      }
      const brandId = match[1];
      if (!brandIds.includes(brandId) || latestByBrandId.has(brandId)) {
        continue;
      }
      latestByBrandId.set(brandId, job);
    }

    enrichedRows = rows.map((row) => ({
      ...row,
      expanded: {
        latest_job:
          latestByBrandId.get(
            typeof row.id === "string" ? row.id : String(row.id ?? "")
          ) ?? null,
      },
    }));
  }

  const totalCount = count ?? 0;
  const hasMore = offset + rows.length < totalCount;

  console.info("[brands.list] lookup_success", {
    requestId: request.requestId,
    orgId: request.organizationId,
    query: query ?? null,
    limit,
    offset,
    returned: enrichedRows.length,
    totalCount,
    hasMore,
    includeLatestJob,
    selectClause,
  });

  return apiSuccess(
    {
      data: enrichedRows,
      total_count: totalCount,
      has_more: hasMore,
    },
    "list",
    request.requestId
  );
});
