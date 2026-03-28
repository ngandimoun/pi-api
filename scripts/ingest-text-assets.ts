import { createClient } from "@supabase/supabase-js";
import { GoogleGenAI } from "@google/genai";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import * as crypto from "crypto";
import dotenv from "dotenv";
import * as fs from "fs";
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
  if (value) return value;
  if (fallback) return fallback;
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

function toPgVector(values: number[]): string {
  return `[${values.join(",")}]`;
}

function listTxtFiles(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const results: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...listTxtFiles(fullPath));
      continue;
    }
    if (entry.isFile() && entry.name.toLowerCase().endsWith(".txt")) {
      results.push(fullPath);
    }
  }
  return results;
}

async function ingestTextAsset(params: {
  filePath: string;
  source: string;
  title: string;
  metadata?: Record<string, unknown>;
}) {
  const contentBytes = fs.readFileSync(params.filePath);
  const content = contentBytes.toString("utf-8");
  const fileHash = crypto.createHash("sha256").update(contentBytes).digest("hex");

  const { data: existing } = await supabase
    .from("text_assets_vector")
    .select("id")
    .eq("file_hash", fileHash)
    .maybeSingle();
  if (existing) {
    console.log(`Skipping ${params.title} (already processed)`);
    return;
  }

  const objectKey = `dataset-text/${params.source}/${fileHash}.txt`;
  await r2.send(
    new PutObjectCommand({
      Bucket: requireEnv("R2_BUCKET_NAME"),
      Key: objectKey,
      Body: contentBytes,
      ContentType: "text/plain; charset=utf-8",
    })
  );
  const r2Url = buildPublicAssetUrl(objectKey);

  const embedContext = `Title: ${params.title}\n\nContent:\n${content}`.trim();
  const embedResult = await ai.models.embedContent({
    model: "gemini-embedding-2-preview",
    contents: [embedContext],
    config: { outputDimensionality: 768 },
  });

  const embeddingValues = embedResult.embeddings?.[0]?.values;
  if (!embeddingValues?.length) {
    throw new Error(`Embedding response missing values for ${params.title}`);
  }

  const { error } = await supabase.from("text_assets_vector").insert({
    file_hash: fileHash,
    source: params.source,
    title: params.title,
    content,
    metadata: params.metadata ?? {},
    r2_url: r2Url,
    embedding: toPgVector(embeddingValues),
  });
  if (error) throw error;

  console.log(`Success: ${params.source} | ${params.title}`);
}

async function main() {
  const promptsDir = process.env.PROMPTS_DIR ?? "./prompts datasets";
  const fontsFile = process.env.FONTS_FILE ?? "./greats fons for desing.txt";

  const promptFiles = fs.existsSync(promptsDir) ? listTxtFiles(promptsDir) : [];
  for (const filePath of promptFiles) {
    const title = path.basename(filePath, ".txt");
    await ingestTextAsset({
      filePath,
      source: "prompts_dataset",
      title,
      metadata: { relative_path: path.relative(process.cwd(), filePath) },
    });
  }

  if (fs.existsSync(fontsFile)) {
    await ingestTextAsset({
      filePath: fontsFile,
      source: "fonts_design",
      title: path.basename(fontsFile),
      metadata: { relative_path: path.relative(process.cwd(), fontsFile) },
    });
  }
}

main().catch((error) => {
  console.error("Fatal ingest error:", error);
  process.exitCode = 1;
});

