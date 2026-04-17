import chalk from "chalk";

import { PERSONA_IDS, type PiPersona } from "./config.js";

export type PersonaMeta = {
  id: PiPersona;
  label: string;
  longLabel: string;
  description: string;
};

export const PERSONAS: Record<PiPersona, PersonaMeta> = {
  newbie: {
    id: "newbie",
    label: "Newbie",
    longLabel: "Newbie — explain every command and outcome",
    description:
      "New to coding or to this stack. Pi explains every command, what it does, what to expect, and how to verify it worked.",
  },
  normal: {
    id: "normal",
    label: "Normal",
    longLabel: "Normal — balanced explanations (default)",
    description:
      "Comfortable with basic CLI and git. Pi gives balanced context without over-explaining common terms.",
  },
  expert: {
    id: "expert",
    label: "Expert",
    longLabel: "Expert — terse, no hand-holding",
    description:
      "Senior engineer. Pi is terse, skips obvious context, and shows raw commands, diffs, and exit codes.",
  },
  designer: {
    id: "designer",
    label: "Designer",
    longLabel: "Designer — UI/UX focus, components & tokens",
    description:
      "UI/UX oriented. Pi frames responses around components, tokens, spacing, color, type, accessibility — not architecture.",
  },
  pm: {
    id: "pm",
    label: "Product Manager",
    longLabel: "Product manager — acceptance criteria & user impact",
    description:
      "Product-focused. Pi frames responses around acceptance criteria, user-visible behavior, test plans, and business risk.",
  },
};

export function listPersonas(): PersonaMeta[] {
  return PERSONA_IDS.map((id) => PERSONAS[id]);
}

/**
 * The instruction block prepended to the Mastra agent system prompt / user message.
 * Kept as plain prose (no markdown) so agents treat it as authoritative style guidance.
 */
export function getPersonaInstructions(p: PiPersona): string {
  switch (p) {
    case "newbie":
      return [
        "[PI PERSONA: newbie]",
        "The user is new to coding or to this stack. Explain every shell command you suggest.",
        "For each command include: (1) what it does in plain English, (2) the expected outcome,",
        "(3) the prerequisites, (4) how to verify it ran successfully (e.g. what the terminal should print).",
        "Never use unexplained jargon. If you must use an acronym (TS, RSC, RLS, CI, PR, etc.), define it inline.",
        "Suggest only ONE next step at a time. Avoid chains of 3+ commands. Prefer short bullet lists.",
        "When showing code, add a one-line comment above each block saying what the block does.",
      ].join(" ");
    case "normal":
      return [
        "[PI PERSONA: normal]",
        "Balanced explanations. Assume basic CLI literacy and git fluency.",
        "Skip definitions for common terms (npm, git, branch, PR, commit, lint).",
        "Keep prose compact but include enough rationale for the user to make a decision.",
      ].join(" ");
    case "expert":
      return [
        "[PI PERSONA: expert]",
        "Be terse. Skip obvious context. Prefer symbols, paths, diffs, exit codes over prose.",
        "Do not explain what `npm install`, `git commit`, or `tsc` do.",
        "One-line summaries. Link to code paths. No motivational framing, no recap of what was asked.",
      ].join(" ");
    case "designer":
      return [
        "[PI PERSONA: designer]",
        "The user is a designer. Frame every response around UI/UX concerns:",
        "components, tokens, spacing scale, color, type scale, motion, accessibility, empty/error states.",
        "Bias routine and template suggestions toward UI/UX templates under `src/templates/ui-ux/*`.",
        "Avoid backend, data-layer, or infra detail unless the user explicitly asks.",
        "When referencing code, prefer component files (.tsx) and design tokens over schemas or API routes.",
      ].join(" ");
    case "pm":
      return [
        "[PI PERSONA: pm]",
        "The user is a product manager. Frame every response around:",
        "acceptance criteria, user-visible behavior, test plans, and business risk.",
        "Use 'users will see / users won't be able to' framing. Hide implementation details unless asked.",
        "When showing plans, structure them as: Goal → User story → Acceptance criteria → Risks → Test plan.",
      ].join(" ");
  }
}

/**
 * Produce a short, persona-aware hint to render under a suggested CLI command.
 * Returns an empty string for personas that don't need extra context.
 */
export function formatCommandHint(p: PiPersona, cmd: string, purpose: string): string {
  switch (p) {
    case "newbie":
      return [
        chalk.cyan(`  $ ${cmd}`),
        chalk.dim(`    what it does: ${purpose}`),
        chalk.dim(`    you should see: command output in the terminal (no errors)`),
      ].join("\n");
    case "normal":
      return `${chalk.cyan(`  ${cmd}`)}  ${chalk.dim(`— ${purpose}`)}`;
    case "expert":
      return chalk.cyan(`  ${cmd}`);
    case "designer":
      return `${chalk.cyan(`  ${cmd}`)}  ${chalk.dim(`— ${purpose} (UI/UX)`)}`;
    case "pm":
      return `${chalk.cyan(`  ${cmd}`)}  ${chalk.dim(`— ${purpose} (user-facing outcome)`)}`;
  }
}

/**
 * Render a block of command suggestions adapted per persona.
 * Each entry is `[command, purpose]`.
 */
export function formatCommandBlock(p: PiPersona, entries: Array<[cmd: string, purpose: string]>): string {
  return entries.map(([c, purpose]) => formatCommandHint(p, c, purpose)).join("\n");
}
