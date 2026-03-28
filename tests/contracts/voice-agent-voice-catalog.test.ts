import { voiceAgentCreateInputSchema } from "@/contracts/voice-agent-api";
import { GEMINI_LIVE_VOICES } from "@/lib/gemini/live/config";

describe("voice agent voice catalog", () => {
  it("lists exactly 30 Gemini Live voices", () => {
    expect(GEMINI_LIVE_VOICES).toHaveLength(30);
    const defaults = GEMINI_LIVE_VOICES.filter((v) => v.default);
    expect(defaults).toHaveLength(1);
    expect(defaults[0]?.name).toBe("Puck");
  });

  it("rejects unknown voice.name", () => {
    const r = voiceAgentCreateInputSchema.safeParse({
      name: "A",
      instructions: "x",
      voice: { name: "NotARealVoice" },
    });
    expect(r.success).toBe(false);
  });

  it("accepts catalog voice.name", () => {
    const r = voiceAgentCreateInputSchema.safeParse({
      name: "A",
      instructions: "x",
      voice: { name: "Kore", language_code: "fr-FR" },
    });
    expect(r.success).toBe(true);
  });
});
