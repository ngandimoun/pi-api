/**
 * Pi API database contract types.
 *
 * Source of truth: supabase/migrations/0001_initial_schema.sql
 */

export type JobStatus = "queued" | "processing" | "completed" | "failed";
export type BillingTier = "free" | "pro" | "enterprise";

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

/**
 * pgvector values are commonly serialized as strings by PostgREST/Supabase.
 * Keep this strict and storage-compatible with the DB.
 */
export type Vector1536 = string;

export interface Organization {
  id: string;
  name: string;
  unkey_workspace_id: string | null;
  billing_tier: BillingTier;
  created_at: string;
  updated_at: string;
}

export interface OrganizationInsert {
  id?: string;
  name: string;
  unkey_workspace_id?: string | null;
  billing_tier?: BillingTier;
  created_at?: string;
  updated_at?: string;
}

export interface OrganizationUpdate {
  name?: string;
  unkey_workspace_id?: string | null;
  billing_tier?: BillingTier;
  updated_at?: string;
}

export interface Brand {
  id: string;
  org_id: string;
  domain: string;
  name: string;
  primary_hex: string | null;
  secondary_hex: string | null;
  logo_url: string | null;
  font_file_url: string | null;
  layout_rules: Json;
  brand_dna: Json;
  created_at: string;
  updated_at: string;
}

export interface BrandInsert {
  id?: string;
  org_id: string;
  domain: string;
  name: string;
  primary_hex?: string | null;
  secondary_hex?: string | null;
  logo_url?: string | null;
  font_file_url?: string | null;
  layout_rules?: Json;
  brand_dna?: Json;
  created_at?: string;
  updated_at?: string;
}

export interface BrandUpdate {
  org_id?: string;
  domain?: string;
  name?: string;
  primary_hex?: string | null;
  secondary_hex?: string | null;
  logo_url?: string | null;
  font_file_url?: string | null;
  layout_rules?: Json;
  brand_dna?: Json;
  updated_at?: string;
}

export interface Product {
  id: string;
  org_id: string;
  brand_id: string;
  sku: string;
  original_image_url: string | null;
  product_url: string | null;
  metadata: Json;
  created_at: string;
  updated_at: string;
}

export interface ProductInsert {
  id?: string;
  org_id: string;
  brand_id: string;
  sku: string;
  original_image_url?: string | null;
  product_url?: string | null;
  metadata?: Json;
  created_at?: string;
  updated_at?: string;
}

export interface ProductUpdate {
  org_id?: string;
  brand_id?: string;
  sku?: string;
  original_image_url?: string | null;
  product_url?: string | null;
  metadata?: Json;
  updated_at?: string;
}

export interface StyleReference {
  id: string;
  org_id: string;
  image_url: string;
  aesthetic_label: string | null;
  embedding: Vector1536;
  created_at: string;
  updated_at: string;
}

export interface StyleReferenceInsert {
  id?: string;
  org_id: string;
  image_url: string;
  aesthetic_label?: string | null;
  embedding: Vector1536;
  created_at?: string;
  updated_at?: string;
}

export interface StyleReferenceUpdate {
  org_id?: string;
  image_url?: string;
  aesthetic_label?: string | null;
  embedding?: Vector1536;
  updated_at?: string;
}

export interface Job {
  id: string;
  org_id: string;
  run_id: string | null;
  run_step_id: string | null;
  type: string;
  status: JobStatus;
  payload: Json;
  result_url: string | null;
  error_log: string | null;
  created_at: string;
  updated_at: string;
}

