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
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
}
