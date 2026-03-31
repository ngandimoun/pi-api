import { createStep } from "@mastra/core/workflows";
import { z } from "zod";

import type {
  PerceptionResult,
  PolicyCreateInput,
  StreamCreateInput,
} from "../../../../contracts/surveillance-api";
import { policyCreateInputSchema } from "../../../../contracts/surveillance-api";
import {
  evaluateBehaviorRules,
  evaluateStoredPolicies,
  mergeIncidents,
  type TrackStateMap,
  type ZoneMap,
} from "../../../../lib/surveillance/policy-engine";
import { getServiceSupabaseClient } from "../../../../lib/supabase";
import { finishDiagnostic, startTimer } from "../debug";

export const step2PolicyEvaluation = createStep({
  id: "surveillance-step2-policy-evaluation",
  inputSchema: z.any(),
  outputSchema: z.any(),
  execute: async ({ inputData }) => {
    const started = startTimer();
    const perception = inputData.perception as PerceptionResult;
    const streamId = String(inputData.stream_id ?? "");
    const orgId = String(inputData.organization_id ?? "");
    const streamInput = inputData.input as StreamCreateInput | undefined;

    const trackState: TrackStateMap = {};
    const zones =
      (streamInput?.context as { zones?: ZoneMap } | undefined)?.zones ??
      ({} as ZoneMap);

    const ctx = {
      nowMs: Date.now(),
      streamId,
      zones,
    };

    let behaviorIncidents =
      streamInput?.behaviors?.length ?
        evaluateBehaviorRules({
          perception,
          behaviors: streamInput.behaviors,
          ctx,
          trackState,
        })
      : [];

    let storedPolicies: PolicyCreateInput[] = [];
    try {
      const supabase = getServiceSupabaseClient();
      const { data } = await supabase
        .from("surveillance_policies")
        .select("id,name,type,condition,action,enabled,stream_id")
        .eq("org_id", orgId)
        .eq("enabled", true);

      if (data?.length) {
        for (const row of data) {
          const raw = {
            id: row.id,
            stream_id: row.stream_id,
            name: row.name,
            type: row.type,
            condition: row.condition ?? {},
            action: row.action ?? {},
            enabled: row.enabled,
          };
          const parsed = policyCreateInputSchema.safeParse(raw);
          if (!parsed.success) continue;
          if (parsed.data.stream_id && parsed.data.stream_id !== "" && parsed.data.stream_id !== streamId) {
            continue;
          }
          storedPolicies.push(parsed.data);
        }
      }
    } catch {
      storedPolicies = [];
    }

    const policyIncidents = evaluateStoredPolicies({
      perception,
      policies: storedPolicies,
      ctx,
      trackState,
      zones,
    });

    behaviorIncidents = mergeIncidents(behaviorIncidents, policyIncidents);

    return {
      ...inputData,
      incidents: behaviorIncidents,
      track_state: trackState,
      diagnostics: [
        ...(inputData as { diagnostics?: unknown[] }).diagnostics ?? [],
        finishDiagnostic({
          step: "step2_policy_evaluation",
          started_at: started,
          status: "ok",
          detail: { incidents: behaviorIncidents.length, policies: storedPolicies.length },
        }),
      ],
    };
  },
});
