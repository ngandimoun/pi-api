/**
 * Server-only avatar taxonomy helpers. Used by prompt orchestration (not exposed in public API).
 */

export const ART_DIRECTIONS = [
  "Ultra Realistic",
  "Realistic",
  "Anime",
  "Cartoon / 2D Stylized",
  "Painterly",
  "Stylized 3D",
  "Line Art / Sketch",
  "Pixel / Retro",
  "Clay / Toy Style",
  "Watercolor",
  "Oil Painting",
  "Digital Art",
  "Concept Art",
  "Minimalist",
  "Abstract",
  "Photorealistic",
  "Comic Book",
  "Low Poly",
  "Cyberpunk",
  "Steampunk",
] as const;

export type ArtDirection = (typeof ART_DIRECTIONS)[number] | "custom";

/** Flattened hair options when art direction has no dedicated list (fallback). */
export const HAIR_STYLES_FALLBACK = [
  "Short Bob",
  "Long Waves",
  "Pixie Cut",
  "Ponytail",
  "Bun",
  "Braids",
  "Shoulder Length",
  "Curly",
  "Afro",
  "Dreadlocks",
  "Slicked Back",
  "Spiky",
  "Long Straight",
  "Twin Tails",
  "Messy",
  "Undercut",
  "Bangs",
] as const;

export type AvatarHints = Record<string, unknown>;

/**
 * Compact text block for LLM context from hints (and optional custom keys).
 */
export function formatHintsForPrompt(hints: AvatarHints | undefined): string {
  if (!hints || typeof hints !== "object") {
    return "";
  }
  const lines: string[] = [];
  for (const [k, v] of Object.entries(hints)) {
    if (v === undefined || v === null || v === "") continue;
    if (Array.isArray(v)) {
      lines.push(`${k}: ${v.join(", ")}`);
    } else {
      lines.push(`${k}: ${String(v)}`);
    }
  }
  return lines.join("\n");
}

export function normalizeArtDirection(value: unknown): string | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  const t = value.trim();
  if (ART_DIRECTIONS.includes(t as (typeof ART_DIRECTIONS)[number])) {
    return t;
  }
  if (t.toLowerCase() === "custom") return "custom";
  return t;
}
