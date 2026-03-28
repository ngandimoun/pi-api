import { POST as generateImage } from "@/app/api/v1/images/generations/route";

const mockTrigger = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

const mockJobInsert = vi.hoisted(() =>
  vi.fn().mockReturnValue({
    select: () => ({
      single: async () => ({
        data: { id: "bbbbbbbb-1111-2222-3333-444444444444" },
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

describe("POST /api/v1/images/generations", () => {
  beforeEach(() => {
    mockTrigger.mockClear();
    mockJobInsert.mockClear();
  });

  it("returns 202 and triggers ads worker", async () => {
    const req = new Request("https://api.example.com/api/v1/images/generations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: "create a static ad for running shoes in french",
      }),
    });
    const res = await generateImage(req as any, {});
    expect(res.status).toBe(202);
    const json = await res.json();
    expect(json.data.job_id).toBe("bbbbbbbb-1111-2222-3333-444444444444");
    expect(mockTrigger).toHaveBeenCalledWith(
      "ads-creator",
      expect.objectContaining({
        jobId: "bbbbbbbb-1111-2222-3333-444444444444",
        organizationId: "org_1",
      })
    );
  });

  it("returns 400 when prompt is empty", async () => {
    const req = new Request("https://api.example.com/api/v1/images/generations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "  " }),
    });
    const res = await generateImage(req as any, {});
    expect(res.status).toBe(400);
  });
});

