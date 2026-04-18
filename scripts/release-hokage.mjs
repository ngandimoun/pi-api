#!/usr/bin/env node
/**
 * Release script for pi-hokage package.
 * Ensures @pi-api/cli and pi-hokage versions are bumped atomically.
 * 
 * Usage:
 *   node scripts/release-hokage.mjs <version>
 *   
 * Example:
 *   node scripts/release-hokage.mjs 0.1.1
 */

import { execSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

const version = process.argv[2];
if (!version || !/^\d+\.\d+\.\d+$/.test(version)) {
  console.error("Usage: node scripts/release-hokage.mjs <version>");
  console.error("Example: node scripts/release-hokage.mjs 0.1.1");
  process.exit(1);
}

console.log(`\n📦 Releasing pi-hokage v${version}\n`);

// Read package.json files
const cliPackagePath = path.join(process.cwd(), "packages/pi-cli/package.json");
const hokagePackagePath = path.join(process.cwd(), "packages/pi-hokage/package.json");

const cliPkg = JSON.parse(await fs.readFile(cliPackagePath, "utf8"));
const hokagePkg = JSON.parse(await fs.readFile(hokagePackagePath, "utf8"));

// Update versions
cliPkg.version = version;
hokagePkg.version = version;
hokagePkg.dependencies["@pi-api/cli"] = version; // Exact version, no ^

// Write back
await fs.writeFile(cliPackagePath, JSON.stringify(cliPkg, null, 2) + "\n", "utf8");
await fs.writeFile(hokagePackagePath, JSON.stringify(hokagePkg, null, 2) + "\n", "utf8");

console.log(`✓ Updated @pi-api/cli to ${version}`);
console.log(`✓ Updated pi-hokage to ${version}`);
console.log(`✓ Pinned pi-hokage dependency to exact @pi-api/cli@${version}`);

// Run prepublish check
console.log("\n🔍 Running prepublish checks...\n");
try {
  execSync("node packages/pi-hokage/scripts/check-cli-version.mjs", { stdio: "inherit" });
} catch (e) {
  console.error("\n✗ Prepublish check failed. Fix issues before publishing.");
  process.exit(1);
}

console.log("\n✅ Release preparation complete!");
console.log("\nNext steps:");
console.log(`  1. Review changes: git diff`);
console.log(`  2. Commit: git add . && git commit -m "release: v${version}"`);
console.log(`  3. Tag: git tag v${version}`);
console.log(`  4. Publish CLI: cd packages/pi-cli && npm publish`);
console.log(`  5. Publish Hokage: cd packages/pi-hokage && npm publish`);
console.log(`  6. Push: git push && git push --tags\n`);
