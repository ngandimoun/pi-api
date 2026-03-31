import { describe, expect, it } from 'vitest';

import { sseStream } from '../streaming.js';

function makeStream(chunks: string[]) {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const c of chunks) controller.enqueue(encoder.encode(c));
      controller.close();
    },
  });
}

describe('sseStream', () => {
  it('parses SSE data messages', async () => {
    const fetchImpl = async () => {
      return new Response(makeStream(['event: test\n', 'data: {"ok":true}\n\n']), {
        status: 200,
        headers: { 'content-type': 'text/event-stream' },
      });
    };

    const msgs: any[] = [];
    for await (const msg of sseStream({
      url: 'https://example.com/sse',
      fetchImpl: fetchImpl as any,
    })) {
      msgs.push(msg);
    }

    expect(msgs).toEqual([{ event: 'test', id: undefined, data: '{"ok":true}' }]);
  });
});
