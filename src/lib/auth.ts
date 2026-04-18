import { NextResponse, type NextRequest } from "next/server";

import { apiError, type StripeErrorType } from "@/lib/api-response";
import { readProviderKeysFromRequest } from "@/lib/provider-keys";
import { getUnkeyVerifyPayload, verifyUnkeyApiKey } from "@/lib/unkey";
import type { AppRouteContext, AuthenticatedRequest } from "@/types/api";

type AuthenticatedHandler<TContext extends AppRouteContext = AppRouteContext> = (
  request: AuthenticatedRequest,
  context: TContext
) => Response | Promise<Response>;

function resolveOrganizationId(data: unknown): string | null {
  if (!data || typeof data !== "object") {
    return null;
  }

  const record = data as Record<string, unknown>;
  const meta = record.meta as Record<string, unknown> | undefined;
  const identity = record.identity as Record<string, unknown> | undefined;

  const fromMeta = meta?.organization_id;
  if (typeof fromMeta === "string" && fromMeta.length > 0) {
    return fromMeta;
  }

  const fromIdentity = identity?.externalId;
  if (typeof fromIdentity === "string" && fromIdentity.length > 0) {
    return fromIdentity;
  }

  return null;
}

function resolveDeveloperId(data: unknown, organizationId: string): string {
  if (!data || typeof data !== "object") {
    return organizationId;
  }
  const record = data as Record<string, unknown>;
  const identity = record.identity as Record<string, unknown> | undefined;

  const keyId = record.keyId;
  if (typeof keyId === "string" && keyId.length > 0) {
    return keyId;
  }

  const ownerId = record.ownerId;
  if (typeof ownerId === "string" && ownerId.length > 0) {
    return ownerId;
  }

  const identityExternalId = identity?.externalId;
  if (typeof identityExternalId === "string" && identityExternalId.length > 0) {
    return identityExternalId;
  }

  return organizationId;
}

function mapUnkeyError(code: string): {
  statusCode: number;
  type: StripeErrorType;
  message: string;
} {
  switch (code) {
    case "RATE_LIMITED":
      return {
        statusCode: 429,
        type: "rate_limit_error",
        message: "Rate limit exceeded for this API key.",
      };
    case "NOT_FOUND":
      return {
        statusCode: 401,
        type: "authentication_error",
        message: "Invalid API key.",
      };
    case "DISABLED":
    case "EXPIRED":
    case "USAGE_EXCEEDED":
    case "FORBIDDEN":
    case "INSUFFICIENT_PERMISSIONS":
      return {
        statusCode: 403,
        type: "permission_error",
        message: `API key verification failed: ${code.toLowerCase()}.`,
      };
    default:
      return {
        statusCode: 401,
        type: "authentication_error",
        message: "Authentication failed.",
      };
  }
}

function withCommonHeaders(
  response: NextResponse,
  requestId: string,
  rateHeaders?: Record<string, string>
) {
  response.headers.set("X-Request-Id", requestId);

  if (rateHeaders) {
    for (const [key, value] of Object.entries(rateHeaders)) {
      response.headers.set(key, value);
    }
  }

  return response;
}

function pickPrimaryRatelimit(data: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  const list = data?.ratelimits;
  if (!Array.isArray(list) || list.length === 0) return undefined;
  const exceeded = list.find((r) => (r as { exceeded?: boolean }).exceeded === true) as
    | Record<string, unknown>
    | undefined;
  if (exceeded) return exceeded;
  const cli = list.find((r) => (r as { name?: string }).name === "cli_requests_monthly") as
    | Record<string, unknown>
    | undefined;
  return cli ?? (list[0] as Record<string, unknown>);
}

export function withApiAuth<TContext extends AppRouteContext = AppRouteContext>(
  handler: AuthenticatedHandler<TContext>
) {
  return async (request: NextRequest, context: TContext): Promise<Response> => {
    const requestId = `req_pi_${crypto.randomUUID()}`;
    const authHeader = request.headers.get("authorization");

    if (!authHeader) {
      return withCommonHeaders(
        apiError(
          "missing_authorization_header",
          "Missing Authorization header. Use Bearer <api_key>.",
          401,
          requestId,
          "invalid_request_error"
        ),
        requestId
      );
    }

    const bearerPrefix = "Bearer ";
    if (!authHeader.startsWith(bearerPrefix)) {
      return withCommonHeaders(
        apiError(
          "invalid_authorization_scheme",
          "Authorization header must use Bearer token format.",
          401,
          requestId,
          "invalid_request_error"
        ),
        requestId
      );
    }

    const token = authHeader.slice(bearerPrefix.length).trim();
    if (!token) {
      return withCommonHeaders(
        apiError(
          "missing_bearer_token",
          "Bearer token is empty.",
          401,
          requestId,
          "invalid_request_error"
        ),
        requestId
      );
    }

    try {
      const pathname = new URL(request.url).pathname;
      const verify = await verifyUnkeyApiKey(token, pathname, "billing");
      const data = getUnkeyVerifyPayload(verify);

      const ratelimit = pickPrimaryRatelimit(data);

      const rateHeaders: Record<string, string> | undefined = ratelimit
        ? {
            "X-RateLimit-Limit": String(ratelimit.limit ?? ""),
            "X-RateLimit-Remaining": String(ratelimit.remaining ?? ""),
            "X-RateLimit-Reset": String(
              Math.floor((Date.now() + Number(ratelimit.reset ?? 0)) / 1000)
            ),
          }
        : undefined;

      const valid = data?.valid === true;
      if (!valid) {
        const rawCode = String(data?.code ?? "AUTH_FAILED");
        const mapped = mapUnkeyError(rawCode);
        const response = withCommonHeaders(
          apiError(
            `unkey_${rawCode.toLowerCase()}`,
            mapped.message,
            mapped.statusCode,
            requestId,
            mapped.type
          ),
          requestId,
          rateHeaders
        );

        if (mapped.statusCode === 429) {
          const reset = rateHeaders?.["X-RateLimit-Reset"];
          const resetEpoch = reset ? Number(reset) : Number.NaN;
          const nowEpoch = Math.floor(Date.now() / 1000);
          if (!Number.isNaN(resetEpoch) && resetEpoch > nowEpoch) {
            response.headers.set("Retry-After", String(Math.max(resetEpoch - nowEpoch, 1)));
          }
        }

        return response;
      }

      const organizationId = resolveOrganizationId(data);
      if (!organizationId) {
        return withCommonHeaders(
          apiError(
            "missing_organization_context",
            "API key is valid but missing organization context.",
            403,
            requestId,
            "permission_error"
          ),
          requestId,
          rateHeaders
        );
      }

      const authenticatedRequest = request as AuthenticatedRequest;
      authenticatedRequest.organizationId = organizationId;
      authenticatedRequest.requestId = requestId;
      authenticatedRequest.developerId = resolveDeveloperId(data, organizationId);
      authenticatedRequest.apiKey = token;
      authenticatedRequest.providerKeys = readProviderKeysFromRequest(request);

      const handlerResponse = await handler(authenticatedRequest, context);
      const response = new NextResponse(handlerResponse.body, {
        status: handlerResponse.status,
        statusText: handlerResponse.statusText,
        headers: handlerResponse.headers,
      });
      return withCommonHeaders(response, requestId, rateHeaders);
    } catch {
      return withCommonHeaders(
        apiError(
          "auth_internal_error",
          "Unable to verify API key at this time.",
          500,
          requestId,
          "api_error"
        ),
        requestId
      );
    }
  };
}
