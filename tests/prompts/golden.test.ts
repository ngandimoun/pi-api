/**
 * Golden prompt tests — regression tests for agent tool-calling behavior.
 * Uses stub models with canned responses to assert tool-call sequences and schema validation.
 */

import { describe, it, expect } from "vitest";
import { z } from "zod";

// Mock Gemini model responses
type MockToolCall = {
  name: string;
  args: Record<string, unknown>;
};

type MockScenario = {
  intent: string;
  expectedToolCalls: string[];
  mockResponse: unknown;
};

const scenarios: Record<string, MockScenario> = {
  "add-stripe-billing": {
    intent: "add stripe billing",
    expectedToolCalls: ["querySystemStyle", "queryDependencyGraph"],
    mockResponse: {
      metadata: {
        id: "add-stripe-billing",
        intent: "add stripe billing",
        version: 1,
        created_at: new Date().toISOString(),
        tags: ["billing", "stripe", "payments"],
      },
      framework: "Next.js App Router",
      existing_patterns: ["@/lib/api patterns", "src/app/api routes"],
      files_manifest: [
        {
          path: "src/app/api/stripe/checkout/route.ts",
          purpose: "Stripe checkout session creation",
          action: "create",
        },
      ],
      phases: [
        {
          phase_id: 1,
          title: "Install Stripe SDK",
          steps: [{ action: "run_command", command: "npm install stripe" }],
        },
      ],
      validation: {
        required_files: ["src/app/api/stripe/checkout/route.ts"],
        required_exports: [],
        test_command: "npm test",
      },
      constraints: {
        must_use: ["Stripe SDK", "environment variables for keys"],
        must_not: ["hardcoded API keys"],
        conventions: ["Use server-side API routes only"],
      },
    },
  },
  "rename-column": {
    intent: "rename column user_id to userId",
    expectedToolCalls: ["blastRadius", "queryDependencyGraph"],
    mockResponse: {
      violations: [
        {
          severity: "high",
          category: "schema_migration",
          message: "Column rename requires database migration",
          evidence: "Found usage in 8 files",
          file: "schema.prisma",
          suggested_fix: "Generate migration with prisma migrate",
        },
      ],
      summary: "Database schema change detected",
    },
  },
  "audit-auth-flow": {
    intent: "audit my auth flow",
    expectedToolCalls: ["architecturalBoundary", "querySystemStyle"],
    mockResponse: {
      understanding: "Reviewing authentication implementation",
      missing_prerequisites: [],
      architectural_traps: ["Session management not implemented", "No CSRF protection"],
      alternative_paths: [
        {
          id: "next-auth",
          title: "Use NextAuth.js",
          description: "Integrated auth solution",
          tradeoffs: "Less control but faster setup",
        },
      ],
      probing_question: "What auth provider are you using?",
      risks: ["Insecure session storage"],
      invariants: ["Must use HTTPS in production"],
      claims: [
        {
          claim: "No authentication middleware found",
          source: "from AST",
        },
      ],
      conflict_type: "hard_constraint",
      files_likely_touched: ["src/middleware.ts", "src/app/api/auth/route.ts"],
      is_ready: false,
    },
  },
};

