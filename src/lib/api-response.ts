import { NextResponse } from "next/server";
import type { ZodError } from "zod";

export type StripeErrorType =
  | "invalid_request_error"
  | "authentication_error"
  | "permission_error"
  | "rate_limit_error"
  | "api_error";

/**
 * Standard success envelope for Pi API endpoints.
 */
export function apiSuccess<T>(data: T, objectType: string, requestId: string) {
  return NextResponse.json({
    id: requestId,
    object: objectType,
    status: "completed",
    created_at: Math.floor(Date.now() / 1000),
    data,
  });
}

/**
 * Same envelope shape as `apiSuccess`, but allows a custom top-level `status` and HTTP status (e.g. voice_session "active" + 201).
 */
export function apiSuccessEnvelope<T>(input: {
  data: T;
  object: string;
  requestId: string;
  status: string;
  httpStatus?: number;
}) {
  const { data, object, requestId, status, httpStatus = 200 } = input;
  return NextResponse.json(
    {
      id: requestId,
      object,
      status,
      created_at: Math.floor(Date.now() / 1000),
      data,
    },
    { status: httpStatus }
  );
}

/**
 * Standard Stripe-style error envelope.
 */
export function apiError(
  code: string,
  message: string,
  statusCode: number,
  requestId: string,
  type: StripeErrorType = "invalid_request_error",
  extra?: Record<string, unknown>
) {
  return NextResponse.json(
    {
      error: {
        type,
        code,
        message,
        request_id: requestId,
        ...(extra ?? {}),
      },
    },
    { status: statusCode }
  );
}

export function apiZodError(
  code: string,
  error: ZodError,
  statusCode: number,
  requestId: string
) {
  const first = error.issues[0];
  const param = first?.path?.length ? first.path.join(".") : undefined;
  return apiError(
    code,
    first?.message ?? "Invalid request payload.",
    statusCode,
    requestId,
    "invalid_request_error",
    {
      ...(param ? { param } : {}),
      issues: error.issues,
    }
  );
}
