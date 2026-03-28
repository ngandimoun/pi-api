/**
 * Gemini 3.1 Flash image API allowlists — see docs/integrations/nano-banana-gemini-image.md
 */
export const FLASH_ASPECT_RATIOS = [
  "1:1",
  "1:4",
  "1:8",
  "2:3",
  "3:2",
  "3:4",
  "4:1",
  "4:3",
  "4:5",
  "5:4",
  "8:1",
  "9:16",
  "16:9",
  "21:9",
] as const;

export type FlashAspectRatio = (typeof FLASH_ASPECT_RATIOS)[number];

export const ALLOWED_RESOLUTIONS = ["512", "1K", "2K", "4K"] as const;

export type AllowedResolution = (typeof ALLOWED_RESOLUTIONS)[number];