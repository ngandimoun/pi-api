import { POST as completeVoiceSessionRoute } from "@/app/api/v1/voice/sessions/[id]/complete/route";

const mockCompleteVoiceSession = vi.hoisted(() =>
  vi.fn().mockResolvedValue({
    session: {
      id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
      org_id: "aaaaaaaa-bbbb-cccc-dddd-111111111111",
      agent_id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
      status: "completed",
      participant: {},
      context: {},
      livekit_room_name: "room",
      transcript: [],
      results: { issue: "billing" },
      duration_seconds: 10,
      max_duration_seconds: null,
      error_log: null,
      metadata: {},
      expires_at: new Date("2026-01-02T00:00:00.000Z").toISOString(),
      created_at: new Date("2026-01-01T00:00:00.000Z").toISOString(),
      updated_at: new Date("2026-01-01T00:00:00.000Z").toISOString(),
    },
    results: { issue: "billing" },
    extraction_warnings: [],
  })
);

vi.mock("@/lib/voice/complete-session", () => ({
  completeVoiceSession: mockCompleteVoiceSession,
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

describe("POST /api/v1/voice/sessions/:id/complete", () => {
  beforeEach(() => {
    mockCompleteVoiceSession.mockClear();
  });

  it("returns 200 with results", async () => {
    const req = new Request("https://api.example.com/api/v1/voice/sessions/x/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        transcript: [{ role: "user", text: "I need help with billing." }],
      }),
    });
    const res = await completeVoiceSessionRoute(req as never, {
      params: Promise.resolve({ id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee" }),
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      data: { results: { issue: string }; session_id: string; participant: unknown; expires_at: unknown };
    };
    expect(json.data.results.issue).toBe("billing");
    expect(json.data.session_id).toBe("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");
    expect(json.data).toHaveProperty("participant");
    expect(json.data).toHaveProperty("expires_at");
    expect(mockCompleteVoiceSession).toHaveBeenCalled();
  });

  it("returns 409 when session is not active", async () => {
    mockCompleteVoiceSession.mockRejectedValueOnce(new Error("voice_session_not_active"));
    const req = new Request("https://api.example.com/api/v1/voice/sessions/x/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        transcript: [{ role: "user", text: "Hello." }],
      }),
    });
    const res = await completeVoiceSessionRoute(req as never, {
      params: Promise.resolve({ id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee" }),
    });
    expect(res.status).toBe(409);
  });
});
