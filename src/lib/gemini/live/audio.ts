export const LIVE_AUDIO_INPUT_MIME_16KHZ = "audio/pcm;rate=16000" as const;
export const LIVE_AUDIO_OUTPUT_RATE_HZ = 24000 as const;

export function toBase64(data: Uint8Array): string {
  return Buffer.from(data).toString("base64");
}

export function fromBase64(b64: string): Uint8Array {
  return new Uint8Array(Buffer.from(b64, "base64"));
}

/**
 * Validates that the buffer length is aligned for PCM16 LE frames.
 * The Live API expects raw little-endian 16-bit PCM audio.
 */
export function assertPcm16le(byteLength: number) {
  if (byteLength % 2 !== 0) {
    throw new Error(`Invalid PCM16LE byte length (${byteLength}). Must be even.`);
  }
}

export type LiveAudioBlob = {
  data: string;
  mimeType: string;
};

export function makeLiveAudioBlob(pcmBytes: Uint8Array, rateHz = 16000): LiveAudioBlob {
  assertPcm16le(pcmBytes.byteLength);
  return {
    data: toBase64(pcmBytes),
    mimeType: `audio/pcm;rate=${rateHz}`,
  };
}

