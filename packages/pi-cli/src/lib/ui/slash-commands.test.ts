import { describe, expect, it } from "vitest";

import { listSlashCommands, parseUserReply } from "./slash-commands.js";

describe("parseUserReply", () => {
  it("treats whitespace as empty", () => {
    expect(parseUserReply("   ")).toEqual({ kind: "empty" });
  });

  it("preserves free-form text", () => {
    const r = parseUserReply("Yeah but what about N+1 queries?");
    expect(r).toEqual({ kind: "text", content: "Yeah but what about N+1 queries?" });
  });

  it.each([
    ["done", "done"],
    ["exit", "done"],
    ["quit", "done"],
    ["cancel", "cancel"],
    ["abort", "cancel"],
    ["back", "back"],
  ])("recognizes sentinel word %s -> /%s", (input, command) => {
    expect(parseUserReply(input)).toEqual({ kind: "slash", command });
  });

  it.each([
    ["/done", "done"],
    ["/end", "done"],
    ["/save", "save"],
    ["/checkpoint", "save"],
    ["/verbose", "verbose"],
    ["/v", "verbose"],
    ["/quiet", "quiet"],
    ["/q", "quiet"],
    ["/copy", "copy"],
    ["/yank", "copy"],
    ["/files", "files"],
    ["/risks", "risks"],
    ["/help", "help"],
    ["/?", "help"],
  ])("parses slash alias %s -> %s", (input, command) => {
    expect(parseUserReply(input)).toEqual({ kind: "slash", command });
  });

  it("captures arguments after a slash command", () => {
    const r = parseUserReply("/files components/Button.tsx");
    expect(r).toEqual({ kind: "slash", command: "files", arg: "components/Button.tsx" });
  });

  it("routes unknown /commands to help", () => {
    expect(parseUserReply("/nope")).toEqual({ kind: "slash", command: "help" });
  });

  it("is case-insensitive", () => {
    expect(parseUserReply("DONE")).toEqual({ kind: "slash", command: "done" });
    expect(parseUserReply("/VERBOSE")).toEqual({ kind: "slash", command: "verbose" });
  });
});

describe("listSlashCommands", () => {
  it("returns at least the core commands", () => {
    const ids = listSlashCommands().map((c) => c.id);
    for (const required of ["done", "save", "help", "quiet", "verbose", "copy", "files", "risks", "cancel"]) {
      expect(ids).toContain(required);
    }
  });

  it("every command exposes at least one alias", () => {
    for (const c of listSlashCommands()) {
      expect(c.aliases.length).toBeGreaterThan(0);
    }
  });
});
