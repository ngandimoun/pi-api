import { apiError, apiSuccessEnvelope } from "@/lib/api-response";
import { withApiAuth } from "@/lib/auth";
import {
  canPersistTeamSystemStyle,
  getResonateDraft,
  logPiCliGovernanceAction,
  resolvePiCliRole,
  resolveResonateDraft,
} from "@/lib/pi-cli-governance";
import { uploadLatestPiSystemStyle } from "@/lib/pi-cli-r2";
import type { AppRouteContext } from "@/types/api";

async function draftIdFromContext(context: AppRouteContext): Promise<string | undefined> {
  const params = await Promise.resolve(context.params ?? {});
  const raw = params.draftId;
  if (typeof raw === "string") return raw;
  if (Array.isArray(raw) && raw[0]) return raw[0];
  return undefined;
}

/** Tech lead / admin approves a pending resonate system-style draft → team R2 snapshot. */
export const POST = withApiAuth(async (request, context: AppRouteContext) => {
  const requestId = request.requestId;
  const draftId = await draftIdFromContext(context);
  if (!draftId?.trim()) {
    return apiError("invalid_request", "Missing draft id.", 400, requestId, "invalid_request_error");
  }

  const role = await resolvePiCliRole(request.organizationId, request.developerId);
  if (!canPersistTeamSystemStyle(role)) {
    return apiError(
      "forbidden",
      "Approving drafts requires admin or tech_lead role.",
      403,
      requestId,
      "permission_error"
    );
  }

  const draft = await getResonateDraft(draftId.trim(), request.organizationId);
  if (!draft || draft.status !== "pending") {
    return apiError("not_found", "Draft not found or already resolved.", 404, requestId, "invalid_request_error");
  }

  try {
    if (process.env.R2_BUCKET_NAME?.trim() || process.env.R2_PI_GRAPHS_BUCKET?.trim()) {
      await uploadLatestPiSystemStyle(request.organizationId, draft.proposed_system_style);
    } else {
      console.warn("[pi-cli/resonate/approve] r2_not_configured");
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Upload failed.";
    return apiError("approve_failed", message, 500, requestId, "api_error");
  }

  const ok = await resolveResonateDraft({
    id: draftId.trim(),
    organizationId: request.organizationId,
    status: "approved",
    resolvedBy: request.developerId,
  });
  if (!ok) {
    return apiError("approve_failed", "Could not mark draft approved.", 500, requestId, "api_error");
  }

  await logPiCliGovernanceAction({
    organizationId: request.organizationId,
    developerId: draft.developer_id,
    action: "resonate_draft_approved",
    details: { draft_id: draftId },
    approvedBy: request.developerId,
  });

  const res = apiSuccessEnvelope({
    data: { ok: true, draft_id: draftId.trim() },
    object: "pi_cli_resonate_approve",
    requestId,
    status: "completed",
    httpStatus: 200,
  });
  res.headers.set("X-Request-Id", requestId);
  return res;
});
