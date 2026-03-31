import type { RequestOptions } from '../types.js';
import {
  voiceAgentCreateInputSchema,
  voiceAgentUpdateInputSchema,
} from '../contracts/voice-agent-api.js';
import {
  voiceSessionCompleteInputSchema,
  voiceSessionCreateInputSchema,
} from '../contracts/voice-session-api.js';
import {
  voiceAgentCreateResponseSchema,
  voiceAgentDeleteResponseSchema,
  voiceAgentListResponseSchema,
  voiceAgentRetrieveResponseSchema,
} from '../contracts/voice-agents-responses.js';

type Requester = <T>(path: string, options?: RequestOptions) => Promise<T>;

export function createVoiceNamespace({ request }: { request: Requester }) {
  return {
    agents: {
      list: () =>
        request<unknown>('/api/v1/voice/agents', { method: 'GET' }).then((r) =>
          voiceAgentListResponseSchema.parse(r),
        ),
      create: (input: unknown) =>
        request<unknown>('/api/v1/voice/agents', {
          method: 'POST',
          body: voiceAgentCreateInputSchema.parse(input),
        }).then((r) => voiceAgentCreateResponseSchema.parse(r)),
      retrieve: (id: string) =>
        request<unknown>(`/api/v1/voice/agents/${id}`, { method: 'GET' }).then((r) =>
          voiceAgentRetrieveResponseSchema.parse(r),
        ),
      update: (id: string, input: unknown) =>
        request<unknown>(`/api/v1/voice/agents/${id}`, {
          method: 'PATCH',
          body: voiceAgentUpdateInputSchema.parse(input),
        }).then((r) => voiceAgentRetrieveResponseSchema.parse(r)),
      delete: (id: string) =>
        request<unknown>(`/api/v1/voice/agents/${id}`, { method: 'DELETE' }).then((r) =>
          voiceAgentDeleteResponseSchema.parse(r),
        ),
      preview: (id: string, input?: unknown) =>
        request(`/api/v1/voice/agents/${id}/preview`, { method: 'POST', body: input ?? {} }),
    },
    sessions: {
      create: (input: unknown, options?: { providerKeys?: RequestOptions['providerKeys'] }) =>
        request('/api/v1/voice/sessions', {
          method: 'POST',
          body: voiceSessionCreateInputSchema.parse(input),
          providerKeys: options?.providerKeys,
        }),
      retrieve: (id: string) => request(`/api/v1/voice/sessions/${id}`, { method: 'GET' }),
      complete: (id: string, input: unknown) =>
        request(`/api/v1/voice/sessions/${id}/complete`, {
          method: 'POST',
          body: voiceSessionCompleteInputSchema.parse(input),
        }),
    },
    voices: {
      list: () => request('/api/v1/voice/voices', { method: 'GET' }),
    },
  };
}
