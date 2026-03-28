import { GET as previewVoiceAgent } from "@/app/api/v1/voice/agents/[id]/preview/route";

vi.mock("@/lib/auth", () => ({
  withApiAuth:
    (handler: (request: unknown, context: unknown) => Promise<Response>) =>
    (request: unknown, context: unknown) =>
      handler(
        Object.assign(request as object, {
          requestId: "req_pi_test",
          organizationId: "aaaaaaaa-bbbb-cccc-dddd-111111111111",
          developerId: "dev_1",
        }),
        context
      ),
}));

vi.mock("@/lib/supabase", () => ({
  getServiceSupabaseClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: {
                id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
                org_id: "aaaaaaaa-bbbb-cccc-dddd-111111111111",
                name: "Preview",
                language: "en-US",
                purpose: null,
                instructions: "Say hello.",
                questions: [],
                behaviors: {},
                output_schema: {},
                voice_config: {},
                system_instruction: "legacy",
                metadata: {},
                is_active: true,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              },
              error: null,
            }),
          }),
        }),
      }),
    }),
  }),
}));

describe("GET /api/v1/voice/agents/:id/preview", () => {
  it("returns compiled system_instruction", async () => {
    const req = new Request("https://api.example.com/api/v1/voice/agents/x/preview");
    const res = await previewVoiceAgent(req as never, {
      params: Promise.resolve({ id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee" }),
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as { data: { system_instruction: string } };
    expect(json.data.system_instruction).toContain("Say hello.");
    expect(json.data.system_instruction).toContain("voice conversation agent");
  });
});
