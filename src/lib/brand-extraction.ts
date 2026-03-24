import { z } from "zod";

const dataUrlRegex = /^data:([a-zA-Z0-9/+.-]+);base64,(.+)$/;

/**
 * Public input contract for omnivorous brand extraction.
 */
export const brandExtractionInputSchema = z
  .object({
    url: z.string().url().optional(),
    logoBase64: z.string().min(1).optional(),
    imagesBase64: z.array(z.string().min(1)).optional(),
    location: z
      .object({
        country: z.string().length(2).optional(),
        languages: z.array(z.string().min(2)).optional(),
      })
      .optional(),
  })
  .refine(
    (data) =>
      Boolean(data.url || data.logoBase64 || (data.imagesBase64?.length ?? 0) > 0),
    {
      message: "At least one input is required: url, logoBase64, or imagesBase64.",
      path: ["url"],
    }
  );

export type BrandExtractionInput = z.infer<typeof brandExtractionInputSchema>;

export type ParsedBase64Asset = {
  buffer: Buffer;
  contentType: string;
  extension: string;
};

/**
 * Parses a base64 data URL (preferred) or raw base64 payload.
 */
export function parseBase64Asset(raw: string): ParsedBase64Asset {
  const trimmed = raw.trim();
  const dataUrlMatch = trimmed.match(dataUrlRegex);

  if (dataUrlMatch) {
    const contentType = dataUrlMatch[1].toLowerCase();
    const base64 = dataUrlMatch[2];
    const buffer = Buffer.from(base64, "base64");
    const extension = extensionFromMime(contentType);
    return { buffer, contentType, extension };
  }

  const buffer = Buffer.from(trimmed, "base64");
  return {
    buffer,
    contentType: "image/png",
    extension: "png",
  };
}

/**
 * Maps known image mime types to sane file extensions.
 */
export function extensionFromMime(contentType: string): string {
  switch (contentType) {
    case "image/jpeg":
    case "image/jpg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    case "image/svg+xml":
      return "svg";
    default:
      return "png";
  }
}
