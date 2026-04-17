import Link from "next/link";
import { MathBlock } from "./math-block";
import { ToriiAccent } from "@/components/marketing/bg/torii-accent";

const COLS: Array<{ title: string; links: Array<{ label: string; href: string; external?: boolean }> }> = [
  {
    title: "Product",
    links: [
      { label: "Why Pi", href: "/why-pi" },
      { label: "Vision", href: "/vision" },
      { label: "Capabilities", href: "/capabilities" },
      { label: "Commands", href: "/commands" },
      { label: "Pricing", href: "/pricing" },
    ],
  },
  {
    title: "Developers",
    links: [
      { label: "Install", href: "/install" },
      { label: "Docs", href: "/docs" },
      { label: "Architecture", href: "/architecture" },
      { label: "Mintlify ref", href: "https://piii.mintlify.app/", external: true },
    ],
  },
  {
    title: "Account",
    links: [
      { label: "Dashboard", href: "/dashboard" },
      { label: "API keys", href: "/dashboard/keys" },
      { label: "Usage", href: "/dashboard/usage" },
      { label: "Billing", href: "/dashboard/billing" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "Contact", href: "mailto:nchrisdonson@gmail.com", external: true },
      { label: "Twitter / X", href: "https://x.com/ChrisNGAND14511", external: true },
    ],
  },
];

export function Footer() {
  return (
    <footer className="relative border-t border-border/60 bg-background/60 backdrop-blur-sm">
      <div className="mx-auto max-w-section px-6 py-16">
        <div className="grid gap-10 md:grid-cols-[1.2fr_2fr]">
          <div className="space-y-4">
            <div className="flex items-center gap-2.5">
              <span
                className="text-3xl font-light"
                style={{ fontFamily: "serif", color: "var(--ja-shu)" }}
              >
                &pi;
              </span>
              <span className="text-sm font-semibold uppercase tracking-[0.18em]">
                Pi <span className="font-normal text-muted-foreground">Hokage</span>
              </span>
            </div>
            <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
              The agentic CLI for serious developers. From intent to shipped code,
              across every stack and every team.
            </p>
            <div className="pt-1 text-muted-foreground/30">
              <MathBlock expression="e^{i\pi} + 1 = 0" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
            {COLS.map((col) => (
              <div key={col.title} className="space-y-3">
                <h3 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-foreground/80">
                  {col.title}
                </h3>
                <ul className="space-y-2">
                  {col.links.map((l) => (
                    <li key={l.label}>
                      {l.external ? (
                        <a
                          href={l.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                        >
                          {l.label}
                        </a>
                      ) : (
                        <Link
                          href={l.href}
                          className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                        >
                          {l.label}
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center gap-4 border-t border-border/40 pt-8 md:flex-row md:justify-between">
          <p className="flex items-center gap-2 text-xs text-muted-foreground/60">
            <ToriiAccent size={16} />
            <span>&copy; {new Date().getFullYear()} Pi. Infrastructure Intelligence.</span>
          </p>
          <p className="font-mono text-[10px] text-muted-foreground/50">
            &pi; = 3.14159265358979...
          </p>
        </div>
      </div>
    </footer>
  );
}
