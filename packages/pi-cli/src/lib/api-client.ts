import type { RoutineTemplate } from "pi-routine-spec";

import { getApiKey, getBaseUrl, getPersona, type PiPersona } from "./config.js";

/**
 * Best-effort CLI version string. Bumped automatically by tsup via `define`
 * or by a release script; falls back to "dev" for local builds.
 */
const PI_CLI_VERSION: string = process.env.PI_CLI_VERSION ?? "dev";

export type PiNlpPlan = {
  detected_language: { locale: string; confidence: number; reasoning: string };
  normalized_intent: string;
  routing: {
    primary: string;
    commands: Array<{
      command: string;
      rationale: string;
      args: string[];
      background?: boolean;
    }>;
    confidence: number;
    warnings: string[];
  };
};

export type VerifyResult = {
  valid: boolean;
  organization_id: string | null;
  subscription_tier?: string | null;
};

/**
 * Server-side Pi CLI Hokage readiness snapshot.
 * Mirrors the `GET /api/cli/health` envelope returned by the Next.js backend.
 */
export type PiCliHealthReport = {
  object: "pi_cli_health";
  ok: boolean;
  checks: {
    default_model: { configured: boolean; source: "env" | "default" };
    postgres: {
      configured: boolean;
      reachable: boolean;
      error?: string;
      diagnostics?: {
        env_value_present: boolean;
        env_source?: "PI_CLI_DATABASE_URL" | "DATABASE_URL" | "none";
        normalized_ok: boolean;
        canonical_parse_ok: boolean;
        deferred_during_next_build: boolean;
        ssl_peer_verification_relaxed?: boolean;
        ssl_ca_bundle_configured?: boolean;
        store_init_error?: string;
        flags?: {
          raw_length: number;
          trimmed_nonempty: boolean;
          has_placeholder: boolean;
          angle_template: boolean;
          scheme_ok: boolean;
          length_ok: boolean;
          whatwg_url_ok: boolean;
          pg_parse_ok: boolean;
          regex_fallback_ok: boolean;
          hostname_is_base: boolean;
        };
      };
    };
    workflow_mode: { enabled: boolean };
    routine_hitl: { enabled: boolean };
    memory: { enabled: boolean; semantic_recall: boolean };
    trigger_dev: { configured: boolean };
    gemini: { configured: boolean };
    fail_closed: { enabled: boolean };
    instrumentation_ok: boolean;
  };
  workflows: string[];
  agents: string[];
  generated_at: number;
};

export class PiApiClient {
  constructor(
    private readonly opts: {
      apiKey?: string;
      baseUrl?: string;
      fetchImpl?: typeof fetch;
      /** Explicit persona override; when omitted we resolve from env/global config. */
      persona?: PiPersona;
    } = {}
  ) {}

  private get fetchImpl() {
    return this.opts.fetchImpl ?? globalThis.fetch;
  }

  private authHeader(): string {
    const key = this.opts.apiKey ?? getApiKey();
    if (!key) throw new Error("Missing API key. Run pi-hokage or set PI_API_KEY.");
    return `Bearer ${key}`;
  }

  private base(): string {
    return (this.opts.baseUrl ?? getBaseUrl()).replace(/\/$/, "");
  }

  /**
   * Standard POST headers (auth + JSON content-type + persona + cli version).
   * Every backend route sees X-Pi-Persona so Mastra agents and workflows can
   * adapt their responses without needing to read the global config file.
   */
  private headers(extra?: Record<string, string>): Record<string, string> {
    const persona = this.opts.persona ?? getPersona();
    const h: Record<string, string> = {
      Authorization: this.authHeader(),
      "Content-Type": "application/json",
      "X-Pi-Persona": persona,
      "X-Pi-Cli-Version": PI_CLI_VERSION,
    };
    if (extra) Object.assign(h, extra);
    return h;
  }

  /** Same as `headers()` but without Content-Type (for GET requests). */
  private getHeaders(): Record<string, string> {
    const persona = this.opts.persona ?? getPersona();
    return {
      Authorization: this.authHeader(),
      "X-Pi-Persona": persona,
      "X-Pi-Cli-Version": PI_CLI_VERSION,
    };
  }

