import { startVoiceSession } from "@/lib/voice/start-session";

const mockCreateRoom = vi.hoisted(() => vi.fn().mockResolvedValue({}));
const mockDeleteRoom = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockCreateToken = vi.hoisted(() => vi.fn().mockResolvedValue("lk_jwt"));
const mockEphemeral = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ token: "ephemeral", raw: {} })
);
const mockGetWsUrl = vi.hoisted(() => vi.fn().mockReturnValue("wss://gemini.example/ws"));
const agentId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const orgId = "bbbbbbbb-cccc-dddd-eeee-ffffffffffff";

let insertPayload: Record<string, unknown> | null = null;

vi.mock("@/lib/livekit/room-service", () => ({
  createLiveKitRoom: mockCreateRoom,
  deleteLiveKitRoom: mockDeleteRoom,
}));

vi.mock("@/lib/livekit/tokens", () => ({
  createDefaultRoomName: () => "pi_voice_test_room",
  createLiveKitUserToken: mockCreateToken,
}));

vi.mock("@/lib/livekit/env", () => ({
  getLiveKitClientWebSocketUrl: () => "wss://livekit.example/ws",
}));

vi.mock("@/lib/gemini/live/ephemeral", () => ({
  createGeminiLiveEphemeralToken: mockEphemeral,
}));

vi.mock("@/lib/gemini/live/ws", () => ({
  buildLiveWsUrlWithEphemeralToken: mockGetWsUrl,
}));

vi.mock("@/lib/gemini/live/config", () => ({
  getGeminiLiveClient: () => ({}),
  toSdkLiveConfig: () => ({ responseModalities: ["AUDIO"] }),
}));

vi.mock("@/lib/supabase", () => ({
  getServiceSupabaseClient: () => ({
    from: (table: string) => {
      if (table === "voice_agents") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: async () => ({
                    data: {
                      id: agentId,
                      org_id: orgId,
                      is_active: true,
                      system_instruction: "You are a test agent.",
                      voice_config: {},
                      behaviors: { max_duration_seconds: 300 },
                    },
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        };
      }
      if (table === "voice_sessions") {
        return {
          insert: (row: Record<string, unknown>) => {
            insertPayload = row;
            return { error: null };
          },
          delete: () => ({
            eq: () => ({
              eq: async () => ({ error: null }),
            }),
          }),
        };
      }
      return {};
    },
  }),
}));

describe("startVoiceSession", () => {
  beforeEach(() => {
    insertPayload = null;
    vi.clearAllMocks();
  });

  it("resolves max_duration_seconds from agent behaviors and stores it", async () => {
    const result = await startVoiceSession({
      organizationId: orgId,
      agentId,
      participant: { identity: "user_1" },
      ttlSeconds: 600,
    });

    expect(result.max_duration_seconds).toBe(300);
    expect(insertPayload?.max_duration_seconds).toBe(300);
    const roomArg = mockCreateRoom.mock.calls[0]?.[0] as { metadata?: string };
    expect(roomArg.metadata).toContain("max_duration_seconds");
  });

  it("overrides agent max_duration_seconds when session provides maxDurationSeconds", async () => {
    const result = await startVoiceSession({
      organizationId: orgId,
      agentId,
      participant: { identity: "user_1" },
      ttlSeconds: 600,
      maxDurationSeconds: 120,
    });

    expect(result.max_duration_seconds).toBe(120);
    expect(insertPayload?.max_duration_seconds).toBe(120);
  });

  it("throws voice_session_ttl_too_short when ttl is below effective max", async () => {
    await expect(
      startVoiceSession({
        organizationId: orgId,
        agentId,
        participant: { identity: "user_1" },
        ttlSeconds: 120,
      })
    ).rejects.toThrow("voice_session_ttl_too_short");

    expect(mockCreateRoom).not.toHaveBeenCalled();
  });
});
