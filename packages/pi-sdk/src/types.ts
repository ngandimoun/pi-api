export type ProviderKeys = {
  gemini?: string;
  firecrawl?: string;
  livekit?: {
    apiKey: string;
    apiSecret: string;
  };
};

export type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
  headers?: Record<string, string | undefined>;
  providerKeys?: ProviderKeys;
  idempotencyKey?: string;
  signal?: AbortSignal;
};

export type PiSuccessEnvelope<T> = {
  id: string;
  object: string;
  status: string;
  created_at: number;
  data: T;
};

export type PiErrorEnvelope = {
  error: {
    type: string;
    code: string;
    message: string;
    request_id?: string;
    [key: string]: unknown;
  };
};
