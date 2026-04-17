/* eslint-disable */
/**
 * AUTO-GENERATED FILE — DO NOT EDIT MANUALLY.
 *
 * Generated from Supabase MCP `generate_typescript_types` for project:
 * - ref: ajxgpqoadkqjhirqrdbr
 * - name: Pii
 *
 * If you need to update this file, re-run the generator via MCP and overwrite.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      ad_templates_vector: {
        Row: {
          ai_description: string
          aspect_ratio: string
          embedding: string | null
          file_hash: string
          id: string
          master_prompt: string
          metadata: Json
          ocr_text: string | null
          quality_score: number
          r2_image_url: string
        }
        Insert: {
          ai_description: string
          aspect_ratio: string
          embedding?: string | null
          file_hash: string
          id?: string
          master_prompt: string
          metadata: Json
          ocr_text?: string | null
          quality_score: number
          r2_image_url: string
        }
        Update: {
          ai_description?: string
          aspect_ratio?: string
          embedding?: string | null
          file_hash?: string
          id?: string
          master_prompt?: string
          metadata?: Json
          ocr_text?: string | null
          quality_score?: number
          r2_image_url?: string
        }
        Relationships: []
      }
      ads_artifact_cache: {
        Row: {
          created_at: string
          expires_at: string
          key: string
          size_bytes: number
          updated_at: string
          value: Json
        }
        Insert: {
          created_at?: string
          expires_at: string
          key: string
          size_bytes?: number
          updated_at?: string
          value: Json
        }
        Update: {
          created_at?: string
          expires_at?: string
          key?: string
          size_bytes?: number
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      api_keys: {
        Row: {
          created_at: string | null
          id: string
          last_used_at: string | null
          name: string | null
          revoked_at: string | null
          unkey_key_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          last_used_at?: string | null
          name?: string | null
          revoked_at?: string | null
          unkey_key_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          last_used_at?: string | null
          name?: string | null
          revoked_at?: string | null
          unkey_key_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_keys_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      brands: {
        Row: {
          brand_dna: Json
          created_at: string
          domain: string
          font_file_url: string | null
          id: string
          layout_rules: Json
          logo_url: string | null
          name: string
          org_id: string
          primary_hex: string | null
          secondary_hex: string | null
          updated_at: string
        }
        Insert: {
          brand_dna?: Json
          created_at?: string
          domain: string
          font_file_url?: string | null
          id?: string
          layout_rules?: Json
          logo_url?: string | null
          name: string
          org_id: string
          primary_hex?: string | null
          secondary_hex?: string | null
          updated_at?: string
        }
        Update: {
          brand_dna?: Json
          created_at?: string
          domain?: string
          font_file_url?: string | null
          id?: string
          layout_rules?: Json
          logo_url?: string | null
          name?: string
          org_id?: string
          primary_hex?: string | null
          secondary_hex?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "brands_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      idempotency_requests: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          key_hash: string
          org_id: string
          request_hash: string
          response_body: Json
          response_status: number
          scope: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          key_hash: string
          org_id: string
          request_hash: string
          response_body: Json
          response_status: number
          scope: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          key_hash?: string
          org_id?: string
          request_hash?: string
          response_body?: Json
          response_status?: number
          scope?: string
        }
        Relationships: [
          {
            foreignKeyName: "idempotency_requests_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          created_at: string
          error_log: string | null
          id: string
          org_id: string
          payload: Json
          result_url: string | null
          run_id: string | null
          run_step_id: string | null
          status: Database["public"]["Enums"]["job_status"]
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          error_log?: string | null
          id?: string
          org_id: string
          payload?: Json
          result_url?: string | null
          run_id?: string | null
          run_step_id?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          error_log?: string | null
          id?: string
          org_id?: string
          payload?: Json
          result_url?: string | null
          run_id?: string | null
          run_step_id?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "jobs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "runs"
            referencedColumns: ["id"]
          },
        ]
      }
      org_saved_avatars: {
        Row: {
          created_at: string
          id: string
          image_url: string
          label: string | null
          metadata: Json
          org_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_url: string
          label?: string | null
          metadata?: Json
          org_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string
          label?: string | null
          metadata?: Json
          org_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_saved_avatars_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          billing_tier: Database["public"]["Enums"]["billing_tier"]
          created_at: string
          id: string
          name: string
          unkey_workspace_id: string | null
          updated_at: string
        }
        Insert: {
          billing_tier?: Database["public"]["Enums"]["billing_tier"]
          created_at?: string
          id?: string
          name: string
          unkey_workspace_id?: string | null
          updated_at?: string
        }
        Update: {
          billing_tier?: Database["public"]["Enums"]["billing_tier"]
          created_at?: string
          id?: string
          name?: string
          unkey_workspace_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          brand_id: string
          created_at: string
          id: string
          metadata: Json
          org_id: string
          original_image_url: string | null
          product_url: string | null
          sku: string
          updated_at: string
        }
        Insert: {
          brand_id: string
          created_at?: string
          id?: string
          metadata?: Json
          org_id: string
          original_image_url?: string | null
          product_url?: string | null
          sku: string
          updated_at?: string
        }
        Update: {
          brand_id?: string
          created_at?: string
          id?: string
          metadata?: Json
          org_id?: string
          original_image_url?: string | null
          product_url?: string | null
          sku?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      projected_payloads: {
        Row: {
          brand_id: string
          clean_payload: Json
          created_at: string
          developer_id: string
          id: string
          is_wildcard: boolean
          org_id: string
          updated_at: string
          use_case: string
        }
        Insert: {
          brand_id: string
          clean_payload?: Json
          created_at?: string
          developer_id: string
          id?: string
          is_wildcard?: boolean
          org_id: string
          updated_at?: string
          use_case: string
        }
        Update: {
          brand_id?: string
          clean_payload?: Json
          created_at?: string
          developer_id?: string
          id?: string
          is_wildcard?: boolean
          org_id?: string
          updated_at?: string
          use_case?: string
        }
        Relationships: [
          {
            foreignKeyName: "projected_payloads_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projected_payloads_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      runs: {
        Row: {
          created_at: string
          id: string
          metadata: Json | null
          org_id: string
          status: string
          steps: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          metadata?: Json | null
          org_id: string
          status?: string
          steps?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          metadata?: Json | null
          org_id?: string
          status?: string
          steps?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "runs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      style_references: {
        Row: {
          aesthetic_label: string | null
          created_at: string
          embedding: string
          id: string
          image_url: string
          org_id: string
          updated_at: string
        }
        Insert: {
          aesthetic_label?: string | null
          created_at?: string
          embedding: string
          id?: string
          image_url: string
          org_id: string
          updated_at?: string
        }
        Update: {
          aesthetic_label?: string | null
          created_at?: string
          embedding?: string
          id?: string
          image_url?: string
          org_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "style_references_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      surveillance_incidents: {
        Row: {
          created_at: string
          id: string
          org_id: string
          payload: Json
          stream_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          org_id: string
          payload: Json
          stream_id: string
        }
        Update: {
          created_at?: string
          id?: string
          org_id?: string
          payload?: Json
          stream_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "surveillance_incidents_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      surveillance_policies: {
        Row: {
          action: Json
          condition: Json
          created_at: string
          enabled: boolean
          id: string
          name: string
          org_id: string
          stream_id: string
          type: string
          updated_at: string
        }
        Insert: {
          action?: Json
          condition?: Json
          created_at?: string
          enabled?: boolean
          id?: string
          name: string
          org_id: string
          stream_id?: string
          type: string
          updated_at?: string
        }
        Update: {
          action?: Json
          condition?: Json
          created_at?: string
          enabled?: boolean
          id?: string
          name?: string
          org_id?: string
          stream_id?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "surveillance_policies_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      text_assets_vector: {
        Row: {
          content: string
          embedding: string | null
          file_hash: string
          id: string
          metadata: Json
          r2_url: string
          source: string
          title: string
        }
        Insert: {
          content: string
          embedding?: string | null
          file_hash: string
          id?: string
          metadata?: Json
          r2_url: string
          source: string
          title: string
        }
        Update: {
          content?: string
          embedding?: string | null
          file_hash?: string
          id?: string
          metadata?: Json
          r2_url?: string
          source?: string
          title?: string
        }
        Relationships: []
      }
      usage_events: {
        Row: {
          api_key_id: string | null
          cost_cents: number | null
          created_at: string | null
          event_type: string
          id: string
          metadata: Json | null
          tokens_used: number | null
          user_id: string
        }
        Insert: {
          api_key_id?: string | null
          cost_cents?: number | null
          created_at?: string | null
          event_type: string
          id?: string
          metadata?: Json | null
          tokens_used?: number | null
          user_id: string
        }
        Update: {
          api_key_id?: string | null
          cost_cents?: number | null
          created_at?: string | null
          event_type?: string
          id?: string
          metadata?: Json | null
          tokens_used?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "usage_events_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "api_keys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usage_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string
          full_name: string | null
          id: string
          stripe_customer_id: string | null
          subscription_status: string | null
          subscription_tier: string | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email: string
          full_name?: string | null
          id: string
          stripe_customer_id?: string | null
          subscription_status?: string | null
          subscription_tier?: string | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string
          full_name?: string | null
          id?: string
          stripe_customer_id?: string | null
          subscription_status?: string | null
          subscription_tier?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      voice_agents: {
        Row: {
          behaviors: Json
          created_at: string
          extraction_model: string | null
          id: string
          instructions: string
          is_active: boolean
          language: string
          metadata: Json
          name: string
          org_id: string
          output_schema: Json
          output_schema_strict: Json | null
          purpose: string | null
          questions: Json
          system_instruction: string
          updated_at: string
          voice_config: Json
        }
        Insert: {
          behaviors?: Json
          created_at?: string
          extraction_model?: string | null
          id?: string
          instructions: string
          is_active?: boolean
          language?: string
          metadata?: Json
          name: string
          org_id: string
          output_schema?: Json
          output_schema_strict?: Json | null
          purpose?: string | null
          questions?: Json
          system_instruction: string
          updated_at?: string
          voice_config?: Json
        }
        Update: {
          behaviors?: Json
          created_at?: string
          extraction_model?: string | null
          id?: string
          instructions?: string
          is_active?: boolean
          language?: string
          metadata?: Json
          name?: string
          org_id?: string
          output_schema?: Json
          output_schema_strict?: Json | null
          purpose?: string | null
          questions?: Json
          system_instruction?: string
          updated_at?: string
          voice_config?: Json
        }
        Relationships: [
          {
            foreignKeyName: "voice_agents_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      voice_sessions: {
        Row: {
          agent_id: string
          context: Json
          created_at: string
          duration_seconds: number | null
          error_log: string | null
          expires_at: string
          id: string
          livekit_room_name: string
          max_duration_seconds: number | null
          metadata: Json
          org_id: string
          participant: Json
          results: Json | null
          status: string
          transcript: Json | null
          updated_at: string
        }
        Insert: {
          agent_id: string
          context?: Json
          created_at?: string
          duration_seconds?: number | null
          error_log?: string | null
          expires_at: string
          id?: string
          livekit_room_name: string
          max_duration_seconds?: number | null
          metadata?: Json
          org_id: string
          participant?: Json
          results?: Json | null
          status?: string
          transcript?: Json | null
          updated_at?: string
        }
        Update: {
          agent_id?: string
          context?: Json
          created_at?: string
          duration_seconds?: number | null
          error_log?: string | null
          expires_at?: string
          id?: string
          livekit_room_name?: string
          max_duration_seconds?: number | null
          metadata?: Json
          org_id?: string
          participant?: Json
          results?: Json | null
          status?: string
          transcript?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "voice_sessions_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "voice_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voice_sessions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      webhooks: {
        Row: {
          created_at: string
          endpoint_url: string
          id: string
          is_active: boolean
          org_id: string
          secret: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          endpoint_url: string
          id?: string
          is_active?: boolean
          org_id: string
          secret: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          endpoint_url?: string
          id?: string
          is_active?: boolean
          org_id?: string
          secret?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhooks_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      match_localized_ad_references: {
        Args: {
          filter_culture?: string
          filter_industry?: string
          match_count: number
          match_threshold: number
          query_embedding: string
          require_human?: boolean
        }
        Returns: {
          id: string
          master_prompt: string
          metadata: Json
          quality_score: number
          r2_image_url: string
          similarity: number
        }[]
      }
      match_localized_ad_references_v2: {
        Args: {
          filter_culture?: string
          filter_industry?: string
          match_count: number
          match_threshold: number
          query_embedding: string
          require_human?: boolean
        }
        Returns: {
          applied_filters: Json
          combined_score: number
          id: string
          master_prompt: string
          metadata: Json
          quality_score: number
          r2_image_url: string
          similarity: number
          tier: string
        }[]
      }
      match_text_assets: {
        Args: {
          filter_source?: string
          match_count: number
          match_threshold: number
          query_embedding: string
        }
        Returns: {
          id: string
          metadata: Json
          r2_url: string
          similarity: number
          source: string
          title: string
        }[]
      }
    }
    Enums: {
      billing_tier: "free" | "pro" | "enterprise"
      job_status: "queued" | "processing" | "completed" | "failed"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">
type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      billing_tier: ["free", "pro", "enterprise"],
      job_status: ["queued", "processing", "completed", "failed"],
    },
  },
} as const

