/**
 * Line-oriented deterministic checks for polyglot validate targets (no native parser).
 *
 * - `no-hardcoded-secret`: all extensions in POLYGLOT_VALIDATE_PATH, including json/yml/yaml/toml.
 * - `no-sql-injection-pattern`: code extensions only; per-language string-interpolation heuristics
 *   (high false-negative rate by design; complements TS ts-morph rules).
 * - Shell (`sh`, `bash`, `zsh`, `ps1`): `no-unsafe-shell-pattern` warnings for obvious footguns.
 *
 * Header-only C/C++ (`.h`, `.hpp`): secrets only — SQL heuristics skipped (too noisy).
 */
import { isSecretOnlyPolyglotExt } from "./polyglot-extensions.js";
import type { RuleViolation } from "./violation-types.js";

const SECRET_RES = [
  /\bsk_live_[a-zA-Z0-9]{20,}/,
  /\bsk_test_[a-zA-Z0-9]{20,}/,
  /\bAIza[0-9A-Za-z_-]{35}\b/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\bxox[baprs]-[0-9A-Za-z-]{10,}\b/,
  /** Synthetic marker for fixtures/tests — not a real provider format (avoids host push-protection false positives). */
  /\bPI_CLI_SYNTHETIC_SECRET_[A-Z0-9]{12,}\b/,
];

const SQL_INTERP_PY = /(?:execute|cursor\.execute)\s*\(\s*f["']/;
/** Go database/sql: string literal concatenated with `+` (either order). */
const SQL_INTERP_GO =
  /Query(?:Row|Context)?\s*\(\s*[^)]*(["'`][^"'`]*["']\s*\+|\+\s*["'`])/;
const SQL_INTERP_RS = /query\s*!\s*\(\s*[^)]*\{[^}]+\}/;

/** Java / Kotlin / C# JDBC-style or ADO-style calls with obvious concatenation or interpolation. */
const SQL_INTERP_JAVA_KT_CS =
  /(?:execute|prepareStatement|createQuery|createNativeQuery|ExecuteNonQuery|ExecuteReader|ExecuteScalar)\s*\([^)]*(["'`][^"'`]*["']\s*\+|\+\s*["'`]|\$\{)/i;

/** PHP dynamic SQL into DB APIs. */
const SQL_INTERP_PHP =
  /(?:mysqli_query|mysql_query|pg_query|->query|->exec)\s*\(\s*[^)]*(\$[a-zA-Z0-9_]+\s*\.|["'][^"']*["']\s*\.)/;

/** Ruby: `execute` / `query` call whose argument list contains `#\{` (string interpolation). */
const SQL_INTERP_RB = /(?:execute|query)\s*\([^)]*#\{/;

/** Swift string interpolation inside execute/query parens. */
const SQL_INTERP_SWIFT = /(?:execute|query)\s*\([^)]*\\\(/;

/** C/C++ sqlite-style or generic execute with concatenation. */
const SQL_INTERP_CPP = /(?:sqlite3_prepare|sqlite3_exec|execute)\s*\([^)]*\+/;

/** Raw `.sql` files with string concat / OR dynamic fragments. */
const SQL_INTERP_SQL_FILE = /'[^']*'\s*\|\|\s*|"\s*\+\s*['"]|\$\{[^}]+\}/;

const SHELL_EVAL = /\beval\s+/;
const SHELL_CURL_PIPE_SH = /\bcurl\b[^#\n`]*\|\s*(?:sudo\s+)?(?:bash|sh)\b/;

function shouldRunSqlHeuristics(ext: string): boolean {
  if (isSecretOnlyPolyglotExt(ext)) return false;
  if (ext === "h" || ext === "hpp") return false;
  return true;
}

export function scanPolyglotFile(
  absPath: string,
  content: string,
  enabled: (id: string) => boolean
): RuleViolation[] {
  const ext = absPath.split(".").pop()?.toLowerCase() ?? "";
  const lines = content.split(/\r?\n/);
  const out: RuleViolation[] = [];

  const push = (rule: string, line: number, col: number, message: string, severity: RuleViolation["severity"]) => {
    if (!enabled(rule)) return;
    out.push({ rule, severity, message, file: absPath, line, column: col });
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const lineNo = i + 1;

    for (const re of SECRET_RES) {
      if (re.test(line)) {
        push("no-hardcoded-secret", lineNo, 1, "Possible secret/token in source; use environment variables.", "error");
        break;
      }
    }

    if (!shouldRunSqlHeuristics(ext)) {
      /* secrets only for config + headers */
    } else if (ext === "py" && SQL_INTERP_PY.test(line)) {
      push(
        "no-sql-injection-pattern",
        lineNo,
        1,
        "Avoid f-string SQL; use parameterized queries.",
        "error"
      );
    } else if (ext === "go" && SQL_INTERP_GO.test(line)) {
      push(
        "no-sql-injection-pattern",
        lineNo,
        1,
        "Avoid string concatenation in SQL queries; use bound parameters.",
        "error"
      );
    } else if (ext === "rs" && SQL_INTERP_RS.test(line)) {
      push(
        "no-sql-injection-pattern",
        lineNo,
        1,
        "Review SQL macro interpolation for injection risk.",
        "warning"
      );
    } else if ((ext === "java" || ext === "kt" || ext === "cs") && SQL_INTERP_JAVA_KT_CS.test(line)) {
      push(
        "no-sql-injection-pattern",
        lineNo,
        1,
        "Avoid string concatenation or raw interpolation in SQL; use bound parameters.",
        "error"
      );
    } else if (ext === "php" && SQL_INTERP_PHP.test(line)) {
      push(
        "no-sql-injection-pattern",
        lineNo,
        1,
        "Avoid building SQL via string concatenation; use prepared statements.",
        "error"
      );
    } else if (ext === "rb" && SQL_INTERP_RB.test(line)) {
      push(
        "no-sql-injection-pattern",
        lineNo,
        1,
        "Avoid Ruby string interpolation in SQL literals; use bound parameters.",
        "error"
      );
    } else if (ext === "swift" && SQL_INTERP_SWIFT.test(line)) {
      push(
        "no-sql-injection-pattern",
        lineNo,
        1,
        "Review Swift string interpolation in SQL for injection risk.",
        "warning"
      );
    } else if ((ext === "cpp" || ext === "cc" || ext === "cxx") && SQL_INTERP_CPP.test(line)) {
      push(
        "no-sql-injection-pattern",
        lineNo,
        1,
        "Avoid concatenating user input into SQL; use bound parameters.",
        "warning"
      );
    } else if (ext === "sql" && SQL_INTERP_SQL_FILE.test(line)) {
      push(
        "no-sql-injection-pattern",
        lineNo,
        1,
        "Review dynamic SQL construction in this file.",
        "warning"
      );
    }

    if (ext === "sh" || ext === "bash" || ext === "zsh" || ext === "ps1") {
      if (SHELL_EVAL.test(line)) {
        push(
          "no-unsafe-shell-pattern",
          lineNo,
          1,
          "Avoid eval; it executes arbitrary strings.",
          "warning"
        );
      }
      if (SHELL_CURL_PIPE_SH.test(line)) {
        push(
          "no-unsafe-shell-pattern",
          lineNo,
          1,
          "Piping curl into a shell executes remote content; download then inspect.",
          "warning"
        );
      }
    }
  }

  return out;
}
