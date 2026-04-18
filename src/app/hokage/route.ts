import { readFile } from "node:fs/promises";
import path from "node:path";

/**
 * curl -fsSL https://<your-host>/hokage | sh
 */
export async function GET() {
  const scriptPath = path.join(/* turbopackIgnore: true */ process.cwd(), "scripts", "install-hokage.sh");
  const script = await readFile(scriptPath, "utf8");

  return new Response(script, {
    headers: {
      "Content-Type": "text/x-shellscript; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
}
