/**
 * Parser abstraction: TypeScript/JavaScript uses ts-morph elsewhere.
 * Polyglot files use text/regex scanners until tree-sitter is wired.
 */

export type SourceLanguage = "typescript" | "javascript" | "python" | "go" | "rust" | "unknown";

export function detectLanguageFromPath(filePath: string): SourceLanguage {
  const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
  switch (ext) {
    case "ts":
    case "tsx":
      return "typescript";
    case "js":
    case "jsx":
    case "mjs":
    case "cjs":
      return "javascript";
    case "py":
      return "python";
    case "go":
      return "go";
    case "rs":
      return "rust";
    default:
      return "unknown";
  }
}
