import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";

export const cliGithubPrCheckWorkflowInputSchema = z.object({
  organization_id: z.string(),
  repo: z.string(),
  pr_number: z.number(),
  head_sha: z.string().optional(),
});

const reviewStep = createStep({
  id: "pr-static-review",
  inputSchema: cliGithubPrCheckWorkflowInputSchema,
  outputSchema: z.object({
    organization_id: z.string(),
    repo: z.string(),
    pr_number: z.number(),
    summary: z.string(),
  }),
  execute: async ({ inputData }) => ({
    organization_id: inputData.organization_id,
    repo: inputData.repo,
    pr_number: inputData.pr_number,
    summary:
      "GitHub PR check workflow ready — wire Octokit + inline review comments + cli validate integration.",
  }),
});

export const cliGithubPrCheckWorkflow = createWorkflow({
  id: "cli-github-pr-check-workflow",
  inputSchema: cliGithubPrCheckWorkflowInputSchema,
  outputSchema: z.object({
    organization_id: z.string(),
    repo: z.string(),
    pr_number: z.number(),
    summary: z.string(),
  }),
})
  .then(reviewStep)
  .commit();