  private async parseEnvelope<T>(res: Response): Promise<T> {
    const json = (await res.json()) as {
      data?: T;
      error?: { message?: string; code?: string; workflow_key?: string; phase?: string; reason?: string };
    };
    if (!res.ok) {
      const code = json.error?.code;
      const base = json.error?.message ?? `Request failed (${res.status})`;
      if (code === "workflow_disabled") {
        const err = new Error(
          `${base} (Pi CLI Hokage: server has Mastra workflow mode turned off. Retry with PI_CLI_STRICT=false or X-Pi-Fail-Closed: false, or ask admin to set PI_CLI_USE_WORKFLOWS=true + PI_CLI_DATABASE_URL.)`,
        );
        (err as Error & { code?: string }).code = code;
        throw err;
      }
      if (code === "workflow_unavailable") {
        const wf = json.error?.workflow_key ? ` [${json.error.workflow_key}]` : "";
        const reason = json.error?.reason ? ` — ${json.error.reason}` : "";
        const err = new Error(
          `${base}${wf}${reason} (Pi CLI Hokage: workflow run failed in strict mode. Retry later, hit /api/cli/health to inspect readiness, or soften via X-Pi-Fail-Closed: false.)`,
        );
        (err as Error & { code?: string }).code = code;
        throw err;
      }
      const err = new Error(base);
      if (code) (err as Error & { code?: string }).code = code;
      throw err;
    }
    if (json.data === undefined) {
      throw new Error("Invalid API response: missing data envelope.");
    }
    return json.data;
  }

  /**
   * Pi CLI server readiness probe (no auth required).
   * Maps to `GET /api/cli/health` on the Pi API. Returns `null` on 404 so older
   * backends don't break `pi doctor`.
   */
  async health(): Promise<PiCliHealthReport | null> {
    try {
      const res = await this.fetchImpl(`${this.base()}/api/cli/health`, {
        method: "GET",
      });
      if (res.status === 404) return null;
      const json = (await res.json()) as PiCliHealthReport;
      return json ?? null;
    } catch {
      return null;
    }
  }

