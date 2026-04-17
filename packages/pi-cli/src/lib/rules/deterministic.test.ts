import { Project } from "ts-morph";
import { describe, expect, it } from "vitest";
import { ruleNoHardcodedHex, ruleNoMissingReactKeys, ruleNoZIndexChaos } from "./deterministic.js";

function tsx(src: string) {
  const p = new Project({ useInMemoryFileSystem: true });
  return p.createSourceFile("test.tsx", src, { overwrite: true });
}

describe("deterministic jutsu", () => {
  it("flags hex in className", () => {
    const sf = tsx(`export function X(){ return <div className="bg-[#ff0000]" /> }`);
    const v = ruleNoHardcodedHex(sf);
    expect(v.some((x) => x.rule === "no-hardcoded-hex")).toBe(true);
  });

  it("flags z-index chaos", () => {
    const sf = tsx(`export function X(){ return <div className="z-[9999]" /> }`);
    const v = ruleNoZIndexChaos(sf);
    expect(v.some((x) => x.rule === "no-z-index-chaos")).toBe(true);
  });

  it("flags map without key", () => {
    const sf = tsx(`export function X(){ return [].map(x => <div />); }`);
    const v = ruleNoMissingReactKeys(sf);
    expect(v.some((x) => x.rule === "no-missing-react-keys")).toBe(true);
  });
});
