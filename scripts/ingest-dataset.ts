import { createClient } from "@supabase/supabase-js";
import { GoogleGenAI } from "@google/genai";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import * as crypto from "crypto";
import dotenv from "dotenv";
import * as fs from "fs";
import sizeOf from "image-size";
import mime from "mime-types";
import * as path from "path";

dotenv.config({ path: fs.existsSync(".env.local") ? ".env.local" : ".env" });

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value?.trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value.trim();
}

function readEnv(name: string, fallback?: string): string {
  const value = process.env[name]?.trim();
  if (value) {
    return value;
  }
  if (fallback) {
    return fallback;
  }
  throw new Error(`Missing required environment variable: ${name}`);
}

function encodeObjectKeyForPublicUrl(key: string): string {
  return key
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function buildPublicAssetUrl(key: string): string {
  const base = readEnv("R2_PUBLIC_CUSTOM_DOMAIN", process.env.R2_PUBLIC_URL).replace(/\/+$/, "");
  return `${base}/${encodeObjectKeyForPublicUrl(key)}`;
}

const supabase = createClient(
  readEnv("SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL),
  requireEnv("SUPABASE_SERVICE_ROLE_KEY")
);

const ai = new GoogleGenAI({
  apiKey: readEnv("GEMINI_KEY", process.env.GOOGLE_GENERATIVE_AI_API_KEY),
});

const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${readEnv("CLOUDFLARE_ACCOUNT_ID", process.env.R2_ACCOUNT_ID)}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: requireEnv("R2_ACCESS_KEY_ID"),
    secretAccessKey: requireEnv("R2_SECRET_ACCESS_KEY"),
  },
});

function getAspectRatio(width: number, height: number): string {
  const ratio = width / height;
  if (ratio >= 2.2) return "21:9";
  if (ratio >= 1.7) return "16:9";
  if (ratio >= 1.4) return "3:2";
  if (ratio >= 1.2) return "4:3";
  if (ratio > 0.8 && ratio < 1.2) return "1:1";
  if (ratio > 0.66) return "3:4";
  if (ratio > 0.5) return "2:3";
  return "9:16";
}

function toPgVector(values: number[]): string {
  return `[${values.join(",")}]`;
}

type AIData = {
  quality_score: number;
  ai_description: string;
  ocr_text: string | null;
  metadata: {
    industry: string;
    culture: {
      vibe: string;
      writing_direction: string;
    };
    typography: {
      style: string;
      font_weight: string;
    };
    demographics: {
      has_human: boolean;
      avatar_description: string;
      human_action: string;
    };
    layout: {
      logo_placement: string;
      has_social_icons: boolean;
      cta_presence: boolean;
    };
  };
};

