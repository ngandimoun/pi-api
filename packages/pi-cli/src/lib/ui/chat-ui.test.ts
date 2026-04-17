import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  renderErrorPanel,
  renderPiBubble,
  renderPiTurnHeader,
  renderRecapCard,
  renderResumePreview,
  renderThinkingLine,
  renderTurnSeparator,
  renderUserTurnHeader,
  shouldUseColor,
  shouldUseUnicode,
  terminalWidth,
  trackSpinner,
  stopAllSpinners,
} from "./chat-ui.js";

/**
 * Ensure we work with a stable, known-good environment each test.
 * We override NO_COLOR / TERM / stdout.columns / isTTY per test.
 */

const ORIGINAL_ENV = { ...process.env };
const originalColumns = process.stdout.columns;
const originalIsTTY = process.stdout.isTTY;

function setEnv(patch: Record<string, string | undefined>, opts?: { columns?: number; isTTY?: boolean }) {
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  if (opts?.columns !== undefined) {
    Object.defineProperty(process.stdout, "columns", { value: opts.columns, configurable: true });
  }
  if (opts?.isTTY !== undefined) {
    Object.defineProperty(process.stdout, "isTTY", { value: opts.isTTY, configurable: true });
  }
}

beforeEach(() => {
  // Default test env: NO_COLOR, non-TTY, 80 columns — stable, deterministic.
  for (const k of Object.keys(process.env)) delete process.env[k];
  Object.assign(process.env, ORIGINAL_ENV);
  process.env.NO_COLOR = "1";
  delete process.env.FORCE_COLOR;
  Object.defineProperty(process.stdout, "columns", { value: 80, configurable: true });
  Object.defineProperty(process.stdout, "isTTY", { value: false, configurable: true });
});

afterEach(() => {
  for (const k of Object.keys(process.env)) delete process.env[k];
  Object.assign(process.env, ORIGINAL_ENV);
  Object.defineProperty(process.stdout, "columns", { value: originalColumns, configurable: true });
  Object.defineProperty(process.stdout, "isTTY", { value: originalIsTTY, configurable: true });
});

describe("shouldUseColor", () => {
  it("returns false when NO_COLOR is set", () => {
    setEnv({ NO_COLOR: "1" });
    expect(shouldUseColor()).toBe(false);
  });

  it("returns false when TERM=dumb", () => {
    setEnv({ NO_COLOR: undefined, TERM: "dumb" }, { isTTY: true });
    expect(shouldUseColor()).toBe(false);
  });

  it("returns false when not in TTY", () => {
    setEnv({ NO_COLOR: undefined, TERM: "xterm-256color" }, { isTTY: false });
    expect(shouldUseColor()).toBe(false);
  });

  it("returns true when FORCE_COLOR is set", () => {
    setEnv({ NO_COLOR: undefined, FORCE_COLOR: "1" });
    expect(shouldUseColor()).toBe(true);
  });
});

describe("shouldUseUnicode", () => {
  it("returns false when PI_CLI_ASCII=1", () => {
    setEnv({ PI_CLI_ASCII: "1" });
    expect(shouldUseUnicode()).toBe(false);
  });
});

describe("terminalWidth", () => {
  it("clamps to minimum 40", () => {
    setEnv({}, { columns: 10 });
    expect(terminalWidth()).toBe(40);
  });
  it("clamps to maximum 160", () => {
    setEnv({}, { columns: 9999 });
    expect(terminalWidth()).toBe(160);
  });
});

describe("renderPiTurnHeader", () => {
  it("produces readable plain-text header with NO_COLOR", () => {
    const out = renderPiTurnHeader("normal", {
      threadId: "deadbeefcafef00d",
      turnNumber: 2,
      sessionStatus: "question",
      nextAction: "reply",
    });
    expect(out).toContain("Pi");
    expect(out).toContain("question");
    expect(out).toContain("next: reply");
  });
});

describe("renderUserTurnHeader", () => {
  it("pads the turn number to 2 digits", () => {
    expect(renderUserTurnHeader(3)).toContain("03");
  });
});

describe("renderTurnSeparator", () => {
  it("returns non-empty output", () => {
    expect(renderTurnSeparator().length).toBeGreaterThan(0);
  });
});

describe("renderPiBubble", () => {
  it("renders markdown in plain-text when NO_COLOR", () => {
    const out = renderPiBubble({
      persona: "normal",
      message: "# Hello\n\nThis is **bold** and a `snippet`.",
    });
    expect(out).toContain("Hello");
    expect(out).toContain("bold");
    // Codespan is preserved in plain text.
    expect(out).toContain("snippet");
  });

  it("strips raw <script> tags defensively", () => {
    const out = renderPiBubble({
      persona: "normal",
      message: "safe <script>alert(1)</script> tail",
    });
    expect(out).not.toContain("alert(1)");
    expect(out).toContain("safe");
    expect(out).toContain("tail");
  });
});

describe("renderRecapCard", () => {
  it("emits an ASCII recap when color is off", () => {
    const out = renderRecapCard({
      intent: "Add billing with Stripe",
      persona: "normal",
      invariants: ["Keep webhook idempotent"],
      exitCriteria: ["/checkout returns 200"],
      resonanceRel: ".pi/resonance/foo.md",
      handoffRel: ".pi/handoff.md",
      nextCommand: 'pi routine "Add billing with Stripe"',
      clipboardCopied: true,
    });
    expect(out).toContain("Add billing with Stripe");
    expect(out).toContain("Keep webhook idempotent");
    expect(out).toContain(".pi/resonance/foo.md");
    expect(out).toContain('pi routine "Add billing with Stripe"');
  });

  it("renders at 160 columns without crashing", () => {
    setEnv({}, { columns: 160 });
    const out = renderRecapCard({
      intent: "wide terminal intent",
      persona: "pm",
      nextCommand: "pi routine \"...\"",
    });
    expect(out).toContain("wide terminal intent");
  });
});

describe("renderErrorPanel", () => {
  it("embeds the error message and default hint", () => {
    const out = renderErrorPanel(new Error("connection refused"));
    expect(out).toContain("connection refused");
    expect(out).toContain("pi doctor");
  });

  it("uses a custom hint when provided", () => {
    const out = renderErrorPanel(new Error("boom"), { hint: "try later" });
    expect(out).toContain("try later");
  });
});

describe("renderThinkingLine", () => {
  it("formats seconds to one decimal", () => {
    expect(renderThinkingLine("loading context", 3200)).toContain("3.2s");
  });
});

describe("renderResumePreview", () => {
  it("includes match score and last Pi message", () => {
    const out = renderResumePreview({
      score: 0.83,
      intentSummary: "add billing",
      lastPiMessage: "Last Pi note content",
      sessionId: "abc",
    });
    expect(out).toContain("83%");
    expect(out).toContain("add billing");
    expect(out).toContain("Last Pi note content");
  });
});

describe("spinner registry", () => {
  it("stops all tracked spinners on stopAllSpinners()", () => {
    const stopped: string[] = [];
    const sp = {
      stop: (msg?: string) => {
        stopped.push(msg ?? "");
      },
    };
    trackSpinner(sp);
    stopAllSpinners("cleanup");
    expect(stopped).toEqual(["cleanup"]);
  });

  it("unregister prevents stop from firing", () => {
    const stopped: string[] = [];
    const sp = { stop: () => stopped.push("x") };
    const un = trackSpinner(sp);
    un();
    stopAllSpinners();
    expect(stopped).toEqual([]);
  });
});
