import {
  brandExtractionInputContract,
  brandListContract,
  errorEnvelopeContract,
  extractJobQueuedContract,
  jobRetrieveContract,
} from "@/contracts/brand-api";

describe("brand api contracts", () => {
  it("validates extraction input requires at least one source", () => {
    expect(() => brandExtractionInputContract.parse({})).toThrow();
    expect(() =>
      brandExtractionInputContract.parse({
        url: "https://example.com",
      })
    ).not.toThrow();
  });

  it("validates queued extraction response envelope", () => {
    const parsed = extractJobQueuedContract.parse({
      id: "req_pi_123",
      object: "job",
      status: "queued",
      created_at: 1700000000,
      data: { job_id: "3b35dce4-7a26-4ea5-bf31-36dff18f1c3e" },
    });
    expect(parsed.data.job_id).toBe("3b35dce4-7a26-4ea5-bf31-36dff18f1c3e");
  });

  it("validates job retrieve with expanded brand and job_result", () => {
    const parsed = jobRetrieveContract.parse({
      id: "req_pi_123",
      object: "job",
      status: "completed",
      created_at: 1700000000,
      data: {
        id: "9d26f4f0-1048-4889-92ed-c99280fddf00",
        org_id: "7ae3e30c-d09f-4785-a6ce-f18f218cadb4",
        type: "brand_extraction",
        status: "completed",
        payload: { phase: "completed" },
        result_url: "brands/12cecf5a-42e9-48b4-85bb-6743126ff2e8",
        error_log: null,
        created_at: 1700000000,
        updated_at: 1700000010,
        expanded: {
          brand: {
            id: "12cecf5a-42e9-48b4-85bb-6743126ff2e8",
            org_id: "7ae3e30c-d09f-4785-a6ce-f18f218cadb4",
            domain: "example.com",
            name: "example.com",
            primary_hex: "#000000",
            secondary_hex: "#ffffff",
            logo_url: null,
            font_file_url: null,
            layout_rules: {},
            brand_dna: {},
            created_at: "2026-03-24T00:00:00.000Z",
            updated_at: "2026-03-24T00:00:00.000Z",
          },
        },
        job_result: {
          type: "brand",
          id: "12cecf5a-42e9-48b4-85bb-6743126ff2e8",
          url: "brands/12cecf5a-42e9-48b4-85bb-6743126ff2e8",
        },
      },
    });
    expect(parsed.data.job_result?.type).toBe("brand");
  });

  it("validates list envelope shape", () => {
    const parsed = brandListContract.parse({
      id: "req_pi_123",
      object: "list",
      status: "completed",
      created_at: 1700000000,
      data: {
        data: [],
        total_count: 0,
        has_more: false,
      },
    });
    expect(parsed.object).toBe("list");
  });

  it("validates error envelope shape", () => {
    const parsed = errorEnvelopeContract.parse({
      error: {
        type: "invalid_request_error",
        code: "invalid_job_id",
        message: "Job id must be a valid UUID.",
        request_id: "req_pi_123",
      },
    });
    expect(parsed.error.code).toBe("invalid_job_id");
  });
});
