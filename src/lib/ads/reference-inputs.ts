import { extensionFromMime, parseBase64Asset } from "@/lib/brand-extraction";

export const MAX_DEVELOPER_REFERENCE_IMAGES = 6;
export const MAX_MODEL_REFERENCE_IMAGES = 6;
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;

const ALLOWED_MIME = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);

export type NormalizedReferenceImage = {
  buffer: Buffer;
  mimeType: string;
  source: "developer_upload";
};

function assertAllowedMime(mimeType: string) {
  if (!ALLOWED_MIME.has(mimeType)) {
    throw new Error(`Unsupported reference image type: ${mimeType}`);
  }
}

async function parseUrlImage(urlString: string): Promise<NormalizedReferenceImage> {
  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    throw new Error("reference image URL is invalid.");
  }
  if (url.protocol !== "https:") {
    throw new Error("reference image URL must use https.");
  }

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Failed to fetch reference image URL (${response.status}).`);
  }

  const mimeType =
    response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() ?? "image/jpeg";
  assertAllowedMime(mimeType);

  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > MAX_IMAGE_BYTES) {
    throw new Error("Reference image exceeds maximum size.");
  }

  return { buffer: bytes, mimeType, source: "developer_upload" };
}

function parseBase64Image(raw: string): NormalizedReferenceImage {
  const parsed = parseBase64Asset(raw);
  if (parsed.buffer.length > MAX_IMAGE_BYTES) {
    throw new Error("Reference image exceeds maximum size.");
  }
  const mimeType = parsed.contentType.split(";")[0]?.trim().toLowerCase() ?? "image/png";
  assertAllowedMime(mimeType);
  return { buffer: parsed.buffer, mimeType, source: "developer_upload" };
}

/**
 * Accepts up to six references in either URL or base64/data-url format.
 * Returns at most `maxForModel` images for generation payload.
 */
export async function normalizeReferenceImages(
  raw: string[] | undefined,
  maxForModel: number = MAX_MODEL_REFERENCE_IMAGES
): Promise<NormalizedReferenceImage[]> {
  if (!raw?.length) return [];

  const out: NormalizedReferenceImage[] = [];
  for (const item of raw.slice(0, MAX_DEVELOPER_REFERENCE_IMAGES)) {
    const trimmed = item.trim();
    if (trimmed.startsWith("https://")) {
      out.push(await parseUrlImage(trimmed));
      continue;
    }
    out.push(parseBase64Image(trimmed));
  }

  return out.slice(0, Math.min(maxForModel, out.length));
}

export function extensionForMime(mimeType: string): string {
  return extensionFromMime(mimeType);
}

