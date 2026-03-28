import type { AdGenerationInput } from "@/contracts/ads-api";
import { FLASH_ASPECT_RATIOS, type FlashAspectRatio, type AllowedResolution } from "@/lib/avatar/image-config";

const aspectRatioSet = new Set<string>(FLASH_ASPECT_RATIOS);

function normalizeAspectRatio(value: string): FlashAspectRatio {
  return aspectRatioSet.has(value) ? (value as FlashAspectRatio) : "1:1";
}

function inferAspectRatio(prompt: string): FlashAspectRatio {
  const lower = prompt.toLowerCase();
  if (lower.includes("story") || lower.includes("vertical")) return "9:16";
  if (lower.includes("banner") || lower.includes("landscape")) return "16:9";
  if (lower.includes("poster")) return "3:4";
  return "1:1";
}

export function resolveAdImageOutput(input: AdGenerationInput): {
  aspectRatio: FlashAspectRatio;
  imageSize: AllowedResolution;
  thinkingIntensity?: "minimal" | "high";
} {
  const ar = input.output?.aspect_ratio;
  const aspectRatio = normalizeAspectRatio(ar && ar !== "auto" ? ar : inferAspectRatio(input.prompt));
  const imageSize: AllowedResolution = input.output?.resolution ?? "1K";
  const thinkingIntensity = input.output?.thinking_intensity;
  return { aspectRatio, imageSize, thinkingIntensity };
}

