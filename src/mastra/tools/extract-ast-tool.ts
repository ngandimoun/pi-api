import { createTool } from "@mastra/core/tools";
import { Project, SyntaxKind } from "ts-morph";
import { z } from "zod";

export type AstSnippetFacts = {
  reactHookNames: string[];
  hasMapCallInJsx: boolean;
  importSpecifiers: string[];
};

/**
 * Lightweight AST facts from a TS/TSX excerpt (no full project graph).
 * Exported for Pi routine context gathering (same logic as the Mastra tool).
 */
export async function extractAstFactsFromExcerpt(path: string, excerpt: string): Promise<AstSnippetFacts> {
  const project = new Project({ useInMemoryFileSystem: true });
  const sf = project.createSourceFile(path, excerpt, { overwrite: true });

  const hookSet = new Set<string>();
  sf.forEachDescendant((node) => {
    if (node.getKind() === SyntaxKind.CallExpression) {
      const expr = node.asKindOrThrow(SyntaxKind.CallExpression).getExpression().getText();
      const tail = expr.includes(".") ? (expr.split(".").pop() ?? expr) : expr;
      if (/^use[A-Z]/.test(tail)) {
        hookSet.add(expr);
      }
    }
  });
  const reactHookNames = [...hookSet];

  let hasMapCallInJsx = false;
  sf.forEachDescendant((node) => {
    if (node.getKind() === SyntaxKind.CallExpression) {
      const call = node.asKindOrThrow(SyntaxKind.CallExpression);
      if (call.getExpression().getText().endsWith(".map")) {
        hasMapCallInJsx = true;
      }
    }
  });

  const importSpecifiers: string[] = [];
  for (const d of sf.getImportDeclarations()) {
    for (const n of d.getNamedImports()) {
      importSpecifiers.push(n.getName());
    }
  }

  return { reactHookNames, hasMapCallInJsx, importSpecifiers };
}

/**
 * Lightweight AST facts from a TS/TSX excerpt (no full project graph).
 */
export const extractAstSnippetTool = createTool({
  id: "extract-ast-snippet",
  description:
    "Parse a TypeScript/TSX code excerpt and return hook usage, JSX map calls, and import hints.",
  inputSchema: z.object({
    path: z.string().describe("Virtual filename for syntax (e.g. Dashboard.tsx)"),
    excerpt: z.string().max(50_000),
  }),
  outputSchema: z.object({
    reactHookNames: z.array(z.string()),
    hasMapCallInJsx: z.boolean(),
    importSpecifiers: z.array(z.string()),
  }),
  execute: async ({ path, excerpt }) => extractAstFactsFromExcerpt(path, excerpt),
});
