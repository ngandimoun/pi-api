#!/usr/bin/env node
// prepublishOnly guard: ensure the local @pi-api/cli package we depend on is
// at least as new as the semver range we declare in dependencies. This prevents
// shipping a pi-hokage that resolves to a stale CLI on the npm registry.
import { execSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const hokagePkgPath = resolve(here, "..", "package.json");
const cliPkgPath = resolve(here, "..", "..", "pi-cli", "package.json");

function parseSemver(v) {
  const m = String(v).match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

function compareSemver(a, b) {
  for (let i = 0; i < 3; i += 1) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return 0;
}

try {
  const [hokageRaw, cliRaw] = await Promise.all([
    readFile(hokagePkgPath, "utf8"),
    readFile(cliPkgPath, "utf8"),
  ]);
  const hokagePkg = JSON.parse(hokageRaw);
  const cliPkg = JSON.parse(cliRaw);

  const range = hokagePkg.dependencies?.["@pi-api/cli"];
  const cliVersion = cliPkg.version;

  if (!range) {
    console.error("[pi-hokage] prepublish: missing @pi-api/cli in dependencies");
    process.exit(1);
  }

  // Assert exact version (no ^ or ~)
  if (String(range).startsWith("^") || String(range).startsWith("~") || String(range).includes("||")) {
    console.error("[pi-hokage] prepublish: @pi-api/cli must be pinned to an exact version (no ^ or ~ allowed).");
    console.error(`         Current: ${range}`);
    console.error("         Fix: Remove ^ or ~ prefix in packages/pi-hokage/package.json to pin to exact version.");
    process.exit(1);
  }

  const rangeVersion = String(range).replace(/^[^0-9]*/, "");
  const rangeParsed = parseSemver(rangeVersion);
  const cliParsed = parseSemver(cliVersion);

  if (!rangeParsed || !cliParsed) {
    console.error(
      `[pi-hokage] prepublish: could not parse versions (range=${range}, cli=${cliVersion})`
    );
    process.exit(1);
  }

  if (compareSemver(cliParsed, rangeParsed) < 0) {
    console.error(
      `[pi-hokage] prepublish: local @pi-api/cli (${cliVersion}) is older than dependency range (${range}).`
    );
    console.error("         Bump packages/pi-cli first, publish it, then publish pi-hokage.");
    process.exit(1);
  }

  console.log(
    `[pi-hokage] prepublish OK — @pi-api/cli ${cliVersion} satisfies ${range}`
  );

  // Also verify that @pi-api/cli@cliVersion is available on npm registry
  try {
    console.log(`[pi-hokage] checking npm registry for @pi-api/cli@${cliVersion}...`);
    execSync(`npm view @pi-api/cli@${cliVersion} version`, { stdio: "ignore" });
    console.log(`[pi-hokage] confirmed: @pi-api/cli@${cliVersion} is available on npm`);
  } catch {
    console.error(
      `[pi-hokage] prepublish: @pi-api/cli@${cliVersion} is not yet available on npm.`
    );
    console.error("         Wait for npm propagation after publishing @pi-api/cli, then retry.");
    process.exit(1);
  }
} catch (err) {
  console.error("[pi-hokage] prepublish: version check failed");
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}
