-- ============================================================
-- MIGRATION 002 — tables catalogue
-- JEUX DE TYPO
-- Requiert PostgreSQL 13+ et le schéma app (migration 001)
-- ============================================================

-- ============================================================
-- 1. ENUMS catalogue (tous dans le schéma app)
-- ============================================================

CREATE TYPE app.primary_category_enum AS ENUM (
  'sans_serif', 'serif', 'mono', 'display'
);

CREATE TYPE app.sub_category_enum AS ENUM (
  'neo_grotesk', 'humanist', 'geometric',
  'transitional', 'old_style', 'didone',
  'slab', 'grotesk', 'script'
);

CREATE TYPE app.difficulty_base_enum AS ENUM (
  'easy', 'medium', 'hard'
);

CREATE TYPE app.rarity_tag_enum AS ENUM (
  'common', 'uncommon', 'rare'
);

CREATE TYPE app.dreyfus_tier_enum AS ENUM (
  'N', 'D', 'C', 'A', 'E'
);

CREATE TYPE app.font_source_enum AS ENUM (
  'google', 'local', 'future'
);

CREATE TYPE app.year_tag_enum AS ENUM (
  'classic',
  'modern',
  'contemporary'
);

CREATE TYPE app.weight_structure_enum AS ENUM (
  'single_weight', 'regular_to_bold', 'light_to_black'
);

CREATE TYPE app.contrast_profile_enum AS ENUM (
  'low', 'medium', 'high', 'very_high'
);

CREATE TYPE app.aperture_profile_enum AS ENUM (
  'open', 'semi_open', 'closed'
);

CREATE TYPE app.qa_status_enum AS ENUM (
  'draft', 'review', 'approved', 'deprecated'
);

CREATE TYPE app.license_type_enum AS ENUM (
  'ofl',
  'apache2',
  'proprietary',
  'unknown'
);

-- ============================================================
-- 2. typefaces_core
-- Source de vérité statique. Aucune donnée utilisateur.
-- ============================================================

CREATE TABLE typefaces_core (
  typeface_slug           text                        PRIMARY KEY
                            CHECK (typeface_slug ~ '^[a-z0-9_]+$'),
  display_name            text                        NOT NULL,
  display_name_ascii      text                        NOT NULL,

  primary_category        app.primary_category_enum   NOT NULL,
  sub_category            app.sub_category_enum       NOT NULL,
  visual_cluster_id       text                        NOT NULL,

  dreyfus_tier            app.dreyfus_tier_enum       NOT NULL,
  difficulty_base         app.difficulty_base_enum    NOT NULL,
  rarity_tag              app.rarity_tag_enum         NOT NULL,

  activation_status       boolean                     NOT NULL DEFAULT false,
  font_source             app.font_source_enum        NOT NULL,
  is_variable_font        boolean                     NOT NULL DEFAULT false,

  release_year            smallint
                            CHECK (release_year BETWEEN 1800 AND 2100),
  designer                text,
  foundry                 text,
  license_type            app.license_type_enum       NOT NULL DEFAULT 'unknown',
  license_url             text,

  year_tag                app.year_tag_enum           NOT NULL,
  weight_structure        app.weight_structure_enum   NOT NULL,
  contrast_profile        app.contrast_profile_enum   NOT NULL,
  aperture_profile        app.aperture_profile_enum   NOT NULL,
  fallback_stack          text,

  structural_signature_json jsonb                     NOT NULL,

  expert_enabled          boolean                     NOT NULL DEFAULT false,
  min_mode                text                        NOT NULL DEFAULT 'training'
                            CHECK (min_mode IN ('training', 'competition', 'expert')),

  qa_status               app.qa_status_enum          NOT NULL DEFAULT 'draft',
  updated_at_utc          timestamptz                 NOT NULL DEFAULT now(),

  CONSTRAINT chk_future_inactive
    CHECK (font_source <> 'future' OR activation_status = false),

  CONSTRAINT chk_contrast_coherence
    CHECK (contrast_profile::text = (structural_signature_json->>'contrast')),

  CONSTRAINT chk_aperture_coherence
    CHECK (aperture_profile::text = (structural_signature_json->>'e_aperture')),

  CONSTRAINT chk_expert_needs_display_name_ascii
    CHECK (NOT expert_enabled OR display_name_ascii IS NOT NULL)
);

CREATE INDEX idx_tc_cluster
  ON typefaces_core (visual_cluster_id, contrast_profile, aperture_profile);

CREATE INDEX idx_tc_dreyfus_rarity
  ON typefaces_core (dreyfus_tier, rarity_tag, activation_status);

