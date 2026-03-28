import { POST as startVoiceSessionRoute } from "@/app/api/v1/voice/sessions/route";
import { voiceSessionCreateInputSchema } from "@/contracts/voice-session-api";

const mockStartVoiceSession = vi.hoisted(() =>
  vi.fn().mockResolvedValue({
    sessionId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    agentId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    expiresAtUnix: 1711500600,
    max_duration_seconds: 420,
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

describe("voiceSessionCreateInputSchema", () => {
  it("rejects ttl_seconds less than max_duration_seconds", () => {
    const r = voiceSessionCreateInputSchema.safeParse({
      agent_id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
      participant: { identity: "user_1" },
      ttl_seconds: 120,
      max_duration_seconds: 600,
    });
    expect(r.success).toBe(false);
  });

  it("accepts ttl_seconds equal to max_duration_seconds", () => {
    const r = voiceSessionCreateInputSchema.safeParse({
      agent_id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
      participant: { identity: "user_1" },
      ttl_seconds: 600,
      max_duration_seconds: 600,
    });
    expect(r.success).toBe(true);
  });

  it("defaults ttl_seconds to 600 when omitted", () => {
    const r = voiceSessionCreateInputSchema.safeParse({
      agent_id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
      participant: { identity: "user_1" },
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.ttl_seconds).toBe(600);
    }
  });
});

describe("POST /api/v1/voice/sessions (duration fields)", () => {
  beforeEach(() => {
    mockStartVoiceSession.mockClear();
  });

  it("passes max_duration_seconds to startVoiceSession and returns it in data", async () => {
    const req = new Request("https://api.example.com/api/v1/voice/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agent_id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
        participant: { identity: "user_1" },
        max_duration_seconds: 900,
        ttl_seconds: 900,
      }),
    });
    const res = await startVoiceSessionRoute(req as never, {});
    expect(res.status).toBe(201);
    const json = (await res.json()) as { data: { max_duration_seconds: number | null } };
    expect(json.data.max_duration_seconds).toBe(420);
    expect(mockStartVoiceSession).toHaveBeenCalledWith(
      expect.objectContaining({
        maxDurationSeconds: 900,
        ttlSeconds: 900,
      })
    );
  });
});
