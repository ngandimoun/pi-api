import type { ProviderKeys, RequestOptions } from '../types.js';
import { sseStream } from '../streaming.js';
import { extractJobQueuedContract } from '../contracts/brand-api.js';
import {
  robotActionRuleSchema,
  robotBehaviorRuleSchema,
  robotCommandSchema,
  robotRunInputSchema,
  zoneDefinitionSchema,
} from '../contracts/robotics-api.js';
import {
  robotActionsCreateResponseSchema,
  robotActionsListResponseSchema,
  robotBehaviorsCreateResponseSchema,
  robotBehaviorsListResponseSchema,
  robotZonesCreateResponseSchema,
  robotZonesListResponseSchema,
} from '../contracts/robotics-responses.js';
import { z } from 'zod';

type Requester = <T>(path: string, options?: RequestOptions) => Promise<T>;

export function createRoboticsNamespace(input: {
  request: Requester;
  baseUrl: string;
  apiKey: string;
  providerKeys?: ProviderKeys;
  fetchImpl?: typeof fetch;
}) {
  const baseUrl = input.baseUrl.replace(/\/+$/, '');
  const zonesBodySchema = z.object({ zones: z.array(zoneDefinitionSchema).min(1).max(200) });
  const behaviorsBodySchema = z.object({
    name: z.string().trim().min(1).max(200),
    robot_id: z.string().trim().min(1).max(128).optional(),
    rule: robotBehaviorRuleSchema,
    enabled: z.boolean().optional(),
  });
  const actionsBodySchema = z.object({
    behavior_id: z.string().uuid().optional(),
    rule: robotActionRuleSchema,
    enabled: z.boolean().optional(),
  });

  return {
    run: (body: unknown, options?: { idempotencyKey?: string; providerKeys?: ProviderKeys }) =>
      input
        .request<unknown>('/api/v1/robots/run', {
          method: 'POST',
          body: robotRunInputSchema.parse(body),
          idempotencyKey: options?.idempotencyKey,
          providerKeys: options?.providerKeys,
        })
        .then((r) => extractJobQueuedContract.parse(r)),
    status: (id: string) => input.request(`/api/v1/robots/${id}/status`, { method: 'GET' }),
    command: (id: string, body: unknown) =>
      input.request(`/api/v1/robots/${id}/command`, {
        method: 'POST',
        body: robotCommandSchema.parse(body),
      }),
    zones: {
      list: (params?: { robot_id?: string }) =>
        input
          .request<unknown>('/api/v1/robots/zones', { method: 'GET', query: params })
          .then((r) => robotZonesListResponseSchema.parse(r)),
      upsert: (body: unknown) =>
        input
          .request<unknown>('/api/v1/robots/zones', {
            method: 'POST',
            body: zonesBodySchema.parse(body),
          })
          .then((r) => robotZonesCreateResponseSchema.parse(r)),
    },
    behaviors: {
      list: (params?: { robot_id?: string }) =>
        input
          .request<unknown>('/api/v1/robots/behaviors', { method: 'GET', query: params })
          .then((r) => robotBehaviorsListResponseSchema.parse(r)),
      upsert: (body: unknown) =>
        input
          .request<unknown>('/api/v1/robots/behaviors', {
            method: 'POST',
            body: behaviorsBodySchema.parse(body),
          })
          .then((r) => robotBehaviorsCreateResponseSchema.parse(r)),
    },
    actions: {
      list: (params?: { behavior_id?: string }) =>
        input
          .request<unknown>('/api/v1/robots/actions', { method: 'GET', query: params })
          .then((r) => robotActionsListResponseSchema.parse(r)),
      upsert: (body: unknown) =>
        input
          .request<unknown>('/api/v1/robots/actions', {
            method: 'POST',
            body: actionsBodySchema.parse(body),
          })
          .then((r) => robotActionsCreateResponseSchema.parse(r)),
    },
    events: (options?: { providerKeys?: ProviderKeys }) => {
      const url = new URL(`${baseUrl}/api/v1/robots/events`);
      const headers: Record<string, string> = {
        Authorization: `Bearer ${input.apiKey}`,
        ...(options?.providerKeys?.gemini
          ? { 'X-Gemini-Api-Key': options.providerKeys.gemini }
          : {}),
        ...(options?.providerKeys?.firecrawl
          ? { 'X-Firecrawl-Api-Key': options.providerKeys.firecrawl }
          : {}),
      };
      return sseStream({ url: url.toString(), options: { headers }, fetchImpl: input.fetchImpl });
    },
  };
}
