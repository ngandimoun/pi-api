import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { PI_CACHE_DIR } from "../constants.js";

const VALIDATE_CLOUD_CACHE_PREFIX = "validate:cloud:v1";

type L1Entry = { value: unknown; expiresAt: number };

/** L1 in-memory + L2 disk cache (Rasengan). L3 is cloud — handled in API client later. */
export class RasenganCache {
  private l1 = new Map<string, L1Entry>();

  constructor(
    private readonly projectRoot: string,
    private readonly defaultTtlMs = 86_400_000
  ) {}

  private diskPath(key: string): string {
    const hash = createHash("sha256").update(key).digest("hex").slice(0, 32);
    return path.join(this.projectRoot, PI_CACHE_DIR, `${hash}.json`);
  }

  async ensureDir(): Promise<void> {
    await fs.mkdir(path.join(this.projectRoot, PI_CACHE_DIR), { recursive: true });
  }

  async get<T>(key: string): Promise<T | null> {
    const now = Date.now();
    const mem = this.l1.get(key);
    if (mem && mem.expiresAt > now) {
      return mem.value as T;
    }
    if (mem) this.l1.delete(key);

    try {
      const raw = await fs.readFile(this.diskPath(key), "utf8");
      const parsed = JSON.parse(raw) as { value: unknown; expiresAt: number };
      if (parsed.expiresAt <= now) {
        return null;
      }
      this.l1.set(key, { value: parsed.value, expiresAt: parsed.expiresAt });
      return parsed.value as T;
    } catch {
      return null;
    }
  }

  async set<T>(key: string, value: T, ttlMs = this.defaultTtlMs): Promise<void> {
    const expiresAt = Date.now() + ttlMs;
    this.l1.set(key, { value, expiresAt });
    await this.ensureDir();
    await fs.writeFile(
      this.diskPath(key),
      JSON.stringify({ value, expiresAt }, null, 0),
      "utf8"
    );
  }

  async clearMemory(): Promise<void> {
    this.l1.clear();
  }

  async clearDisk(): Promise<void> {
    const dir = path.join(this.projectRoot, PI_CACHE_DIR);
    try {
      const entries = await fs.readdir(dir);
      await Promise.all(entries.map((f) => fs.unlink(path.join(dir, f))));
    } catch {
      /* empty */
    }
  }
}

export function cacheKeyForFile(filePath: string, content: string): string {
  return `file:${filePath}:${createHash("sha256").update(content).digest("hex")}`;
}

/**
 * Stable SHA-256 digest of arbitrary strings (used for circuit-breaker keys).
 */
export function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

export type ValidateCloudFingerprintParts = {
  intentKey: string;
  routineTok: string;
  systemStyleDigest: string;
  branchName: string;
  developerId: string;
  /** Serialized deterministic violations (same inputs as cloud receives). */
  localViolationsJson: string;
  fileExcerpts: { path: string; excerpt: string }[];
  hunksOnly: boolean;
};

/**
 * Fingerprint for the full validate cloud request. When unchanged, skip the network call
 * and reuse cached semantic results (L2 Rasengan).
 */
export function buildValidateCloudFingerprint(parts: ValidateCloudFingerprintParts): string {
  const excerptsSorted = [...parts.fileExcerpts].sort((a, b) => a.path.localeCompare(b.path));
  const payload = JSON.stringify({
    v: 1,
    intent: parts.intentKey,
    routine: parts.routineTok,
    style: parts.systemStyleDigest,
    branch: parts.branchName,
    dev: parts.developerId,
    local: parts.localViolationsJson,
    hunks: parts.hunksOnly,
    excerpts: excerptsSorted,
  });
  return sha256Hex(payload);
}

export function validateCloudCacheKey(fingerprint: string): string {
  return `${VALIDATE_CLOUD_CACHE_PREFIX}:${fingerprint}`;
}
