import { PiApiError } from './errors.js';
import type { RequestOptions } from './types.js';

export type SseMessage = {
  event?: string;
  data: string;
  id?: string;
};

export async function* sseStream(input: {
  url: string;
  options?: Omit<RequestOptions, 'method' | 'body'>;
  fetchImpl?: typeof fetch;
}): AsyncGenerator<SseMessage, void, void> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const response = await fetchImpl(input.url, {
    method: 'GET',
    headers: input.options?.headers as Record<string, string> | undefined,
    signal: input.options?.signal,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new PiApiError({
      message: `SSE request failed with status ${response.status}`,
      status: response.status,
      details: { body: text },
    });
  }

  if (!response.body) {
    throw new PiApiError({
      message: 'SSE response body is not readable in this environment.',
      status: response.status,
    });
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  let currentEvent: Partial<SseMessage> = {};
  let currentData: string[] = [];

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // Process complete lines. Keep trailing partial line in buffer.
    let idx: number;
    while ((idx = buffer.indexOf('\n')) !== -1) {
      let line = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 1);
      if (line.endsWith('\r')) line = line.slice(0, -1);

      if (line === '') {
        // Dispatch message
        if (currentData.length) {
          yield {
            event: currentEvent.event,
            id: currentEvent.id,
            data: currentData.join('\n'),
          };
        }
        currentEvent = {};
        currentData = [];
        continue;
      }

      if (line.startsWith(':')) continue;

      const sep = line.indexOf(':');
      const field = (sep === -1 ? line : line.slice(0, sep)).trim();
      const valuePart = sep === -1 ? '' : line.slice(sep + 1).replace(/^ /, '');

      if (field === 'event') currentEvent.event = valuePart;
      else if (field === 'id') currentEvent.id = valuePart;
      else if (field === 'data') currentData.push(valuePart);
    }
  }
}
