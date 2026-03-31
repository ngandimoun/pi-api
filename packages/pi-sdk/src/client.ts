import { createRequester } from './request.js';
import type { ProviderKeys } from './types.js';
import { createBrandsNamespace } from './namespaces/brands.js';
import { createJobsNamespace } from './namespaces/jobs.js';
import { createRunsNamespace } from './namespaces/runs.js';
import { createAvatarsNamespace } from './namespaces/avatars.js';
import { createImagesNamespace } from './namespaces/images.js';
import { createAdsNamespace } from './namespaces/ads.js';
import { createCampaignsNamespace } from './namespaces/campaigns.js';
import { createWebhooksNamespace } from './namespaces/webhooks.js';
import { createVoiceNamespace } from './namespaces/voice.js';
import { createSurveillanceNamespace } from './namespaces/surveillance.js';
import { createRoboticsNamespace } from './namespaces/robotics.js';
import { createHealthNamespace } from './namespaces/health.js';
import { createNeuroNamespace } from './namespaces/neuro.js';

export type CreatePiClientOptions = {
  apiKey: string;
  baseUrl: string;
  providerKeys?: ProviderKeys;
  fetchImpl?: typeof fetch;
};

export function createPiClient(options: CreatePiClientOptions) {
  const { request } = createRequester({
    apiKey: options.apiKey,
    baseUrl: options.baseUrl,
    providerKeys: options.providerKeys,
    fetchImpl: options.fetchImpl,
  });

  return {
    brands: createBrandsNamespace({ request }),
    jobs: createJobsNamespace({ request }),
    runs: createRunsNamespace({ request }),
    avatars: createAvatarsNamespace({ request }),
    images: createImagesNamespace({ request }),
    ads: createAdsNamespace({ request }),
    campaigns: createCampaignsNamespace({ request }),
    webhooks: createWebhooksNamespace({ request }),
    voice: createVoiceNamespace({ request }),
    surveillance: createSurveillanceNamespace({
      request,
      baseUrl: options.baseUrl,
      apiKey: options.apiKey,
      providerKeys: options.providerKeys,
      fetchImpl: options.fetchImpl,
    }),
    robots: createRoboticsNamespace({
      request,
      baseUrl: options.baseUrl,
      apiKey: options.apiKey,
      providerKeys: options.providerKeys,
      fetchImpl: options.fetchImpl,
    }),
    health: createHealthNamespace({ request }),
    neuro: createNeuroNamespace({ request }),
  };
}
