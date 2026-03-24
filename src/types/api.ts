import type { NextRequest } from "next/server";

export interface AuthenticatedRequest extends NextRequest {
  organizationId: string;
  requestId: string;
  developerId: string;
}

export type AppRouteContext = {
  params?:
    | Record<string, string | string[]>
    | Promise<Record<string, string | string[]>>;
};
