import { describe, expect, it, vi } from 'vitest';

import { createJobsNamespace } from '../namespaces/jobs.js';

describe('jobs.waitForCompletion', () => {
  it('polls until terminal status', async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce({ data: { status: 'processing' } })
      .mockResolvedValueOnce({ data: { status: 'completed' } });

    const jobs = createJobsNamespace({ request });
    const job = await jobs.waitForCompletion('job_1', { timeout_seconds: 1, poll_interval_ms: 1 });

    expect(job).toEqual({ data: { status: 'completed' } });
    expect(request).toHaveBeenCalledTimes(2);
  });
});
