import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const pi = path.join(root, "packages", "pi-cli", "dist", "index.js");

const r = spawnSync(process.execPath, [pi, "doctor"], { encoding: "utf8" });
if (r.status !== 0) {
  console.error(r.stderr || r.stdout);
  process.exit(r.status ?? 1);
}
console.log("pi-cli-e2e: ok\n", r.stdout);
