import { NextResponse } from "next/server";

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
 * Standard Stripe-style error envelope.
 */
export function apiError(
  code: string,
  message: string,
  statusCode: number,
  requestId: string,
  type: StripeErrorType = "invalid_request_error"
) {
  return NextResponse.json(
    {
      error: {
        type,
        code,
        message,
        request_id: requestId,
      },
    },
    { status: statusCode }
  );
}
