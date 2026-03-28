import { mastra } from "@/mastra";

describe("mastra smoke", () => {
  it("registers the uppercase workflow and can execute it", async () => {
    const workflow = mastra.getWorkflow("uppercaseWorkflow");
    const run = await workflow.createRun();
    const result = await run.start({ inputData: { message: "hello" } });

    expect(result.status).toBe("success");
    if (result.status === "success") {
      expect(result.result).toEqual({ formatted: "HELLO" });
    }
  });

  it("registers the demo agent (construction only; no model call)", () => {
    const agent = mastra.getAgent("demoAgent");
    expect(agent.id).toBe("demo-agent");
  });
});

