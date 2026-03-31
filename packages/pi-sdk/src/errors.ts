import type { PiErrorEnvelope } from './types.js';

export class PiApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly type?: string;
  readonly requestId?: string;
  readonly details?: Record<string, unknown>;

  constructor(input: {
    message: string;
    status: number;
    code?: string;
    type?: string;
    requestId?: string;
    details?: Record<string, unknown>;
  }) {
    super(input.message);
    this.name = 'PiApiError';
    this.status = input.status;
    this.code = input.code;
    this.type = input.type;
    this.requestId = input.requestId;
    this.details = input.details;
  }
}

export function tryParsePiErrorEnvelope(value: unknown): PiErrorEnvelope | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const v = value as Record<string, unknown>;
  const err = v.error as Record<string, unknown> | undefined;
  if (!err || typeof err !== 'object') return undefined;
  const code = err.code;
  const message = err.message;
  const type = err.type;
  if (typeof code !== 'string' || typeof message !== 'string' || typeof type !== 'string')
    return undefined;
  return value as PiErrorEnvelope;
}
