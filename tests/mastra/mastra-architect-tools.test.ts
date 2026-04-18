import { readFileSync } from "node:fs";
import path from "node:path";

import { mastra } from "@/mastra";
import {
  CLI_ARCHITECT_AGENT_TOOL_IDS,
  cliArchitectAgentTools,
} from "@/mastra/agents/cli-architect-agent";

describe("cliArchitectAgent tooling (Socratic / AST stack)", () => {
  it("registers cliArchitectAgent on the Mastra singleton", () => {
    expect(mastra.getAgent("cliArchitectAgent")).toBeDefined();
  });

  it("cliArchitectAgentTools matches the canonical tool id list", () => {
    const keys = Object.keys(cliArchitectAgentTools).sort();
    expect(keys).toEqual([...CLI_ARCHITECT_AGENT_TOOL_IDS].sort());
  });

  it("cliResonateWorkflow imports deterministic AST helpers (orchestration wiring)", () => {
    const p = path.join(process.cwd(), "src/mastra/workflows/pi-cli/cli-resonate-workflow.ts");
    const src = readFileSync(p, "utf8");
    expect(src).toContain("analyzeBoundary");
    expect(src).toContain("computeBlastRadius");
    expect(src).toContain("scanForPrerequisites");
  });
});
