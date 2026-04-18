"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CodeBlock } from "@/components/landing/code-block";
import { InstallCommand } from "@/components/landing/install-command";
import { ArrowRight, Check, Copy, Loader2, ShieldAlert } from "lucide-react";

type ApiKeyResponse = {
  id: string;
  object: "api_key";
  status: "created";
  created_at: number;
  data: {
    key: string;
    key_id: string | null;
    organization_id: string;
  };
};

function KeyRow({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  async function onCopy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-border/60 bg-card/60 p-5 shadow-sm backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Your API key
          </p>
          <p className="mt-1 font-mono text-sm text-foreground break-all">{value}</p>
        </div>
        <button
          type="button"
          onClick={onCopy}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          aria-label="Copy API key"
        >
          {copied ? (
            <>
              <Check className="h-4 w-4" /> Copied
            </>
          ) : (
            <>
              <Copy className="h-4 w-4" /> Copy
            </>
          )}
        </button>
      </div>

      <div className="mt-2 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-foreground/80">
        <div className="flex items-start gap-3">
          <ShieldAlert className="mt-0.5 h-4 w-4 text-destructive" />
          <div>
            <p className="font-medium">Save this key now.</p>
            <p className="mt-1 text-muted-foreground">
              For now, Pi doesn&apos;t have a dashboard to recover keys. If you lose this key,
              generate a new one.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function KeysClient() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const curlExample = useMemo(() => {
    const key = apiKey ?? "pi_***YOUR_KEY***";
    return `curl https://YOUR_DOMAIN/api/v1/brands \\\n  -H "Authorization: Bearer ${key}"`;
  }, [apiKey]);

  const sdkExample = useMemo(() => {
    const key = apiKey ?? "pi_***YOUR_KEY***";
    return `import { createPiClient } from "@pi-api/sdk";\n\nconst pi = createPiClient({ apiKey: "${key}" });\n\nconst brands = await pi.brands.list({ limit: 5 });\nconsole.log(brands);`;
  }, [apiKey]);

  async function onGenerate() {
    router.push("/dashboard/keys");
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border/60 bg-card/50 p-6 shadow-sm backdrop-blur">
        <div className="flex flex-col gap-4 md:flex-row md:items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium text-foreground">
              Key name (optional)
            </label>
            <p className="mt-1 text-sm text-muted-foreground">
              Useful if you generate multiple keys.
            </p>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. personal-laptop"
              className="mt-3 w-full rounded-xl border border-border/60 bg-background/60 px-4 py-2.5 text-sm text-foreground outline-none transition-colors focus:border-primary/40"
              maxLength={80}
              autoComplete="off"
              inputMode="text"
            />
          </div>

          <button
            type="button"
            onClick={onGenerate}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Generating…
              </>
            ) : (
              <>
                Generate API key <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </div>

        {error ? (
          <div className="mt-5 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            {error}
          </div>
        ) : null}
      </div>

      {apiKey ? <KeyRow value={apiKey} /> : null}

      <div className="grid gap-6">
        <div className="rounded-2xl border border-border/60 bg-card/40 p-6 shadow-sm backdrop-blur">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Install the SDK
          </p>
          <InstallCommand command="install @pi-api/sdk" />
        </div>

        <div className="rounded-2xl border border-border/60 bg-card/40 p-6 shadow-sm backdrop-blur">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Quickstart (curl)
          </p>
          <div className="mt-4">
            <CodeBlock code={curlExample} filename="curl" language="bash" />
          </div>
        </div>

        <div className="rounded-2xl border border-border/60 bg-card/40 p-6 shadow-sm backdrop-blur">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Quickstart (TypeScript)
          </p>
          <div className="mt-4">
            <CodeBlock code={sdkExample} filename="quickstart.ts" language="typescript" />
          </div>
        </div>

        {organizationId ? (
          <p className="text-xs text-muted-foreground">
            Org context (for support/debugging):{" "}
            <span className="font-mono text-foreground/80">{organizationId}</span>
          </p>
        ) : null}
      </div>
    </div>
  );
}

