import { generateObject } from "ai";
import { z } from "zod";

import { apiError, apiSuccessEnvelope } from "@/lib/api-response";
import { withApiAuth } from "@/lib/auth";
import { getPiCliGeminiModel } from "@/lib/pi-cli-llm";

const nlpBodySchema = z
  .object({
    query: z.string().min(1).max(4000),
    changed_files: z.array(z.string()).max(1000).optional(),
    project_context: z
      .object({
        framework: z.string().optional(),
        language: z.string().optional(),
      })
      .optional(),
    /** Optional: hint for response language (e.g. "fr", "en"). */
    prefer_locale: z.string().max(32).optional(),
  })
  .strict();

const cliCommandSchema = z.enum([
  "sync",
  "learn",
  "resonate",
  "routine",
  "prompt",
  "validate",
  "fix",
  "watch",
  "trace",
]);

const nlpPlanSchema = z.object({
  detected_language: z.object({
    /** BCP-47-ish: "en", "fr", "fr-CA", etc. */
    locale: z.string(),
    confidence: z.number().min(0).max(1),
    reasoning: z.string(),
  }),
  normalized_intent: z.string(),
  routing: z.object({
    primary: cliCommandSchema,
    /** Commands to run (ordered). */
    commands: z.array(
      z.object({
        command: cliCommandSchema,
        /** Human-facing rationale (use detected language when possible). */
        rationale: z.string(),
        /** Suggested CLI args (strings exactly as user would type after the command). */
        args: z.array(z.string()),
        /** If true, command should be run as a background process (e.g. watch). */
        background: z.boolean().optional(),
      })
    ),
    confidence: z.number().min(0).max(1),
    warnings: z.array(z.string()),
  }),
});

/**
 * Smart multilingual router — turn natural language into a Pi CLI execution plan.
 *
 * This does NOT execute commands; it returns a structured plan that the CLI can follow.
 */
export const POST = withApiAuth(async (request) => {
  const requestId = request.requestId;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError(
      "invalid_json",
      "Request body must be valid JSON.",
      400,
      requestId,
      "invalid_request_error"
    );
  }

  const parsed = nlpBodySchema.safeParse(body);
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
      schema: nlpPlanSchema,
      maxOutputTokens: 1500,
      prompt: `You are Pi's CLI Router. The developer will speak naturally in ANY language.

Your job:
- Detect the input language.
- Rewrite the intent into a crisp normalized intent (keep it short).
- Choose the best Pi CLI command (or combination) from: sync, learn, resonate, routine, prompt, validate, fix, watch, trace.
- Prefer deterministic + safe flows. Do NOT invent commands outside that list.
- If the user asks to continuously monitor, prefer watch (background).
- If user asks to auto-heal deterministic issues, include validate then fix (and optionally validate again).
- If user asks to "why did Pi reject", include trace.
- If user asks to align with team standards / onboarding, include sync (and maybe learn).

Important:
- For each planned command, \`args\` MUST be argv tokens AFTER the subcommand (do not include "pi" or the subcommand itself).
- Put free-text intents as a single string token inside args (quotes are not required in JSON strings).
- Use flags as separate args (e.g. "--staged", "--async", "--json").
- **Confidence scoring**: If the query lacks an unambiguous verb (build / fix / validate / explain / add / create / debug / refactor / test), or if the intent is vague, set confidence ≤ 0.5.
- **Locale awareness**: ${parsed.data.prefer_locale ? `Respond using locale=${parsed.data.prefer_locale}. All rationale and warnings MUST be written in that locale.` : "Respond in the detected language of the query."}

Output must match the JSON schema exactly.

Input:
query: ${parsed.data.query}
changed_files: ${(parsed.data.changed_files ?? []).join(", ") || "(none)"}
project_context: ${JSON.stringify(parsed.data.project_context ?? {})}
prefer_locale: ${parsed.data.prefer_locale ?? "(none)"}
organization_id: ${request.organizationId}`,
    });

    const res = apiSuccessEnvelope({
      data: object,
      object: "pi_cli_nlp_plan",
      requestId,
      status: "completed",
      httpStatus: 200,
    });
    res.headers.set("X-Request-Id", requestId);
    return res;
  } catch (e) {
    const message = e instanceof Error ? e.message : "NLP routing failed.";
    return apiError("nlp_failed", message, 500, requestId, "api_error");
  }
});

