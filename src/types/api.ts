import type { NextRequest } from "next/server";

export interface AuthenticatedRequest extends NextRequest {
  organizationId: string;
  requestId: string;
  developerId: string;
  /** Raw Pi API key (Bearer token) — server-only; used for follow-up Unkey calls if needed. */
  apiKey?: string;
  providerKeys?: {
    gemini?: string;
    firecrawl?: string;
    livekit?: {
      apiKey?: string;
      apiSecret?: string;
    };
  };
}

export type AppRouteContext = {
  params?:
    | Record<string, string | string[]>
    | Promise<Record<string, string | string[]>>;
};
