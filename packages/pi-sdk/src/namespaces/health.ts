import type { RequestOptions } from '../types.js';
import { extractJobQueuedContract } from '../contracts/brand-api.js';
import { adherenceInputSchema } from '../contracts/adherence-api.js';
import { cognitiveWellnessInputSchema } from '../contracts/cognitive-wellness-api.js';
import { decisionSupportInputSchema } from '../contracts/decision-support-api.js';
import { healthTriageInputSchema } from '../contracts/health-triage-api.js';
import { medicationCheckInputSchema } from '../contracts/medication-check-api.js';
import { notesStructureInputSchema } from '../contracts/notes-structure-api.js';
import { patientRiskInputSchema } from '../contracts/patient-risk-api.js';
import { researchAssistInputSchema } from '../contracts/research-assist-api.js';
import { scanAnalysisInputSchema } from '../contracts/scan-analysis-api.js';

type Requester = <T>(path: string, options?: RequestOptions) => Promise<T>;

export function createHealthNamespace({ request }: { request: Requester }) {
  return {
    analyze: (
      input: unknown,
      options?: { idempotencyKey?: string; providerKeys?: RequestOptions['providerKeys'] },
    ) =>
      request<unknown>('/api/v1/health/analyze', {
        method: 'POST',
        body: healthTriageInputSchema.parse(input),
        idempotencyKey: options?.idempotencyKey,
        providerKeys: options?.providerKeys,
      }).then((r) => extractJobQueuedContract.parse(r)),
    decisionSupport: (
      input: unknown,
      options?: { idempotencyKey?: string; providerKeys?: RequestOptions['providerKeys'] },
    ) =>
      request<unknown>('/api/v1/health/decision-support', {
        method: 'POST',
        body: decisionSupportInputSchema.parse(input),
        idempotencyKey: options?.idempotencyKey,
        providerKeys: options?.providerKeys,
      }).then((r) => extractJobQueuedContract.parse(r)),
    medicationCheck: (
      input: unknown,
      options?: { idempotencyKey?: string; providerKeys?: RequestOptions['providerKeys'] },
    ) =>
      request<unknown>('/api/v1/health/medication-check', {
        method: 'POST',
        body: medicationCheckInputSchema.parse(input),
        idempotencyKey: options?.idempotencyKey,
        providerKeys: options?.providerKeys,
      }).then((r) => extractJobQueuedContract.parse(r)),
    notesStructure: (
      input: unknown,
      options?: { idempotencyKey?: string; providerKeys?: RequestOptions['providerKeys'] },
    ) =>
      request<unknown>('/api/v1/health/notes-structure', {
        method: 'POST',
        body: notesStructureInputSchema.parse(input),
        idempotencyKey: options?.idempotencyKey,
        providerKeys: options?.providerKeys,
      }).then((r) => extractJobQueuedContract.parse(r)),
    adherence: (
      input: unknown,
      options?: { idempotencyKey?: string; providerKeys?: RequestOptions['providerKeys'] },
    ) =>
      request<unknown>('/api/v1/health/adherence', {
        method: 'POST',
        body: adherenceInputSchema.parse(input),
        idempotencyKey: options?.idempotencyKey,
        providerKeys: options?.providerKeys,
      }).then((r) => extractJobQueuedContract.parse(r)),
    riskPriority: (
      input: unknown,
      options?: { idempotencyKey?: string; providerKeys?: RequestOptions['providerKeys'] },
    ) =>
      request<unknown>('/api/v1/health/risk-priority', {
        method: 'POST',
        body: patientRiskInputSchema.parse(input),
        idempotencyKey: options?.idempotencyKey,
        providerKeys: options?.providerKeys,
      }).then((r) => extractJobQueuedContract.parse(r)),
    scanAnalysis: (
      input: unknown,
      options?: { idempotencyKey?: string; providerKeys?: RequestOptions['providerKeys'] },
    ) =>
      request<unknown>('/api/v1/health/scan-analysis', {
        method: 'POST',
        body: scanAnalysisInputSchema.parse(input),
        idempotencyKey: options?.idempotencyKey,
        providerKeys: options?.providerKeys,
      }).then((r) => extractJobQueuedContract.parse(r)),
    researchAssist: (
      input: unknown,
      options?: { idempotencyKey?: string; providerKeys?: RequestOptions['providerKeys'] },
    ) =>
      request<unknown>('/api/v1/health/research-assist', {
        method: 'POST',
        body: researchAssistInputSchema.parse(input),
        idempotencyKey: options?.idempotencyKey,
        providerKeys: options?.providerKeys,
      }).then((r) => extractJobQueuedContract.parse(r)),
    wellness: (
      input: unknown,
      options?: { idempotencyKey?: string; providerKeys?: RequestOptions['providerKeys'] },
    ) =>
      request<unknown>('/api/v1/health/wellness', {
        method: 'POST',
        body: cognitiveWellnessInputSchema.parse(input),
        idempotencyKey: options?.idempotencyKey,
        providerKeys: options?.providerKeys,
      }).then((r) => extractJobQueuedContract.parse(r)),
  };
}
