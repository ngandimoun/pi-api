BEGIN;

-- v2: tiered fallback search that prefers strict filters but never returns empty
-- as long as ad_templates_vector contains rows.
--
-- Notes:
-- - Uses HNSW index by ordering on embedding distance per tier.
-- - Applies match_threshold only in tiers A-D; tier E ignores threshold.
-- - Returns diagnostics columns (tier + applied_filters) for observability.

CREATE OR REPLACE FUNCTION public.match_localized_ad_references_v2(
  query_embedding extensions.vector(768),
  match_threshold float,
  match_count int,
  filter_industry text DEFAULT NULL,
  filter_culture text DEFAULT NULL,
  require_human boolean DEFAULT NULL
) RETURNS TABLE (
  id uuid,
  master_prompt text,
  r2_image_url text,
  metadata jsonb,
  similarity float,
  quality_score int,
  combined_score float,
  tier text,
  applied_filters jsonb
) AS $$
BEGIN
  RETURN QUERY
  WITH tiers AS (
    -- Tier A: strict (all provided filters + threshold)
    (
      SELECT
        v.id,
        v.master_prompt,
        v.r2_image_url,
        v.metadata,
        1 - (v.embedding <=> query_embedding) AS similarity,
        v.quality_score,
        (1 - (v.embedding <=> query_embedding)) * (v.quality_score / 10.0) AS combined_score,
        'strict'::text AS tier,
        jsonb_build_object(
          'filter_industry', filter_industry,
          'filter_culture', filter_culture,
          'require_human', require_human,
          'match_threshold_applied', true
        ) AS applied_filters,
        1 AS tier_rank
      FROM public.ad_templates_vector v
      WHERE (filter_industry IS NULL OR v.metadata->>'industry' = filter_industry)
        AND (filter_culture IS NULL OR v.metadata->'culture'->>'vibe' = filter_culture)
        AND (
          require_human IS NULL
          OR (v.metadata->'demographics'->>'has_human')::boolean = require_human
        )
        AND 1 - (v.embedding <=> query_embedding) > match_threshold
      ORDER BY (v.embedding <=> query_embedding) ASC
      LIMIT 200
    )

    UNION ALL

    -- Tier B: relax culture (industry + require_human + threshold)
    (
      SELECT
        v.id,
        v.master_prompt,
        v.r2_image_url,
        v.metadata,
        1 - (v.embedding <=> query_embedding) AS similarity,
        v.quality_score,
        (1 - (v.embedding <=> query_embedding)) * (v.quality_score / 10.0) AS combined_score,
        'relax_culture'::text AS tier,
        jsonb_build_object(
          'filter_industry', filter_industry,
          'filter_culture', NULL,
          'require_human', require_human,
          'match_threshold_applied', true
        ) AS applied_filters,
        2 AS tier_rank
      FROM public.ad_templates_vector v
      WHERE (filter_industry IS NULL OR v.metadata->>'industry' = filter_industry)
        AND (
          require_human IS NULL
          OR (v.metadata->'demographics'->>'has_human')::boolean = require_human
        )
        AND 1 - (v.embedding <=> query_embedding) > match_threshold
      ORDER BY (v.embedding <=> query_embedding) ASC
      LIMIT 200
    )

    UNION ALL

    -- Tier C: relax industry (culture + require_human + threshold)
    (
      SELECT
        v.id,
        v.master_prompt,
        v.r2_image_url,
        v.metadata,
        1 - (v.embedding <=> query_embedding) AS similarity,
        v.quality_score,
        (1 - (v.embedding <=> query_embedding)) * (v.quality_score / 10.0) AS combined_score,
        'relax_industry'::text AS tier,
        jsonb_build_object(
          'filter_industry', NULL,
          'filter_culture', filter_culture,
          'require_human', require_human,
          'match_threshold_applied', true
        ) AS applied_filters,
        3 AS tier_rank
      FROM public.ad_templates_vector v
      WHERE (filter_culture IS NULL OR v.metadata->'culture'->>'vibe' = filter_culture)
        AND (
          require_human IS NULL
          OR (v.metadata->'demographics'->>'has_human')::boolean = require_human
        )
        AND 1 - (v.embedding <=> query_embedding) > match_threshold
      ORDER BY (v.embedding <=> query_embedding) ASC
      LIMIT 200
    )

    UNION ALL

    -- Tier D: relax human requirement (culture + industry + threshold)
    (
      SELECT
        v.id,
        v.master_prompt,
        v.r2_image_url,
        v.metadata,
        1 - (v.embedding <=> query_embedding) AS similarity,
        v.quality_score,
        (1 - (v.embedding <=> query_embedding)) * (v.quality_score / 10.0) AS combined_score,
        'relax_human'::text AS tier,
        jsonb_build_object(
          'filter_industry', filter_industry,
          'filter_culture', filter_culture,
          'require_human', NULL,
          'match_threshold_applied', true
        ) AS applied_filters,
        4 AS tier_rank
      FROM public.ad_templates_vector v
      WHERE (filter_industry IS NULL OR v.metadata->>'industry' = filter_industry)
        AND (filter_culture IS NULL OR v.metadata->'culture'->>'vibe' = filter_culture)
        AND 1 - (v.embedding <=> query_embedding) > match_threshold
      ORDER BY (v.embedding <=> query_embedding) ASC
      LIMIT 200
    )

    UNION ALL

    -- Tier E: global fallback (no threshold, no filters) => always returns if table has rows
    (
      SELECT
        v.id,
        v.master_prompt,
        v.r2_image_url,
        v.metadata,
        1 - (v.embedding <=> query_embedding) AS similarity,
        v.quality_score,
        (1 - (v.embedding <=> query_embedding)) * (v.quality_score / 10.0) AS combined_score,
        'global'::text AS tier,
        jsonb_build_object(
          'filter_industry', NULL,
          'filter_culture', NULL,
          'require_human', NULL,
          'match_threshold_applied', false
        ) AS applied_filters,
        5 AS tier_rank
      FROM public.ad_templates_vector v
      ORDER BY (v.embedding <=> query_embedding) ASC
      LIMIT 400
    )
  )
  SELECT
    t.id,
    t.master_prompt,
    t.r2_image_url,
    t.metadata,
    t.similarity,
    t.quality_score,
    t.combined_score,
    t.tier,
    t.applied_filters
  FROM tiers t
  ORDER BY t.tier_rank ASC, t.combined_score DESC
  LIMIT match_count;
END;
$$ LANGUAGE plpgsql;

COMMIT;

