import { z } from "zod";

import { apiError, apiSuccess } from "@/lib/api-response";
import { withApiAuth } from "@/lib/auth";
import { getServiceSupabaseClient } from "@/lib/supabase";

const paramsSchema = z.object({
  id: z.string().uuid(),
});
const querySchema = z.object({
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
 * Retrieve a single brand resource by ID for the authenticated organization.
 * Returns 404 for missing/cross-org resources to avoid existence leakage.
 */
export const GET = withApiAuth(async (request, context) => {
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

  const url = new URL(request.url);
  const parsedQuery = querySchema.safeParse({
    expand: url.searchParams.get("expand") ?? undefined,
    include: url.searchParams.get("include") ?? undefined,
    fields: url.searchParams.get("fields") ?? undefined,
  });
  if (!parsedQuery.success) {
    return apiError(
      "invalid_expand_param",
      "expand/include must be 'latest_job' when provided.",
      400,
      request.requestId
    );
  }

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
  const { data: rawBrand, error } = await supabase
    .from("brands")
    .select(selectClause)
    .eq("id", parsedParams.data.id)
    .maybeSingle();

  if (error) {
    return apiError(
      "brand_lookup_failed",
      "Failed to fetch brand.",
      500,
      request.requestId,
      "api_error"
    );
  }

  if (!rawBrand || typeof rawBrand !== "object") {
    return apiError("brand_not_found", "Brand not found.", 404, request.requestId);
  }
  const brand = rawBrand as Record<string, unknown>;

  if (brand.org_id !== request.organizationId) {
    console.warn("[brands.get] cross_org_access_denied", {
      requestId: request.requestId,
      brandId: parsedParams.data.id,
      requesterOrgId: request.organizationId,
      ownerOrgId: brand.org_id,
    });
    return apiError("brand_not_found", "Brand not found.", 404, request.requestId);
  }

  console.info("[brands.get] lookup_success", {
    requestId: request.requestId,
    brandId: brand.id,
    orgId: request.organizationId,
    name: "name" in brand ? brand.name : null,
    includeLatestJob,
    selectClause,
  });

  let payload: Record<string, unknown> = brand;
  if (includeLatestJob) {
    const { data: latestJob } = await supabase
      .from("jobs")
      .select("*")
      .eq("org_id", request.organizationId)
      .eq("type", "brand_extraction")
      .eq("result_url", `brands/${String(brand.id)}`)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    payload = {
      ...brand,
      expanded: {
        latest_job: latestJob ?? null,
      },
    };
  }

  return apiSuccess(payload, "brand", request.requestId);
});