export interface JobInsert {
  id?: string;
  org_id: string;
  run_id?: string | null;
  run_step_id?: string | null;
  type: string;
  status?: JobStatus;
  payload?: Json;
  result_url?: string | null;
  error_log?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface JobUpdate {
  org_id?: string;
  run_id?: string | null;
  run_step_id?: string | null;
  type?: string;
  status?: JobStatus;
  payload?: Json;
  result_url?: string | null;
  error_log?: string | null;
  updated_at?: string;
}

export interface Webhook {
  id: string;
  org_id: string;
  endpoint_url: string;
  secret: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface WebhookInsert {
  id?: string;
  org_id: string;
  endpoint_url: string;
  secret: string;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface WebhookUpdate {
  org_id?: string;
  endpoint_url?: string;
  secret?: string;
  is_active?: boolean;
  updated_at?: string;
}

export interface ProjectedPayload {
  id: string;
  brand_id: string;
  org_id: string;
  developer_id: string;
  use_case: string;
  is_wildcard: boolean;
  clean_payload: Json;
  created_at: string;
  updated_at: string;
}

export interface ProjectedPayloadInsert {
  id?: string;
  brand_id: string;
  org_id: string;
  developer_id: string;
  use_case: string;
  is_wildcard?: boolean;
  clean_payload: Json;
  created_at?: string;
  updated_at?: string;
}

export interface ProjectedPayloadUpdate {
  brand_id?: string;
  org_id?: string;
  developer_id?: string;
  use_case?: string;
  is_wildcard?: boolean;
  clean_payload?: Json;
  updated_at?: string;
}

export interface OrgSavedAvatar {
  id: string;
  org_id: string;
  label: string | null;
  image_url: string;
  metadata: Json;
  created_at: string;
  updated_at: string;
}

export interface OrgSavedAvatarInsert {
  id?: string;
  org_id: string;
  label?: string | null;
  image_url: string;
  metadata?: Json;
  created_at?: string;
  updated_at?: string;
}

export interface OrgSavedAvatarUpdate {
  label?: string | null;
  image_url?: string;
  metadata?: Json;
  updated_at?: string;
}

export type RunStatus = "pending" | "in_progress" | "completed" | "failed" | "cancelled";

export interface Run {
  id: string;
  org_id: string;
  status: RunStatus;
  steps: Json;
  metadata: Json | null;
  created_at: string;
  updated_at: string;
}

export interface RunInsert {
  id?: string;
  org_id: string;
  status?: RunStatus;
  steps?: Json;
  metadata?: Json | null;
  created_at?: string;
  updated_at?: string;
}

export interface RunUpdate {
  org_id?: string;
  status?: RunStatus;
  steps?: Json;
  metadata?: Json | null;
  updated_at?: string;
}

export type VoiceSessionStatus = "active" | "completed" | "failed" | "expired";

export interface VoiceAgent {
  id: string;
  org_id: string;
  name: string;
  language: string;
  purpose: string | null;
  instructions: string;
  questions: Json;
  behaviors: Json;
  output_schema: Json;
  /** Optional JSON Schema subset for constrained post-session extraction. */
  output_schema_strict?: Json | null;
  /** Optional Gemini model id for extraction (overrides default orchestrator model). */
  extraction_model?: string | null;
  voice_config: Json;
  system_instruction: string;
  metadata: Json;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface VoiceAgentInsert {
  id?: string;
  org_id: string;
  name: string;
  language?: string;
  purpose?: string | null;
  instructions: string;
  questions?: Json;
  behaviors?: Json;
  output_schema?: Json;
  output_schema_strict?: Json | null;
  extraction_model?: string | null;
  voice_config?: Json;
  system_instruction: string;
  metadata?: Json;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface VoiceAgentUpdate {
  name?: string;
  language?: string;
  purpose?: string | null;
  instructions?: string;
  questions?: Json;
  behaviors?: Json;
  output_schema?: Json;
  output_schema_strict?: Json | null;
  extraction_model?: string | null;
  voice_config?: Json;
  system_instruction?: string;
  metadata?: Json;
  is_active?: boolean;
  updated_at?: string;
}

export interface VoiceSession {
  id: string;
  org_id: string;
  agent_id: string;
  status: VoiceSessionStatus;
  participant: Json;
  context: Json;
  livekit_room_name: string;
  transcript: Json | null;
  results: Json | null;
  duration_seconds: number | null;
  /** Resolved cap for call length (agent default or per-session override); client should disconnect by this deadline. */
  max_duration_seconds: number | null;
  error_log: string | null;
  metadata: Json;
  expires_at: string;
  created_at: string;
  updated_at: string;
}

export interface VoiceSessionInsert {
  id?: string;
  org_id: string;
  agent_id: string;
  status?: VoiceSessionStatus;
  participant?: Json;
  context?: Json;
  livekit_room_name: string;
  transcript?: Json | null;
  results?: Json | null;
  duration_seconds?: number | null;
  max_duration_seconds?: number | null;
  error_log?: string | null;
  metadata?: Json;
  expires_at: string;
  created_at?: string;
  updated_at?: string;
}

export interface VoiceSessionUpdate {
  status?: VoiceSessionStatus;
  participant?: Json;
  context?: Json;
  transcript?: Json | null;
  results?: Json | null;
  duration_seconds?: number | null;
  max_duration_seconds?: number | null;
  error_log?: string | null;
  metadata?: Json;
  expires_at?: string;
  updated_at?: string;
}

export interface UserProfileRow {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  stripe_customer_id: string | null;
  subscription_tier: string | null;
  subscription_status: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface UserProfileInsert {
  id: string;
  email: string;
  full_name?: string | null;
  avatar_url?: string | null;
  stripe_customer_id?: string | null;
  subscription_tier?: string | null;
  subscription_status?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface UserProfileUpdate {
  id?: string;
  email?: string;
  full_name?: string | null;
  avatar_url?: string | null;
  stripe_customer_id?: string | null;
  subscription_tier?: string | null;
  subscription_status?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface ApiKeyRow {
  id: string;
  user_id: string;
  unkey_key_id: string;
  name: string | null;
  last_used_at: string | null;
  created_at: string | null;
  revoked_at: string | null;
}

export interface ApiKeyInsert {
  id?: string;
  user_id: string;
  unkey_key_id: string;
  name?: string | null;
  last_used_at?: string | null;
  created_at?: string | null;
  revoked_at?: string | null;
}

export interface ApiKeyUpdate {
  id?: string;
  user_id?: string;
  unkey_key_id?: string;
  name?: string | null;
  last_used_at?: string | null;
  created_at?: string | null;
  revoked_at?: string | null;
}

export interface UsageEventRow {
  id: string;
  user_id: string;
  api_key_id: string | null;
  event_type: string;
  tokens_used: number | null;
  cost_cents: number | null;
  metadata: Json | null;
  created_at: string | null;
}

export interface UsageEventInsert {
  id?: string;
  user_id: string;
  api_key_id?: string | null;
  event_type: string;
  tokens_used?: number | null;
  cost_cents?: number | null;
  metadata?: Json | null;
  created_at?: string | null;
}

export interface UsageEventUpdate {
  id?: string;
  user_id?: string;
  api_key_id?: string | null;
  event_type?: string;
  tokens_used?: number | null;
  cost_cents?: number | null;
  metadata?: Json | null;
  created_at?: string | null;
}

export interface Database {
  public: {
    Enums: {
      billing_tier: BillingTier;
      job_status: JobStatus;
    };
    CompositeTypes: Record<string, never>;
    Tables: {
      organizations: {
        Row: Organization;
        Insert: OrganizationInsert;
        Update: OrganizationUpdate;
      };
      brands: {
        Row: Brand;
        Insert: BrandInsert;
        Update: BrandUpdate;
      };
      products: {
        Row: Product;
        Insert: ProductInsert;
        Update: ProductUpdate;
      };
      style_references: {
        Row: StyleReference;
        Insert: StyleReferenceInsert;
        Update: StyleReferenceUpdate;
      };
      jobs: {
        Row: Job;
        Insert: JobInsert;
        Update: JobUpdate;
      };
      runs: {
        Row: Run;
        Insert: RunInsert;
        Update: RunUpdate;
      };
      webhooks: {
        Row: Webhook;
        Insert: WebhookInsert;
        Update: WebhookUpdate;
      };
      projected_payloads: {
        Row: ProjectedPayload;
        Insert: ProjectedPayloadInsert;
        Update: ProjectedPayloadUpdate;
      };
      org_saved_avatars: {
        Row: OrgSavedAvatar;
        Insert: OrgSavedAvatarInsert;
        Update: OrgSavedAvatarUpdate;
      };
      voice_agents: {
        Row: VoiceAgent;
        Insert: VoiceAgentInsert;
        Update: VoiceAgentUpdate;
      };
      voice_sessions: {
        Row: VoiceSession;
        Insert: VoiceSessionInsert;
        Update: VoiceSessionUpdate;
      };
      users: {
        Row: UserProfileRow;
        Insert: UserProfileInsert;
        Update: UserProfileUpdate;
      };
      api_keys: {
        Row: ApiKeyRow;
        Insert: ApiKeyInsert;
        Update: ApiKeyUpdate;
      };
      usage_events: {
        Row: UsageEventRow;
        Insert: UsageEventInsert;
        Update: UsageEventUpdate;
      };
    };
    Views: Record<string, never>;
    Functions: {
      match_localized_ad_references: {
        Args: {
          query_embedding: string;
          match_threshold: number;
          match_count: number;
          filter_industry?: string | null;
          filter_culture?: string | null;
          require_human?: boolean | null;
        };
        Returns: Array<{
          id: string;
          master_prompt: string;
          r2_image_url: string;
          metadata: Json;
          similarity: number;
          quality_score: number;
        }>;
      };
      match_localized_ad_references_v2: {
        Args: {
          query_embedding: string;
          match_threshold: number;
          match_count: number;
          filter_industry?: string | null;
          filter_culture?: string | null;
          require_human?: boolean | null;
        };
        Returns: Array<{
          id: string;
          master_prompt: string;
          r2_image_url: string;
          metadata: Json;
          similarity: number;
          quality_score: number;
          combined_score: number;
          tier: string;
          applied_filters: Json;
        }>;
      };
    };
  };
}
