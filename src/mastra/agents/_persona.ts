/**
 * Persona helpers shared by Pi CLI agents and workflows.
 *
 * The CLI ships an `X-Pi-Persona` header on every request (see
 * `packages/pi-cli/src/lib/api-client.ts`). API routes and workflow steps
 * extract it, validate it, and prepend `buildSessionPreamble(persona)` to the
 * user prompt so the agent adapts its response style without mutating the
 * global agent `instructions` array (which would leak across requests).
 */

export const PI_PERSONA_IDS = [
  "newbie",
  "normal",
  "expert",
  "designer",
  "pm",
] as const;

export type PiPersona = (typeof PI_PERSONA_IDS)[number];

export function isPiPersona(value: unknown): value is PiPersona {
  return typeof value === "string" && (PI_PERSONA_IDS as readonly string[]).includes(value);
}

/**
 * Extract the persona from an incoming request's headers.
 * Falls back to "normal" for unknown / missing / invalid values.
 */
export function readPersonaFromHeaders(headers: Headers): PiPersona {
  const raw = headers.get("x-pi-persona")?.trim().toLowerCase();
  return isPiPersona(raw) ? raw : "normal";
}

/**
 * Prose preamble prepended to agent user prompts. Written so the agent treats
 * it as authoritative style guidance (no code fences, no markdown headings,
 * single block).
 */
export function buildSessionPreamble(p: PiPersona): string {
  switch (p) {
    case "newbie":
      return [
        "[PI PERSONA: newbie]",
        "The developer is new to coding or to this stack. Explain every shell command or API call you mention.",
        "For each command include: (1) what it does in plain English, (2) the expected outcome,",
        "(3) the prerequisites, (4) how to verify it ran successfully.",
        "Never use unexplained jargon. Define every acronym inline (TS = TypeScript, RSC = React Server Component, RLS = Row-Level Security, etc.).",
        "Suggest only ONE next action at a time. Avoid chains of 3+ steps. Use short bullet lists.",
      ].join(" ");
    case "normal":
      return [
        "[PI PERSONA: normal]",
        "Balanced explanations. Assume basic CLI literacy and git fluency.",
        "Skip definitions for common terms (npm, git, branch, PR, lint).",
        "Keep prose compact but include enough rationale for the developer to make a decision.",
      ].join(" ");
    case "expert":
      return [
        "[PI PERSONA: expert]",
        "Be terse. Skip obvious context. Prefer symbols, paths, diffs, exit codes over prose.",
        "Do not explain what common commands do.",
        "One-line summaries. Link to code paths. No motivational framing, no recap of the question.",
      ].join(" ");
    case "designer":
      return [
        "[PI PERSONA: designer]",
        "The reader is a designer. Frame every response around components, tokens, spacing scale, color, type scale, motion, accessibility, and empty/error states.",
        "Bias routine and template suggestions toward UI/UX templates under `src/templates/ui-ux/*`.",
        "Avoid backend, data-layer, or infra detail unless the user explicitly asks.",
        "When referencing code, prefer component files (.tsx) and design tokens over schemas or API routes.",
      ].join(" ");
    case "pm":
      return [
        "[PI PERSONA: pm]",
        "The reader is a product manager. Frame every response around acceptance criteria, user-visible behavior, test plans, and business risk.",
        "Use 'users will see / users won't be able to' framing. Hide implementation details unless asked.",
        "When producing plans, structure them as: Goal → User story → Acceptance criteria → Risks → Test plan.",
      ].join(" ");
  }
}

/**
 * Convenience: prepend the preamble onto an existing prompt body, separated by
 * a blank line. No-op for "normal" if the caller prefers to save tokens, but we
 * always include it for consistency across agent logs.
 */
export function withPersonaPreamble(p: PiPersona, promptBody: string): string {
  return `${buildSessionPreamble(p)}\n\n${promptBody}`;
}
