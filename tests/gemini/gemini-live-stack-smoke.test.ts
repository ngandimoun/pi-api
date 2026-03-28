import { describe, expect, it } from "vitest";

import { getGeminiLiveModelId, toSdkLiveConfig } from "@/lib/gemini/live/config";
import { makeLiveFunctionTools, makeLiveGoogleSearchTool, combineLiveTools } from "@/lib/gemini/live/tools";
import {
  buildLiveWsUrlWithApiKey,
  buildLiveWsUrlWithEphemeralToken,
  makeLiveWsRealtimeInputMessage,
  makeLiveWsSetupMessage,
  makeLiveWsToolResponseMessage,
} from "@/lib/gemini/live/ws";

describe("gemini live stack smoke (no network)", () => {
  it("enforces strict Live model id policy", () => {
    expect(getGeminiLiveModelId()).toBe("gemini-3.1-flash-live-preview");
    expect(() => getGeminiLiveModelId({ model_id: "gemini-2.5-flash-native-audio-preview-12-2025" })).toThrow();
  });

  it("builds SDK config with transcription + thinking defaults", () => {
    const cfg = toSdkLiveConfig({
      output_audio_transcription: true,
      input_audio_transcription: true,
      thinking_level: "minimal",
      include_thoughts: false,
      voice_name: "Kore",
    });
    expect(cfg.responseModalities).toEqual(["AUDIO"]);
    expect(cfg.outputAudioTranscription).toBeTruthy();
    expect(cfg.inputAudioTranscription).toBeTruthy();
    expect(cfg.thinkingConfig).toBeTruthy();
    expect(cfg.speechConfig).toBeTruthy();
  });

  it("creates tools config (function declarations + google search)", () => {
    const fn = makeLiveFunctionTools([{ name: "turn_on_the_lights" }, { name: "turn_off_the_lights" }]);
    const search = makeLiveGoogleSearchTool();
    const tools = combineLiveTools(fn, search);
    expect(Array.isArray(tools)).toBe(true);
    expect(tools.length).toBe(2);
  });

  it("creates WS messages and URLs", () => {
    const setup = makeLiveWsSetupMessage({
      config: { responseModalities: ["AUDIO"] },
    });
    expect((setup.config.model as string).includes("gemini-3.1-flash-live-preview")).toBe(true);

    const rt = makeLiveWsRealtimeInputMessage({ text: "hello" });
    expect(rt.realtimeInput.text).toBe("hello");

    const tr = makeLiveWsToolResponseMessage([{ id: "1", name: "x", response: { result: "ok" } }]);
    expect(tr.toolResponse.functionResponses.length).toBe(1);

    const url1 = buildLiveWsUrlWithApiKey("abc");
    expect(url1.startsWith("wss://")).toBe(true);

    const url2 = buildLiveWsUrlWithEphemeralToken("tok");
    expect(url2.includes("access_token=tok")).toBe(true);
  });
});