async function processDataset(datasetDir: string) {
  function listImageFiles(dir: string): string[] {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const results: string[] = [];
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...listImageFiles(fullPath));
        continue;
      }
      if (entry.isFile() && /\.(png|jpe?g)$/i.test(entry.name)) {
        results.push(fullPath);
      }
    }
    return results;
  }

  const files = listImageFiles(datasetDir);

  for (const imagePath of files) {
    const file = path.basename(imagePath);
    const textPath = imagePath.replace(/\.[^/.]+$/, ".txt");
    const imageBytes = fs.readFileSync(imagePath);
    const originalPrompt = fs.existsSync(textPath) ? fs.readFileSync(textPath, "utf-8") : "";

    // 1. IDEMPOTENCY CHECK
    const fileHash = crypto.createHash("sha256").update(imageBytes).digest("hex");
    const { data: existing } = await supabase
      .from("ad_templates_vector")
      .select("id")
      .eq("file_hash", fileHash)
      .maybeSingle();
    if (existing) {
      console.log(`Skipping ${file} (already processed)`);
      continue;
    }

    console.log(`\nDeep cultural analysis: ${file}`);

    try {
      // 2. DIMENSION EXTRACTION
      const dimensions = sizeOf(imageBytes);
      if (!dimensions.width || !dimensions.height) {
        throw new Error(`Could not read dimensions for ${file}`);
      }
      const aspectRatio = getAspectRatio(dimensions.width, dimensions.height);

      // 3. THE HYPER-AWARE VISION AGENT
      const mimeType = mime.lookup(imagePath) || "image/jpeg";
      const analysisPrompt = `
        You are an elite Global Art Director. Analyze this ad image and its prompt: "${originalPrompt}".
        Return strict JSON detailing the cultural, demographic, typographic, and layout nuances.

        SCHEMA REQUIRED:
        {
          "quality_score": <Integer 1-10>,
          "ai_description": "Detailed description of lighting, composition, and mood.",
          "ocr_text": "Exact text visible (or null)",
          "metadata": {
            "industry": "Enum[tech, beauty, auto, fashion, food, software, travel, health, education, finance, generic]",
            "culture": {
              "vibe": "Enum[western, japanese, arabic, african, french, sub_african, north_african, korean, middle_east, south_east_asia, futuristic, scandinavian, cyberpunk, global]",
              "writing_direction": "Enum[ltr, rtl, vertical, none]"
            },
            "typography": {
              "style": "Enum[neon, elegant_serif, bold_sans, handwritten, geometric_sans, editorial_serif, minimal_ui, retro, 3d, none]",
              "font_weight": "Enum[light, regular, medium, semibold, bold, heavy, none]"
            },
            "demographics": {
              "has_human": boolean,
              "avatar_description": "Be highly specific, or 'None'",
              "human_action": "e.g., 'holding coffee cup', 'smiling at camera', or 'None'"
            },
            "layout": {
              "logo_placement": "Enum[top_left, top_right, center, bottom, none]",
              "has_social_icons": boolean,
              "cta_presence": boolean
            }
          }
        }
      `;

      const visionResult = await ai.models.generateContent({
        model:
          process.env.GEMINI_ANALYSIS_MODEL ??
          process.env.GOOGLE_BRAND_PROJECTION_MODEL ??
          process.env.GOOGLE_DEFAULT_MODEL ??
          "gemini-2.0-flash",
        contents: [
          analysisPrompt,
          { inlineData: { data: imageBytes.toString("base64"), mimeType } },
        ],
        config: { responseMimeType: "application/json" },
      });

      const aiData = JSON.parse(visionResult.text ?? "{}") as AIData;

      // 4. QUALITY GATING (Auto-reject low quality)
      if ((aiData.quality_score ?? 0) < 7) {
        console.log(`Rejected ${file} (score: ${aiData.quality_score}/10)`);
        continue;
      }

      // 5. UPLOAD TO R2 (Deduplicated via Hash)
      const extension = mime.extension(mimeType) || "jpg";
      const objectKey = `dataset-global/${fileHash}.${extension}`;
      await r2.send(
        new PutObjectCommand({
          Bucket: requireEnv("R2_BUCKET_NAME"),
          Key: objectKey,
          Body: imageBytes,
          ContentType: mimeType.toString(),
        })
      );
      const r2Url = buildPublicAssetUrl(objectKey);

      // 6. NATIVE MULTIMODAL EMBEDDING (Gemini Embedding 2)
      const embedContext = `
        Prompt: ${originalPrompt}
        Visuals: ${aiData.ai_description}
        Culture & Layout: ${aiData.metadata.culture.vibe} vibe, ${aiData.metadata.culture.writing_direction} layout. Logo at ${aiData.metadata.layout.logo_placement}.
        Typography: ${aiData.metadata.typography.style}, ${aiData.metadata.typography.font_weight} weight.
        Demographics: ${aiData.metadata.demographics.has_human ? `${aiData.metadata.demographics.avatar_description} ${aiData.metadata.demographics.human_action}` : "No human"}.
        Text on image: ${aiData.ocr_text || "none"}
      `.trim();

      const embedResult = await ai.models.embedContent({
        model: "gemini-embedding-2-preview",
        contents: [
          embedContext,
          { inlineData: { data: imageBytes.toString("base64"), mimeType } },
        ],
        config: { outputDimensionality: 768 },
      });

      const embeddingValues = embedResult.embeddings?.[0]?.values;
      if (!embeddingValues?.length) {
        throw new Error(`Embedding response missing values for ${file}`);
      }

      // 7. ATOMIC COMMIT TO SUPABASE
      const { error } = await supabase.from("ad_templates_vector").insert({
        file_hash: fileHash,
        master_prompt: originalPrompt.trim().length ? originalPrompt : aiData.ai_description,
        ai_description: aiData.ai_description,
        ocr_text: aiData.ocr_text,
        quality_score: aiData.quality_score,
        aspect_ratio: aspectRatio,
        metadata: aiData.metadata,
        r2_image_url: r2Url,
        embedding: toPgVector(embeddingValues),
      });

      if (error) throw error;
      console.log(
        `Success: ${file} | Culture: ${aiData.metadata.culture.vibe} | Typo: ${aiData.metadata.typography.style} | Human: ${aiData.metadata.demographics.has_human ? "Yes" : "No"}`
      );
    } catch (e) {
      console.error(`Failed on ${file}:`, e);
    }
  }
}

processDataset(process.env.DATASET_DIR ?? "./images datasets").catch((error) => {
  console.error("Fatal ingest error:", error);
  process.exitCode = 1;
});
