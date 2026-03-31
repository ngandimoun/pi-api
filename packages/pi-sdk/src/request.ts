import { PiApiError, tryParsePiErrorEnvelope } from './errors.js';
import type { ProviderKeys, RequestOptions } from './types.js';

export type CreateRequesterOptions = {
  apiKey: string;
  baseUrl: string;
  providerKeys?: ProviderKeys;
  fetchImpl?: typeof fetch;
};

function mergeHeaders(...headers: Array<Record<string, string | undefined> | undefined>) {
  const out: Record<string, string> = {};
  for (const h of headers) {
    if (!h) continue;
    for (const [k, v] of Object.entries(h)) {
      if (v !== undefined) out[k] = v;
    }
  }
  return out;
}

function providerKeysToHeaders(keys?: ProviderKeys): Record<string, string | undefined> {
  if (!keys) return {};
  return {
    'X-Gemini-Api-Key': keys.gemini,
    'X-Firecrawl-Api-Key': keys.firecrawl,
    'X-LiveKit-Api-Key': keys.livekit?.apiKey,
    'X-LiveKit-Api-Secret': keys.livekit?.apiSecret,
  };
}

export function createRequester(opts: CreateRequesterOptions) {
  const normalizedBaseUrl = opts.baseUrl.replace(/\/+$/, '');
  const fetchImpl = opts.fetchImpl ?? fetch;

  async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const url = new URL(`${normalizedBaseUrl}${path}`);
    if (options.query) {
      for (const [key, value] of Object.entries(options.query)) {
        if (value !== undefined) url.searchParams.set(key, String(value));
      }
    }

    const headers = mergeHeaders(
      {
        Authorization: `Bearer ${opts.apiKey}`,
        'Content-Type': 'application/json',
      },
      providerKeysToHeaders(opts.providerKeys),
      providerKeysToHeaders(options.providerKeys),
      options.idempotencyKey ? { 'Idempotency-Key': options.idempotencyKey } : undefined,
      options.headers,
    );

    const response = await fetchImpl(url.toString(), {
      method: options.method ?? 'GET',
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: options.signal,
    });

    const contentType = response.headers.get('content-type') ?? '';
    const isJson = contentType.toLowerCase().includes('application/json');

    const rawText = await response.text();
    const json = isJson && rawText.length ? safeJsonParse(rawText) : undefined;

    if (!response.ok) {
      const parsed = json ? tryParsePiErrorEnvelope(json) : undefined;
      if (parsed) {
        throw new PiApiError({
          message: `${parsed.error.code}: ${parsed.error.message}`,
          status: response.status,
          code: parsed.error.code,
          type: parsed.error.type,
          requestId:
            typeof parsed.error.request_id === 'string' ? parsed.error.request_id : undefined,
          details: parsed.error,
        });
      }
      throw new PiApiError({
        message: `Request failed with status ${response.status}`,
        status: response.status,
        details: { body: rawText },
      });
    }

    if (!rawText.length) return undefined as T;
    if (json === undefined) {
      throw new PiApiError({
        message: 'Expected JSON response but received non-JSON body.',
        status: response.status,
        details: { contentType, body: rawText },
      });
    }

    return json as T;
  }

  return { request };
}

function safeJsonParse(text: string): unknown | undefined {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}
