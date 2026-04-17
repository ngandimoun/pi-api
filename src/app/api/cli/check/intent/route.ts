import { generateObject } from "ai";
import { z } from "zod";

import { apiError, apiSuccessEnvelope } from "@/lib/api-response";
import { withApiAuth } from "@/lib/auth";
import { getPiCliGeminiModel } from "@/lib/pi-cli-llm";

const intentBodySchema = z
  .object({
    query: z.string().min(1).max(2000),
    changed_files: z.array(z.string()).max(500).optional(),
    project_context: z
      .object({
        framework: z.string().optional(),
        language: z.string().optional(),
      })
      .optional(),
  })
  .strict();

const intentDslSchema = z.object({
  target: z.string(),
  scope: z.array(z.string()),
  active_registries: z.array(
    z.enum(["security", "design", "ux", "performance", "a11y", "backend"])
  ),
  detected_language: z
    .object({
      locale: z.string(),
      confidence: z.number().min(0).max(1),
    })
    .optional(),
  confidence_score: z.number().min(0).max(1),
  reasoning: z.string(),
});

/**
 * Byakugan — natural language intent to Pi DSL.
 */
export const POST = withApiAuth(async (request) => {
  const requestId = request.requestId;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("invalid_json", "Request body must be valid JSON.", 400, requestId, "invalid_request_error");
  }

  const parsed = intentBodySchema.safeParse(body);
  if (!parsed.success) {
    return apiError(
      "invalid_body",
      parsed.error.issues[0]?.message ?? "Invalid body.",
      400,
      requestId,
      "invalid_request_error"
    );
  }

  try {
    const model = getPiCliGeminiModel("lite");
    const { object } = await generateObject({
      model,
      schema: intentDslSchema,
      prompt: `Map the developer query to Pi's intent DSL.

Also detect the natural language of the query (locale like "en", "fr", "fr-CA") and include it as detected_language when confident.

Query: ${parsed.data.query}
Changed files: ${(parsed.data.changed_files ?? []).join(", ") || "(none)"}
Project: ${JSON.stringify(parsed.data.project_context ?? {})}`,
    });

    const res = apiSuccessEnvelope({
      data: object,
      object: "pi_cli_intent",
      requestId,
      status: "completed",
      httpStatus: 200,
    });
    res.headers.set("X-Request-Id", requestId);
    return res;
  } catch (e) {
    const message = e instanceof Error ? e.message : "Intent routing failed.";
    return apiError("intent_failed", message, 500, requestId, "api_error");
  }
});
