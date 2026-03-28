import { POST } from "@/app/api/internal/ads-cache/cleanup/route";

const mockTrigger = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock("@trigger.dev/sdk/v3", () => ({
  tasks: {
    trigger: mockTrigger,
  },
}));

describe("POST /api/internal/ads-cache/cleanup", () => {
  beforeEach(() => {
    mockTrigger.mockClear();
    process.env.PI_INTERNAL_ADMIN_TOKEN = "admin_test_token";
  });

  it("rejects when admin token is missing", async () => {
    const req = new Request("https://api.example.com/api/internal/ads-cache/cleanup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dry_run: true }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("triggers cleanup when admin token is provided", async () => {
    const req = new Request("https://api.example.com/api/internal/ads-cache/cleanup", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Pi-Admin-Token": "admin_test_token",
      },
      body: JSON.stringify({ dry_run: true, batch_size: 1234 }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mockTrigger).toHaveBeenCalledWith(
      "ads-cache-cleanup",
      expect.objectContaining({ dryRun: true, batchSize: 1234 })
    );
  });
});

