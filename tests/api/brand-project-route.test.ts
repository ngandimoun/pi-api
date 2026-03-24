import { POST as projectBrand } from "@/app/api/v1/brands/[id]/project/route";

const mockState = vi.hoisted(() => ({
  brand: null as Record<string, unknown> | null,
  projection: { theme: "minimal" } as Record<string, unknown>,
  projectionError: null as Error | null,
  insertedRows: [] as Record<string, unknown>[],
}));

vi.mock("@/lib/auth", () => ({
  withApiAuth:
    (handler: (request: any, context: any) => Promise<Response>) =>
    (request: any, context: any) =>
      handler(
        Object.assign(request, {
          requestId: "req_pi_test",
          organizationId: "org_1",
          developerId: "dev_1",
        }),
        context
      ),
}));

vi.mock("@/lib/dynamic-projection", () => ({
  generateDynamicProjection: async () => {
    if (mockState.projectionError) {
      throw mockState.projectionError;
    }
    return mockState.projection;
  },
}));

vi.mock("@/lib/supabase", () => ({
  getServiceSupabaseClient: () => ({
    from: (table: string) => {
      if (table === "brands") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: mockState.brand, error: null }),
            }),
          }),
        };
      }
      return {
        insert: (row: Record<string, unknown>) => {
          mockState.insertedRows.push(row);
          return Promise.resolve({ error: null });
        },
      };
    },
  }),
}));

describe("POST /api/v1/brands/[id]/project", () => {
  beforeEach(() => {
    process.env.GOOGLE_BRAND_PROJECTION_MAX_USE_CASE_CHARS = "700";
    process.env.GOOGLE_BRAND_PROJECTION_MAX_BODY_BYTES = "100";
    process.env.GOOGLE_BRAND_PROJECTION_ABUSE_MAX_VIOLATIONS = "3";
    process.env.GOOGLE_BRAND_PROJECTION_ABUSE_WINDOW_MS = "600000";

    mockState.brand = {
      id: "12cecf5a-42e9-48b4-85bb-6743126ff2e8",
      org_id: "org_1",
      brand_dna: { name: "Acme", colors: ["#000000"] },
    };
    mockState.projection = { color_tokens: { primary: "#000000" } };
    mockState.projectionError = null;
    mockState.insertedRows = [];
  });

  it("returns 400 for invalid brand id", async () => {
    const req = new Request("https://api.example.com/api/v1/brands/not-a-uuid/project", {
      method: "POST",
      body: JSON.stringify({ use_case: "ui theme" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await projectBrand(req as any, { params: { id: "not-a-uuid" } });
    expect(res.status).toBe(400);
  });

  it("returns 404 for cross-org brand access", async () => {
    mockState.brand = {
      id: "12cecf5a-42e9-48b4-85bb-6743126ff2e8",
      org_id: "org_other",
      brand_dna: { name: "Other" },
    };
    const req = new Request(
      "https://api.example.com/api/v1/brands/12cecf5a-42e9-48b4-85bb-6743126ff2e8/project",
      {
        method: "POST",
        body: JSON.stringify({ use_case: "ui theme" }),
        headers: { "Content-Type": "application/json" },
      }
    );
    const res = await projectBrand(req as any, {
      params: { id: "12cecf5a-42e9-48b4-85bb-6743126ff2e8" },
    });
    expect(res.status).toBe(404);
  });

  it("returns wildcard payload and tracks projection", async () => {
    const req = new Request(
      "https://api.example.com/api/v1/brands/12cecf5a-42e9-48b4-85bb-6743126ff2e8/project",
      {
        method: "POST",
        body: JSON.stringify({ use_case: "create lovable design tokens for dashboard" }),
        headers: { "Content-Type": "application/json" },
      }
    );
    const res = await projectBrand(req as any, {
      params: { id: "12cecf5a-42e9-48b4-85bb-6743126ff2e8" },
    });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.object).toBe("brand.projection");
    expect(json.data.is_wildcard).toBe(true);
    expect(json.data.payload).toEqual(mockState.projection);
    expect(mockState.insertedRows).toHaveLength(1);
    expect(mockState.insertedRows[0]).toMatchObject({
      brand_id: "12cecf5a-42e9-48b4-85bb-6743126ff2e8",
      org_id: "org_1",
      developer_id: "dev_1",
      is_wildcard: true,
    });
  });

  it("returns 400 when use_case exceeds max length", async () => {
    const req = new Request(
      "https://api.example.com/api/v1/brands/12cecf5a-42e9-48b4-85bb-6743126ff2e8/project",
      {
        method: "POST",
        body: JSON.stringify({ use_case: "a".repeat(701) }),
        headers: { "Content-Type": "application/json" },
      }
    );
    const res = await projectBrand(req as any, {
      params: { id: "12cecf5a-42e9-48b4-85bb-6743126ff2e8" },
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 for oversized request body", async () => {
    const req = new Request(
      "https://api.example.com/api/v1/brands/12cecf5a-42e9-48b4-85bb-6743126ff2e8/project",
      {
        method: "POST",
        body: JSON.stringify({ use_case: "ui theme" }),
        headers: {
          "Content-Type": "application/json",
          "Content-Length": "99999",
        },
      }
    );
    const res = await projectBrand(req as any, {
      params: { id: "12cecf5a-42e9-48b4-85bb-6743126ff2e8" },
    });
    expect(res.status).toBe(400);
  });

  it("returns 429 after repeated oversized abusive requests", async () => {
    let status = 0;
    for (let i = 0; i < 4; i += 1) {
      const req = new Request(
        "https://api.example.com/api/v1/brands/12cecf5a-42e9-48b4-85bb-6743126ff2e8/project",
        {
          method: "POST",
          body: JSON.stringify({ use_case: "ui theme" }),
          headers: {
            "Content-Type": "application/json",
            "Content-Length": "99999",
          },
        }
      );
      const res = await projectBrand(req as any, {
        params: { id: "12cecf5a-42e9-48b4-85bb-6743126ff2e8" },
      });
      status = res.status;
    }
    expect(status).toBe(429);
  });
});
