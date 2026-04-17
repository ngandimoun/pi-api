import { createTool } from "@mastra/core/tools";
import { z } from "zod";

type Severity = "none" | "low" | "medium" | "high";

const FEATURE_PREREQUISITE_MAP: Record<string, { check: string; label: string }[]> = {
  auth: [
    { check: "prisma/schema.prisma|model User", label: "User model in Prisma schema" },
    { check: "NEXTAUTH_SECRET|AUTH_SECRET", label: "Auth secret env variable configuration" },
    { check: "SessionProvider|getServerSession", label: "Session provider setup" },
  ],
  stripe: [
    { check: "STRIPE_SECRET_KEY|STRIPE_WEBHOOK_SECRET", label: "Stripe env variables" },
    { check: "export async function POST", label: "POST route handler for webhooks" },
    { check: "rawBody|raw-body|bodyParser", label: "Raw body parsing for Stripe signature verification" },
  ],
  database: [
    { check: "prisma/schema.prisma|drizzle.config", label: "Database schema / ORM configuration" },
    { check: "DATABASE_URL|POSTGRES_URL", label: "Database connection string env" },
  ],
  storage: [
    { check: "S3Client|createClient|supabase.storage", label: "Storage client setup" },
    { check: "STORAGE_BUCKET|S3_BUCKET|SUPABASE_URL", label: "Storage environment variables" },
  ],
  realtime: [
    { check: "WebSocket|livekit|pusher|ably", label: "Realtime transport layer" },
    { check: "LIVEKIT_URL|PUSHER_KEY|ABLY_KEY", label: "Realtime service credentials" },
  ],
  email: [
    { check: "resend|sendgrid|nodemailer|SMTP", label: "Email sending service" },
    { check: "RESEND_API_KEY|SENDGRID_API_KEY|SMTP_HOST", label: "Email service credentials" },
  ],
  payment: [
    { check: "stripe|STRIPE_SECRET_KEY|paypal", label: "Payment processor SDK" },
    { check: "webhook|STRIPE_WEBHOOK_SECRET", label: "Payment webhook handler" },
  ],
  cache: [
    { check: "redis|upstash|REDIS_URL|UPSTASH_REDIS", label: "Cache/Redis client" },
  ],
};

export function scanForPrerequisites(
  excerpts: { path: string; excerpt: string }[],
  featureIntent: string,
  packageJsonDeps?: Record<string, string>
): { missing_prerequisites: string[]; severity: Severity } {
  const allContent = excerpts.map((e) => `--- ${e.path}\n${e.excerpt}`).join("\n");
  const depsStr = packageJsonDeps ? Object.keys(packageJsonDeps).join(" ") : "";
  const searchable = `${allContent}\n${depsStr}`.toLowerCase();
  const intentLower = featureIntent.toLowerCase();

  const missing: string[] = [];

  for (const [feature, checks] of Object.entries(FEATURE_PREREQUISITE_MAP)) {
    const featureTokens = feature.split(/[_-]/);
    if (!featureTokens.some((t) => intentLower.includes(t))) continue;

    for (const { check, label } of checks) {
      const tokens = check.split("|");
      if (!tokens.some((t) => searchable.includes(t.toLowerCase()))) {
        missing.push(label);
      }
    }
  }

  if (
    (intentLower.includes("api") || intentLower.includes("endpoint") || intentLower.includes("route")) &&
    !searchable.includes("export async function") &&
    !searchable.includes("app/api/")
  ) {
    missing.push("API route handler scaffold (app/api/)");
  }

  if (intentLower.includes("middleware") && !searchable.includes("middleware.ts")) {
    missing.push("Next.js middleware.ts file");
  }

  if (intentLower.includes("cron") || intentLower.includes("scheduled")) {
    if (!searchable.includes("cron") && !searchable.includes("vercel.json")) {
      missing.push("Cron job configuration (vercel.json crons or Trigger.dev)");
    }
  }

  const severity: Severity =
    missing.length === 0 ? "none"
    : missing.length <= 1 ? "low"
    : missing.length <= 3 ? "medium"
    : "high";

  return { missing_prerequisites: missing, severity };
}

export const prerequisiteScannerTool = createTool({
  id: "prerequisite-scanner",
  description:
    "Given a feature intent and code excerpts, detect missing infrastructure prerequisites (DB schemas, env vars, route handlers, etc.).",
  inputSchema: z.object({
    feature_intent: z.string().max(4000).describe("What the developer wants to build"),
    file_excerpts: z
      .array(z.object({ path: z.string(), excerpt: z.string().max(20_000) }))
      .max(40),
    package_json_deps: z.record(z.string()).optional().describe("Combined dependencies + devDependencies"),
  }),
  outputSchema: z.object({
    missing_prerequisites: z.array(z.string()),
    severity: z.enum(["none", "low", "medium", "high"]),
  }),
  execute: async ({ feature_intent, file_excerpts, package_json_deps }) =>
    scanForPrerequisites(file_excerpts, feature_intent, package_json_deps),
});
