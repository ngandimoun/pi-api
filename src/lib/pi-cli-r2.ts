import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";

import { getR2S3Client } from "@/lib/storage";
import type { DependencyGraph } from "@/lib/pi-cli-graph";

function requireEnv(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`Missing ${name}`);
  return v;
}

function graphsBucket(): string {
  return process.env.R2_PI_GRAPHS_BUCKET?.trim() || requireEnv("R2_BUCKET_NAME");
}

/**
 * Upload latest immutable system-style snapshot for an org (Cloudflare R2 via S3 API).
 * Stored alongside graphs in the same bucket by default (prefix: pi-system-style/).
 */
export async function uploadLatestPiSystemStyle(
  organizationId: string,
  systemStyle: Record<string, unknown>
): Promise<string> {
  const safeOrg = organizationId.replace(/[^a-zA-Z0-9_-]/g, "_");
  const ts = Date.now();
  const key = `pi-system-style/${safeOrg}/system-style-${ts}.json`;
  const latestKey = `pi-system-style/${safeOrg}/latest.json`;
  const body = Buffer.from(JSON.stringify(systemStyle, null, 0), "utf8");
  const client = getR2S3Client();
  const bucket = graphsBucket();

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: "application/json",
    })
  );
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: latestKey,
      Body: body,
      ContentType: "application/json",
    })
  );
  return key;
}

export async function downloadLatestPiSystemStyle(organizationId: string): Promise<Record<string, unknown> | null> {
  try {
    const safeOrg = organizationId.replace(/[^a-zA-Z0-9_-]/g, "_");
    const key = `pi-system-style/${safeOrg}/latest.json`;
    const client = getR2S3Client();
    const out = await client.send(
      new GetObjectCommand({
        Bucket: graphsBucket(),
        Key: key,
      })
    );
    const stream = out.Body;
    if (!stream) return null;
    const chunks: Buffer[] = [];
    for await (const chunk of stream as AsyncIterable<Uint8Array>) {
      chunks.push(Buffer.from(chunk));
    }
    const raw = Buffer.concat(chunks).toString("utf8");
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Upload dependency graph JSON; returns object key (not public URL — graphs are private).
 */
export async function uploadPiGraphJson(organizationId: string, graph: DependencyGraph): Promise<string> {
  const safeOrg = organizationId.replace(/[^a-zA-Z0-9_-]/g, "_");
  const ts = Date.now();
  const key = `pi-graphs/${safeOrg}/graph-${ts}.json`;
  const latestKey = `pi-graphs/${safeOrg}/latest.json`;
  const body = Buffer.from(JSON.stringify(graph, null, 0), "utf8");
  const client = getR2S3Client();
  const bucket = graphsBucket();

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: "application/json",
    })
  );
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: latestKey,
      Body: body,
      ContentType: "application/json",
    })
  );
  return key;
}

/**
 * Download latest dependency graph for an organization from R2.
 */
export async function downloadLatestPiGraph(organizationId: string): Promise<DependencyGraph | null> {
  try {
    const safeOrg = organizationId.replace(/[^a-zA-Z0-9_-]/g, "_");
    const key = `pi-graphs/${safeOrg}/latest.json`;
    const client = getR2S3Client();
    const out = await client.send(
      new GetObjectCommand({
        Bucket: graphsBucket(),
        Key: key,
      })
    );
    const stream = out.Body;
    if (!stream) return null;
    const chunks: Buffer[] = [];
    for await (const chunk of stream as AsyncIterable<Uint8Array>) {
      chunks.push(Buffer.from(chunk));
    }
    const raw = Buffer.concat(chunks).toString("utf8");
    return JSON.parse(raw) as DependencyGraph;
  } catch {
    return null;
  }
}
