import { generateText } from "ai";

import { getPiCliGeminiModel } from "@/lib/pi-cli-llm";
import { slugFromIntent } from "@/lib/pi-cli-routine-generate";

export type PromptCompileResult = {
  compiled_prompt: string;
  intent_slug: string;
};

export type PromptCompileInput = {
  intent: string;
  system_style_summary: string;
  graph_summary: string;
  ast_summaries: string;
  memory_context: string;
  import_histogram_note: string;
  framework_hints_note: string;
};

const SYSTEM_INSTRUCTIONS = [
  "You are a Staff Engineer writing a strict, paste-ready instruction prompt for a Junior AI Coder (Cursor, Claude Code, Windsurf, etc.).",
  "The human gave a vague feature request. Your output must be ONE markdown document they can paste into an agent — not a chat reply to the human.",
  "You MUST:",
  "1. Infer a clear **Role** and **Task** from the intent.",
  "2. Ground the prompt in the **Context & Codebase Rules** section using ONLY paths, libraries, and patterns implied by the provided summaries (graph, AST, imports, framework hints). If a path is uncertain, say 'verify in repo' instead of inventing.",
  "3. Add **Step-by-step implementation** with ordered, concrete steps referencing repo-relative paths when given.",
  "4. Add **Constraints** (security, testing, styling, validation) aligned with system style and memory.",
  "5. If **Prior memory / learn** mentions past mistakes or rules, surface them as explicit MUST/MUST NOT bullets.",
  "6. Do not include filler like 'Sure!' or 'Here is your prompt'. Start directly with markdown headings.",
  "7. Prefer specificity over generic advice; this prompt should reduce hallucinations for THIS codebase.",
].join("\n");

/**
 * Compile a high-density, codebase-aware prompt for agentic coding tools.
 */
export async function compilePiPromptDraft(input: PromptCompileInput): Promise<PromptCompileResult> {
  const model = getPiCliGeminiModel("lite");
  const intent_slug = slugFromIntent(input.intent);

  const userContent = [
    `**Developer intent:** ${input.intent}`,
    "",
    "**System style / company rules (curated):**",
    input.system_style_summary,
    "",
    "**Import / stack signals:**",
    input.import_histogram_note,
    input.framework_hints_note ? `\n${input.framework_hints_note}` : "",
    "",
    "**Dependency / file graph:**",
    input.graph_summary,
    "",
    "**AST / excerpt hints:**",
    input.ast_summaries,
    "",
    "**Prior memory / learn (may be empty):**",
    input.memory_context || "(none)",
    "",
    "Produce the final markdown prompt for the coding agent now.",
  ].join("\n");

  const { text } = await generateText({
    model,
    system: SYSTEM_INSTRUCTIONS,
    prompt: userContent,
  });

  const compiled_prompt = text.trim();
  if (!compiled_prompt) {
    throw new Error("Prompt compilation returned empty text.");
  }

  return { compiled_prompt, intent_slug };
}
