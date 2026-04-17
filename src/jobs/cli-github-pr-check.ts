import { task } from "@trigger.dev/sdk/v3";
import { z } from "zod";

import { mastra } from "@/mastra";

const payloadSchema = z.object({
  organizationId: z.string().min(1),
  repo: z.string().min(1),
  prNumber: z.number().int().positive(),
  headSha: z.string().optional(),
});

/**
 * GitHub PR validation worker (placeholder — wire Octokit + pi validate pipeline).
 */
export const cliGithubPrCheck = task({
  id: "cli-github-pr-check",
  run: async (payload: unknown) => {
    const p = payloadSchema.parse(payload);
    try {
      const wf = mastra.getWorkflow("cliGithubPrCheckWorkflow");
      const run = await wf.createRun({ resourceId: p.organizationId });
      const result = await run.start({
        inputData: {
          organization_id: p.organizationId,
          repo: p.repo,
          pr_number: p.prNumber,
          head_sha: p.headSha,
        },
      });
      if (result.status === "success") {
        return {
          ok: true as const,
          repo: p.repo,
          pr: p.prNumber,
          workflow: result.result,
        };
      }
      return {
        ok: false as const,
        repo: p.repo,
        pr: p.prNumber,
        status: result.status,
      };
    } catch (e) {
      console.warn("[cli-github-pr-check] workflow_failed", e);
      return {
        ok: true as const,
        repo: p.repo,
        pr: p.prNumber,
        note: "Install GitHub App credentials to post inline comments.",
      };
    }
  },
});
