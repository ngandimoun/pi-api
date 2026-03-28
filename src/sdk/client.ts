import {
  brandExtractionInputContract,
  brandListContract,
  brandProjectionRequestContract,
  brandProjectionResponseContract,
  brandRetrieveContract,
  errorEnvelopeContract,
  extractJobQueuedContract,
  jobRetrieveContract,
  type BrandExtractionInputContract,
} from "@/contracts/brand-api";
import { createRunInputSchema, runCreateResponseContract, runRetrieveContract } from "@/contracts/run-api";
import {
  avatarGenerationInputSchema,
  avatarSaveInputSchema,
} from "@/contracts/avatar-api";
import { adGenerationInputSchema } from "@/contracts/ads-api";
import { campaignAdGenerationInputSchema } from "@/contracts/campaign-ads-api";
import { campaignAdEditInputSchema } from "@/contracts/campaign-ads-edit-api";
import { campaignAdLocalizationInputSchema } from "@/contracts/campaign-localize-api";
import { z } from "zod";

type RequestOptions = {
  method?: "GET" | "POST";
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
  headers?: Record<string, string | undefined>;
};

export type CreatePiClientOptions = {
  apiKey: string;
  baseUrl: string;
};

/**
 * Creates a typed Pi API client for server-side integrations.
 */
