import type { RequestOptions } from '../types.js';
import { jobRetrieveContract } from '../contracts/brand-api.js';

type Requester = <T>(path: string, options?: RequestOptions) => Promise<T>;

export function createJobsNamespace({ request }: { request: Requester }) {
  async function waitForCompletion(
    id: string,
    options?: {
      timeout_seconds?: number;
      poll_interval_ms?: number;
      include?: RequestOptions['query'];
    },
  ) {
    const timeoutSeconds = options?.timeout_seconds ?? 120;
    const pollIntervalMs = options?.poll_interval_ms ?? 1000;
    const deadline = Date.now() + timeoutSeconds * 1000;

    while (Date.now() <= deadline) {
      const job = await request<unknown>(`/api/v1/jobs/${id}`, {
        method: 'GET',
        query: { ...(options?.include ?? {}), wait_for_completion: false },
      });
      // Best-effort parse (contract covers the common envelope shape).
      const parsed = jobRetrieveContract.safeParse(job);
      const status = parsed.success
        ? parsed.data.data.status
        : ((job as any)?.data?.status ?? (job as any)?.status);
      if (
        parsed.success &&
        (status === 'completed' || status === 'failed' || status === 'cancelled')
      )
        return parsed.data;
      if (
        !parsed.success &&
        (status === 'completed' || status === 'failed' || status === 'cancelled')
      )
        return job;
      await new Promise((r) => setTimeout(r, pollIntervalMs));
    }

    const fallback = await request<unknown>(`/api/v1/jobs/${id}`, {
      method: 'GET',
      query: { wait_for_completion: false },
    });
    const parsedFallback = jobRetrieveContract.safeParse(fallback);
    return parsedFallback.success ? parsedFallback.data : fallback;
  }

  return {
    retrieve: (
      id: string,
      params?: {
        expand?: 'brand' | 'avatar' | 'ad' | 'diagnostics';
        include?: 'brand' | 'avatar' | 'ad' | 'diagnostics';
        wait_for_completion?: boolean;
        timeout_seconds?: number;
      },
    ) =>
      request<unknown>(`/api/v1/jobs/${id}`, { method: 'GET', query: params }).then((r) =>
        jobRetrieveContract.parse(r),
      ),
    waitForCompletion,
  };
}
