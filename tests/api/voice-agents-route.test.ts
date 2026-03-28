import { POST as createVoiceAgent } from "@/app/api/v1/voice/agents/route";

const mockInsert = vi.hoisted(() =>
  vi.fn().mockReturnValue({
    select: () => ({
      single: async () => ({
        data: {
          id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
          name: "Support",
          created_at: new Date("2026-01-01T00:00:00.000Z").toISOString(),
        },
        error: null,
      }),
    }),
  })
);

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
    from: (table: string) => {
      if (table === "voice_agents") {
        return { insert: mockInsert };
      }
      return {};
    },
  }),
}));

describe("POST /api/v1/voice/agents", () => {
  beforeEach(() => {
    mockInsert.mockClear();
  });

  it("returns 400 when voice.name is not in the catalog", async () => {
    const req = new Request("https://api.example.com/api/v1/voice/agents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Bad",
        instructions: "x",
        voice: { name: "InvalidVoiceName" },
      }),
    });
    const res = await createVoiceAgent(req as never, {});
    expect(res.status).toBe(400);
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("returns 200 and agent_id on valid payload", async () => {
    const req = new Request("https://api.example.com/api/v1/voice/agents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Support",
        instructions: "You help customers with billing questions.",
        questions: [
          {
            key: "issue",
            ask: "What is the issue?",
            type: "text",
          },
        ],
        output_schema: { issue: "text", summary: "text" },
      }),
    });
    const res = await createVoiceAgent(req as never, {});
    expect(res.status).toBe(200);
    const json = (await res.json()) as { data: { agent_id: string; name: string } };
    expect(json.data.agent_id).toBe("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");
    expect(json.data.name).toBe("Support");
    expect(mockInsert).toHaveBeenCalled();
  });
});