export function createPiClient({ apiKey, baseUrl }: CreatePiClientOptions) {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, "");

  async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const url = new URL(`${normalizedBaseUrl}${path}`);
    if (options.query) {
      for (const [key, value] of Object.entries(options.query)) {
        if (value !== undefined) {
          url.searchParams.set(key, String(value));
        }
      }
    }

    const response = await fetch(url.toString(), {
      method: options.method ?? "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        ...(options.headers ?? {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    const json = await response.json();
    if (!response.ok) {
      const parsedError = errorEnvelopeContract.safeParse(json);
      if (parsedError.success) {
        throw new Error(
          `${parsedError.data.error.code}: ${parsedError.data.error.message}`
        );
      }
      throw new Error(`Request failed with status ${response.status}`);
    }

    return json as T;
  }

  return {
    brands: {
      extract: async (input: BrandExtractionInputContract) => {
        const validated = brandExtractionInputContract.parse(input);
        const response = await request<unknown>("/api/v1/brands/extract", {
          method: "POST",
          body: validated,
        });
        return extractJobQueuedContract.parse(response);
      },
      list: async (params?: {
        query?: string;
        limit?: number;
        offset?: number;
        expand?: "latest_job";
        include?: "latest_job";
      }) => {
        const response = await request<unknown>("/api/v1/brands", {
          query: params,
        });
        return brandListContract.parse(response);
      },
      retrieve: async (id: string, params?: { expand?: "latest_job"; include?: "latest_job" }) => {
        const response = await request<unknown>(`/api/v1/brands/${id}`, {
          query: params,
        });
        return brandRetrieveContract.parse(response);
      },
      project: async (id: string, input: { use_case: string }) => {
        const validated = brandProjectionRequestContract.parse(input);
        const response = await request<unknown>(`/api/v1/brands/${id}/project`, {
          method: "POST",
          body: validated,
        });
        return brandProjectionResponseContract.parse(response);
      },
    },
    jobs: {
      retrieve: async (
        id: string,
        params?: {
          expand?: "brand" | "avatar" | "ad" | "diagnostics";
          include?: "brand" | "avatar" | "ad" | "diagnostics";
          wait_for_completion?: boolean;
          timeout_seconds?: number;
        }
      ) => {
        const response = await request<unknown>(`/api/v1/jobs/${id}`, {
          query: params,
        });
        return jobRetrieveContract.parse(response);
      },
    },
    avatars: {
      generate: async (input: unknown, options?: { idempotencyKey?: string }) => {
        const validated = avatarGenerationInputSchema.parse(input);
        const response = await request<unknown>("/api/v1/avatars/generate", {
          method: "POST",
          body: validated,
          headers: options?.idempotencyKey
            ? { "Idempotency-Key": options.idempotencyKey }
            : undefined,
        });
        return extractJobQueuedContract.parse(response);
      },
      save: async (input: unknown) => {
        const validated = avatarSaveInputSchema.parse(input);
        const response = await request<unknown>("/api/v1/avatars/save", {
          method: "POST",
          body: validated,
        });
        const savedAvatarContract = z.object({
          id: z.string().uuid(),
          object: z.literal("saved_avatar"),
          label: z.string().nullable(),
          image_url: z.string().url(),
          created_at: z.string(),
        });
        const envelope = z.object({
          id: z.string(),
          object: z.string(),
          status: z.string(),
          created_at: z.number(),
          data: savedAvatarContract,
        });
        return envelope.parse(response);
      },
      list: async (params?: { limit?: number; offset?: number }) => {
        const response = await request<unknown>("/api/v1/avatars", { query: params });
        const envelope = z.object({
          id: z.string(),
          object: z.string(),
          status: z.string(),
          created_at: z.number(),
          data: z.object({
            object: z.literal("list"),
            data: z.array(
              z.object({
                id: z.string().uuid(),
                label: z.string().nullable(),
                image_url: z.string().url(),
                created_at: z.string(),
              })
            ),
            has_more: z.boolean(),
            total_count: z.number(),
          }),
        });
        return envelope.parse(response);
      },
      retrieve: async (id: string) => {
        const response = await request<unknown>(`/api/v1/avatars/${id}`);
        const envelope = z.object({
          id: z.string(),
          object: z.string(),
          status: z.string(),
          created_at: z.number(),
          data: z.object({
            id: z.string().uuid(),
            object: z.literal("saved_avatar"),
            label: z.string().nullable(),
            image_url: z.string().url(),
            created_at: z.string(),
            updated_at: z.string(),
          }),
        });
        return envelope.parse(response);
      },
    },
    images: {
      generate: async (input: unknown, options?: { idempotencyKey?: string }) => {
        const validated = adGenerationInputSchema.parse(input);
        const response = await request<unknown>("/api/v1/images/generations", {
          method: "POST",
          body: validated,
          headers: options?.idempotencyKey
            ? { "Idempotency-Key": options.idempotencyKey }
            : undefined,
        });
        return extractJobQueuedContract.parse(response);
      },
    },
    ads: {
      generate: async (input: unknown, options?: { idempotencyKey?: string }) => {
        const validated = adGenerationInputSchema.parse(input);
        const response = await request<unknown>("/api/v1/ads/generate", {
          method: "POST",
          body: validated,
          headers: options?.idempotencyKey
            ? { "Idempotency-Key": options.idempotencyKey }
            : undefined,
        });
        return extractJobQueuedContract.parse(response);
      },
    },
    campaigns: {
      generate: async (input: unknown, options?: { idempotencyKey?: string }) => {
        const validated = campaignAdGenerationInputSchema.parse(input);
        const response = await request<unknown>("/api/v1/campaigns/generate", {
          method: "POST",
          body: validated,
          headers: options?.idempotencyKey
            ? { "Idempotency-Key": options.idempotencyKey }
            : undefined,
        });
        return extractJobQueuedContract.parse(response);
      },
      edit: async (input: unknown, options?: { idempotencyKey?: string }) => {
        const validated = campaignAdEditInputSchema.parse(input);
        const response = await request<unknown>("/api/v1/campaigns/edit", {
          method: "POST",
          body: validated,
          headers: options?.idempotencyKey
            ? { "Idempotency-Key": options.idempotencyKey }
            : undefined,
        });
        return extractJobQueuedContract.parse(response);
      },
      localizeAd: async (input: unknown, options?: { idempotencyKey?: string }) => {
        const validated = campaignAdLocalizationInputSchema.parse(input);
        const response = await request<unknown>("/api/v1/campaigns/localize-ad", {
          method: "POST",
          body: validated,
          headers: options?.idempotencyKey
            ? { "Idempotency-Key": options.idempotencyKey }
            : undefined,
        });
        return extractJobQueuedContract.parse(response);
      },
    },
    runs: {
      create: async (input: unknown) => {
        const validated = createRunInputSchema.parse(input);
        const response = await request<unknown>("/api/v1/runs", {
          method: "POST",
          body: validated,
        });
        return runCreateResponseContract.parse(response);
      },
      retrieve: async (
        id: string,
        params?: {
          wait_for_completion?: boolean;
          timeout_seconds?: number;
        }
      ) => {
        const response = await request<unknown>(`/api/v1/runs/${id}`, {
          query: params,
        });
        return runRetrieveContract.parse(response);
      },
      createAndWait: async (
        input: unknown,
        options?: {
          timeout_seconds?: number;
          poll_interval_ms?: number;
        }
      ) => {
        const created = await (async () => {
          const validated = createRunInputSchema.parse(input);
          const response = await request<unknown>("/api/v1/runs", {
            method: "POST",
            body: validated,
          });
          return runCreateResponseContract.parse(response);
        })();
        const runId = created.data.run_id;
        const timeoutSeconds = options?.timeout_seconds ?? 120;
        const pollIntervalMs = options?.poll_interval_ms ?? 1000;
        const deadline = Date.now() + timeoutSeconds * 1000;

        while (Date.now() <= deadline) {
          const response = await request<unknown>(`/api/v1/runs/${runId}`, {
            query: {
              wait_for_completion: false,
            },
          });
          const parsed = runRetrieveContract.parse(response);
          const status = parsed.data.status;
          if (status === "completed" || status === "failed" || status === "cancelled") {
            return parsed;
          }
          await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
        }

        const fallback = await request<unknown>(`/api/v1/runs/${runId}`, {
          query: { wait_for_completion: false },
        });
        return runRetrieveContract.parse(fallback);
      },
    },
  };
}
