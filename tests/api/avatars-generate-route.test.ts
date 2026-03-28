import { POST as generateAvatar } from "@/app/api/v1/avatars/generate/route";

const mockTrigger = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

const mockJobInsert = vi.hoisted(() =>
  vi.fn().mockReturnValue({
    select: () => ({
      single: async () => ({
        data: { id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee", created_at: new Date().toISOString() },
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
        Object.assign(request, { requestId: "req_pi_test", organizationId: "org_1" }),
        context
      ),
}));

vi.mock("@/lib/supabase", () => ({
  getServiceSupabaseClient: () => ({
    from: (table: string) => {
      if (table === "jobs") {
        return {
          insert: mockJobInsert,
        };
      }
      return {};
    },
  }),
}));

describe("POST /api/v1/avatars/generate", () => {
  beforeEach(() => {
    mockTrigger.mockClear();
    mockJobInsert.mockClear();
  });

  it("returns 202 and triggers worker for prompt-only body", async () => {
    const req = new Request("https://api.example.com/api/v1/avatars/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "friendly doctor portrait for health app" }),
    });
    const res = await generateAvatar(req as any, {});
    expect(res.status).toBe(202);
    const json = await res.json();
    expect(json.data.job_id).toBe("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");
    expect(mockTrigger).toHaveBeenCalledWith(
      "avatar-creator",
      expect.objectContaining({
        jobId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
        organizationId: "org_1",
        input: expect.objectContaining({ prompt: "friendly doctor portrait for health app" }),
      })
    );
  });

  it("returns 400 for empty prompt", async () => {
    const req = new Request("https://api.example.com/api/v1/avatars/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "   " }),
    });
    const res = await generateAvatar(req as any, {});
    expect(res.status).toBe(400);
  });

  it("returns 400 for more than six reference images", async () => {
    const req = new Request("https://api.example.com/api/v1/avatars/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: "test",
        reference_images: ["a", "b", "c", "d", "e", "f", "g"],
      }),
    });
    const res = await generateAvatar(req as any, {});
    expect(res.status).toBe(400);
  });
});