  async verify(): Promise<VerifyResult> {
    const res = await this.fetchImpl(`${this.base()}/api/cli/auth/verify`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({}),
    });
    return this.parseEnvelope<VerifyResult>(res);
  }

  async learn(
    body: {
      metadata: {
        package_json?: Record<string, unknown>;
        import_histogram?: Record<string, number>;
        file_sample_paths?: string[];
        framework_hints?: string[];
        polyglot_hints?: {
          counts_by_extension?: Record<string, number>;
          sample_paths?: string[];
        };
        file_sources?: { path: string; content: string }[];
      };
    },
    opts?: { async?: boolean }
  ) {
    const q = opts?.async ? "?async=true" : "";
    const res = await this.fetchImpl(`${this.base()}/api/cli/learn${q}`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(body),
    });
    return this.parseEnvelope<{
      system_style?: Record<string, unknown>;
      graph_job_triggered?: boolean;
      rules_persisted?: number;
      workflow?: string | null;
      async?: boolean;
      run_id?: string;
      workflow_key?: string;
      trigger_job_id?: string;
    }>(res);
  }

  async routineGenerate(
    body: {
      intent: string;
      system_style?: Record<string, unknown>;
      doc_urls?: string[];
      require_approval?: boolean;
      branch_name?: string;
      developer_id?: string;
      routine_context?: Record<string, unknown>;
      format?: ("cursor" | "claude" | "windsurf")[];
    },
    opts?: { async?: boolean }
  ) {
    const q = opts?.async ? "?async=true" : "";
    const res = await this.fetchImpl(`${this.base()}/api/cli/routine/generate${q}`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(body),
    });
    return this.parseEnvelope<{
      slug?: string;
      markdown?: string;
      version?: number;
      status?: string;
      run_id?: string;
      workflow_key?: string | null;
      suspend_payload?: unknown;
      suspended?: unknown;
      thread_id?: string;
      async?: boolean;
      trigger_job_id?: string;
      routine_spec_json?: string;
      execution_plan_markdown?: string;
      execution_plan_slug?: string;
      adapter_outputs?: {
        cursor_mdc?: string;
        claude_agents_section?: string;
        windsurf_md?: string;
      };
      format?: string[];
    }>(res);
  }

  async promptGenerate(body: {
    intent: string;
    system_style?: Record<string, unknown>;
    branch_name?: string;
    developer_id?: string;
    routine_context?: Record<string, unknown>;
  }) {
    const res = await this.fetchImpl(`${this.base()}/api/cli/prompt/generate`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(body),
    });
    return this.parseEnvelope<{
      compiled_prompt: string;
      intent_slug: string;
      thread_id?: string;
      context_quality: "rich" | "partial" | "thin";
      memory_highlight?: string;
    }>(res);
  }

  async promptFeedback(body: {
    intent_slug: string;
    intent: string;
    feedback: "up" | "down";
    thread_id?: string;
    branch_name?: string;
    developer_id?: string;
  }) {
    const res = await this.fetchImpl(`${this.base()}/api/cli/prompt/feedback`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(body),
    });
    return this.parseEnvelope<{ ok: boolean; persisted?: boolean }>(res);
  }

  async routineUpgrade(body: { legacy_markdown: string; intent_hint?: string }) {
    const res = await this.fetchImpl(`${this.base()}/api/cli/routine/upgrade`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(body),
    });
    return this.parseEnvelope<{
      slug: string;
      markdown: string;
      version: number;
      routine_spec_json?: string;
      status?: string;
    }>(res);
  }

  async validate(
    body: {
    intent?: string;
    branch_name?: string;
    developer_id?: string;
    local_violations: unknown[];
    routine_markdown?: string;
    file_excerpts?: { path: string; excerpt: string }[];
    },
    opts?: { async?: boolean }
  ) {
    const q = opts?.async ? "?async=true" : "";
    const res = await this.fetchImpl(`${this.base()}/api/cli/validate${q}`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(body),
    });
    return this.parseEnvelope<{
      local_violations: unknown[];
      semantic_violations: { rule: string; severity: string; message: string; suggestion?: string }[];
      summary: string | null;
      thread_id?: string;
      workflow?: string | null;
      adaptive_recommended?: boolean;
      async?: boolean;
      run_id?: string;
      workflow_key?: string;
      trigger_job_id?: string;
    }>(res);
  }

  async workflowPoll(body: { workflow_key: string; run_id: string }) {
    const res = await this.fetchImpl(`${this.base()}/api/cli/workflow/poll`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(body),
    });
    return this.parseEnvelope<{
      status: string;
      workflow_run?: unknown;
      workflow_result?: unknown;
      suspend_payload?: unknown;
    }>(res);
  }

  async validateDebug(body: { run_id: string; workflow_key?: string }) {
    const res = await this.fetchImpl(`${this.base()}/api/cli/validate/debug`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(body),
    });
    return this.parseEnvelope<{
      run_id: string;
      workflow_key?: string;
      snapshot: unknown;
    }>(res);
  }

  async workflowStatus(body: { workflow_key: string; run_id: string }) {
    const res = await this.fetchImpl(`${this.base()}/api/cli/workflow/status`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(body),
    });
    return this.parseEnvelope<{ workflow_run: unknown }>(res);
  }

  async workflowResume(body: { workflow_key: string; run_id: string; step_id?: string; resume_data: unknown }) {
    const res = await this.fetchImpl(`${this.base()}/api/cli/workflow/resume`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(body),
    });
    return this.parseEnvelope<{ workflow_result: unknown }>(res);
  }

  async templatesList(): Promise<RoutineTemplate[]> {
    const res = await this.fetchImpl(`${this.base()}/api/cli/templates`, {
      method: "GET",
      headers: this.getHeaders(),
    });
    return this.parseEnvelope<{ templates: RoutineTemplate[] }>(res).then((d) => d.templates);
  }

  async templateGet(id: string): Promise<RoutineTemplate> {
    const enc = encodeURIComponent(id);
    const res = await this.fetchImpl(`${this.base()}/api/cli/templates/${enc}`, {
      method: "GET",
      headers: this.getHeaders(),
    });
    return this.parseEnvelope<{ template: RoutineTemplate }>(res).then((d) => d.template);
  }

  async intent(body: {
    query: string;
    changed_files?: string[];
    project_context?: { framework?: string; language?: string };
  }) {
    const res = await this.fetchImpl(`${this.base()}/api/cli/check/intent`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(body),
    });
    return this.parseEnvelope<{
      target: string;
      scope: string[];
      active_registries: string[];
      detected_language?: { locale: string; confidence: number };
      confidence_score: number;
      reasoning: string;
    }>(res);
  }

  /**
   * Smart multilingual router — natural language → suggested Pi CLI command sequence.
   * This does not execute anything; it returns an execution plan.
   */
  async nlpPlan(body: {
    query: string;
    changed_files?: string[];
    project_context?: { framework?: string; language?: string };
    prefer_locale?: string;
  }) {
    const res = await this.fetchImpl(`${this.base()}/api/cli/nlp`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(body),
    });
    return this.parseEnvelope<PiNlpPlan>(res);
  }

  async syncFetch(body: { include_graph?: boolean }) {
    const res = await this.fetchImpl(`${this.base()}/api/cli/sync`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(body ?? {}),
    });
    return this.parseEnvelope<{
      system_style: Record<string, unknown> | null;
      graph: unknown | null;
      hints: { system_style_file: string; graph_file: string };
    }>(res);
  }

  async trace(body: {
    run_id: string;
    workflow_key?: "cliValidateWorkflow" | "cliRoutineWorkflow" | "cliLearnWorkflow" | "cliResonateWorkflow";
  }) {
    const res = await this.fetchImpl(`${this.base()}/api/cli/trace`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(body),
    });
    return this.parseEnvelope<{
      run_id: string;
      workflow_key: string;
      snapshot: unknown;
      links: Array<{ label: string; url: string; method: "POST"; body: unknown }>;
      notes: string[];
    }>(res);
  }

  /** Approve a pending team system-style draft (tech_lead / admin). */
  async resonateApprove(draftId: string) {
    const enc = encodeURIComponent(draftId);
    const res = await this.fetchImpl(`${this.base()}/api/cli/resonate/approve/${enc}`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({}),
    });
    return this.parseEnvelope<{ ok: boolean; draft_id?: string }>(res);
  }

  /** Interactive staff-engineer architecture session (no code generation). */
  async resonateChat(body: {
    intent: string;
    messages: Array<{ role: "user" | "assistant"; content: string }>;
    branch_name?: string;
    developer_id?: string;
    system_style?: Record<string, unknown>;
    routine_context?: Record<string, unknown>;
    mode?: "explore" | "challenge" | "decision";
    depth?: "fast" | "deep";
    constitution?: string;
    git_diff_summary?: string;
    validate_context?: { violations: string[]; routine_slug?: string };
  }) {
    const res = await this.fetchImpl(`${this.base()}/api/cli/resonate`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(body),
    });
    return this.parseEnvelope<{
      message: string;
      tradeoffs: string[];
      risks: string[];
      invariants: string[];
      open_questions: string[];
      suggested_alternatives: string[];
      recommended_approach: { label: "A" | "B" | "none"; rationale: string };
      exit_criteria: string[];
      claims: Array<{
        claim: string;
        source: string;
        evidence_type?:
          | "graph"
          | "system_style"
          | "ast"
          | "diff"
          | "constitution"
          | "validation"
          | "memory"
          | "inference";
        confidence?: number;
      }>;
      conflict_type: "hard_constraint" | "pattern_divergence" | "preference" | "none";
      files_likely_touched?: string[];
      grounding_quality: {
        graph_available: boolean;
        style_available: boolean;
        excerpts_count: number;
        constitution_loaded: boolean;
      };
      is_ready: boolean;
      thread_id: string;
      session_status: "question" | "building" | "resolved";
      next_action: "reply" | "approve" | "execute" | "done";
    }>(res);
  }

  /** Start a resonate workflow (Socratic Loop state machine). */
  async resonateWorkflowStart(body: {
    intent: string;
    messages: Array<{ role: "user" | "assistant"; content: string }>;
    branch_name?: string;
    developer_id?: string;
    system_style?: Record<string, unknown>;
    routine_context?: Record<string, unknown>;
    mode?: "explore" | "challenge" | "decision";
    depth?: "fast" | "deep";
    constitution?: string;
    git_diff_summary?: string;
  }) {
    const res = await this.fetchImpl(`${this.base()}/api/cli/resonate?workflow=true`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(body),
    });
    return this.parseEnvelope<{
      workflow?: boolean;
      run_id?: string;
      status?: string;
      suspend_payload?: unknown;
      thread_id?: string;
      shadow_plan_markdown?: string;
      challenge?: unknown;
      conversation?: unknown;
      grounding_quality?: unknown;
      ast_insights?: unknown;
    }>(res);
  }
}
