import { describe, expect, it, vi } from 'vitest';
import { ZodError } from 'zod';

import { createAdsNamespace } from '../namespaces/ads.js';
import { createBrandsNamespace } from '../namespaces/brands.js';
import { createCampaignsNamespace } from '../namespaces/campaigns.js';
import { createHealthNamespace } from '../namespaces/health.js';
import { createNeuroNamespace } from '../namespaces/neuro.js';
import { createRoboticsNamespace } from '../namespaces/robotics.js';
import { createSurveillanceNamespace } from '../namespaces/surveillance.js';
import { createVoiceNamespace } from '../namespaces/voice.js';
import { createWebhooksNamespace } from '../namespaces/webhooks.js';

describe('input validation (one per API family)', () => {
  it('brands.extract rejects invalid input', async () => {
    const request = vi.fn(async () => ({}));
    const brands = createBrandsNamespace({ request });
    await expect(brands.extract({})).rejects.toBeInstanceOf(ZodError);
    expect(request).not.toHaveBeenCalled();
  });

  it('ads.generate rejects invalid input', async () => {
    const request = vi.fn(async () => ({}));
    const ads = createAdsNamespace({ request });
    expect(() => ads.generate({ prompt: '' })).toThrow(ZodError);
    expect(request).not.toHaveBeenCalled();
  });

  it('campaigns.localizeAd rejects invalid input', async () => {
    const request = vi.fn(async () => ({}));
    const campaigns = createCampaignsNamespace({ request });
    // must provide exactly one of source_image_url or source_job_id
    expect(() =>
      campaigns.localizeAd({
        prompt: 'localize',
        target_culture: 'Kigali vibe',
      }),
    ).toThrow(ZodError);
    expect(request).not.toHaveBeenCalled();
  });

  it('health.analyze rejects invalid input', async () => {
    const request = vi.fn(async () => ({}));
    const health = createHealthNamespace({ request });
    // image requires modality
    expect(() =>
      health.analyze({
        input: { type: 'image', data: 'data:image/png;base64,abc' },
      }),
    ).toThrow(ZodError);
    expect(request).not.toHaveBeenCalled();
  });

  it('neuro.decode rejects invalid input', async () => {
    const request = vi.fn(async () => ({}));
    const neuro = createNeuroNamespace({ request });
    expect(() => neuro.decode({ input: { type: 'eeg', data: '', paradigm: 'p300' } })).toThrow(
      ZodError,
    );
    expect(request).not.toHaveBeenCalled();
  });

  it('robots.run rejects invalid input', async () => {
    const request = vi.fn(async () => ({}));
    const robots = createRoboticsNamespace({
      request,
      baseUrl: 'https://example.com',
      apiKey: 'pi_test',
      fetchImpl: fetch,
    });
    expect(() => robots.run({ task: 'patrol' })).toThrow(ZodError);
    expect(request).not.toHaveBeenCalled();
  });

  it('surveillance.streams.create rejects invalid input', async () => {
    const request = vi.fn(async () => ({}));
    const surveillance = createSurveillanceNamespace({
      request,
      baseUrl: 'https://example.com',
      apiKey: 'pi_test',
      fetchImpl: fetch,
    });
    expect(() =>
      surveillance.streams.create({
        source: { url: 'https://example.com/stream', type: 'http' },
      }),
    ).toThrow(ZodError);
    expect(request).not.toHaveBeenCalled();
  });

  it('voice.agents.create rejects invalid input', async () => {
    const request = vi.fn(async () => ({}));
    const voice = createVoiceNamespace({ request });
    expect(() => voice.agents.create({ name: '' })).toThrow(ZodError);
    expect(request).not.toHaveBeenCalled();
  });

  it('webhooks.create rejects invalid input', async () => {
    const request = vi.fn(async () => ({}));
    const webhooks = createWebhooksNamespace({ request });
    expect(() => webhooks.create({ endpoint_url: 'https://example.com', secret: 'short' })).toThrow(
      ZodError,
    );
    expect(request).not.toHaveBeenCalled();
  });
});
