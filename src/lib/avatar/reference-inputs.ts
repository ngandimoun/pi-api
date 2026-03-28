import { extensionFromMime, parseBase64Asset } from "@/lib/brand-extraction";

/** Gemini 3.1 Flash Image: up to 4 character-consistency reference images. */
export const MAX_MODEL_REFERENCE_IMAGES = 4;

const MAX_IMAGE_BYTES = 15 * 1024 * 1024;

const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

export type NormalizedReferenceImage = {
  buffer: Buffer;
  mimeType: string;
};

/**
 * Parses up to six client-supplied reference strings (data URL or raw base64).
 * Returns at most `maxForModel` images for image generation (default NB2 character cap).
 */
export function normalizeReferenceImages(
  raw: string[] | undefined,
  maxForModel: number = MAX_MODEL_REFERENCE_IMAGES
): NormalizedReferenceImage[] {
  if (!raw?.length) {
    return [];
  }
  const out: NormalizedReferenceImage[] = [];
  for (const item of raw.slice(0, 6)) {
    const parsed = parseBase64Asset(item);
    if (parsed.buffer.length > MAX_IMAGE_BYTES) {
      throw new Error("Reference image exceeds maximum size.");
    }
    const mime = parsed.contentType.split(";")[0]?.trim().toLowerCase() ?? "image/png";
    if (!ALLOWED_MIME.has(mime)) {
      throw new Error(`Unsupported reference image type: ${mime}`);
    }
    out.push({ buffer: parsed.buffer, mimeType: mime });
  }
  return out.slice(0, Math.min(maxForModel, out.length));
}

export function extensionForMime(mimeType: string): string {
  return extensionFromMime(mimeType);
}
