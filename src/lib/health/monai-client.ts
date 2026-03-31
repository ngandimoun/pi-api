import { z } from "zod";

const segmentResponseSchema = z.object({
  overlay_url: z.string().url().nullable().optional(),
  mask_base64: z.string().min(1).nullable().optional(),
  detail: z.record(z.unknown()).optional(),
});

export type MonaiSegmentResult = z.infer<typeof segmentResponseSchema>;

function readEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing ${name}`);
  }
  return value;
}

export async function monaiSegment(params: {
  input: { data: string; modality: string; mime_type?: string };
  requestId: string;
  timeoutMs?: number;
}): Promise<MonaiSegmentResult> {
  const baseUrl = readEnv("MONAI_SERVICE_URL").replace(/\/+$/, "");
  const url = `${baseUrl}/v1/segment`;

  const controller = new AbortController();
  const timeoutMs = params.timeoutMs ?? 15_000;
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Request-Id": params.requestId,
      },
      body: JSON.stringify({
        input: params.input,
      }),
      signal: controller.signal,
    });

    const text = await res.text();
    if (!res.ok) {
      throw new Error(`monai_segment_http_${res.status}: ${text.slice(0, 500)}`);
    }

    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      throw new Error("monai_segment_invalid_json");
    }

    const parsed = segmentResponseSchema.safeParse(json);
    if (!parsed.success) {
      throw new Error("monai_segment_invalid_response_shape");
    }
    return parsed.data;
  } finally {
    clearTimeout(timer);
  }
}

