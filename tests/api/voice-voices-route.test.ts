import { GET as listVoices } from "@/app/api/v1/voice/voices/route";

vi.mock("@/lib/auth", () => ({
  withApiAuth:
    (handler: (request: unknown, context: unknown) => Promise<Response>) =>
    (request: unknown, context: unknown) =>
      handler(
        Object.assign(request as object, {
          requestId: "req_pi_test",
          organizationId: "aaaaaaaa-bbbb-cccc-dddd-111111111111",
          developerId: "dev_1",
        }),
        context
      ),
}));

describe("GET /api/v1/voice/voices", () => {
  it("returns voice catalog", async () => {
    const req = new Request("https://api.example.com/api/v1/voice/voices");
    const res = await listVoices(req as never, {});
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      data: { data: Array<{ name: string; description: string; default: boolean }> };
    };
    expect(json.data.data.length).toBe(30);
    expect(json.data.data.some((v) => v.default)).toBe(true);
  });
});
