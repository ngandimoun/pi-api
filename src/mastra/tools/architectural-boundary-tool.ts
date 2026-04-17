import { createTool } from "@mastra/core/tools";
import { Project, SyntaxKind } from "ts-morph";
import { z } from "zod";

function analyzeBoundary(filePath: string, excerpt: string) {
  const project = new Project({ useInMemoryFileSystem: true });
  const sf = project.createSourceFile(filePath, excerpt, { overwrite: true });

  const firstStatement = sf.getStatements()[0];
  const firstText = firstStatement?.getText().trim() ?? "";
  const has_use_client = firstText === '"use client"' || firstText === "'use client'";
  const has_use_server = firstText === '"use server"' || firstText === "'use server'";
  const is_server_component = !has_use_client;

  const exported_symbols: string[] = [];
  for (const exp of sf.getExportedDeclarations()) {
    exported_symbols.push(exp[0]);
  }

  const violations: string[] = [];
  const normalPath = filePath.replace(/\\/g, "/");
  const isLayout = /layout\.(ts|tsx|js|jsx)$/.test(normalPath);

  if (isLayout && has_use_client) {
    violations.push(
      `${filePath} is a layout with "use client" — forces entire subtree into client rendering. Create a <Providers> client wrapper instead.`
    );
  }

  if (is_server_component) {
    const clientOnlyHooks = ["useState", "useEffect", "useReducer", "useContext", "useRef", "useCallback", "useMemo"];
    for (const decl of sf.getImportDeclarations()) {
      for (const named of decl.getNamedImports()) {
        if (clientOnlyHooks.includes(named.getName())) {
          violations.push(
            `${filePath} is a Server Component importing "${named.getName()}" (client-only hook). Add "use client" or extract to a client component.`
          );
        }
      }
    }

    let hasProviderJsx = false;
    sf.forEachDescendant((node) => {
      if (node.getKind() === SyntaxKind.JsxOpeningElement || node.getKind() === SyntaxKind.JsxSelfClosingElement) {
        const tagName = node.getChildAtIndex(1)?.getText() ?? "";
        if (tagName.endsWith("Provider") || tagName.endsWith("Context")) {
          hasProviderJsx = true;
        }
      }
    });
    if (hasProviderJsx) {
      violations.push(
        `${filePath} is a Server Component wrapping children in a Provider/Context. Extract into a "use client" wrapper.`
      );
    }
  }

  if (has_use_client) {
    sf.forEachDescendant((node) => {
      if (node.getKind() === SyntaxKind.ExpressionStatement) {
        const text = node.getText().trim();
        if (text === '"use server"' || text === "'use server'") {
          violations.push(`${filePath} has both "use client" and "use server" — mutually exclusive.`);
        }
      }
    });
  }

  return {
    is_server_component,
    has_use_client,
    has_use_server,
    exported_symbols: exported_symbols.slice(0, 50),
    boundary_violations: violations,
  };
}

export const architecturalBoundaryTool = createTool({
  id: "architectural-boundary",
  description:
    "Analyze a TS/TSX file for Next.js architectural boundary violations: 'use client'/'use server' issues, Provider placement, client hooks in Server Components.",
  inputSchema: z.object({
    file_path: z.string().describe("Repo-relative path of the file to analyze"),
    excerpt: z.string().max(50_000).describe("Source code content of the file"),
  }),
  outputSchema: z.object({
    is_server_component: z.boolean(),
    has_use_client: z.boolean(),
    has_use_server: z.boolean(),
    exported_symbols: z.array(z.string()),
    boundary_violations: z.array(z.string()),
  }),
  execute: async ({ file_path, excerpt }) => analyzeBoundary(file_path, excerpt),
});
