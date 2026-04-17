import { createTool } from "@mastra/core/tools";
import { Project, SyntaxKind } from "ts-morph";
import { z } from "zod";

export type BlastRadiusOutput = {
  impacted_files: string[];
  blast_summary: string;
};

export function computeBlastRadius(
  excerpts: { path: string; excerpt: string }[],
  targetSymbol: string,
  filePath: string
): BlastRadiusOutput {
  const project = new Project({ useInMemoryFileSystem: true });
  for (const e of excerpts) {
    project.createSourceFile(e.path, e.excerpt, { overwrite: true });
  }

  const impacted = new Set<string>();
  const normalTarget = filePath.replace(/\\/g, "/").replace(/\.(ts|tsx|js|jsx)$/, "");

  for (const sf of project.getSourceFiles()) {
    const sfPath = sf.getFilePath().replace(/\\/g, "/");
    for (const decl of sf.getImportDeclarations()) {
      const spec = decl.getModuleSpecifierValue().replace(/\\/g, "/").replace(/\.(ts|tsx|js|jsx)$/, "");
      const lastTarget = normalTarget.split("/").pop() ?? "";
      const lastSpec = spec.split("/").pop() ?? "";
      const specsMatch = spec === normalTarget || lastSpec === lastTarget;
      if (!specsMatch) continue;

      const namedImports = decl.getNamedImports().map((n) => n.getName());
      const defaultImport = decl.getDefaultImport()?.getText();
      if (namedImports.includes(targetSymbol) || defaultImport === targetSymbol || decl.getNamespaceImport()) {
        impacted.add(sfPath);
      }
    }

    sf.forEachDescendant((node) => {
      if (
        node.getKind() === SyntaxKind.Identifier &&
        node.getText() === targetSymbol &&
        sfPath !== filePath.replace(/\\/g, "/")
      ) {
        impacted.add(sfPath);
      }
    });
  }

  const files = [...impacted];
  const blast_summary =
    files.length > 0
      ? `"${targetSymbol}" from ${filePath} is referenced in ${files.length} file(s): ${files.slice(0, 15).join(", ")}${files.length > 15 ? ` (+${files.length - 15} more)` : ""}`
      : `"${targetSymbol}" from ${filePath} — no references found in provided excerpts.`;

  return { impacted_files: files, blast_summary };
}

export const blastRadiusTool = createTool({
  id: "blast-radius",
  description:
    "Analyze which files are impacted when a given symbol changes. Operates on code excerpts sent from the CLI.",
  inputSchema: z.object({
    target_symbol: z.string().describe("The exported symbol to trace (e.g. 'User', 'fetchData')"),
    file_path: z.string().describe("Repo-relative path where the symbol is defined"),
    file_excerpts: z
      .array(z.object({ path: z.string(), excerpt: z.string().max(20_000) }))
      .max(40)
      .describe("Code excerpts from the project to search through"),
  }),
  outputSchema: z.object({
    impacted_files: z.array(z.string()),
    blast_summary: z.string(),
  }),
  execute: async ({ target_symbol, file_path, file_excerpts }) =>
    computeBlastRadius(file_excerpts, target_symbol, file_path),
});
