import { task } from "@trigger.dev/sdk/v3";
import crypto from "crypto";
import { z } from "zod";

import { getServiceSupabaseClient } from "../lib/supabase";

const payloadSchema = z.object({
  orgId: z.string().uuid(),
  event: z.enum(["job.completed", "job.failed"]),
  jobId: z.string().uuid(),
});

function sign(secret: string, body: string): string {
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(body);
  return `sha256=${hmac.digest("hex")}`;
}

export const webhookDelivery = task({
  id: "webhook-delivery",
  retry: { maxAttempts: 8 },
  run: async (payload) => {
    const parsed = payloadSchema.parse(payload);
    const supabase = getServiceSupabaseClient();

    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .select("id,org_id,type,status,payload,result_url,error_log,created_at,updated_at")
      .eq("id", parsed.jobId)
      .maybeSingle();

    if (jobError || !job || job.org_id !== parsed.orgId) {
      return { delivered: 0, skipped: true as const };
    }

    const { data: hooks, error: hooksError } = await supabase
      .from("webhooks")
      .select("id,endpoint_url,secret,is_active")
      .eq("org_id", parsed.orgId)
      .eq("is_active", true);

    if (hooksError || !hooks || hooks.length === 0) {
      return { delivered: 0, skipped: true as const };
    }

    const body = JSON.stringify({
      id: `evt_pi_${crypto.randomUUID()}`,
      object: "event",
      type: parsed.event,
      created_at: Math.floor(Date.now() / 1000),
      data: {
        job: {
          id: job.id,
          type: job.type,
          status: job.status,
          result_url: job.result_url,
          error_log: job.error_log,
          payload: job.payload,
          created_at: job.created_at,
          updated_at: job.updated_at,
        },
      },
    });

    let delivered = 0;
    for (const hook of hooks) {
      if (!hook.endpoint_url || !/^https:\/\//i.test(hook.endpoint_url)) {
        continue;
      }

      const signature = sign(hook.secret, body);
      const res = await fetch(hook.endpoint_url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Pi-Signature": signature,
          "X-Pi-Event": parsed.event,
        },
        body,
      });

      if (!res.ok) {
        throw new Error(`webhook_delivery_failed: ${hook.id} ${res.status}`);
      }
      delivered += 1;
    }

    return { delivered };
  },
});

