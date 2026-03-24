import {
  PutObjectCommand,
  S3Client,
  type PutObjectCommandInput,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { NextResponse } from "next/server";

import { apiError } from "@/lib/api-response";

const R2_REGION = "auto" as const;

/** Normalized S3 object key (no leading slash). */
export type R2ObjectKey = string;

export class R2StorageError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "R2StorageError";
  }
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value?.trim()) {
    throw new R2StorageError(
      `Missing required environment variable: ${name}`,
      "storage_configuration_error",
      500
    );
  }
  return value.trim();
}

function getR2Client(): S3Client {
  const accountId = requireEnv("R2_ACCOUNT_ID");
  const accessKeyId = requireEnv("R2_ACCESS_KEY_ID");
  const secretAccessKey = requireEnv("R2_SECRET_ACCESS_KEY");

  return new S3Client({
    region: R2_REGION,
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
}

/** Singleton client for serverless reuse within the same isolate. */
let cachedClient: S3Client | null = null;

export function getR2S3Client(): S3Client {
  if (!cachedClient) {
    cachedClient = getR2Client();
  }
  return cachedClient;
}

/**
 * Public URL for an object path (uses R2_PUBLIC_URL; no trailing slash issues).
 */
function encodeObjectKeyForPublicUrl(key: string): string {
  return key.split("/").map((segment) => encodeURIComponent(segment)).join("/");
}

export function buildPublicAssetUrl(path: string): string {
  const base = requireEnv("R2_PUBLIC_URL").replace(/\/+$/, "");
  const key = normalizeObjectKey(path);
  return `${base}/${encodeObjectKeyForPublicUrl(key)}`;
}

function normalizeObjectKey(path: string): R2ObjectKey {
  const trimmed = path.trim().replace(/^\/+/, "");
  if (!trimmed) {
    throw new R2StorageError(
      "Storage path must be a non-empty string.",
      "invalid_storage_path",
      400
    );
  }
  return trimmed;
}

/**
 * Upload a buffer to R2 and return the public CDN URL.
 */
export async function uploadAsset(
  buffer: Buffer,
  path: string,
  contentType: string
): Promise<string> {
  const bucket = requireEnv("R2_BUCKET_NAME");
  const key = normalizeObjectKey(path);
  const client = getR2S3Client();

  const input: PutObjectCommandInput = {
    Bucket: bucket,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  };

  try {
    await client.send(new PutObjectCommand(input));
  } catch (err) {
    throw new R2StorageError(
      "Failed to upload asset to storage.",
      "storage_upload_failed",
      502,
      err
    );
  }

  return buildPublicAssetUrl(key);
}

const DEFAULT_PRESIGNED_EXPIRES_SECONDS = 300;

export type PresignedUploadResult = {
  /** HTTPS URL for PUT upload (client sends body directly to R2). */
  uploadUrl: string;
  /** Object key to reference after upload (same as normalized path). */
  key: string;
  /** Seconds until the presigned URL expires. */
  expiresIn: number;
  /** Public URL once the object exists (for convenience). */
  publicUrl: string;
};

/**
 * Generate a short-lived presigned PUT URL so clients upload large files
 * directly to R2 (bypasses API body limits).
 */
export async function generatePresignedUploadUrl(
  path: string,
  contentType: string,
  expiresInSeconds: number = DEFAULT_PRESIGNED_EXPIRES_SECONDS
): Promise<PresignedUploadResult> {
  const bucket = requireEnv("R2_BUCKET_NAME");
  const key = normalizeObjectKey(path);
  const client = getR2S3Client();

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
  });

  let uploadUrl: string;
  try {
    uploadUrl = await getSignedUrl(client, command, {
      expiresIn: expiresInSeconds,
    });
  } catch (err) {
    throw new R2StorageError(
      "Failed to generate presigned upload URL.",
      "storage_presign_failed",
      502,
      err
    );
  }

  return {
    uploadUrl,
    key,
    expiresIn: expiresInSeconds,
    publicUrl: buildPublicAssetUrl(key),
  };
}

/**
 * Map storage failures to the Pi API error envelope (for route handlers).
 */
export function mapR2ErrorToResponse(
  error: unknown,
  requestId: string
): NextResponse {
  if (error instanceof R2StorageError) {
    const type =
      error.statusCode >= 500 ? "api_error" : "invalid_request_error";
    return apiError(
      error.code,
      error.message,
      error.statusCode,
      requestId,
      type
    );
  }

  return apiError(
    "storage_error",
    "An unexpected storage error occurred.",
    500,
    requestId,
    "api_error"
  );
}
