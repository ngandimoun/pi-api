import { ThinkingLevel } from "@google/genai";

import type { AvatarGenerationInput } from "@/contracts/avatar-api";

import { type AllowedResolution, type FlashAspectRatio, FLASH_ASPECT_RATIOS } from "./image-config";
import { mapAspectRatio } from "./image-generate";

const flashAspectSet = new Set<string>(FLASH_ASPECT_RATIOS);

export type ResolvedImageOutput = {
  aspectRatio: FlashAspectRatio;
  imageSize: AllowedResolution;
  thinkingLevel?: ThinkingLevel;
};

/** Ensures downstream image API always receives a supported aspect string. */
export function normalizeFlashAspectRatio(value: string): FlashAspectRatio {
  return flashAspectSet.has(value) ? (value as FlashAspectRatio) : "1:1";
}

function envThinkingLevel(): ThinkingLevel | undefined {
  const raw = process.env.GOOGLE_AVATAR_IMAGE_THINKING_LEVEL?.trim().toLowerCase();
  if (raw === "minimal") return ThinkingLevel.MINIMAL;
  if (raw === "high") return ThinkingLevel.HIGH;
  return undefined;
}

/**
 * Maps public `output` + hints to SDK image config. `auto` or omitted aspect uses mapAspectRatio(hints).
 */
export function resolveImageOutput(input: AvatarGenerationInput): ResolvedImageOutput {
  const hints = input.hints as Record<string, unknown> | undefined;
  const out = input.output;
  const ar = out?.aspect_ratio;
  const aspectRaw =
    ar && ar !== "auto" ? ar : mapAspectRatio(hints);
  const aspectRatio = normalizeFlashAspectRatio(aspectRaw);
  const imageSize: AllowedResolution = out?.resolution ?? "1K";

  let thinkingLevel: ThinkingLevel | undefined;
  if (out?.thinking_intensity === "minimal") {
    thinkingLevel = ThinkingLevel.MINIMAL;
  } else if (out?.thinking_intensity === "high") {
    thinkingLevel = ThinkingLevel.HIGH;
  } else {
    thinkingLevel = envThinkingLevel();
  }

  return { aspectRatio, imageSize, thinkingLevel };
}

/** For job payload / support: mirror public naming where possible. */
export function thinkingLevelToPublic(
  level: ThinkingLevel | undefined
): "minimal" | "high" | undefined {
  if (level === ThinkingLevel.MINIMAL) return "minimal";
  if (level === ThinkingLevel.HIGH) return "high";
  return undefined;
}