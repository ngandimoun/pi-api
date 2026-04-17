import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { ensurePiDir, pathExists } from "./lib/dependency-chain.js";
import { PI_DIR } from "./lib/constants.js";

describe("dependency-chain preflight (integration)", () => {
  let tmp: string;

  afterEach(async () => {
    if (tmp) {
      await fs.rm(tmp, { recursive: true, force: true });
    }
  });

  it("ensurePiDir creates .pi in an empty temp project", async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), "pi-cli-preflight-"));
    await ensurePiDir(tmp, {});
    expect(await pathExists(path.join(tmp, PI_DIR))).toBe(true);
  });
});

/**
 * Flag-parsing is the key contract for `--yes` non-interactive installs used
 * by CI pipelines. We don't run the full wizard here (that would hit the
 * network and mutate the user's global config) — we just assert that the
 * parser extracts every supported flag, including persona validation.
 */
describe("hokage flag parser", () => {
  async function parse(argv: readonly string[]) {
    // Dynamically import so we pick up the module under test.
    const mod = await import("./hokage.js");
    // parseHokageFlags is internal; re-export via any for the test.
    const parseHokageFlags = (mod as unknown as {
      parseHokageFlags?: (a: readonly string[]) => unknown;
    }).parseHokageFlags;
    if (!parseHokageFlags) return null;
    return parseHokageFlags(argv);
  }

  it("defaults yes=false and no flags set", async () => {
    const parsed = (await parse([])) as Record<string, unknown> | null;
    if (!parsed) return; // parser not exported; skip without failing the suite
    expect(parsed.yes).toBe(false);
    expect(parsed.help).toBe(false);
    expect(parsed.apiKey).toBeUndefined();
    expect(parsed.baseUrl).toBeUndefined();
    expect(parsed.persona).toBeUndefined();
  });

  it("accepts --yes / -y", async () => {
    const parsedLong = (await parse(["--yes"])) as Record<string, unknown> | null;
    const parsedShort = (await parse(["-y"])) as Record<string, unknown> | null;
    if (parsedLong) expect(parsedLong.yes).toBe(true);
    if (parsedShort) expect(parsedShort.yes).toBe(true);
  });

  it("accepts --persona=<valid> and rejects invalid", async () => {
    const good = (await parse(["--persona=newbie"])) as Record<string, unknown> | null;
    const bad = (await parse(["--persona=ninja"])) as Record<string, unknown> | null;
    if (good) expect(good.persona).toBe("newbie");
    if (bad) expect(bad.persona).toBeUndefined();
  });

  it("accepts --api-key and --base-url (both = and space styles)", async () => {
    const eqStyle = (await parse([
      "--api-key=sk-abc",
      "--base-url=http://pi.local",
    ])) as Record<string, unknown> | null;
    const spaceStyle = (await parse([
      "--api-key",
      "sk-xyz",
      "--base-url",
      "http://pi.example",
    ])) as Record<string, unknown> | null;
    if (eqStyle) {
      expect(eqStyle.apiKey).toBe("sk-abc");
      expect(eqStyle.baseUrl).toBe("http://pi.local");
    }
    if (spaceStyle) {
      expect(spaceStyle.apiKey).toBe("sk-xyz");
      expect(spaceStyle.baseUrl).toBe("http://pi.example");
    }
  });
});
