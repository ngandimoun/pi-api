import type { RequestOptions } from '../types.js';
import {
  brandExtractionInputContract,
  brandListContract,
  brandProjectionRequestContract,
  brandProjectionResponseContract,
  brandRetrieveContract,
  extractJobQueuedContract,
} from '../contracts/brand-api.js';

type Requester = <T>(path: string, options?: RequestOptions) => Promise<T>;

export function createBrandsNamespace({ request }: { request: Requester }) {
  return {
    extract: async (
      input: unknown,
      options?: { providerKeys?: RequestOptions['providerKeys'] },
    ) => {
      const validated = brandExtractionInputContract.parse(input);
      const response = await request<unknown>('/api/v1/brands/extract', {
        method: 'POST',
        body: validated,
        providerKeys: options?.providerKeys,
      });
      return extractJobQueuedContract.parse(response);
    },
    list: (params?: {
      query?: string;
      limit?: number;
      offset?: number;
      expand?: 'latest_job';
      include?: 'latest_job';
    }) =>
      request<unknown>('/api/v1/brands', { method: 'GET', query: params }).then((r) =>
        brandListContract.parse(r),
      ),
    retrieve: (id: string, params?: { expand?: 'latest_job'; include?: 'latest_job' }) =>
      request<unknown>(`/api/v1/brands/${id}`, { method: 'GET', query: params }).then((r) =>
        brandRetrieveContract.parse(r),
      ),
    project: async (id: string, input: { use_case: string }) => {
      const validated = brandProjectionRequestContract.parse(input);
      const response = await request<unknown>(`/api/v1/brands/${id}/project`, {
        method: 'POST',
        body: validated,
      });
      return brandProjectionResponseContract.parse(response);
    },
  };
}