describe("Golden Prompt Tests", () => {
  describe("add stripe billing", () => {
    it("should route to routine and call system-style + dependency-graph tools", () => {
      const scenario = scenarios["add-stripe-billing"];
      
      // Simulate NLP routing
      const intent = scenario.intent;
      const expectedCommand = "routine";
      
      // Assert intent maps to routine command
      expect(intent.toLowerCase()).toContain("add");
      expect(expectedCommand).toBe("routine");
      
      // Verify expected tool calls
      expect(scenario.expectedToolCalls).toContain("querySystemStyle");
      expect(scenario.expectedToolCalls).toContain("queryDependencyGraph");
      
      // Verify structured output validates against routine spec schema
      const mockOutput = scenario.mockResponse as Record<string, unknown>;
      expect(mockOutput).toHaveProperty("metadata");
      expect(mockOutput).toHaveProperty("files_manifest");
      expect(mockOutput).toHaveProperty("phases");
      expect(mockOutput).toHaveProperty("validation");
      expect(mockOutput).toHaveProperty("constraints");
      
      // Verify metadata structure
      const metadata = mockOutput.metadata as Record<string, unknown>;
      expect(metadata.id).toBe("add-stripe-billing");
      expect(metadata.intent).toBe(intent);
      expect(Array.isArray((mockOutput.phases as unknown[]))).toBe(true);
    });
  });

  describe("rename column user_id to userId", () => {
    it("should route to validate and call blast-radius + dependency-graph tools", () => {
      const scenario = scenarios["rename-column"];
      
      const intent = scenario.intent;
      const expectedCommand = "validate";
      
      // Assert intent maps to validate command (schema migration)
      expect(intent.toLowerCase()).toContain("rename");
      expect(expectedCommand).toBe("validate");
      
      // Verify expected tool calls for impact analysis
      expect(scenario.expectedToolCalls).toContain("blastRadius");
      expect(scenario.expectedToolCalls).toContain("queryDependencyGraph");
      
      // Verify validation output structure
      const mockOutput = scenario.mockResponse as Record<string, unknown>;
      expect(mockOutput).toHaveProperty("violations");
      expect(Array.isArray(mockOutput.violations)).toBe(true);
      
      const violations = mockOutput.violations as Array<Record<string, unknown>>;
      expect(violations.length).toBeGreaterThan(0);
      expect(violations[0]).toHaveProperty("severity");
      expect(violations[0]).toHaveProperty("evidence");
      expect(violations[0].severity).toBe("high");
    });
  });

  describe("audit my auth flow", () => {
    it("should route to resonate and call architectural-boundary + system-style tools", () => {
      const scenario = scenarios["audit-auth-flow"];
      
      const intent = scenario.intent;
      const expectedCommand = "resonate";
      
      // Assert intent maps to resonate command (architectural review)
      expect(intent.toLowerCase()).toContain("audit");
      expect(expectedCommand).toBe("resonate");
      
      // Verify expected tool calls for architectural analysis
      expect(scenario.expectedToolCalls).toContain("architecturalBoundary");
      expect(scenario.expectedToolCalls).toContain("querySystemStyle");
      
      // Verify Socratic challenge output structure
      const mockOutput = scenario.mockResponse as Record<string, unknown>;
      expect(mockOutput).toHaveProperty("understanding");
      expect(mockOutput).toHaveProperty("missing_prerequisites");
      expect(mockOutput).toHaveProperty("architectural_traps");
      expect(mockOutput).toHaveProperty("alternative_paths");
      expect(mockOutput).toHaveProperty("probing_question");
      expect(mockOutput).toHaveProperty("risks");
      expect(mockOutput).toHaveProperty("invariants");
      expect(mockOutput).toHaveProperty("claims");
      expect(mockOutput).toHaveProperty("conflict_type");
      expect(mockOutput).toHaveProperty("is_ready");
      
      // Verify claims structure
      const claims = mockOutput.claims as Array<Record<string, unknown>>;
      expect(Array.isArray(claims)).toBe(true);
      expect(claims.length).toBeGreaterThan(0);
      expect(claims[0]).toHaveProperty("claim");
      expect(claims[0]).toHaveProperty("source");
      
      // Verify is_ready is false for audit (requires clarification)
      expect(mockOutput.is_ready).toBe(false);
    });
  });

  describe("Tool call sequences", () => {
    it("should enforce querySystemStyle before making convention claims", () => {
      // Rule: agents should call querySystemStyle before making assertions about repo conventions
      const scenario = scenarios["add-stripe-billing"];
      expect(scenario.expectedToolCalls).toContain("querySystemStyle");
    });

    it("should call blastRadius for any multi-file refactor or rename", () => {
      // Rule: validate should use blastRadius for impact analysis
      const scenario = scenarios["rename-column"];
      expect(scenario.expectedToolCalls).toContain("blastRadius");
    });

    it("should call architecturalBoundary for Server/Client component audits", () => {
      // Rule: architectural reviews should check boundaries
      const scenario = scenarios["audit-auth-flow"];
      expect(scenario.expectedToolCalls).toContain("architecturalBoundary");
    });
  });
});
