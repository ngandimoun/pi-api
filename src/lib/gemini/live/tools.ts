import { z } from "zod";

/**
 * Minimal, SDK- and WS-friendly tool definitions for Gemini Live.
 * We keep the schema permissive because the exact @google/genai shapes evolve.
 *
 * Policy note: Gemini 3.1 Flash Live Preview supports function calling
 * synchronously only. Do not use NON_BLOCKING behavior.
 */

export const liveFunctionDeclarationSchema = z
  .object({
    name: z.string().min(1),
    description: z.string().optional(),
    parameters: z.record(z.unknown()).optional(),
    // Explicitly forbid async function calling flags in our stack.
    behavior: z.never().optional(),
  })
  .passthrough();

export type LiveFunctionDeclaration = z.infer<typeof liveFunctionDeclarationSchema>;

export const liveToolsSchema = z.array(z.record(z.unknown())).optional();

export type LiveToolConfig = Record<string, unknown>;

export function makeLiveFunctionTools(declarations: LiveFunctionDeclaration[]): LiveToolConfig[] {
  for (const decl of declarations) {
    liveFunctionDeclarationSchema.parse(decl);
  }
  return [
    {
      functionDeclarations: declarations,
    },
  ];
}

export function makeLiveGoogleSearchTool(): LiveToolConfig[] {
  return [
    {
      googleSearch: {},
    },
  ];
}

export function combineLiveTools(...toolGroups: Array<LiveToolConfig[] | undefined>): LiveToolConfig[] {
  return toolGroups.flatMap((group) => group ?? []);
}

