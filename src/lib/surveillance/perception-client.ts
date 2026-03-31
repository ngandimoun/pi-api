import { perceptionResultSchema, type PerceptionResult, type StreamCreateInput } from "../../contracts/surveillance-api";

function orchestratorBaseUrl(): string {
  const url = process.env.SURVEILLANCE_ORCHESTRATOR_URL?.trim();
  if (!url) {
    throw new Error("Missing SURVEILLANCE_ORCHESTRATOR_URL");
  }
  return url.replace(/\/$/, "");
}

export async function callPerceptionOrchestrator(params: {
  streamId: string;
  frameIndex: number;
  input: StreamCreateInput;
  requestId: string;
}): Promise<{ perception: PerceptionResult | null; error?: string }> {
  const data = params.input.input?.data?.trim();
  if (!data) {
    return { perception: null, error: "missing_input_frame" };
  }

  const body = {
    stream_id: params.streamId,
    frame_index: params.frameIndex,
    input: {
      image_base64: data,
      mime_type: params.input.input?.mime_type ?? undefined,
    },
  };

  const res = await fetch(`${orchestratorBaseUrl()}/v1/perceive`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Request-Id": params.requestId,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { perception: null, error: `orchestrator_${res.status}:${text.slice(0, 500)}` };
  }

  const json = (await res.json()) as unknown;
  const parsed = perceptionResultSchema.safeParse(json);
  if (!parsed.success) {
    return { perception: null, error: "orchestrator_invalid_response" };
  }
  return { perception: parsed.data };
}
