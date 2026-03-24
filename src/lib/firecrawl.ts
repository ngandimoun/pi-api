import type { BrandExtractionInput } from "@/lib/brand-extraction";

export type FirecrawlBrandingResult = {
  markdown: string;
  screenshotUrl: string | null;
  branding: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  actions: Record<string, unknown> | null;
};

type FirecrawlScrapeResponse = {
  success?: boolean;
  data?: {
    markdown?: string;
    screenshot?: string;
    branding?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
    actions?: Record<string, unknown>;
  };
  error?: string;
};

function readBooleanEnv(name: string, defaultValue: boolean): boolean {
  const value = process.env[name];
  if (!value) {
    return defaultValue;
  }
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

function readNumberEnv(name: string, defaultValue: number): number {
  const parsed = Number(process.env[name] ?? String(defaultValue));
  return Number.isFinite(parsed) ? parsed : defaultValue;
}

/**
 * Runs an extensive Firecrawl scrape for brand extraction.
 */
export async function scrapeBrandingProfile(
  url: string,
  options?: Pick<BrandExtractionInput, "location">
): Promise<FirecrawlBrandingResult> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey?.trim()) {
    throw new Error("Missing FIRECRAWL_API_KEY");
  }

  const enableScreenshot = readBooleanEnv("FIRECRAWL_ENABLE_SCREENSHOT", true);
  const enableActionWait = readBooleanEnv("FIRECRAWL_ENABLE_ACTION_WAIT", false);
  const actionWaitMs = Math.max(0, Math.floor(readNumberEnv("FIRECRAWL_ACTION_WAIT_MS", 0)));
  const formats = ["branding", "markdown", ...(enableScreenshot ? ["screenshot"] : [])];
  const actions =
    enableActionWait && actionWaitMs > 0 ? [{ type: "wait", milliseconds: actionWaitMs }] : undefined;

  const response = await fetch("https://api.firecrawl.dev/v1/scrape", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      url,
      formats,
      ...(actions ? { actions } : {}),
      location: options?.location,
    }),
  });

  if (!response.ok) {
    const bodyText = await response.text();
    throw new Error(
      `Firecrawl scrape failed (${response.status}): ${bodyText.slice(0, 500)}`
    );
  }

  const json = (await response.json()) as FirecrawlScrapeResponse;
  if (!json.success || !json.data) {
    throw new Error(`Firecrawl scrape returned unsuccessful response: ${json.error ?? "unknown_error"}`);
  }

  return {
    markdown: json.data.markdown ?? "",
    screenshotUrl: json.data.screenshot ?? null,
    branding: json.data.branding ?? null,
    metadata: json.data.metadata ?? null,
    actions: json.data.actions ?? null,
  };
}
