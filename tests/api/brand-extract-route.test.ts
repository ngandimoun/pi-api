import { POST } from "@/app/api/v1/brands/extract/route";

const mockState = vi.hoisted(() => ({
  triggerCalled: false,
  insertedJobId: "3b35dce4-7a26-4ea5-bf31-36dff18f1c3e",
}));

vi.mock("@/lib/auth", () => ({
  withApiAuth:
    (handler: (request: any, context: any) => Promise<Response>) =>
    (request: any, context: any) =>
      handler(Object.assign(request, { requestId: "req_pi_test", organizationId: "org_1" }), context),
}));

vi.mock("@/lib/supabase", () => ({
  getServiceSupabaseClient: () => ({
    from: () => ({
      insert: () => ({
        select: () => ({
          single: async () => ({
            data: { id: mockState.insertedJobId, created_at: "2026-03-24T00:00:00.000Z" },
            error: null,
          }),
        }),
      }),
      update: () => ({
        eq: async () => ({ error: null }),
      }),
    }),
  }),
}));

vi.mock("@trigger.dev/sdk/v3", () => ({
  tasks: {
    trigger: async () => {
      mockState.triggerCalled = true;
    },
  },
}));

describe("POST /api/v1/brands/extract", () => {
  beforeEach(() => {
    mockState.triggerCalled = false;
  });

  it("queues brand extraction and returns 202 with job_id", async () => {
    const req = new Request("https://api.example.com/api/v1/brands/extract", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: "https://example.com",
      }),
    });
    const res = await POST(req as any, {});
    const json = await res.json();

    expect(res.status).toBe(202);
    expect(json.object).toBe("job");
    expect(json.data.job_id).toBe(mockState.insertedJobId);
    expect(mockState.triggerCalled).toBe(true);
  });
});
