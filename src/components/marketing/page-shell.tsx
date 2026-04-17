import { ReactNode } from "react";
import { Navbar } from "@/components/landing/navbar";
import { Footer } from "@/components/landing/footer";
import { LatticeBg } from "./bg/lattice-bg";
import { FieldLinesBg } from "./bg/field-lines-bg";
import { FourierBg } from "./bg/fourier-bg";
import { PhaseSpaceBg } from "./bg/phase-space-bg";
import { EmaWavesBg } from "./bg/ema-waves-bg";
import { GridEngawaBg } from "./bg/grid-engawa-bg";

export type PageBg =
  | "lattice"
  | "field-lines"
  | "fourier"
  | "phase-space"
  | "ema-waves"
  | "grid-engawa"
  | "none";

export interface PageShellProps {
  children: ReactNode;
  bg?: PageBg;
}

function renderBg(bg: PageBg) {
  switch (bg) {
    case "lattice":
      return <LatticeBg />;
    case "field-lines":
      return <FieldLinesBg />;
    case "fourier":
      return <FourierBg />;
    case "phase-space":
      return <PhaseSpaceBg />;
    case "ema-waves":
      return <EmaWavesBg />;
    case "grid-engawa":
      return <GridEngawaBg />;
    case "none":
    default:
      return null;
  }
}

export function PageShell({ children, bg = "lattice" }: PageShellProps) {
  return (
    <>
      <Navbar />
      <div className="relative min-h-screen">
        <div className="fixed inset-0 -z-10 text-foreground">{renderBg(bg)}</div>
        <main className="relative">{children}</main>
      </div>
      <Footer />
    </>
  );
}
