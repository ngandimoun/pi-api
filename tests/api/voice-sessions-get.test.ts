import { GET as getVoiceSessionRoute } from "@/app/api/v1/voice/sessions/[id]/route";

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
      if (table !== "voice_sessions") return {};
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: {
                  id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
                  org_id: "aaaaaaaa-bbbb-cccc-dddd-111111111111",
                  agent_id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
                  status: "active",
                  participant: {},
                  context: {},
                  livekit_room_name: "room",
                  transcript: null,
                  results: null,
                  duration_seconds: null,
                  max_duration_seconds: 240,
                  error_log: null,
                  metadata: {},
                  expires_at: new Date().toISOString(),
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                },
                error: null,
              }),
            }),
          }),
        }),
      };
    },
  }),
}));

describe("GET /api/v1/voice/sessions/:id", () => {
  it("includes max_duration_seconds in response data", async () => {
    const req = new Request("https://api.example.com/api/v1/voice/sessions/x", { method: "GET" });
    const res = await getVoiceSessionRoute(req as never, {
      params: Promise.resolve({ id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee" }),
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as { data: { max_duration_seconds: number | null } };
    expect(json.data.max_duration_seconds).toBe(240);
  });
});
