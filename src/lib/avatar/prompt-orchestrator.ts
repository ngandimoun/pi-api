import { google } from "@ai-sdk/google";
import { generateText } from "ai";

import type { AvatarGenerationInput } from "@/contracts/avatar-api";
import { formatHintsForPrompt } from "@/lib/avatar/taxonomy";
import type { CorpusReferenceRow } from "@/lib/avatar/retrieve-reference";

function getOrchestratorModelId(): string {
  const id =
    process.env.GOOGLE_AVATAR_ORCHESTRATOR_MODEL ??
    process.env.GOOGLE_BRAND_PROJECTION_MODEL ??
    process.env.GOOGLE_DEFAULT_MODEL;
  if (!id?.trim()) {
    throw new Error(
      "Missing GOOGLE_AVATAR_ORCHESTRATOR_MODEL (or GOOGLE_BRAND_PROJECTION_MODEL / GOOGLE_DEFAULT_MODEL)."
    );
  }
  return id.trim();
}

function corpusSummary(row: CorpusReferenceRow): string {
  const meta = row.metadata ?? {};
  return [
    `Reference summary (inspiration only, do not copy identity):`,
    `Similarity-weighted row quality: ${row.quality_score}/10.`,
    `Prior description: ${row.master_prompt.slice(0, 1200)}`,
    `Structured metadata (JSON excerpt): ${JSON.stringify(meta).slice(0, 2000)}`,
  ].join("\n");
}

export type OrchestratorParams = {
  input: AvatarGenerationInput;
  mode: "corpus" | "client_refs";
  corpusRow?: CorpusReferenceRow | null;
  clientRefDigest?: string;
};

/**
 * Builds a single master prompt for native image generation: avatar-only sections, uniqueness rules.
 */
export async function buildAvatarImagePrompt(params: OrchestratorParams): Promise<string> {
  const modelId = getOrchestratorModelId();
  const hintsText = formatHintsForPrompt(params.input.hints as Record<string, unknown>);

  const referenceSection =
    params.mode === "corpus" && params.corpusRow
      ? corpusSummary(params.corpusRow)
      : params.mode === "client_refs"
        ? params.clientRefDigest ??
          "Reference mode: developer-supplied images are attached. Synthesize a new character informed by their general style, lighting, and mood — not a duplicate of any person shown."
        : "No library reference row; rely on user prompt and hints only.";

  const system = `You are a senior character art director and prompt engineer for high-end marketing avatars.
Your output will be sent directly to an image generation system (you must not name vendors or models).
Produce ONE cohesive English prompt body with the following labeled sections in order:
1) IDENTITY_AND_ROLE
2) FRAME_AND_COMPOSITION
3) PHYSICAL_TRAITS_AND_OUTFIT
4) EXPRESSION_AND_DETAILS
5) VISUAL_STYLE_STACK (art direction, lighting, background, mood)
6) UNIQUENESS_MANDATE (explicit: new original individual; inspired only; not a copy or lookalike of reference)
7) NEGATIVES (no extra faces unless requested, no logos, no watermark text, no UI frames)

Rules:
- Obey the user's creative brief and hints strictly where they specify; invent tasteful defaults only where missing.
- If references are used, treat them as loose inspiration for palette, wardrobe class, and camera language — never replicate a real person's identity.
- Keep the final prompt under 3500 characters. Plain text only inside sections.`;

  const user = [
    `USER_PROMPT:\n${params.input.prompt}`,
    hintsText ? `HINTS:\n${hintsText}` : "",
    `REFERENCE_CONTEXT:\n${referenceSection}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const { text } = await generateText({
    model: google(modelId),
    system,
    prompt: user,
    maxOutputTokens: 2500,
  });

  const trimmed = text.trim();
  if (trimmed.length < 80) {
    throw new Error("Orchestrator produced an empty or unusable prompt.");
  }
  return trimmed;
}
