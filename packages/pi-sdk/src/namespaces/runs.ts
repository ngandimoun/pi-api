import type { RequestOptions } from '../types.js';
import {
  createRunInputSchema,
  runCreateResponseContract,
  runRetrieveContract,
} from '../contracts/run-api.js';

type Requester = <T>(path: string, options?: RequestOptions) => Promise<T>;

export function createRunsNamespace({ request }: { request: Requester }) {
  return {
    create: async (input: unknown) => {
      const validated = createRunInputSchema.parse(input);
      const response = await request<unknown>('/api/v1/runs', { method: 'POST', body: validated });
      return runCreateResponseContract.parse(response);
    },
    retrieve: (id: string, params?: { wait_for_completion?: boolean; timeout_seconds?: number }) =>
      request<unknown>(`/api/v1/runs/${id}`, { method: 'GET', query: params }).then((r) =>
        runRetrieveContract.parse(r),
      ),
    createAndWait: async (
      input: unknown,
      options?: {
        timeout_seconds?: number;
        poll_interval_ms?: number;
      },
    ) => {
      const validated = createRunInputSchema.parse(input);
      const created = runCreateResponseContract.parse(
        await request<unknown>('/api/v1/runs', { method: 'POST', body: validated }),
      );
      const runId = created?.data?.run_id;
      if (!runId) return created;

      const timeoutSeconds = options?.timeout_seconds ?? 120;
      const pollIntervalMs = options?.poll_interval_ms ?? 1000;
      const deadline = Date.now() + timeoutSeconds * 1000;

      while (Date.now() <= deadline) {
        const run = runRetrieveContract.parse(
          await request<unknown>(`/api/v1/runs/${runId}`, {
            method: 'GET',
            query: { wait_for_completion: false },
          }),
        );
        const status = run?.data?.status ?? run?.status;
        if (status === 'completed' || status === 'failed' || status === 'cancelled') return run;
        await new Promise((r) => setTimeout(r, pollIntervalMs));
      }

      return runRetrieveContract.parse(
        await request<unknown>(`/api/v1/runs/${runId}`, {
          method: 'GET',
          query: { wait_for_completion: false },
        }),
      );
    },
  };
}
