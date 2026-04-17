import { generateObject } from "ai";
import { routineSpecToMarkdown, routineSpecificationSchema } from "pi-routine-spec";
import { z } from "zod";

import { apiError, apiSuccessEnvelope } from "@/lib/api-response";
import { withApiAuth } from "@/lib/auth";
import { getPiCliGeminiModel } from "@/lib/pi-cli-llm";
import { slugFromIntent } from "@/lib/pi-cli-routine-generate";

const bodySchema = z
  .object({
    legacy_markdown: z.string().min(10).max(200_000),
    intent_hint: z.string().max(4000).optional(),
  })
  .strict();

/**
 * Best-effort upgrade of legacy routine markdown to Pi routine v2 (structured + rendered markdown).
 */
export const POST = withApiAuth(async (request) => {
  const requestId = request.requestId;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("invalid_json", "Request body must be valid JSON.", 400, requestId, "invalid_request_error");
  }
  const parsed = bodySchema.safeParse(body);
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
    const model = getPiCliGeminiModel("pro");
    const hint = parsed.data.intent_hint?.trim() || "infer from legacy document";
    const { object } = await generateObject({
      model,
      schema: routineSpecificationSchema,
      prompt: `Convert the following legacy Pi routine (plain markdown) into a RoutineSpecification JSON.

Intent hint: ${hint}

Preserve phases as logical groups; map numbered steps to structured steps. Infer constraints and validation from the text. Use action "other" if unsure.
Populate files_manifest with every file path implied by the legacy doc (create/modify/verify). Use empty array only if none can be inferred.

Legacy markdown:
${parsed.data.legacy_markdown.slice(0, 100_000)}`,
    });
    const spec = routineSpecificationSchema.parse(object);
    const slug = slugFromIntent(spec.metadata.intent || hint);
    const fixed = {
      ...spec,
      metadata: {
        ...spec.metadata,
        id: slug,
        intent: spec.metadata.intent || hint,
        version: Math.max(spec.metadata.version ?? 1, 1),
      },
    };
    const markdown = routineSpecToMarkdown(fixed);
    const res = apiSuccessEnvelope({
      data: {
        slug,
        markdown,
        version: fixed.metadata.version,
        routine_spec_json: JSON.stringify(fixed),
        status: "completed",
      },
      object: "pi_cli_routine_upgrade",
      requestId,
      status: "completed",
      httpStatus: 200,
    });
    res.headers.set("X-Request-Id", requestId);
    return res;
  } catch (e) {
    const message = e instanceof Error ? e.message : "Upgrade failed.";
    return apiError("routine_upgrade_failed", message, 500, requestId, "api_error");
  }
});
