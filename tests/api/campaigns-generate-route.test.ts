import { POST as generateCampaign } from "@/app/api/v1/campaigns/generate/route";

const mockTrigger = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

const mockJobInsert = vi.hoisted(() =>
  vi.fn().mockReturnValue({
    select: () => ({
      single: async () => ({
        data: { id: "cccccccc-1111-2222-3333-444444444444" },
        error: null,
      }),
    }),
  })
);

vi.mock("@trigger.dev/sdk/v3", () => ({
  tasks: {
    trigger: mockTrigger,
  },
}));

vi.mock("@/lib/auth", () => ({
  withApiAuth:
    (handler: (request: any, context: any) => Promise<Response>) =>
    (request: any, context: any) =>
      handler(
        Object.assign(request, { requestId: "req_pi_test", organizationId: "org_1", developerId: "dev_1" }),
        context
      ),
}));

vi.mock("@/lib/supabase", () => ({
  getServiceSupabaseClient: () => ({
    from: (table: string) => {
      if (table === "jobs") {
        return { insert: mockJobInsert };
      }
      if (table === "idempotency_requests") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: async () => ({ data: null, error: null }),
                }),
              }),
            }),
          }),
          insert: async () => ({ error: null }),
        };
      }
      return {};
    },
  }),
}));

describe("POST /api/v1/campaigns/generate", () => {
  beforeEach(() => {
    mockTrigger.mockClear();
    mockJobInsert.mockClear();
  });

  it("returns 202 and triggers campaign ads worker", async () => {
    const req = new Request("https://api.example.com/api/v1/campaigns/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: "Create a premium static ad for a soda brand for Gen Z",
      }),
    });
    const res = await generateCampaign(req as any, {});
    expect(res.status).toBe(202);
    const json = await res.json();
    expect(json.data.job_id).toBe("cccccccc-1111-2222-3333-444444444444");
    expect(mockTrigger).toHaveBeenCalledWith(
      "campaign-ads-creator",
      expect.objectContaining({
        jobId: "cccccccc-1111-2222-3333-444444444444",
        organizationId: "org_1",
      })
    );
  });
});
