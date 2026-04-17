/**
 * Single source of truth for which non-TS/JS paths participate in polyglot
 * fingerprinting (`pi learn` / `pi doctor`) vs local deterministic scan (`pi validate`).
 */

/** Code-like paths: secrets + language-specific SQL / shell heuristics. */
export const POLYGLOT_CODE_EXTENSIONS = [
  "py",
  "go",
  "rs",
  "java",
  "kt",
  "cs",
  "php",
  "rb",
  "swift",
  "cpp",
  "cc",
  "cxx",
  "h",
  "hpp",
  "sql",
  "sh",
  "bash",
  "zsh",
  "ps1",
] as const;

/** Config / serialized data: hardcoded-secret scan only (no SQL interpolation rules). */
export const POLYGLOT_SECRET_ONLY_EXTENSIONS = ["json", "yml", "yaml", "toml"] as const;

/** Counted in repo hints but not passed through validate (embedded examples → noisy). */
export const POLYGLOT_FINGERPRINT_ONLY_EXTENSIONS = ["md"] as const;

export type PolyglotCodeExt = (typeof POLYGLOT_CODE_EXTENSIONS)[number];
export type PolyglotSecretOnlyExt = (typeof POLYGLOT_SECRET_ONLY_EXTENSIONS)[number];

const _validateExts = [...POLYGLOT_CODE_EXTENSIONS, ...POLYGLOT_SECRET_ONLY_EXTENSIONS] as const;

/** Regex: file path ends with a polyglot validate extension (excludes .md). */
export const POLYGLOT_VALIDATE_PATH = new RegExp(`\\.(${_validateExts.join("|")})$`, "i");

/** fast-glob pattern for `collectPolyglotHints` / enhanced hints (includes .md). */
export function buildPolyglotHintsGlob(): string {
  const exts = [
    ...POLYGLOT_CODE_EXTENSIONS,
    ...POLYGLOT_SECRET_ONLY_EXTENSIONS,
    ...POLYGLOT_FINGERPRINT_ONLY_EXTENSIONS,
  ];
  return `**/*.{${exts.join(",")}}`;
}

export function isPolyglotValidatePath(filePath: string): boolean {
  return POLYGLOT_VALIDATE_PATH.test(filePath);
}

export function isSecretOnlyPolyglotExt(extLower: string): boolean {
  return (POLYGLOT_SECRET_ONLY_EXTENSIONS as readonly string[]).includes(extLower);
}
