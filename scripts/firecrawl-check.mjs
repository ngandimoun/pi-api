import fs from "node:fs";
import path from "node:path";

function loadEnvLocal() {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) {
    return;
  }

  const content = fs.readFileSync(envPath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const idx = trimmed.indexOf("=");
    if (idx <= 0) {
      continue;
    }
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

async function main() {
  loadEnvLocal();

  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) {
    console.error("firecrawl:check failed: FIRECRAWL_API_KEY is missing.");
    process.exit(1);
  }

  const targetUrl = process.env.FIRECRAWL_CHECK_URL || "https://example.com";
  const response = await fetch("https://api.firecrawl.dev/v1/scrape", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      url: targetUrl,
      formats: ["markdown"],
    }),
  });

  const json = await response.json().catch(() => ({}));
  if (!response.ok || !json?.success) {
    console.error("firecrawl:check failed:", {
      status: response.status,
      error: json?.error ?? "unknown_error",
    });
    process.exit(1);
  }

  const hasMarkdown = Boolean(json?.data?.markdown);
  console.info("firecrawl:check ok", {
    url: targetUrl,
    hasMarkdown,
  });
}

main().catch((error) => {
  console.error("firecrawl:check failed:", error?.message ?? String(error));
  process.exit(1);
});