CREATE INDEX idx_tc_qa
  ON typefaces_core (qa_status)
  WHERE qa_status <> 'approved';

-- ============================================================
-- 3. font_runtime_assets
-- Fichiers concrets à charger dans le navigateur.
-- ============================================================

CREATE TYPE app.runtime_status_enum AS ENUM (
  'ready', 'missing', 'error'
);

CREATE TABLE font_runtime_assets (
  asset_id            uuid                    PRIMARY KEY DEFAULT gen_random_uuid(),
  typeface_slug       text                    NOT NULL
                          REFERENCES typefaces_core (typeface_slug)
                          ON DELETE RESTRICT,

  font_format         text                    NOT NULL DEFAULT 'woff2'
                          CHECK (font_format IN ('woff2', 'woff', 'ttf')),
  weight              smallint                NOT NULL
                          CHECK (weight BETWEEN 100 AND 900),
  style               text                    NOT NULL DEFAULT 'normal'
                          CHECK (style IN ('normal', 'italic')),
  relative_path       text                    NOT NULL,

  file_size_bytes     int
                          CHECK (file_size_bytes > 0),
  sha256_hash         text,
  runtime_status      app.runtime_status_enum NOT NULL DEFAULT 'missing',

  verified_at_utc     timestamptz,
  updated_at_utc      timestamptz             NOT NULL DEFAULT now(),

  CONSTRAINT uq_asset_slug_weight_style
    UNIQUE (typeface_slug, weight, style)
);

CREATE INDEX idx_fra_slug
  ON font_runtime_assets (typeface_slug, runtime_status);

CREATE VIEW v_missing_runtime_assets AS
  SELECT tc.typeface_slug, tc.display_name, tc.activation_status
  FROM typefaces_core tc
  WHERE tc.activation_status = true
    AND NOT EXISTS (
      SELECT 1
      FROM font_runtime_assets fra
      WHERE fra.typeface_slug = tc.typeface_slug
        AND fra.runtime_status = 'ready'
    );

-- ============================================================
-- 4. expert_answer_keys
-- Réponses texte autorisées en mode Expert.
-- ============================================================

CREATE TABLE expert_answer_keys (
  answer_key_id       uuid                  PRIMARY KEY DEFAULT gen_random_uuid(),
  typeface_slug       text                  NOT NULL
                          REFERENCES typefaces_core (typeface_slug)
                          ON DELETE RESTRICT,

  answer_text         text                  NOT NULL,
  answer_normalized   text                  NOT NULL,
  is_canonical        boolean               NOT NULL DEFAULT false,
  locale              text                  NOT NULL DEFAULT 'any'
                          CHECK (locale IN ('any', 'fr', 'en')),

  qa_status           app.qa_status_enum    NOT NULL DEFAULT 'draft',
  updated_at_utc      timestamptz           NOT NULL DEFAULT now(),

  CONSTRAINT uq_answer_normalized_slug
    UNIQUE (typeface_slug, answer_normalized)
);

CREATE UNIQUE INDEX uq_eak_one_canonical_per_slug
  ON expert_answer_keys (typeface_slug)
  WHERE is_canonical = true;

CREATE INDEX idx_eak_slug
  ON expert_answer_keys (typeface_slug, qa_status);

CREATE INDEX idx_eak_normalized
  ON expert_answer_keys (answer_normalized);

-- ============================================================
-- 5. QA RULES — contraintes cross-tables
-- ============================================================

CREATE VIEW v_qa_active_no_asset AS
  SELECT tc.typeface_slug, 'active_typeface_missing_runtime_asset' AS rule
  FROM typefaces_core tc
  WHERE tc.activation_status = true
    AND NOT EXISTS (
      SELECT 1
      FROM font_runtime_assets fra
      WHERE fra.typeface_slug = tc.typeface_slug
        AND fra.runtime_status = 'ready'
    );

CREATE VIEW v_qa_expert_no_canonical AS
  SELECT tc.typeface_slug, 'expert_enabled_missing_canonical_answer' AS rule
  FROM typefaces_core tc
  WHERE tc.expert_enabled = true
    AND NOT EXISTS (
      SELECT 1
      FROM expert_answer_keys eak
      WHERE eak.typeface_slug = tc.typeface_slug
        AND eak.is_canonical = true
        AND eak.qa_status = 'approved'
    );

CREATE VIEW v_qa_unknown_license AS
  SELECT tc.typeface_slug, 'license_type_unknown' AS rule
  FROM typefaces_core tc
  WHERE tc.license_type = 'unknown'
    AND tc.activation_status = true;
