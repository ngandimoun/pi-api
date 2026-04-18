import { apiError, apiSuccessEnvelope } from "@/lib/api-response";
import { resolveOrganizationIdFromUnkeyData } from "@/lib/pi-cli-server";
import { getServiceSupabaseClient } from "@/lib/supabase";
import { getUnkeyVerifyPayload, verifyUnkeyApiKey } from "@/lib/unkey";

/**
 * Verify Pi API key for CLI / pi-hokage wizard (Bearer auth).
 */
export async function POST(request: Request) {
  const requestId = `req_pi_${crypto.randomUUID()}`;
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    const res = apiError(
      "missing_auth",
      "Missing Authorization: Bearer <api_key>.",
      401,
      requestId,
      "invalid_request_error"
    );
    res.headers.set("X-Request-Id", requestId);
    return res;
  }

  const apiKey = authHeader.slice(7).trim();
  if (!apiKey) {
    const res = apiError("empty_token", "Bearer token is empty.", 401, requestId, "invalid_request_error");
    res.headers.set("X-Request-Id", requestId);
    return res;
  }

  try {
    const verify = await verifyUnkeyApiKey(apiKey, null, "identity");
    const data = getUnkeyVerifyPayload(verify);
    const valid = data?.valid === true;
    if (!valid) {
      const code = typeof data?.code === "string" ? data.code : "";
      if (code === "DISABLED") {
        const res = apiError(
          "key_disabled",
          "API key is inactive — complete your Pi CLI subscription in the dashboard to enable access.",
          403,
          requestId,
          "authentication_error",
          { code: "DISABLED" }
        );
        res.headers.set("X-Request-Id", requestId);
        return res;
      }
      const res = apiError("invalid_key", "Invalid API key.", 401, requestId, "authentication_error");
      res.headers.set("X-Request-Id", requestId);
      return res;
    }

    const organizationId = resolveOrganizationIdFromUnkeyData(data);
    const ratelimits = data?.ratelimits;
    const first = Array.isArray(ratelimits) ? (ratelimits[0] as Record<string, unknown> | undefined) : undefined;

    // Metering: record CLI verify as a lightweight usage event (best-effort)
    if (organizationId && typeof data?.keyId === "string") {
      try {
        const supabase = getServiceSupabaseClient();
        const { data: ak } = await supabase
          .from("api_keys")
          .select("id")
          .eq("unkey_key_id", data.keyId)
          .maybeSingle();
        await supabase.from("usage_events").insert({
          user_id: organizationId,
          api_key_id: ak?.id ?? null,
          event_type: "cli_request",
          tokens_used: 0,
          cost_cents: 0,
        });
      } catch {
        // ignore metering failures
      }
    }

    const res = apiSuccessEnvelope({
      data: {
        valid: true,
        organization_id: organizationId,
        remaining: typeof first?.remaining === "number" ? first.remaining : null,
      },
      object: "cli_auth_verify",
      requestId,
      status: "completed",
      httpStatus: 200,
    });
    res.headers.set("X-Request-Id", requestId);
    return res;
  } catch (e) {
    const message = e instanceof Error ? e.message : "Verification failed.";
    const res = apiError("verify_failed", message, 500, requestId, "api_error");
    res.headers.set("X-Request-Id", requestId);
    return res;
  }
}
