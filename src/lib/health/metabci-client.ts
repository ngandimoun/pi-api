import { z } from "zod";

const eegResponseSchema = z.object({
  seizure_detected: z.boolean(),
  confidence: z.number().min(0).max(1).optional(),
  detail: z.record(z.unknown()).optional(),
});

export type MetabciEegResult = z.infer<typeof eegResponseSchema>;

function readEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing ${name}`);
  }
  return value;
}

export async function metabciClassifyEeg(params: {
  input: { data: string; modality?: string };
  requestId: string;
  timeoutMs?: number;
}): Promise<MetabciEegResult> {
  const baseUrl = readEnv("METABCI_SERVICE_URL").replace(/\/+$/, "");
  const url = `${baseUrl}/v1/eeg/classify`;

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
      throw new Error(`metabci_eeg_http_${res.status}: ${text.slice(0, 500)}`);
    }

    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      throw new Error("metabci_eeg_invalid_json");
    }

    const parsed = eegResponseSchema.safeParse(json);
    if (!parsed.success) {
      throw new Error("metabci_eeg_invalid_response_shape");
    }
    return parsed.data;
  } finally {
    clearTimeout(timer);
  }
}

