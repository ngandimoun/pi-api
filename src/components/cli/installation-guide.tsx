"use client";

import { Copy, Terminal, CheckCircle } from "lucide-react";
import { useState } from "react";

const INSTALLATION_STEPS = [
  {
    step: 1,
    title: "Install Pi CLI",
    command: "npm install -g @pi-api/cli",
    description: "Install the Pi CLI globally using npm",
  },
  {
    step: 2, 
    title: "Authenticate",
    command: "pi auth login",
    description: "Open browser authentication or use your API key",
  },
  {
    step: 3,
    title: "Start Building", 
    command: 'pi "Create a Next.js app with authentication"',
    description: "Use natural language to generate complete implementations",
  },
];

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  return (
    <button
      onClick={handleCopy}
      className="absolute right-3 top-3 p-2 text-muted-foreground hover:text-foreground transition-colors"
      title="Copy to clipboard"
    >
      {copied ? (
        <CheckCircle className="h-4 w-4 text-green-500" />
      ) : (
        <Copy className="h-4 w-4" />
      )}
    </button>
  );
}

function TerminalExample() {
  return (
    <div className="mt-12 rounded-xl border border-border/50 bg-card p-6">
      <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
        <Terminal className="h-4 w-4" />
        <span>Terminal Example</span>
      </div>
      
      <div className="space-y-4 font-mono text-sm">
        <div className="relative rounded-lg bg-muted p-4">
          <div className="text-green-400">$ pi "Add Stripe billing to my React app"</div>
          <div className="mt-2 space-y-1 text-muted-foreground">
            <div>✓ Analyzing codebase context...</div>
            <div>✓ Installing stripe and dependencies...</div>
            <div>✓ Creating payment components...</div>
            <div>✓ Setting up webhook handlers...</div>
            <div>✓ Configuring subscription management...</div>
            <div className="text-foreground">✓ Stripe billing integrated successfully</div>
          </div>
        </div>

        <div className="relative rounded-lg bg-muted p-4">
          <div className="text-green-400">$ pi "Refactor this component to use TypeScript"</div>
          <div className="mt-2 space-y-1 text-muted-foreground">
            <div>✓ Scanning component dependencies...</div>
            <div>✓ Generating TypeScript interfaces...</div>
            <div>✓ Converting prop types...</div>
            <div>✓ Updating imports and exports...</div>
            <div className="text-foreground">✓ Component migrated to TypeScript</div>
          </div>
        </div>

        <div className="relative rounded-lg bg-muted p-4">
          <div className="text-green-400">$ pi "Deploy this to Vercel with environment setup"</div>
          <div className="mt-2 space-y-1 text-muted-foreground">
            <div>✓ Checking deployment requirements...</div>
            <div>✓ Configuring build settings...</div>
            <div>✓ Setting up environment variables...</div>
            <div>✓ Initializing Vercel project...</div>
            <div className="text-foreground">✓ Deployed to https://your-app.vercel.app</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function InstallationGuide() {
  return (
    <section id="installation" className="relative border-t border-border/50">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(45deg, currentColor 0, currentColor 1px, transparent 0, transparent 50%)",
          backgroundSize: "24px 24px",
        }}
      />

      <div className="relative mx-auto max-w-section px-6 py-20 md:py-28">
        <div className="mx-auto max-w-prose text-center">
          <div className="mb-6 text-muted-foreground/15">
            <span className="text-2xl">e<sup>iπ</sup> + 1 = 0</span>
          </div>
          <h2 className="text-3xl font-bold tracking-tight md:text-5xl">
            Get started in minutes
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            From installation to shipping code - the fastest path from idea to implementation.
          </p>
        </div>

        <div className="mt-16 grid gap-8 md:grid-cols-3">
          {INSTALLATION_STEPS.map((step) => (
            <div
              key={step.step}
              className="relative rounded-xl border border-border/50 bg-card p-6"
            >
              <div className="mb-4 flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                {step.step}
              </div>
              
              <h3 className="mb-2 text-lg font-semibold">{step.title}</h3>
              <p className="mb-4 text-sm text-muted-foreground">
                {step.description}
              </p>
              
              <div className="relative rounded-lg border bg-muted p-3">
                <CopyButton text={step.command} />
                <code className="text-sm font-mono pr-12 block">
                  {step.command}
                </code>
              </div>
            </div>
          ))}
        </div>

        <TerminalExample />

        <div className="mt-12 text-center">
          <p className="text-sm text-muted-foreground">
            Need help getting started? Check our{" "}
            <a
              href="https://piii.mintlify.app/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              documentation
            </a>{" "}
            or join our community.
          </p>
        </div>
      </div>
    </section>
  );
}