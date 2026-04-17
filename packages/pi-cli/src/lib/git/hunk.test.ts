import { describe, expect, it } from "vitest";

import { parseUnifiedDiff } from "./hunk.js";

describe("parseUnifiedDiff", () => {
  it("parses git-style unified diff", () => {
    const diff = `+++ b/src/foo.ts
@@ -1,2 +1,3 @@
 a
+b
 c`;
    const out = parseUnifiedDiff(diff);
    expect(out.length).toBe(1);
    expect(out[0].file).toBe("src/foo.ts");
    expect(out[0].hunks.length).toBe(1);
  });
});
