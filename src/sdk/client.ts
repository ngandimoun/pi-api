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

type RequestOptions = {
  method?: "GET" | "POST";
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
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
          expand?: "brand";
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
  };
}
