import { generateDynamicProjection } from "@/lib/dynamic-projection";
import { getServiceSupabaseClient } from "@/lib/supabase";

export type BrandConditioningResult = {
  active: boolean;
  constraints: string[];
  brandProjection: Record<string, unknown> | null;
};

function toConstraintsFromJson(brandJson: Record<string, unknown>): string[] {
  const constraints: string[] = [];
  const entries = Object.entries(brandJson).slice(0, 20);
  for (const [key, value] of entries) {
    if (typeof value === "string" && value.trim()) {
      constraints.push(`${key}: ${value.trim()}`);
    } else if (typeof value === "number" || typeof value === "boolean") {
      constraints.push(`${key}: ${String(value)}`);
    }
  }
  return constraints;
}

/**
 * Resolves brand identity context from either brand_id or inline brand_identity_json.
 * brand_id takes precedence when both are supplied.
 */
export async function resolveBrandConditioning(params: {
  input: {
    brand_id?: string;
    brand_identity_json?: Record<string, unknown>;
  };
  organizationId: string;
}): Promise<BrandConditioningResult> {
  if (!params.input.brand_id && !params.input.brand_identity_json) {
    return { active: false, constraints: [], brandProjection: null };
  }

  if (params.input.brand_id) {
    const supabase = getServiceSupabaseClient();
    const { data: brand, error } = await supabase
      .from("brands")
      .select("id,org_id,brand_dna")
      .eq("id", params.input.brand_id)
      .maybeSingle();

    if (error || !brand || brand.org_id !== params.organizationId) {
      throw new Error("brand_id not found in your organization.");
    }

    const projection = await generateDynamicProjection({
      useCase: "static marketing ads image generation",
      brandDna: brand.brand_dna,
    });
    return {
      active: true,
      constraints: toConstraintsFromJson(projection),
      brandProjection: projection,
    };
  }

  const inline = params.input.brand_identity_json ?? {};
  return {
    active: true,
    constraints: toConstraintsFromJson(inline),
    brandProjection: inline,
  };
}

