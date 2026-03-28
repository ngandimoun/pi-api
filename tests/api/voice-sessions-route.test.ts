import { POST as startVoiceSessionRoute } from "@/app/api/v1/voice/sessions/route";

const mockStartVoiceSession = vi.hoisted(() =>
  vi.fn().mockResolvedValue({
    sessionId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    agentId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    expiresAtUnix: 1711500600,
    max_duration_seconds: null,
    connection: {
      livekit: { url: "wss://livekit.example/ws", token: "lk_jwt" },
      gemini_live: { url: "wss://generativelanguage.googleapis.com/ws/test", token: "ephemeral_token" },
    },
    system_instruction: "You are a test agent.",
  })
);

vi.mock("@/lib/voice/start-session", () => ({
  startVoiceSession: mockStartVoiceSession,
}));

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

describe("POST /api/v1/voice/sessions", () => {
  beforeEach(() => {
    mockStartVoiceSession.mockClear();
  });

  it("returns 201 with livekit and gemini_live connection objects", async () => {
    const req = new Request("https://api.example.com/api/v1/voice/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agent_id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
        participant: { identity: "user_1", name: "Test" },
      }),
    });
    const res = await startVoiceSessionRoute(req as never, {});
    expect(res.status).toBe(201);
    const json = (await res.json()) as {
      status: string;
      data: {
        session_id: string;
        connection: { livekit: { url: string }; gemini_live: { url: string; token: string } };
        system_instruction: string;
        max_duration_seconds: number | null;
      };
    };
    expect(json.status).toBe("active");
    expect(json.data.session_id).toBe("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");
    expect(json.data.connection.livekit.url).toContain("livekit");
    expect(json.data.connection.gemini_live.token).toBe("ephemeral_token");
    expect(json.data.system_instruction).toContain("test agent");
    expect(json.data.max_duration_seconds).toBeNull();
    expect(mockStartVoiceSession).toHaveBeenCalledWith(
      expect.objectContaining({
        agentId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
        participant: { identity: "user_1", name: "Test" },
        ttlSeconds: 600,
      })
    );
  });
});
