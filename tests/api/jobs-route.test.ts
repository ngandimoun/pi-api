import { GET } from "@/app/api/v1/jobs/[id]/route";

const mockSupabase = vi.hoisted(() => ({
  job: null as Record<string, unknown> | null,
  brand: null as Record<string, unknown> | null,
}));

vi.mock("@/lib/auth", () => ({
  withApiAuth:
    (handler: (request: any, context: any) => Promise<Response>) =>
    (request: any, context: any) =>
      handler(Object.assign(request, { requestId: "req_pi_test", organizationId: "org_1" }), context),
}));

vi.mock("@/lib/supabase", () => ({
  getServiceSupabaseClient: () => ({
    from: (table: string) => {
      if (table === "jobs") {
        const chain = {
          select: () => chain,
          eq: () => chain,
          maybeSingle: async () => ({ data: mockSupabase.job, error: null }),
        };
        return chain;
      }

      const chain = {
        select: () => chain,
        eq: () => chain,
        maybeSingle: async () => ({ data: mockSupabase.brand, error: null }),
      };
      return chain;
    },
  }),
}));

describe("GET /api/v1/jobs/[id]", () => {
  beforeEach(() => {
    mockSupabase.job = null;
    mockSupabase.brand = null;
  });

  it("returns 404 when cross-org job is requested", async () => {
    mockSupabase.job = {
      id: "9d26f4f0-1048-4889-92ed-c99280fddf00",
      org_id: "org_other",
      type: "brand_extraction",
      status: "processing",
      payload: {},
      result_url: null,
      error_log: null,
      created_at: "2026-03-24T00:00:00.000Z",
      updated_at: "2026-03-24T00:00:00.000Z",
    };

    const req = new Request(
      "https://api.example.com/api/v1/jobs/9d26f4f0-1048-4889-92ed-c99280fddf00"
    );
    const res = await GET(req as any, {
      params: { id: "9d26f4f0-1048-4889-92ed-c99280fddf00" },
    });
    expect(res.status).toBe(404);
  });

  it("returns expanded brand and job_result with include=brand", async () => {
    mockSupabase.job = {
      id: "9d26f4f0-1048-4889-92ed-c99280fddf00",
      org_id: "org_1",
      type: "brand_extraction",
      status: "completed",
      payload: {},
      result_url: "brands/12cecf5a-42e9-48b4-85bb-6743126ff2e8",
      error_log: null,
      created_at: "2026-03-24T00:00:00.000Z",
      updated_at: "2026-03-24T00:00:10.000Z",
    };
    mockSupabase.brand = {
      id: "12cecf5a-42e9-48b4-85bb-6743126ff2e8",
      org_id: "org_1",
      name: "example.com",
    };

    const req = new Request(
      "https://api.example.com/api/v1/jobs/9d26f4f0-1048-4889-92ed-c99280fddf00?include=brand"
    );
    const res = await GET(req as any, {
      params: { id: "9d26f4f0-1048-4889-92ed-c99280fddf00" },
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.expanded.brand.id).toBe("12cecf5a-42e9-48b4-85bb-6743126ff2e8");
    expect(json.data.job_result.type).toBe("brand");
  });
});
