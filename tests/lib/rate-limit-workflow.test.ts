import { describe, expect, it } from "vitest";
import { buildBillingRatelimitsForPath, inferWorkflowFamilyFromPathname } from "@/lib/workflow-family";

describe("workflow family + billing ratelimits", () => {
  it("infers health for /api/v1/health/*", () => {
    expect(inferWorkflowFamilyFromPathname("/api/v1/health/analyze")).toBe("health");
    expect(inferWorkflowFamilyFromPathname("/api/v1/neuro/decode")).toBe("health");
  });

  it("infers brand for brands, campaigns, jobs, runs", () => {
    expect(inferWorkflowFamilyFromPathname("/api/v1/brands/x")).toBe("brand");
    expect(inferWorkflowFamilyFromPathname("/api/v1/campaigns/generate")).toBe("brand");
    expect(inferWorkflowFamilyFromPathname("/api/v1/jobs/1")).toBe("brand");
    expect(inferWorkflowFamilyFromPathname("/api/v1/runs")).toBe("brand");
  });

  it("infers surveillance, robotics, voice, images", () => {
    expect(inferWorkflowFamilyFromPathname("/api/v1/surveillance/streams")).toBe("surveillance");
    expect(inferWorkflowFamilyFromPathname("/api/v1/robots/run")).toBe("robotics");
    expect(inferWorkflowFamilyFromPathname("/api/v1/voice/sessions")).toBe("voice");
    expect(inferWorkflowFamilyFromPathname("/api/v1/images/generations")).toBe("images");
    expect(inferWorkflowFamilyFromPathname("/api/v1/avatars")).toBe("images");
  });

  it("buildBillingRatelimitsForPath adds family bucket when not cli", () => {
    expect(buildBillingRatelimitsForPath("/api/v1/webhooks")).toEqual([
      { name: "cli_requests_monthly", cost: 1 },
    ]);
    expect(buildBillingRatelimitsForPath("/api/v1/health/wellness")).toEqual([
      { name: "cli_requests_monthly", cost: 1 },
      { name: "health_monthly", cost: 1 },
    ]);
  });
});
