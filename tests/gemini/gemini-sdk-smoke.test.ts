import { GoogleGenAI } from "@google/genai";

describe("gemini sdk smoke", () => {
  it("can import @google/genai and construct a client without network", () => {
    const client = new GoogleGenAI({});
    expect(client).toBeTruthy();
  });
});

