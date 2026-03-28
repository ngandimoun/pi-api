import { buildVoiceAgentSystemInstruction } from "@/lib/voice/build-system-prompt";
import type { VoiceAgentCreateInput } from "@/contracts/voice-agent-api";

const base: VoiceAgentCreateInput = {
  name: "Test",
  language: "en-US",
  instructions: "Do the thing.",
  questions: [],
  output_schema: {},
};

describe("buildVoiceAgentSystemInstruction", () => {
  it("includes enterprise behavior fields when set", () => {
    const text = buildVoiceAgentSystemInstruction({
      ...base,
      behaviors: {
        speaking_pace: "slow",
        response_length: "brief",
        escalation_phrase: "Let me get a specialist.",
        follow_up_enabled: false,
        silence_timeout_seconds: 12,
        closing_message: "This call may be recorded.",
        require_all_questions: true,
      },
      questions: [{ key: "q1", ask: "Why?", type: "text" }],
    });
    expect(text).toContain("Speaking pace: slow");
    expect(text).toContain("Response length: brief");
    expect(text).toContain("Let me get a specialist.");
    expect(text).toContain("12 seconds");
    expect(text).toContain("This call may be recorded.");
    expect(text).toContain("must attempt every scripted question");
  });
});
