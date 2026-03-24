import { GET as getBrandById } from "@/app/api/v1/brands/[id]/route";
import { GET as listBrands } from "@/app/api/v1/brands/route";

const mockSupabase = vi.hoisted(() => ({
  brandsList: [] as Record<string, unknown>[],
  totalCount: 0,
  brandById: null as Record<string, unknown> | null,
  latestJob: null as Record<string, unknown> | null,
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
      if (table === "brands") {
        const headChain = {
          eq: () => headChain,
          ilike: () => headChain,
          then: (resolve: (value: any) => void) =>
            resolve({ count: mockSupabase.totalCount, error: null }),
        };
        const chain = {
          select: (_cols: string, opts?: { head?: boolean }) => {
            if (opts?.head) {
              return headChain;
            }
            return chain;
          },
          eq: () => chain,
          ilike: () => chain,
          order: () => chain,
          range: () => chain,
          maybeSingle: async () => ({ data: mockSupabase.brandById, error: null }),
          then: (resolve: (value: any) => void) =>
            resolve({ data: mockSupabase.brandsList, error: null }),
        };
        return chain;
      }
      const chain = {
        select: () => chain,
        eq: () => chain,
        order: () => chain,
        limit: () => ({
          maybeSingle: async () => ({ data: mockSupabase.latestJob, error: null }),
        }),
      };
      return chain;
    },
  }),
}));

describe("brands endpoints", () => {
  beforeEach(() => {
    mockSupabase.brandsList = [];
    mockSupabase.totalCount = 0;
    mockSupabase.brandById = null;
    mockSupabase.latestJob = null;
  });

  it("returns list envelope with has_more", async () => {
    mockSupabase.brandsList = [{ id: "b_1", name: "Brand One" }];
    mockSupabase.totalCount = 3;

    const req = new Request("https://api.example.com/api/v1/brands?query=brand&limit=1&offset=0");
    const res = await listBrands(req as any, {});
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.object).toBe("list");
    expect(json.data.has_more).toBe(true);
  });

  it("returns 404 for cross-org brand access", async () => {
    mockSupabase.brandById = {
      id: "12cecf5a-42e9-48b4-85bb-6743126ff2e8",
      org_id: "org_other",
      name: "other",
    };
    const req = new Request(
      "https://api.example.com/api/v1/brands/12cecf5a-42e9-48b4-85bb-6743126ff2e8"
    );
    const res = await getBrandById(req as any, {
      params: { id: "12cecf5a-42e9-48b4-85bb-6743126ff2e8" },
    });
    expect(res.status).toBe(404);
  });
});
