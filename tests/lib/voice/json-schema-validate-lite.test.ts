import { validateJsonSchemaSubset } from "@/lib/voice/json-schema-validate-lite";

describe("validateJsonSchemaSubset", () => {
  it("flags missing required properties", () => {
    const schema = {
      type: "object",
      properties: {
        score: { type: "number" },
        label: { type: "string" },
      },
      required: ["score", "label"],
      additionalProperties: false,
    };
    const errs = validateJsonSchemaSubset(schema, { score: 1 });
    expect(errs.some((e) => e.includes("label"))).toBe(true);
  });

  it("passes valid object", () => {
    const schema = {
      type: "object",
      properties: {
        ok: { type: "boolean" },
      },
      required: ["ok"],
    };
    expect(validateJsonSchemaSubset(schema, { ok: true })).toHaveLength(0);
  });
});
