-- ============================================================
-- MIGRATION 016 : les 108 polices du projet web Adobe entrent au catalogue
-- Genere par scripts/build_adobe_catalog_migration.py le 2026-08-23
-- NON APPLIQUEE. Elle demande le feu vert explicite du proprietaire.
-- Requiert la migration 015, qui cree les valeurs d'enum 'adobe' et 'adobe_fonts'.
-- Retour arriere : 016_adobe_catalog_rows.rollback.sql
-- ============================================================
--
-- CE QU'ELLE FAIT. 4 lignes deja au catalogue mais eteintes faute de licence se
-- rallument, servies par Adobe : arial, courier_new, georgia, times_new_roman.
-- 104 lignes nouvelles entrent. Les 108 reparties par categorie : 56 sans serif,
-- 48 serif, 2 monospace, 2 dessinees.
--
-- CE QUI VIENT D'ADOBE ET CE QUI VIENT DU SCRIPT, la distinction est le point de la revue.
--   D'Adobe, sans retouche : le nom exact de la famille et le nom de famille CSS
--   que sert leur feuille. primary_category vient aussi d'eux, SAUF pour 20 familles
--   ou leur API ment : elle rend "sans-serif" pour Times New Roman, Georgia,
--   Rockwell, Bodoni Std, Courier New et quinze autres. Ces 20 exceptions sont
--   nommees une par une dans le script generateur et tranchees contre Adobe.
--   Du script, par regle mecanique, donc a relire : sub_category deduite du nom,
--   visual_cluster_id qui en decoule, dreyfus_tier a 'N', et le couple
--   rarity_tag / difficulty_base decrit juste en dessous.
--
-- UNE POLICE CANONIQUE PAR FAMILLE, ET C'EST LA DECISION QUI COMPTE.
-- Le projet web sert 108 lignes mais seulement 30 familles reelles : sept
-- Baskerville, douze Franklin Gothic, huit Gill Sans Nova, sept Futura. Mesure faite
-- sur une branche de base jetable le 2026-08-23, en appliquant cette migration puis en
-- semant un joueur neuf : il recevait 30 polices dont 14 Adobe, et parmi elles
-- Baskerville URW Regular Oblique et Franklin Gothic URW Extra Compressed. C'est
-- l'inverse du but du jeu, qui est de reconnaitre les polices les plus connues au
-- monde et non de distinguer la Baskerville d'URW de celle de Berthold.
-- Donc 30 lignes canoniques restent common et easy, atteignables des le premier
-- pool, et 78 variantes passent en uncommon et medium. init_user_pool ne seme que
-- du common, et try_unlock n'ouvre le uncommon qu'a partir du niveau Dreyfus D :
-- les variantes existent, elles se jouent, mais plus tard.
--
-- UN SEUL DE CES CHAMPS DERIVES CHANGE LE JEU : visual_cluster_id. Les deux
-- fournisseurs s'en servent pour choisir les mauvaises reponses, une police du meme
-- cluster faisant un leurre plus dur. year_tag, contrast_profile et aperture_profile
-- ne sont lus par aucun code de jeu : colonnes NOT NULL a remplir, pas des reglages.
-- structural_signature_json porte les onze cles du reste du catalogue, avec null
-- partout ou la valeur est inconnue ; deux de ses cles sont obligees par
-- chk_contrast_coherence et chk_aperture_coherence a valoir la colonne correspondante.
--
-- designer, foundry et release_year restent NULL. L'API du projet web ne les donne
-- pas, et les inventer serait pire que les laisser vides.
--
-- expert_enabled reste false. expert_answer_keys porte une reponse canonique pour
-- chacune des 2032 lignes du catalogue et aucune pour ces 104 la : les activer en
-- expert donnerait une police sans reponse acceptee. Rien ne casse aujourd'hui,
-- app/play/expert/page.tsx est un placeholder de 29 lignes sans API et aucun code
-- de runtime ne lit expert_answer_keys, mais le jour ou le mode expert sera ecrit
-- ces 104 lignes seraient injouables. Les laisser a false, c'est ne pas poser la
-- mine maintenant.
--
-- LA VUE v_qa_active_no_asset PASSERA DE 0 A 104 LIGNES. Elle liste les polices
-- actives sans fichier dans font_runtime_assets, et c'est precisement le cas d'une
-- police Adobe : il n'y a pas de fichier chez nous et il n'y en aura jamais. Ce
-- n'est pas une contrainte, rien n'echoue, mais la vue cesse d'etre un signal utile
-- pour les polices Google. Le controle equivalent pour Adobe est ailleurs :
-- npm run check:adobe-migration verifie que le nom de famille CSS de chaque ligne
-- est bien celui que sert la feuille du projet web.
--
-- Toutes les lignes sortent en qa_status = 'review', la colonne prevue exactement
-- pour dire qu'aucun oeil humain n'est encore passe.
--
-- AUCUN FICHIER DE POLICE N'EST TELECHARGE, les conditions d'Adobe l'interdisent.
-- Le rendu passe par la feuille du projet web,
-- https://use.typekit.net/ozq5yfs.css,
-- chargee dans app/layout.tsx, et chaque ligne porte dans fallback_stack le nom de
-- famille exact que cette feuille declare.
--
-- LE PROJET WEB EST VERROUILLE SUR SES DOMAINES, aujourd'hui localhost et 127.0.0.1.
-- AJOUTER LE DOMAINE DE PRODUCTION AVANT LA MISE EN LIGNE, sinon ces 108 polices ne
-- s'afficheront pas et le joueur devra nommer une typo absente de son ecran.
--
-- SI L'ABONNEMENT CREATIVE CLOUD S'ARRETE, ces polices cessent de s'afficher. Ces
-- lignes sont une COUCHE, jamais le socle : le fichier de retour arriere les eteint
-- toutes et le jeu retombe sur ses seules polices libres.
--
-- PIEGE DE REIMPORT, meme convention que 010, 013, 014 et 015. Le prochain passage de
-- scripts/import_catalog_json.py fait ON CONFLICT DO UPDATE sur font_source et
-- license_type depuis content/catalog/typefaces-core.json. Tant que ce JSON ne porte
-- pas ces lignes, un reimport eteindrait tout ce lot.

BEGIN;

-- Arial : ligne deja au catalogue, eteinte faute de licence.
-- Categorie, cluster et signature d'origine conserves : ils ont ete revus a la main.
UPDATE typefaces_core SET
  font_source = 'adobe',
  license_type = 'adobe_fonts',
  activation_status = true,
  rarity_tag = 'common',
  difficulty_base = 'easy',
  fallback_stack = '"arial", sans-serif',
  qa_status = 'review',
  updated_at_utc = now()
WHERE typeface_slug = 'arial';

-- Courier New : ligne deja au catalogue, eteinte faute de licence.
-- Categorie, cluster et signature d'origine conserves : ils ont ete revus a la main.
UPDATE typefaces_core SET
  font_source = 'adobe',
  license_type = 'adobe_fonts',
  activation_status = true,
  rarity_tag = 'common',
  difficulty_base = 'easy',
  fallback_stack = '"courier-new", monospace',
  qa_status = 'review',
  updated_at_utc = now()
WHERE typeface_slug = 'courier_new';

-- Georgia : ligne deja au catalogue, eteinte faute de licence.
-- Categorie, cluster et signature d'origine conserves : ils ont ete revus a la main.
UPDATE typefaces_core SET
  font_source = 'adobe',
  license_type = 'adobe_fonts',
  activation_status = true,
  rarity_tag = 'common',
  difficulty_base = 'easy',
  fallback_stack = '"georgia", serif',
  qa_status = 'review',
  updated_at_utc = now()
WHERE typeface_slug = 'georgia';

-- Times New Roman : ligne deja au catalogue, eteinte faute de licence.
-- Categorie, cluster et signature d'origine conserves : ils ont ete revus a la main.
UPDATE typefaces_core SET
  font_source = 'adobe',
  license_type = 'adobe_fonts',
  activation_status = true,
  rarity_tag = 'common',
  difficulty_base = 'easy',
  fallback_stack = '"times-new-roman", serif',
  qa_status = 'review',
  updated_at_utc = now()
WHERE typeface_slug = 'times_new_roman';

INSERT INTO typefaces_core (
  typeface_slug, display_name, display_name_ascii,
  primary_category, sub_category, visual_cluster_id,
  dreyfus_tier, difficulty_base, rarity_tag,
  activation_status, font_source, license_type, license_url,
  is_variable_font, designer, foundry, release_year,
  year_tag, weight_structure, contrast_profile, aperture_profile,
  fallback_stack, structural_signature_json,
  expert_enabled, min_mode, qa_status
) VALUES (
  'adobe_caslon_pro', 'Adobe Caslon Pro', 'Adobe Caslon Pro',
  'serif', 'old_style', 'cluster_oldstyle_A',
  'N', 'easy', 'common',
  true, 'adobe', 'adobe_fonts', 'https://fonts.adobe.com/fonts/adobe-caslon-pro',
  false, NULL, NULL, NULL,
  'classic', 'single_weight', 'medium', 'semi_open',
  '"adobe-caslon-pro", serif', '{"a_type": null, "e_aperture": "semi_open", "axis": null, "contrast": "medium", "terminals": null, "serifs": "present", "x_height": null, "fixed_width": false, "width": "normal", "caps_only": false, "distinctive_w": false}'::jsonb,
  false, 'training', 'review'
)
ON CONFLICT (typeface_slug) DO UPDATE SET
  font_source = EXCLUDED.font_source,
  license_type = EXCLUDED.license_type,
  activation_status = EXCLUDED.activation_status,
  fallback_stack = EXCLUDED.fallback_stack,
  qa_status = EXCLUDED.qa_status,
  updated_at_utc = now();

INSERT INTO typefaces_core (
  typeface_slug, display_name, display_name_ascii,
  primary_category, sub_category, visual_cluster_id,
  dreyfus_tier, difficulty_base, rarity_tag,
  activation_status, font_source, license_type, license_url,
  is_variable_font, designer, foundry, release_year,
  year_tag, weight_structure, contrast_profile, aperture_profile,
  fallback_stack, structural_signature_json,
  expert_enabled, min_mode, qa_status
) VALUES (
  'adobe_garamond_pro', 'Adobe Garamond Pro', 'Adobe Garamond Pro',
  'serif', 'old_style', 'cluster_oldstyle_A',
  'N', 'easy', 'common',
  true, 'adobe', 'adobe_fonts', 'https://fonts.adobe.com/fonts/adobe-garamond-pro',
  false, NULL, NULL, NULL,
  'classic', 'single_weight', 'medium', 'semi_open',
  '"adobe-garamond-pro", serif', '{"a_type": null, "e_aperture": "semi_open", "axis": null, "contrast": "medium", "terminals": null, "serifs": "present", "x_height": null, "fixed_width": false, "width": "normal", "caps_only": false, "distinctive_w": false}'::jsonb,
  false, 'training', 'review'
)
ON CONFLICT (typeface_slug) DO UPDATE SET
  font_source = EXCLUDED.font_source,
  license_type = EXCLUDED.license_type,
  activation_status = EXCLUDED.activation_status,
  fallback_stack = EXCLUDED.fallback_stack,
  qa_status = EXCLUDED.qa_status,
  updated_at_utc = now();

INSERT INTO typefaces_core (
  typeface_slug, display_name, display_name_ascii,
  primary_category, sub_category, visual_cluster_id,
  dreyfus_tier, difficulty_base, rarity_tag,
  activation_status, font_source, license_type, license_url,
  is_variable_font, designer, foundry, release_year,
  year_tag, weight_structure, contrast_profile, aperture_profile,
  fallback_stack, structural_signature_json,
  expert_enabled, min_mode, qa_status
) VALUES (
  'arial_narrow', 'Arial Narrow', 'Arial Narrow',
  'sans_serif', 'neo_grotesk', 'cluster_neo_grotesk_A',
  'N', 'medium', 'uncommon',
  true, 'adobe', 'adobe_fonts', 'https://fonts.adobe.com/fonts/arial-narrow',
  false, NULL, NULL, NULL,
  'classic', 'single_weight', 'low', 'semi_open',
  '"arial-narrow", sans-serif', '{"a_type": null, "e_aperture": "semi_open", "axis": null, "contrast": "low", "terminals": null, "serifs": null, "x_height": null, "fixed_width": false, "width": "normal", "caps_only": false, "distinctive_w": false}'::jsonb,
  false, 'training', 'review'
)
ON CONFLICT (typeface_slug) DO UPDATE SET
  font_source = EXCLUDED.font_source,
  license_type = EXCLUDED.license_type,
  activation_status = EXCLUDED.activation_status,
  fallback_stack = EXCLUDED.fallback_stack,
  qa_status = EXCLUDED.qa_status,
  updated_at_utc = now();

INSERT INTO typefaces_core (
  typeface_slug, display_name, display_name_ascii,
  primary_category, sub_category, visual_cluster_id,
  dreyfus_tier, difficulty_base, rarity_tag,
  activation_status, font_source, license_type, license_url,
  is_variable_font, designer, foundry, release_year,
  year_tag, weight_structure, contrast_profile, aperture_profile,
  fallback_stack, structural_signature_json,
  expert_enabled, min_mode, qa_status
) VALUES (
  'arial_nova', 'Arial Nova', 'Arial Nova',
  'sans_serif', 'neo_grotesk', 'cluster_neo_grotesk_A',
  'N', 'medium', 'uncommon',
  true, 'adobe', 'adobe_fonts', 'https://fonts.adobe.com/fonts/arial-nova',
  false, NULL, NULL, NULL,
  'classic', 'single_weight', 'low', 'semi_open',
  '"arial-nova", sans-serif', '{"a_type": null, "e_aperture": "semi_open", "axis": null, "contrast": "low", "terminals": null, "serifs": null, "x_height": null, "fixed_width": false, "width": "normal", "caps_only": false, "distinctive_w": false}'::jsonb,
  false, 'training', 'review'
)
ON CONFLICT (typeface_slug) DO UPDATE SET
  font_source = EXCLUDED.font_source,
  license_type = EXCLUDED.license_type,
  activation_status = EXCLUDED.activation_status,
  fallback_stack = EXCLUDED.fallback_stack,
  qa_status = EXCLUDED.qa_status,
  updated_at_utc = now();

INSERT INTO typefaces_core (
  typeface_slug, display_name, display_name_ascii,
  primary_category, sub_category, visual_cluster_id,
  dreyfus_tier, difficulty_base, rarity_tag,
  activation_status, font_source, license_type, license_url,
  is_variable_font, designer, foundry, release_year,
  year_tag, weight_structure, contrast_profile, aperture_profile,
  fallback_stack, structural_signature_json,
  expert_enabled, min_mode, qa_status
) VALUES (
  'arial_nova_condensed', 'Arial Nova Condensed', 'Arial Nova Condensed',
  'sans_serif', 'neo_grotesk', 'cluster_neo_grotesk_A',
  'N', 'medium', 'uncommon',
  true, 'adobe', 'adobe_fonts', 'https://fonts.adobe.com/fonts/arial-nova-condensed',
  false, NULL, NULL, NULL,
  'classic', 'single_weight', 'low', 'semi_open',
  '"arial-nova-condensed", sans-serif', '{"a_type": null, "e_aperture": "semi_open", "axis": null, "contrast": "low", "terminals": null, "serifs": null, "x_height": null, "fixed_width": false, "width": "normal", "caps_only": false, "distinctive_w": false}'::jsonb,
  false, 'training', 'review'
)
ON CONFLICT (typeface_slug) DO UPDATE SET
  font_source = EXCLUDED.font_source,
  license_type = EXCLUDED.license_type,
  activation_status = EXCLUDED.activation_status,
  fallback_stack = EXCLUDED.fallback_stack,
  qa_status = EXCLUDED.qa_status,
  updated_at_utc = now();

INSERT INTO typefaces_core (
  typeface_slug, display_name, display_name_ascii,
  primary_category, sub_category, visual_cluster_id,
  dreyfus_tier, difficulty_base, rarity_tag,
  activation_status, font_source, license_type, license_url,
  is_variable_font, designer, foundry, release_year,
  year_tag, weight_structure, contrast_profile, aperture_profile,
  fallback_stack, structural_signature_json,
  expert_enabled, min_mode, qa_status
) VALUES (
  'arial_rounded_mt_pro', 'Arial Rounded MT Pro', 'Arial Rounded MT Pro',
  'sans_serif', 'neo_grotesk', 'cluster_neo_grotesk_A',
  'N', 'medium', 'uncommon',
  true, 'adobe', 'adobe_fonts', 'https://fonts.adobe.com/fonts/arial-rounded-mt-pro',
  false, NULL, NULL, NULL,
  'classic', 'single_weight', 'low', 'semi_open',
  '"arial-rounded-mt-pro", sans-serif', '{"a_type": null, "e_aperture": "semi_open", "axis": null, "contrast": "low", "terminals": null, "serifs": null, "x_height": null, "fixed_width": false, "width": "normal", "caps_only": false, "distinctive_w": false}'::jsonb,
  false, 'training', 'review'
)
ON CONFLICT (typeface_slug) DO UPDATE SET
  font_source = EXCLUDED.font_source,
  license_type = EXCLUDED.license_type,
  activation_status = EXCLUDED.activation_status,
  fallback_stack = EXCLUDED.fallback_stack,
  qa_status = EXCLUDED.qa_status,
  updated_at_utc = now();

INSERT INTO typefaces_core (
  typeface_slug, display_name, display_name_ascii,
  primary_category, sub_category, visual_cluster_id,
  dreyfus_tier, difficulty_base, rarity_tag,
  activation_status, font_source, license_type, license_url,
  is_variable_font, designer, foundry, release_year,
  year_tag, weight_structure, contrast_profile, aperture_profile,
  fallback_stack, structural_signature_json,
  expert_enabled, min_mode, qa_status
) VALUES (
  'baskerville_bt', 'Baskerville BT', 'Baskerville BT',
  'serif', 'transitional', 'cluster_transitional_A',
  'N', 'medium', 'uncommon',
  true, 'adobe', 'adobe_fonts', 'https://fonts.adobe.com/fonts/baskerville-bt',
  false, NULL, NULL, NULL,
  'classic', 'single_weight', 'medium', 'semi_open',
  '"baskerville-bt", serif', '{"a_type": null, "e_aperture": "semi_open", "axis": null, "contrast": "medium", "terminals": null, "serifs": "present", "x_height": null, "fixed_width": false, "width": "normal", "caps_only": false, "distinctive_w": false}'::jsonb,
  false, 'training', 'review'
)
ON CONFLICT (typeface_slug) DO UPDATE SET
  font_source = EXCLUDED.font_source,
  license_type = EXCLUDED.license_type,
  activation_status = EXCLUDED.activation_status,
  fallback_stack = EXCLUDED.fallback_stack,
  qa_status = EXCLUDED.qa_status,
  updated_at_utc = now();

INSERT INTO typefaces_core (
  typeface_slug, display_name, display_name_ascii,
  primary_category, sub_category, visual_cluster_id,
  dreyfus_tier, difficulty_base, rarity_tag,
  activation_status, font_source, license_type, license_url,
  is_variable_font, designer, foundry, release_year,
  year_tag, weight_structure, contrast_profile, aperture_profile,
  fallback_stack, structural_signature_json,
  expert_enabled, min_mode, qa_status
) VALUES (
  'baskerville_display_pt', 'Baskerville Display PT', 'Baskerville Display PT',
  'serif', 'transitional', 'cluster_transitional_A',
  'N', 'medium', 'uncommon',
  true, 'adobe', 'adobe_fonts', 'https://fonts.adobe.com/fonts/baskerville-display-pt',
  false, NULL, NULL, NULL,
  'classic', 'single_weight', 'medium', 'semi_open',
  '"baskerville-display-pt", serif', '{"a_type": null, "e_aperture": "semi_open", "axis": null, "contrast": "medium", "terminals": null, "serifs": "present", "x_height": null, "fixed_width": false, "width": "normal", "caps_only": false, "distinctive_w": false}'::jsonb,
  false, 'training', 'review'
)
ON CONFLICT (typeface_slug) DO UPDATE SET
  font_source = EXCLUDED.font_source,
  license_type = EXCLUDED.license_type,
  activation_status = EXCLUDED.activation_status,
  fallback_stack = EXCLUDED.fallback_stack,
  qa_status = EXCLUDED.qa_status,
  updated_at_utc = now();

INSERT INTO typefaces_core (
  typeface_slug, display_name, display_name_ascii,
  primary_category, sub_category, visual_cluster_id,
  dreyfus_tier, difficulty_base, rarity_tag,
  activation_status, font_source, license_type, license_url,
  is_variable_font, designer, foundry, release_year,
  year_tag, weight_structure, contrast_profile, aperture_profile,
  fallback_stack, structural_signature_json,
  expert_enabled, min_mode, qa_status
) VALUES (
  'baskerville_no2', 'Baskerville No2', 'Baskerville No2',
  'serif', 'transitional', 'cluster_transitional_A',
  'N', 'medium', 'uncommon',
  true, 'adobe', 'adobe_fonts', 'https://fonts.adobe.com/fonts/baskerville-no2',
  false, NULL, NULL, NULL,
  'classic', 'single_weight', 'medium', 'semi_open',
  '"baskerville-no2", serif', '{"a_type": null, "e_aperture": "semi_open", "axis": null, "contrast": "medium", "terminals": null, "serifs": "present", "x_height": null, "fixed_width": false, "width": "normal", "caps_only": false, "distinctive_w": false}'::jsonb,
  false, 'training', 'review'
)
ON CONFLICT (typeface_slug) DO UPDATE SET
  font_source = EXCLUDED.font_source,
  license_type = EXCLUDED.license_type,
  activation_status = EXCLUDED.activation_status,
  fallback_stack = EXCLUDED.fallback_stack,
  qa_status = EXCLUDED.qa_status,
  updated_at_utc = now();

INSERT INTO typefaces_core (
  typeface_slug, display_name, display_name_ascii,
  primary_category, sub_category, visual_cluster_id,
  dreyfus_tier, difficulty_base, rarity_tag,
  activation_status, font_source, license_type, license_url,
  is_variable_font, designer, foundry, release_year,
  year_tag, weight_structure, contrast_profile, aperture_profile,
  fallback_stack, structural_signature_json,
  expert_enabled, min_mode, qa_status
) VALUES (
  'baskerville_poster_pt', 'Baskerville Poster PT', 'Baskerville Poster PT',
  'serif', 'transitional', 'cluster_transitional_A',
  'N', 'medium', 'uncommon',
  true, 'adobe', 'adobe_fonts', 'https://fonts.adobe.com/fonts/baskerville-poster-pt',
  false, NULL, NULL, NULL,
  'classic', 'single_weight', 'medium', 'semi_open',
  '"baskerville-poster-pt", serif', '{"a_type": null, "e_aperture": "semi_open", "axis": null, "contrast": "medium", "terminals": null, "serifs": "present", "x_height": null, "fixed_width": false, "width": "normal", "caps_only": false, "distinctive_w": false}'::jsonb,
  false, 'training', 'review'
)
ON CONFLICT (typeface_slug) DO UPDATE SET
  font_source = EXCLUDED.font_source,
  license_type = EXCLUDED.license_type,
  activation_status = EXCLUDED.activation_status,
  fallback_stack = EXCLUDED.fallback_stack,
  qa_status = EXCLUDED.qa_status,
  updated_at_utc = now();

INSERT INTO typefaces_core (
  typeface_slug, display_name, display_name_ascii,
  primary_category, sub_category, visual_cluster_id,
  dreyfus_tier, difficulty_base, rarity_tag,
  activation_status, font_source, license_type, license_url,
  is_variable_font, designer, foundry, release_year,
  year_tag, weight_structure, contrast_profile, aperture_profile,
  fallback_stack, structural_signature_json,
  expert_enabled, min_mode, qa_status
) VALUES (
  'baskerville_urw', 'Baskerville URW', 'Baskerville URW',
  'serif', 'transitional', 'cluster_transitional_A',
  'N', 'easy', 'common',
  true, 'adobe', 'adobe_fonts', 'https://fonts.adobe.com/fonts/baskerville-urw',
  false, NULL, NULL, NULL,
  'classic', 'single_weight', 'medium', 'semi_open',
  '"baskerville-urw", serif', '{"a_type": null, "e_aperture": "semi_open", "axis": null, "contrast": "medium", "terminals": null, "serifs": "present", "x_height": null, "fixed_width": false, "width": "normal", "caps_only": false, "distinctive_w": false}'::jsonb,
  false, 'training', 'review'
)
ON CONFLICT (typeface_slug) DO UPDATE SET
  font_source = EXCLUDED.font_source,
  license_type = EXCLUDED.license_type,
  activation_status = EXCLUDED.activation_status,
  fallback_stack = EXCLUDED.fallback_stack,
  qa_status = EXCLUDED.qa_status,
  updated_at_utc = now();

INSERT INTO typefaces_core (
  typeface_slug, display_name, display_name_ascii,
  primary_category, sub_category, visual_cluster_id,
  dreyfus_tier, difficulty_base, rarity_tag,
  activation_status, font_source, license_type, license_url,
  is_variable_font, designer, foundry, release_year,
  year_tag, weight_structure, contrast_profile, aperture_profile,
  fallback_stack, structural_signature_json,
  expert_enabled, min_mode, qa_status
) VALUES (
  'baskerville_urw_regular_oblique', 'Baskerville URW Regular Oblique', 'Baskerville URW Regular Oblique',
  'serif', 'transitional', 'cluster_transitional_A',
  'N', 'medium', 'uncommon',
  true, 'adobe', 'adobe_fonts', 'https://fonts.adobe.com/fonts/baskerville-urw-regular-oblique',
  false, NULL, NULL, NULL,
  'classic', 'single_weight', 'medium', 'semi_open',
  '"baskerville-urw-regular-obli", serif', '{"a_type": null, "e_aperture": "semi_open", "axis": null, "contrast": "medium", "terminals": null, "serifs": "present", "x_height": null, "fixed_width": false, "width": "normal", "caps_only": false, "distinctive_w": false}'::jsonb,
  false, 'training', 'review'
)
ON CONFLICT (typeface_slug) DO UPDATE SET
  font_source = EXCLUDED.font_source,
  license_type = EXCLUDED.license_type,
  activation_status = EXCLUDED.activation_status,
  fallback_stack = EXCLUDED.fallback_stack,
  qa_status = EXCLUDED.qa_status,
  updated_at_utc = now();

INSERT INTO typefaces_core (
  typeface_slug, display_name, display_name_ascii,
  primary_category, sub_category, visual_cluster_id,
  dreyfus_tier, difficulty_base, rarity_tag,
  activation_status, font_source, license_type, license_url,
  is_variable_font, designer, foundry, release_year,
  year_tag, weight_structure, contrast_profile, aperture_profile,
  fallback_stack, structural_signature_json,
  expert_enabled, min_mode, qa_status
) VALUES (
  'berthold_baskerville_pro', 'Berthold Baskerville Pro', 'Berthold Baskerville Pro',
  'serif', 'transitional', 'cluster_transitional_A',
  'N', 'medium', 'uncommon',
  true, 'adobe', 'adobe_fonts', 'https://fonts.adobe.com/fonts/berthold-baskerville-pro',
  false, NULL, NULL, NULL,
  'classic', 'single_weight', 'medium', 'semi_open',
  '"berthold-baskerville-pro", serif', '{"a_type": null, "e_aperture": "semi_open", "axis": null, "contrast": "medium", "terminals": null, "serifs": "present", "x_height": null, "fixed_width": false, "width": "normal", "caps_only": false, "distinctive_w": false}'::jsonb,
  false, 'training', 'review'
)
ON CONFLICT (typeface_slug) DO UPDATE SET
  font_source = EXCLUDED.font_source,
  license_type = EXCLUDED.license_type,
  activation_status = EXCLUDED.activation_status,
  fallback_stack = EXCLUDED.fallback_stack,
  qa_status = EXCLUDED.qa_status,
  updated_at_utc = now();

INSERT INTO typefaces_core (
  typeface_slug, display_name, display_name_ascii,
  primary_category, sub_category, visual_cluster_id,
  dreyfus_tier, difficulty_base, rarity_tag,
  activation_status, font_source, license_type, license_url,
  is_variable_font, designer, foundry, release_year,
  year_tag, weight_structure, contrast_profile, aperture_profile,
  fallback_stack, structural_signature_json,
  expert_enabled, min_mode, qa_status
) VALUES (
  'big_caslon_fb', 'Big Caslon FB', 'Big Caslon FB',
  'serif', 'old_style', 'cluster_oldstyle_A',
  'N', 'medium', 'uncommon',
  true, 'adobe', 'adobe_fonts', 'https://fonts.adobe.com/fonts/big-caslon-fb',
  false, NULL, NULL, NULL,
  'classic', 'single_weight', 'medium', 'semi_open',
  '"big-caslon-fb", serif', '{"a_type": null, "e_aperture": "semi_open", "axis": null, "contrast": "medium", "terminals": null, "serifs": "present", "x_height": null, "fixed_width": false, "width": "normal", "caps_only": false, "distinctive_w": false}'::jsonb,
  false, 'training', 'review'
)
ON CONFLICT (typeface_slug) DO UPDATE SET
  font_source = EXCLUDED.font_source,
  license_type = EXCLUDED.license_type,
  activation_status = EXCLUDED.activation_status,
  fallback_stack = EXCLUDED.fallback_stack,
  qa_status = EXCLUDED.qa_status,
  updated_at_utc = now();

INSERT INTO typefaces_core (
  typeface_slug, display_name, display_name_ascii,
  primary_category, sub_category, visual_cluster_id,
  dreyfus_tier, difficulty_base, rarity_tag,
  activation_status, font_source, license_type, license_url,
  is_variable_font, designer, foundry, release_year,
  year_tag, weight_structure, contrast_profile, aperture_profile,
  fallback_stack, structural_signature_json,
  expert_enabled, min_mode, qa_status
) VALUES (
  'bodoni_std', 'Bodoni Std', 'Bodoni Std',
  'serif', 'didone', 'cluster_didone_A',
  'N', 'easy', 'common',
  true, 'adobe', 'adobe_fonts', 'https://fonts.adobe.com/fonts/bodoni-std',
  false, NULL, NULL, NULL,
  'classic', 'single_weight', 'very_high', 'semi_open',
  '"bodoni-std", serif', '{"a_type": null, "e_aperture": "semi_open", "axis": null, "contrast": "very_high", "terminals": null, "serifs": "present", "x_height": null, "fixed_width": false, "width": "normal", "caps_only": false, "distinctive_w": false}'::jsonb,
  false, 'training', 'review'
)
ON CONFLICT (typeface_slug) DO UPDATE SET
  font_source = EXCLUDED.font_source,
  license_type = EXCLUDED.license_type,
  activation_status = EXCLUDED.activation_status,
  fallback_stack = EXCLUDED.fallback_stack,
  qa_status = EXCLUDED.qa_status,
  updated_at_utc = now();

INSERT INTO typefaces_core (
  typeface_slug, display_name, display_name_ascii,
  primary_category, sub_category, visual_cluster_id,
  dreyfus_tier, difficulty_base, rarity_tag,
  activation_status, font_source, license_type, license_url,
  is_variable_font, designer, foundry, release_year,
  year_tag, weight_structure, contrast_profile, aperture_profile,
  fallback_stack, structural_signature_json,
  expert_enabled, min_mode, qa_status
) VALUES (
  'bodoni_urw', 'Bodoni URW', 'Bodoni URW',
  'serif', 'didone', 'cluster_didone_A',
  'N', 'medium', 'uncommon',
  true, 'adobe', 'adobe_fonts', 'https://fonts.adobe.com/fonts/bodoni-urw',
  false, NULL, NULL, NULL,
  'classic', 'single_weight', 'very_high', 'semi_open',
  '"bodoni-urw", serif', '{"a_type": null, "e_aperture": "semi_open", "axis": null, "contrast": "very_high", "terminals": null, "serifs": "present", "x_height": null, "fixed_width": false, "width": "normal", "caps_only": false, "distinctive_w": false}'::jsonb,
  false, 'training', 'review'
)
ON CONFLICT (typeface_slug) DO UPDATE SET
  font_source = EXCLUDED.font_source,
  license_type = EXCLUDED.license_type,
  activation_status = EXCLUDED.activation_status,
  fallback_stack = EXCLUDED.fallback_stack,
  qa_status = EXCLUDED.qa_status,
  updated_at_utc = now();

INSERT INTO typefaces_core (
  typeface_slug, display_name, display_name_ascii,
  primary_category, sub_category, visual_cluster_id,
  dreyfus_tier, difficulty_base, rarity_tag,
  activation_status, font_source, license_type, license_url,
  is_variable_font, designer, foundry, release_year,
  year_tag, weight_structure, contrast_profile, aperture_profile,
  fallback_stack, structural_signature_json,
  expert_enabled, min_mode, qa_status
) VALUES (
  'brush_script_std', 'Brush Script Std', 'Brush Script Std',
  'display', 'script', 'cluster_display_script_A',
  'N', 'easy', 'common',
  true, 'adobe', 'adobe_fonts', 'https://fonts.adobe.com/fonts/brush-script-std',
  false, NULL, NULL, NULL,
  'classic', 'single_weight', 'medium', 'semi_open',
  '"brush-script-std", cursive', '{"a_type": null, "e_aperture": "semi_open", "axis": null, "contrast": "medium", "terminals": null, "serifs": null, "x_height": null, "fixed_width": false, "width": "normal", "caps_only": false, "distinctive_w": false}'::jsonb,
  false, 'training', 'review'
)
ON CONFLICT (typeface_slug) DO UPDATE SET
  font_source = EXCLUDED.font_source,
  license_type = EXCLUDED.license_type,
  activation_status = EXCLUDED.activation_status,
  fallback_stack = EXCLUDED.fallback_stack,
  qa_status = EXCLUDED.qa_status,
  updated_at_utc = now();

INSERT INTO typefaces_core (
  typeface_slug, display_name, display_name_ascii,
  primary_category, sub_category, visual_cluster_id,
  dreyfus_tier, difficulty_base, rarity_tag,
  activation_status, font_source, license_type, license_url,
  is_variable_font, designer, foundry, release_year,
  year_tag, weight_structure, contrast_profile, aperture_profile,
  fallback_stack, structural_signature_json,
  expert_enabled, min_mode, qa_status
) VALUES (
  'clarendon_text_pro', 'Clarendon Text Pro', 'Clarendon Text Pro',
  'serif', 'slab', 'cluster_slab_serif_A',
  'N', 'medium', 'uncommon',
  true, 'adobe', 'adobe_fonts', 'https://fonts.adobe.com/fonts/clarendon-text-pro',
  false, NULL, NULL, NULL,
  'classic', 'single_weight', 'low', 'semi_open',
  '"clarendon-text-pro", serif', '{"a_type": null, "e_aperture": "semi_open", "axis": null, "contrast": "low", "terminals": null, "serifs": "present", "x_height": null, "fixed_width": false, "width": "normal", "caps_only": false, "distinctive_w": false}'::jsonb,
  false, 'training', 'review'
)
ON CONFLICT (typeface_slug) DO UPDATE SET
  font_source = EXCLUDED.font_source,
  license_type = EXCLUDED.license_type,
  activation_status = EXCLUDED.activation_status,
  fallback_stack = EXCLUDED.fallback_stack,
  qa_status = EXCLUDED.qa_status,
  updated_at_utc = now();

INSERT INTO typefaces_core (
  typeface_slug, display_name, display_name_ascii,
  primary_category, sub_category, visual_cluster_id,
  dreyfus_tier, difficulty_base, rarity_tag,
  activation_status, font_source, license_type, license_url,
  is_variable_font, designer, foundry, release_year,
  year_tag, weight_structure, contrast_profile, aperture_profile,
  fallback_stack, structural_signature_json,
  expert_enabled, min_mode, qa_status
) VALUES (
  'clarendon_urw', 'Clarendon URW', 'Clarendon URW',
  'serif', 'slab', 'cluster_slab_serif_A',
  'N', 'easy', 'common',
  true, 'adobe', 'adobe_fonts', 'https://fonts.adobe.com/fonts/clarendon-urw',
  false, NULL, NULL, NULL,
  'classic', 'single_weight', 'low', 'semi_open',
  '"clarendon-urw", serif', '{"a_type": null, "e_aperture": "semi_open", "axis": null, "contrast": "low", "terminals": null, "serifs": "present", "x_height": null, "fixed_width": false, "width": "normal", "caps_only": false, "distinctive_w": false}'::jsonb,
  false, 'training', 'review'
)
ON CONFLICT (typeface_slug) DO UPDATE SET
  font_source = EXCLUDED.font_source,
  license_type = EXCLUDED.license_type,
  activation_status = EXCLUDED.activation_status,
  fallback_stack = EXCLUDED.fallback_stack,
  qa_status = EXCLUDED.qa_status,
  updated_at_utc = now();

INSERT INTO typefaces_core (
  typeface_slug, display_name, display_name_ascii,
  primary_category, sub_category, visual_cluster_id,
  dreyfus_tier, difficulty_base, rarity_tag,
  activation_status, font_source, license_type, license_url,
  is_variable_font, designer, foundry, release_year,
  year_tag, weight_structure, contrast_profile, aperture_profile,
  fallback_stack, structural_signature_json,
  expert_enabled, min_mode, qa_status
) VALUES (
  'clarendon_urw_extra_narrow', 'Clarendon URW Extra Narrow', 'Clarendon URW Extra Narrow',
  'serif', 'slab', 'cluster_slab_serif_A',
  'N', 'medium', 'uncommon',
  true, 'adobe', 'adobe_fonts', 'https://fonts.adobe.com/fonts/clarendon-urw-extra-narrow',
  false, NULL, NULL, NULL,
  'classic', 'single_weight', 'low', 'semi_open',
  '"clarendon-urw-extra-narrow", serif', '{"a_type": null, "e_aperture": "semi_open", "axis": null, "contrast": "low", "terminals": null, "serifs": "present", "x_height": null, "fixed_width": false, "width": "normal", "caps_only": false, "distinctive_w": false}'::jsonb,
  false, 'training', 'review'
)
ON CONFLICT (typeface_slug) DO UPDATE SET
  font_source = EXCLUDED.font_source,
  license_type = EXCLUDED.license_type,
  activation_status = EXCLUDED.activation_status,
  fallback_stack = EXCLUDED.fallback_stack,
  qa_status = EXCLUDED.qa_status,
  updated_at_utc = now();

INSERT INTO typefaces_core (
  typeface_slug, display_name, display_name_ascii,
  primary_category, sub_category, visual_cluster_id,
  dreyfus_tier, difficulty_base, rarity_tag,
  activation_status, font_source, license_type, license_url,
  is_variable_font, designer, foundry, release_year,
  year_tag, weight_structure, contrast_profile, aperture_profile,
  fallback_stack, structural_signature_json,
  expert_enabled, min_mode, qa_status
) VALUES (
  'clarendon_urw_extra_wide', 'Clarendon URW Extra Wide', 'Clarendon URW Extra Wide',
  'serif', 'slab', 'cluster_slab_serif_A',
  'N', 'medium', 'uncommon',
  true, 'adobe', 'adobe_fonts', 'https://fonts.adobe.com/fonts/clarendon-urw-extra-wide',
  false, NULL, NULL, NULL,
  'classic', 'single_weight', 'low', 'semi_open',
  '"clarendon-urw-extra-wide", serif', '{"a_type": null, "e_aperture": "semi_open", "axis": null, "contrast": "low", "terminals": null, "serifs": "present", "x_height": null, "fixed_width": false, "width": "normal", "caps_only": false, "distinctive_w": false}'::jsonb,
  false, 'training', 'review'
)
ON CONFLICT (typeface_slug) DO UPDATE SET
  font_source = EXCLUDED.font_source,
  license_type = EXCLUDED.license_type,
  activation_status = EXCLUDED.activation_status,
  fallback_stack = EXCLUDED.fallback_stack,
  qa_status = EXCLUDED.qa_status,
  updated_at_utc = now();

INSERT INTO typefaces_core (
  typeface_slug, display_name, display_name_ascii,
  primary_category, sub_category, visual_cluster_id,
  dreyfus_tier, difficulty_base, rarity_tag,
  activation_status, font_source, license_type, license_url,
  is_variable_font, designer, foundry, release_year,
  year_tag, weight_structure, contrast_profile, aperture_profile,
  fallback_stack, structural_signature_json,
  expert_enabled, min_mode, qa_status
) VALUES (
  'clarendon_wide', 'Clarendon Wide', 'Clarendon Wide',
  'serif', 'slab', 'cluster_slab_serif_A',
  'N', 'medium', 'uncommon',
  true, 'adobe', 'adobe_fonts', 'https://fonts.adobe.com/fonts/clarendon-wide',
  false, NULL, NULL, NULL,
  'classic', 'single_weight', 'low', 'semi_open',
  '"clarendon-wide", serif', '{"a_type": null, "e_aperture": "semi_open", "axis": null, "contrast": "low", "terminals": null, "serifs": "present", "x_height": null, "fixed_width": false, "width": "normal", "caps_only": false, "distinctive_w": false}'::jsonb,
  false, 'training', 'review'
)
ON CONFLICT (typeface_slug) DO UPDATE SET
  font_source = EXCLUDED.font_source,
  license_type = EXCLUDED.license_type,
  activation_status = EXCLUDED.activation_status,
  fallback_stack = EXCLUDED.fallback_stack,
  qa_status = EXCLUDED.qa_status,
  updated_at_utc = now();

INSERT INTO typefaces_core (
  typeface_slug, display_name, display_name_ascii,
  primary_category, sub_category, visual_cluster_id,
  dreyfus_tier, difficulty_base, rarity_tag,
  activation_status, font_source, license_type, license_url,
  is_variable_font, designer, foundry, release_year,
  year_tag, weight_structure, contrast_profile, aperture_profile,
  fallback_stack, structural_signature_json,
  expert_enabled, min_mode, qa_status
) VALUES (
  'clarendon_wide_sc', 'Clarendon Wide SC', 'Clarendon Wide SC',
  'serif', 'slab', 'cluster_slab_serif_A',
  'N', 'medium', 'uncommon',
  true, 'adobe', 'adobe_fonts', 'https://fonts.adobe.com/fonts/clarendon-wide-sc',
  false, NULL, NULL, NULL,
  'classic', 'single_weight', 'low', 'semi_open',
  '"clarendon-wide-sc", serif', '{"a_type": null, "e_aperture": "semi_open", "axis": null, "contrast": "low", "terminals": null, "serifs": "present", "x_height": null, "fixed_width": false, "width": "normal", "caps_only": false, "distinctive_w": false}'::jsonb,
  false, 'training', 'review'
)
ON CONFLICT (typeface_slug) DO UPDATE SET
  font_source = EXCLUDED.font_source,
  license_type = EXCLUDED.license_type,
  activation_status = EXCLUDED.activation_status,
  fallback_stack = EXCLUDED.fallback_stack,
  qa_status = EXCLUDED.qa_status,
  updated_at_utc = now();

INSERT INTO typefaces_core (
  typeface_slug, display_name, display_name_ascii,
  primary_category, sub_category, visual_cluster_id,
  dreyfus_tier, difficulty_base, rarity_tag,
  activation_status, font_source, license_type, license_url,
  is_variable_font, designer, foundry, release_year,
  year_tag, weight_structure, contrast_profile, aperture_profile,
  fallback_stack, structural_signature_json,
  expert_enabled, min_mode, qa_status
) VALUES (
  'clarendon_wide_stencil', 'Clarendon Wide Stencil', 'Clarendon Wide Stencil',
  'serif', 'slab', 'cluster_slab_serif_A',
  'N', 'medium', 'uncommon',
  true, 'adobe', 'adobe_fonts', 'https://fonts.adobe.com/fonts/clarendon-wide-stencil',
  false, NULL, NULL, NULL,
  'classic', 'single_weight', 'low', 'semi_open',
  '"clarendon-wide-stencil", serif', '{"a_type": null, "e_aperture": "semi_open", "axis": null, "contrast": "low", "terminals": null, "serifs": "present", "x_height": null, "fixed_width": false, "width": "normal", "caps_only": false, "distinctive_w": false}'::jsonb,
  false, 'training', 'review'
)
ON CONFLICT (typeface_slug) DO UPDATE SET
  font_source = EXCLUDED.font_source,
  license_type = EXCLUDED.license_type,
  activation_status = EXCLUDED.activation_status,
  fallback_stack = EXCLUDED.fallback_stack,
  qa_status = EXCLUDED.qa_status,
  updated_at_utc = now();

INSERT INTO typefaces_core (
  typeface_slug, display_name, display_name_ascii,
  primary_category, sub_category, visual_cluster_id,
  dreyfus_tier, difficulty_base, rarity_tag,
  activation_status, font_source, license_type, license_url,
  is_variable_font, designer, foundry, release_year,
  year_tag, weight_structure, contrast_profile, aperture_profile,
  fallback_stack, structural_signature_json,
  expert_enabled, min_mode, qa_status
) VALUES (
  'comic_sans_ms', 'Comic Sans MS', 'Comic Sans MS',
  'sans_serif', 'humanist', 'cluster_humanist_A',
  'N', 'easy', 'common',
  true, 'adobe', 'adobe_fonts', 'https://fonts.adobe.com/fonts/comic-sans-ms',
  false, NULL, NULL, NULL,
  'classic', 'single_weight', 'low', 'semi_open',
  '"comic-sans-ms", sans-serif', '{"a_type": null, "e_aperture": "semi_open", "axis": null, "contrast": "low", "terminals": null, "serifs": null, "x_height": null, "fixed_width": false, "width": "normal", "caps_only": false, "distinctive_w": false}'::jsonb,
  false, 'training', 'review'
)
ON CONFLICT (typeface_slug) DO UPDATE SET
  font_source = EXCLUDED.font_source,
  license_type = EXCLUDED.license_type,
  activation_status = EXCLUDED.activation_status,
  fallback_stack = EXCLUDED.fallback_stack,
  qa_status = EXCLUDED.qa_status,
  updated_at_utc = now();

INSERT INTO typefaces_core (
  typeface_slug, display_name, display_name_ascii,
  primary_category, sub_category, visual_cluster_id,
  dreyfus_tier, difficulty_base, rarity_tag,
  activation_status, font_source, license_type, license_url,
  is_variable_font, designer, foundry, release_year,
  year_tag, weight_structure, contrast_profile, aperture_profile,
  fallback_stack, structural_signature_json,
  expert_enabled, min_mode, qa_status
) VALUES (
  'cooper_black_std', 'Cooper Black Std', 'Cooper Black Std',
  'serif', 'slab', 'cluster_slab_serif_A',
  'N', 'easy', 'common',
  true, 'adobe', 'adobe_fonts', 'https://fonts.adobe.com/fonts/cooper-black-std',
  false, NULL, NULL, NULL,
  'classic', 'single_weight', 'low', 'semi_open',
  '"cooper-black-std", serif', '{"a_type": null, "e_aperture": "semi_open", "axis": null, "contrast": "low", "terminals": null, "serifs": "present", "x_height": null, "fixed_width": false, "width": "normal", "caps_only": false, "distinctive_w": false}'::jsonb,
  false, 'training', 'review'
)
ON CONFLICT (typeface_slug) DO UPDATE SET
  font_source = EXCLUDED.font_source,
  license_type = EXCLUDED.license_type,
  activation_status = EXCLUDED.activation_status,
  fallback_stack = EXCLUDED.fallback_stack,
  qa_status = EXCLUDED.qa_status,
  updated_at_utc = now();

INSERT INTO typefaces_core (
  typeface_slug, display_name, display_name_ascii,
  primary_category, sub_category, visual_cluster_id,
  dreyfus_tier, difficulty_base, rarity_tag,
  activation_status, font_source, license_type, license_url,
  is_variable_font, designer, foundry, release_year,
  year_tag, weight_structure, contrast_profile, aperture_profile,
  fallback_stack, structural_signature_json,
  expert_enabled, min_mode, qa_status
) VALUES (
  'copperplate', 'Copperplate', 'Copperplate',
  'serif', 'old_style', 'cluster_oldstyle_A',
  'N', 'easy', 'common',
  true, 'adobe', 'adobe_fonts', 'https://fonts.adobe.com/fonts/copperplate',
  false, NULL, NULL, NULL,
  'classic', 'single_weight', 'medium', 'semi_open',
  '"copperplate", serif', '{"a_type": null, "e_aperture": "semi_open", "axis": null, "contrast": "medium", "terminals": null, "serifs": "present", "x_height": null, "fixed_width": false, "width": "normal", "caps_only": false, "distinctive_w": false}'::jsonb,
  false, 'training', 'review'
)
ON CONFLICT (typeface_slug) DO UPDATE SET
  font_source = EXCLUDED.font_source,
  license_type = EXCLUDED.license_type,
  activation_status = EXCLUDED.activation_status,
  fallback_stack = EXCLUDED.fallback_stack,
  qa_status = EXCLUDED.qa_status,
  updated_at_utc = now();

INSERT INTO typefaces_core (
  typeface_slug, display_name, display_name_ascii,
  primary_category, sub_category, visual_cluster_id,
  dreyfus_tier, difficulty_base, rarity_tag,
  activation_status, font_source, license_type, license_url,
  is_variable_font, designer, foundry, release_year,
  year_tag, weight_structure, contrast_profile, aperture_profile,
  fallback_stack, structural_signature_json,
  expert_enabled, min_mode, qa_status
) VALUES (
  'copperplate_condensed', 'Copperplate Condensed', 'Copperplate Condensed',
  'serif', 'old_style', 'cluster_oldstyle_A',
  'N', 'medium', 'uncommon',
  true, 'adobe', 'adobe_fonts', 'https://fonts.adobe.com/fonts/copperplate-condensed',
  false, NULL, NULL, NULL,
  'classic', 'single_weight', 'medium', 'semi_open',
  '"copperplate-condensed", serif', '{"a_type": null, "e_aperture": "semi_open", "axis": null, "contrast": "medium", "terminals": null, "serifs": "present", "x_height": null, "fixed_width": false, "width": "normal", "caps_only": false, "distinctive_w": false}'::jsonb,
  false, 'training', 'review'
)
ON CONFLICT (typeface_slug) DO UPDATE SET
  font_source = EXCLUDED.font_source,
  license_type = EXCLUDED.license_type,
  activation_status = EXCLUDED.activation_status,
  fallback_stack = EXCLUDED.fallback_stack,
  qa_status = EXCLUDED.qa_status,
  updated_at_utc = now();

INSERT INTO typefaces_core (
  typeface_slug, display_name, display_name_ascii,
  primary_category, sub_category, visual_cluster_id,
  dreyfus_tier, difficulty_base, rarity_tag,
  activation_status, font_source, license_type, license_url,
  is_variable_font, designer, foundry, release_year,
  year_tag, weight_structure, contrast_profile, aperture_profile,
  fallback_stack, structural_signature_json,
  expert_enabled, min_mode, qa_status
) VALUES (
  'courier_std', 'Courier Std', 'Courier Std',
  'mono', 'slab', 'cluster_mono_slab_A',
  'N', 'medium', 'uncommon',
  true, 'adobe', 'adobe_fonts', 'https://fonts.adobe.com/fonts/courier-std',
  false, NULL, NULL, NULL,
  'classic', 'single_weight', 'low', 'semi_open',
  '"courier-std", monospace', '{"a_type": null, "e_aperture": "semi_open", "axis": null, "contrast": "low", "terminals": null, "serifs": null, "x_height": null, "fixed_width": true, "width": "normal", "caps_only": false, "distinctive_w": false}'::jsonb,
  false, 'training', 'review'
)
ON CONFLICT (typeface_slug) DO UPDATE SET
  font_source = EXCLUDED.font_source,
  license_type = EXCLUDED.license_type,
  activation_status = EXCLUDED.activation_status,
  fallback_stack = EXCLUDED.fallback_stack,
  qa_status = EXCLUDED.qa_status,
  updated_at_utc = now();

INSERT INTO typefaces_core (
  typeface_slug, display_name, display_name_ascii,
  primary_category, sub_category, visual_cluster_id,
  dreyfus_tier, difficulty_base, rarity_tag,
  activation_status, font_source, license_type, license_url,
  is_variable_font, designer, foundry, release_year,
  year_tag, weight_structure, contrast_profile, aperture_profile,
  fallback_stack, structural_signature_json,
  expert_enabled, min_mode, qa_status
) VALUES (
  'eurostile', 'Eurostile', 'Eurostile',
  'sans_serif', 'geometric', 'cluster_geometric_A',
  'N', 'easy', 'common',
  true, 'adobe', 'adobe_fonts', 'https://fonts.adobe.com/fonts/eurostile',
  false, NULL, NULL, NULL,
  'classic', 'single_weight', 'low', 'semi_open',
  '"eurostile", sans-serif', '{"a_type": null, "e_aperture": "semi_open", "axis": null, "contrast": "low", "terminals": null, "serifs": null, "x_height": null, "fixed_width": false, "width": "normal", "caps_only": false, "distinctive_w": false}'::jsonb,
  false, 'training', 'review'
)
ON CONFLICT (typeface_slug) DO UPDATE SET
  font_source = EXCLUDED.font_source,
  license_type = EXCLUDED.license_type,
  activation_status = EXCLUDED.activation_status,
  fallback_stack = EXCLUDED.fallback_stack,
  qa_status = EXCLUDED.qa_status,
  updated_at_utc = now();

INSERT INTO typefaces_core (
  typeface_slug, display_name, display_name_ascii,
  primary_category, sub_category, visual_cluster_id,
  dreyfus_tier, difficulty_base, rarity_tag,
  activation_status, font_source, license_type, license_url,
  is_variable_font, designer, foundry, release_year,
  year_tag, weight_structure, contrast_profile, aperture_profile,
  fallback_stack, structural_signature_json,
  expert_enabled, min_mode, qa_status
) VALUES (
  'eurostile_condensed', 'Eurostile Condensed', 'Eurostile Condensed',
  'sans_serif', 'geometric', 'cluster_geometric_A',
  'N', 'medium', 'uncommon',
  true, 'adobe', 'adobe_fonts', 'https://fonts.adobe.com/fonts/eurostile-condensed',
  false, NULL, NULL, NULL,
  'classic', 'single_weight', 'low', 'semi_open',
  '"eurostile-condensed", sans-serif', '{"a_type": null, "e_aperture": "semi_open", "axis": null, "contrast": "low", "terminals": null, "serifs": null, "x_height": null, "fixed_width": false, "width": "normal", "caps_only": false, "distinctive_w": false}'::jsonb,
  false, 'training', 'review'
)
ON CONFLICT (typeface_slug) DO UPDATE SET
  font_source = EXCLUDED.font_source,
  license_type = EXCLUDED.license_type,
  activation_status = EXCLUDED.activation_status,
  fallback_stack = EXCLUDED.fallback_stack,
  qa_status = EXCLUDED.qa_status,
  updated_at_utc = now();

INSERT INTO typefaces_core (
  typeface_slug, display_name, display_name_ascii,
  primary_category, sub_category, visual_cluster_id,
  dreyfus_tier, difficulty_base, rarity_tag,
  activation_status, font_source, license_type, license_url,
  is_variable_font, designer, foundry, release_year,
  year_tag, weight_structure, contrast_profile, aperture_profile,
  fallback_stack, structural_signature_json,
  expert_enabled, min_mode, qa_status
) VALUES (
  'eurostile_extended', 'Eurostile Extended', 'Eurostile Extended',
  'sans_serif', 'geometric', 'cluster_geometric_A',
  'N', 'medium', 'uncommon',
  true, 'adobe', 'adobe_fonts', 'https://fonts.adobe.com/fonts/eurostile-extended',
  false, NULL, NULL, NULL,
  'classic', 'single_weight', 'low', 'semi_open',
  '"eurostile-extended", sans-serif', '{"a_type": null, "e_aperture": "semi_open", "axis": null, "contrast": "low", "terminals": null, "serifs": null, "x_height": null, "fixed_width": false, "width": "normal", "caps_only": false, "distinctive_w": false}'::jsonb,
  false, 'training', 'review'
)
ON CONFLICT (typeface_slug) DO UPDATE SET
  font_source = EXCLUDED.font_source,
  license_type = EXCLUDED.license_type,
  activation_status = EXCLUDED.activation_status,
  fallback_stack = EXCLUDED.fallback_stack,
  qa_status = EXCLUDED.qa_status,
  updated_at_utc = now();

INSERT INTO typefaces_core (
  typeface_slug, display_name, display_name_ascii,
  primary_category, sub_category, visual_cluster_id,
  dreyfus_tier, difficulty_base, rarity_tag,
  activation_status, font_source, license_type, license_url,
  is_variable_font, designer, foundry, release_year,
  year_tag, weight_structure, contrast_profile, aperture_profile,
  fallback_stack, structural_signature_json,
  expert_enabled, min_mode, qa_status
) VALUES (
  'franklin_gothic', 'Franklin Gothic', 'Franklin Gothic',
  'sans_serif', 'neo_grotesk', 'cluster_neo_grotesk_A',
  'N', 'easy', 'common',
  true, 'adobe', 'adobe_fonts', 'https://fonts.adobe.com/fonts/franklin-gothic',
  false, NULL, NULL, NULL,
  'classic', 'single_weight', 'low', 'semi_open',
  '"franklin-gothic", sans-serif', '{"a_type": null, "e_aperture": "semi_open", "axis": null, "contrast": "low", "terminals": null, "serifs": null, "x_height": null, "fixed_width": false, "width": "normal", "caps_only": false, "distinctive_w": false}'::jsonb,
  false, 'training', 'review'
)
ON CONFLICT (typeface_slug) DO UPDATE SET
  font_source = EXCLUDED.font_source,
  license_type = EXCLUDED.license_type,
  activation_status = EXCLUDED.activation_status,
  fallback_stack = EXCLUDED.fallback_stack,
  qa_status = EXCLUDED.qa_status,
  updated_at_utc = now();

INSERT INTO typefaces_core (
  typeface_slug, display_name, display_name_ascii,
  primary_category, sub_category, visual_cluster_id,
  dreyfus_tier, difficulty_base, rarity_tag,
  activation_status, font_source, license_type, license_url,
  is_variable_font, designer, foundry, release_year,
  year_tag, weight_structure, contrast_profile, aperture_profile,
  fallback_stack, structural_signature_json,
  expert_enabled, min_mode, qa_status
) VALUES (
  'franklin_gothic_atf', 'Franklin Gothic ATF', 'Franklin Gothic ATF',
  'sans_serif', 'neo_grotesk', 'cluster_neo_grotesk_A',
  'N', 'medium', 'uncommon',
  true, 'adobe', 'adobe_fonts', 'https://fonts.adobe.com/fonts/franklin-gothic-atf',
  false, NULL, NULL, NULL,
  'classic', 'single_weight', 'low', 'semi_open',
  '"franklin-gothic-atf", sans-serif', '{"a_type": null, "e_aperture": "semi_open", "axis": null, "contrast": "low", "terminals": null, "serifs": null, "x_height": null, "fixed_width": false, "width": "normal", "caps_only": false, "distinctive_w": false}'::jsonb,
  false, 'training', 'review'
)
ON CONFLICT (typeface_slug) DO UPDATE SET
  font_source = EXCLUDED.font_source,
  license_type = EXCLUDED.license_type,
  activation_status = EXCLUDED.activation_status,
  fallback_stack = EXCLUDED.fallback_stack,
  qa_status = EXCLUDED.qa_status,
  updated_at_utc = now();

INSERT INTO typefaces_core (
  typeface_slug, display_name, display_name_ascii,
  primary_category, sub_category, visual_cluster_id,
  dreyfus_tier, difficulty_base, rarity_tag,
  activation_status, font_source, license_type, license_url,
  is_variable_font, designer, foundry, release_year,
  year_tag, weight_structure, contrast_profile, aperture_profile,
  fallback_stack, structural_signature_json,
  expert_enabled, min_mode, qa_status
) VALUES (
  'franklin_gothic_compressed', 'Franklin Gothic Compressed', 'Franklin Gothic Compressed',
  'sans_serif', 'neo_grotesk', 'cluster_neo_grotesk_A',
  'N', 'medium', 'uncommon',
  true, 'adobe', 'adobe_fonts', 'https://fonts.adobe.com/fonts/franklin-gothic-compressed',
  false, NULL, NULL, NULL,
  'classic', 'single_weight', 'low', 'semi_open',
  '"franklin-gothic-compressed", sans-serif', '{"a_type": null, "e_aperture": "semi_open", "axis": null, "contrast": "low", "terminals": null, "serifs": null, "x_height": null, "fixed_width": false, "width": "normal", "caps_only": false, "distinctive_w": false}'::jsonb,
  false, 'training', 'review'
)
ON CONFLICT (typeface_slug) DO UPDATE SET
  font_source = EXCLUDED.font_source,
  license_type = EXCLUDED.license_type,
  activation_status = EXCLUDED.activation_status,
  fallback_stack = EXCLUDED.fallback_stack,
  qa_status = EXCLUDED.qa_status,
  updated_at_utc = now();

INSERT INTO typefaces_core (
  typeface_slug, display_name, display_name_ascii,
  primary_category, sub_category, visual_cluster_id,
  dreyfus_tier, difficulty_base, rarity_tag,
  activation_status, font_source, license_type, license_url,
  is_variable_font, designer, foundry, release_year,
  year_tag, weight_structure, contrast_profile, aperture_profile,
  fallback_stack, structural_signature_json,
  expert_enabled, min_mode, qa_status
) VALUES (
  'franklin_gothic_condensed', 'Franklin Gothic Condensed', 'Franklin Gothic Condensed',
  'sans_serif', 'neo_grotesk', 'cluster_neo_grotesk_A',
  'N', 'medium', 'uncommon',
  true, 'adobe', 'adobe_fonts', 'https://fonts.adobe.com/fonts/franklin-gothic-condensed',
  false, NULL, NULL, NULL,
  'classic', 'single_weight', 'low', 'semi_open',
  '"franklin-gothic-condensed", sans-serif', '{"a_type": null, "e_aperture": "semi_open", "axis": null, "contrast": "low", "terminals": null, "serifs": null, "x_height": null, "fixed_width": false, "width": "normal", "caps_only": false, "distinctive_w": false}'::jsonb,
  false, 'training', 'review'
)
ON CONFLICT (typeface_slug) DO UPDATE SET
  font_source = EXCLUDED.font_source,
  license_type = EXCLUDED.license_type,
  activation_status = EXCLUDED.activation_status,
  fallback_stack = EXCLUDED.fallback_stack,
  qa_status = EXCLUDED.qa_status,
  updated_at_utc = now();

INSERT INTO typefaces_core (
  typeface_slug, display_name, display_name_ascii,
  primary_category, sub_category, visual_cluster_id,
  dreyfus_tier, difficulty_base, rarity_tag,
  activation_status, font_source, license_type, license_url,
  is_variable_font, designer, foundry, release_year,
  year_tag, weight_structure, contrast_profile, aperture_profile,
  fallback_stack, structural_signature_json,
  expert_enabled, min_mode, qa_status
) VALUES (
  'franklin_gothic_extra_compressed', 'Franklin Gothic Extra Compressed', 'Franklin Gothic Extra Compressed',
  'sans_serif', 'neo_grotesk', 'cluster_neo_grotesk_A',
  'N', 'medium', 'uncommon',
  true, 'adobe', 'adobe_fonts', 'https://fonts.adobe.com/fonts/franklin-gothic-extra-compressed',
  false, NULL, NULL, NULL,
  'classic', 'single_weight', 'low', 'semi_open',
  '"franklin-gothic-extra-compre", sans-serif', '{"a_type": null, "e_aperture": "semi_open", "axis": null, "contrast": "low", "terminals": null, "serifs": null, "x_height": null, "fixed_width": false, "width": "normal", "caps_only": false, "distinctive_w": false}'::jsonb,
  false, 'training', 'review'
)
ON CONFLICT (typeface_slug) DO UPDATE SET
  font_source = EXCLUDED.font_source,
  license_type = EXCLUDED.license_type,
  activation_status = EXCLUDED.activation_status,
  fallback_stack = EXCLUDED.fallback_stack,
  qa_status = EXCLUDED.qa_status,
  updated_at_utc = now();

INSERT INTO typefaces_core (
  typeface_slug, display_name, display_name_ascii,
  primary_category, sub_category, visual_cluster_id,
  dreyfus_tier, difficulty_base, rarity_tag,
  activation_status, font_source, license_type, license_url,
  is_variable_font, designer, foundry, release_year,
  year_tag, weight_structure, contrast_profile, aperture_profile,
  fallback_stack, structural_signature_json,
  expert_enabled, min_mode, qa_status
) VALUES (
  'franklin_gothic_std', 'Franklin Gothic Std', 'Franklin Gothic Std',
  'sans_serif', 'neo_grotesk', 'cluster_neo_grotesk_A',
  'N', 'medium', 'uncommon',
  true, 'adobe', 'adobe_fonts', 'https://fonts.adobe.com/fonts/franklin-gothic-std',
  false, NULL, NULL, NULL,
  'classic', 'single_weight', 'low', 'semi_open',
  '"franklin-gothic-std", sans-serif', '{"a_type": null, "e_aperture": "semi_open", "axis": null, "contrast": "low", "terminals": null, "serifs": null, "x_height": null, "fixed_width": false, "width": "normal", "caps_only": false, "distinctive_w": false}'::jsonb,
  false, 'training', 'review'
)
ON CONFLICT (typeface_slug) DO UPDATE SET
  font_source = EXCLUDED.font_source,
  license_type = EXCLUDED.license_type,
  activation_status = EXCLUDED.activation_status,
  fallback_stack = EXCLUDED.fallback_stack,
  qa_status = EXCLUDED.qa_status,
  updated_at_utc = now();

INSERT INTO typefaces_core (
  typeface_slug, display_name, display_name_ascii,
  primary_category, sub_category, visual_cluster_id,
  dreyfus_tier, difficulty_base, rarity_tag,
  activation_status, font_source, license_type, license_url,
  is_variable_font, designer, foundry, release_year,
  year_tag, weight_structure, contrast_profile, aperture_profile,
  fallback_stack, structural_signature_json,
  expert_enabled, min_mode, qa_status
) VALUES (
  'franklin_gothic_std_cond', 'Franklin Gothic Std Cond', 'Franklin Gothic Std Cond',
  'sans_serif', 'neo_grotesk', 'cluster_neo_grotesk_A',
  'N', 'medium', 'uncommon',
  true, 'adobe', 'adobe_fonts', 'https://fonts.adobe.com/fonts/franklin-gothic-std-cond',
  false, NULL, NULL, NULL,
  'classic', 'single_weight', 'low', 'semi_open',
  '"franklin-gothic-std-cond", sans-serif', '{"a_type": null, "e_aperture": "semi_open", "axis": null, "contrast": "low", "terminals": null, "serifs": null, "x_height": null, "fixed_width": false, "width": "normal", "caps_only": false, "distinctive_w": false}'::jsonb,
  false, 'training', 'review'
)
ON CONFLICT (typeface_slug) DO UPDATE SET
  font_source = EXCLUDED.font_source,
  license_type = EXCLUDED.license_type,
  activation_status = EXCLUDED.activation_status,
  fallback_stack = EXCLUDED.fallback_stack,
  qa_status = EXCLUDED.qa_status,
  updated_at_utc = now();

INSERT INTO typefaces_core (
  typeface_slug, display_name, display_name_ascii,
  primary_category, sub_category, visual_cluster_id,
  dreyfus_tier, difficulty_base, rarity_tag,
  activation_status, font_source, license_type, license_url,
  is_variable_font, designer, foundry, release_year,
  year_tag, weight_structure, contrast_profile, aperture_profile,
  fallback_stack, structural_signature_json,
  expert_enabled, min_mode, qa_status
) VALUES (
  'franklin_gothic_urw', 'Franklin Gothic URW', 'Franklin Gothic URW',
  'sans_serif', 'neo_grotesk', 'cluster_neo_grotesk_A',
  'N', 'medium', 'uncommon',
  true, 'adobe', 'adobe_fonts', 'https://fonts.adobe.com/fonts/franklin-gothic-urw',
  false, NULL, NULL, NULL,
  'classic', 'single_weight', 'low', 'semi_open',
  '"franklin-gothic-urw", sans-serif', '{"a_type": null, "e_aperture": "semi_open", "axis": null, "contrast": "low", "terminals": null, "serifs": null, "x_height": null, "fixed_width": false, "width": "normal", "caps_only": false, "distinctive_w": false}'::jsonb,
  false, 'training', 'review'
)
ON CONFLICT (typeface_slug) DO UPDATE SET
  font_source = EXCLUDED.font_source,
  license_type = EXCLUDED.license_type,
  activation_status = EXCLUDED.activation_status,
  fallback_stack = EXCLUDED.fallback_stack,
  qa_status = EXCLUDED.qa_status,
  updated_at_utc = now();

INSERT INTO typefaces_core (
  typeface_slug, display_name, display_name_ascii,
  primary_category, sub_category, visual_cluster_id,
  dreyfus_tier, difficulty_base, rarity_tag,
  activation_status, font_source, license_type, license_url,
  is_variable_font, designer, foundry, release_year,
  year_tag, weight_structure, contrast_profile, aperture_profile,
  fallback_stack, structural_signature_json,
  expert_enabled, min_mode, qa_status
) VALUES (
  'franklin_gothic_urw_compressed', 'Franklin Gothic URW Compressed', 'Franklin Gothic URW Compressed',
  'sans_serif', 'neo_grotesk', 'cluster_neo_grotesk_A',
  'N', 'medium', 'uncommon',
  true, 'adobe', 'adobe_fonts', 'https://fonts.adobe.com/fonts/franklin-gothic-urw-compressed',
  false, NULL, NULL, NULL,
  'classic', 'single_weight', 'low', 'semi_open',
  '"franklin-gothic-urw-comp", sans-serif', '{"a_type": null, "e_aperture": "semi_open", "axis": null, "contrast": "low", "terminals": null, "serifs": null, "x_height": null, "fixed_width": false, "width": "normal", "caps_only": false, "distinctive_w": false}'::jsonb,
  false, 'training', 'review'
)
ON CONFLICT (typeface_slug) DO UPDATE SET
  font_source = EXCLUDED.font_source,
  license_type = EXCLUDED.license_type,
  activation_status = EXCLUDED.activation_status,
  fallback_stack = EXCLUDED.fallback_stack,
  qa_status = EXCLUDED.qa_status,
  updated_at_utc = now();

INSERT INTO typefaces_core (
  typeface_slug, display_name, display_name_ascii,
  primary_category, sub_category, visual_cluster_id,
  dreyfus_tier, difficulty_base, rarity_tag,
  activation_status, font_source, license_type, license_url,
  is_variable_font, designer, foundry, release_year,
  year_tag, weight_structure, contrast_profile, aperture_profile,
  fallback_stack, structural_signature_json,
  expert_enabled, min_mode, qa_status
) VALUES (
  'franklin_gothic_urw_condensed', 'Franklin Gothic URW Condensed', 'Franklin Gothic URW Condensed',
  'sans_serif', 'neo_grotesk', 'cluster_neo_grotesk_A',
  'N', 'medium', 'uncommon',
  true, 'adobe', 'adobe_fonts', 'https://fonts.adobe.com/fonts/franklin-gothic-urw-condensed',
  false, NULL, NULL, NULL,
  'classic', 'single_weight', 'low', 'semi_open',
  '"franklin-gothic-urw-cond", sans-serif', '{"a_type": null, "e_aperture": "semi_open", "axis": null, "contrast": "low", "terminals": null, "serifs": null, "x_height": null, "fixed_width": false, "width": "normal", "caps_only": false, "distinctive_w": false}'::jsonb,
  false, 'training', 'review'
)
ON CONFLICT (typeface_slug) DO UPDATE SET
  font_source = EXCLUDED.font_source,
  license_type = EXCLUDED.license_type,
  activation_status = EXCLUDED.activation_status,
  fallback_stack = EXCLUDED.fallback_stack,
  qa_status = EXCLUDED.qa_status,
  updated_at_utc = now();

INSERT INTO typefaces_core (
  typeface_slug, display_name, display_name_ascii,
  primary_category, sub_category, visual_cluster_id,
  dreyfus_tier, difficulty_base, rarity_tag,
  activation_status, font_source, license_type, license_url,
  is_variable_font, designer, foundry, release_year,
  year_tag, weight_structure, contrast_profile, aperture_profile,
  fallback_stack, structural_signature_json,
  expert_enabled, min_mode, qa_status
) VALUES (
  'franklin_gothic_urw_extra_compressed', 'Franklin Gothic URW Extra Compressed', 'Franklin Gothic URW Extra Compressed',
  'sans_serif', 'neo_grotesk', 'cluster_neo_grotesk_A',
  'N', 'medium', 'uncommon',
  true, 'adobe', 'adobe_fonts', 'https://fonts.adobe.com/fonts/franklin-gothic-urw-extra-compressed',
  false, NULL, NULL, NULL,
  'classic', 'single_weight', 'low', 'semi_open',
  '"franklin-gothic-ext-comp-urw", sans-serif', '{"a_type": null, "e_aperture": "semi_open", "axis": null, "contrast": "low", "terminals": null, "serifs": null, "x_height": null, "fixed_width": false, "width": "normal", "caps_only": false, "distinctive_w": false}'::jsonb,
  false, 'training', 'review'
)
ON CONFLICT (typeface_slug) DO UPDATE SET
  font_source = EXCLUDED.font_source,
  license_type = EXCLUDED.license_type,
  activation_status = EXCLUDED.activation_status,
  fallback_stack = EXCLUDED.fallback_stack,
  qa_status = EXCLUDED.qa_status,
  updated_at_utc = now();

INSERT INTO typefaces_core (
  typeface_slug, display_name, display_name_ascii,
  primary_category, sub_category, visual_cluster_id,
  dreyfus_tier, difficulty_base, rarity_tag,
  activation_status, font_source, license_type, license_url,
  is_variable_font, designer, foundry, release_year,
  year_tag, weight_structure, contrast_profile, aperture_profile,
  fallback_stack, structural_signature_json,
  expert_enabled, min_mode, qa_status
) VALUES (
  'futura_100', 'Futura 100', 'Futura 100',
  'sans_serif', 'geometric', 'cluster_geometric_A',
  'N', 'medium', 'uncommon',
  true, 'adobe', 'adobe_fonts', 'https://fonts.adobe.com/fonts/futura-100',
  false, NULL, NULL, NULL,
  'classic', 'single_weight', 'low', 'semi_open',
  '"futura-100", sans-serif', '{"a_type": null, "e_aperture": "semi_open", "axis": null, "contrast": "low", "terminals": null, "serifs": null, "x_height": null, "fixed_width": false, "width": "normal", "caps_only": false, "distinctive_w": false}'::jsonb,
  false, 'training', 'review'
)
ON CONFLICT (typeface_slug) DO UPDATE SET
  font_source = EXCLUDED.font_source,
  license_type = EXCLUDED.license_type,
  activation_status = EXCLUDED.activation_status,
  fallback_stack = EXCLUDED.fallback_stack,
  qa_status = EXCLUDED.qa_status,
  updated_at_utc = now();

INSERT INTO typefaces_core (
  typeface_slug, display_name, display_name_ascii,
  primary_category, sub_category, visual_cluster_id,
  dreyfus_tier, difficulty_base, rarity_tag,
  activation_status, font_source, license_type, license_url,
  is_variable_font, designer, foundry, release_year,
  year_tag, weight_structure, contrast_profile, aperture_profile,
  fallback_stack, structural_signature_json,
  expert_enabled, min_mode, qa_status
) VALUES (
  'futura_100_book', 'Futura 100 Book', 'Futura 100 Book',
  'sans_serif', 'geometric', 'cluster_geometric_A',
  'N', 'medium', 'uncommon',
  true, 'adobe', 'adobe_fonts', 'https://fonts.adobe.com/fonts/futura-100-book',
  false, NULL, NULL, NULL,
  'classic', 'single_weight', 'low', 'semi_open',
  '"futura-100-book", sans-serif', '{"a_type": null, "e_aperture": "semi_open", "axis": null, "contrast": "low", "terminals": null, "serifs": null, "x_height": null, "fixed_width": false, "width": "normal", "caps_only": false, "distinctive_w": false}'::jsonb,
  false, 'training', 'review'
)
ON CONFLICT (typeface_slug) DO UPDATE SET
  font_source = EXCLUDED.font_source,
  license_type = EXCLUDED.license_type,
  activation_status = EXCLUDED.activation_status,
  fallback_stack = EXCLUDED.fallback_stack,
  qa_status = EXCLUDED.qa_status,
  updated_at_utc = now();

INSERT INTO typefaces_core (
  typeface_slug, display_name, display_name_ascii,
  primary_category, sub_category, visual_cluster_id,
  dreyfus_tier, difficulty_base, rarity_tag,
  activation_status, font_source, license_type, license_url,
  is_variable_font, designer, foundry, release_year,
  year_tag, weight_structure, contrast_profile, aperture_profile,
  fallback_stack, structural_signature_json,
  expert_enabled, min_mode, qa_status
) VALUES (
  'futura_100_latin_ext', 'Futura 100 Latin Ext', 'Futura 100 Latin Ext',
  'sans_serif', 'geometric', 'cluster_geometric_A',
  'N', 'medium', 'uncommon',
  true, 'adobe', 'adobe_fonts', 'https://fonts.adobe.com/fonts/futura-100-latin-ext',
  false, NULL, NULL, NULL,
  'classic', 'single_weight', 'low', 'semi_open',
  '"futura-100-latin-ext", sans-serif', '{"a_type": null, "e_aperture": "semi_open", "axis": null, "contrast": "low", "terminals": null, "serifs": null, "x_height": null, "fixed_width": false, "width": "normal", "caps_only": false, "distinctive_w": false}'::jsonb,
  false, 'training', 'review'
)
ON CONFLICT (typeface_slug) DO UPDATE SET
  font_source = EXCLUDED.font_source,
  license_type = EXCLUDED.license_type,
  activation_status = EXCLUDED.activation_status,
  fallback_stack = EXCLUDED.fallback_stack,
  qa_status = EXCLUDED.qa_status,
  updated_at_utc = now();

INSERT INTO typefaces_core (
  typeface_slug, display_name, display_name_ascii,
  primary_category, sub_category, visual_cluster_id,
  dreyfus_tier, difficulty_base, rarity_tag,
  activation_status, font_source, license_type, license_url,
  is_variable_font, designer, foundry, release_year,
  year_tag, weight_structure, contrast_profile, aperture_profile,
  fallback_stack, structural_signature_json,
  expert_enabled, min_mode, qa_status
) VALUES (
  'futura_100_latin_ext_book', 'Futura 100 Latin Ext Book', 'Futura 100 Latin Ext Book',
  'sans_serif', 'geometric', 'cluster_geometric_A',
  'N', 'medium', 'uncommon',
  true, 'adobe', 'adobe_fonts', 'https://fonts.adobe.com/fonts/futura-100-latin-ext-book',
  false, NULL, NULL, NULL,
  'classic', 'single_weight', 'low', 'semi_open',
  '"futura-100-latin-ext-book", sans-serif', '{"a_type": null, "e_aperture": "semi_open", "axis": null, "contrast": "low", "terminals": null, "serifs": null, "x_height": null, "fixed_width": false, "width": "normal", "caps_only": false, "distinctive_w": false}'::jsonb,
  false, 'training', 'review'
)
ON CONFLICT (typeface_slug) DO UPDATE SET
  font_source = EXCLUDED.font_source,
  license_type = EXCLUDED.license_type,
  activation_status = EXCLUDED.activation_status,
  fallback_stack = EXCLUDED.fallback_stack,
  qa_status = EXCLUDED.qa_status,
  updated_at_utc = now();

INSERT INTO typefaces_core (
  typeface_slug, display_name, display_name_ascii,
  primary_category, sub_category, visual_cluster_id,
  dreyfus_tier, difficulty_base, rarity_tag,
  activation_status, font_source, license_type, license_url,
  is_variable_font, designer, foundry, release_year,
  year_tag, weight_structure, contrast_profile, aperture_profile,
  fallback_stack, structural_signature_json,
  expert_enabled, min_mode, qa_status
) VALUES (
  'futura_pt', 'Futura PT', 'Futura PT',
  'sans_serif', 'geometric', 'cluster_geometric_A',
  'N', 'easy', 'common',
  true, 'adobe', 'adobe_fonts', 'https://fonts.adobe.com/fonts/futura-pt',
  false, NULL, NULL, NULL,
  'classic', 'single_weight', 'low', 'semi_open',
  '"futura-pt", sans-serif', '{"a_type": null, "e_aperture": "semi_open", "axis": null, "contrast": "low", "terminals": null, "serifs": null, "x_height": null, "fixed_width": false, "width": "normal", "caps_only": false, "distinctive_w": false}'::jsonb,
  false, 'training', 'review'
)
ON CONFLICT (typeface_slug) DO UPDATE SET
  font_source = EXCLUDED.font_source,
  license_type = EXCLUDED.license_type,
  activation_status = EXCLUDED.activation_status,
  fallback_stack = EXCLUDED.fallback_stack,
  qa_status = EXCLUDED.qa_status,
  updated_at_utc = now();

INSERT INTO typefaces_core (
  typeface_slug, display_name, display_name_ascii,
  primary_category, sub_category, visual_cluster_id,
  dreyfus_tier, difficulty_base, rarity_tag,
  activation_status, font_source, license_type, license_url,
  is_variable_font, designer, foundry, release_year,
  year_tag, weight_structure, contrast_profile, aperture_profile,
  fallback_stack, structural_signature_json,
  expert_enabled, min_mode, qa_status
) VALUES (
  'futura_pt_bold', 'Futura PT Bold', 'Futura PT Bold',
  'sans_serif', 'geometric', 'cluster_geometric_A',
  'N', 'medium', 'uncommon',
  true, 'adobe', 'adobe_fonts', 'https://fonts.adobe.com/fonts/futura-pt-bold',
  false, NULL, NULL, NULL,
  'classic', 'single_weight', 'low', 'semi_open',
  '"futura-pt-bold", sans-serif', '{"a_type": null, "e_aperture": "semi_open", "axis": null, "contrast": "low", "terminals": null, "serifs": null, "x_height": null, "fixed_width": false, "width": "normal", "caps_only": false, "distinctive_w": false}'::jsonb,
  false, 'training', 'review'
)
ON CONFLICT (typeface_slug) DO UPDATE SET
  font_source = EXCLUDED.font_source,
  license_type = EXCLUDED.license_type,
  activation_status = EXCLUDED.activation_status,
  fallback_stack = EXCLUDED.fallback_stack,
  qa_status = EXCLUDED.qa_status,
  updated_at_utc = now();

INSERT INTO typefaces_core (
  typeface_slug, display_name, display_name_ascii,
  primary_category, sub_category, visual_cluster_id,
  dreyfus_tier, difficulty_base, rarity_tag,
  activation_status, font_source, license_type, license_url,
  is_variable_font, designer, foundry, release_year,
  year_tag, weight_structure, contrast_profile, aperture_profile,
  fallback_stack, structural_signature_json,
  expert_enabled, min_mode, qa_status
) VALUES (
  'futura_pt_condensed', 'Futura PT Condensed', 'Futura PT Condensed',
  'sans_serif', 'geometric', 'cluster_geometric_A',
  'N', 'medium', 'uncommon',
  true, 'adobe', 'adobe_fonts', 'https://fonts.adobe.com/fonts/futura-pt-condensed',
  false, NULL, NULL, NULL,
  'classic', 'single_weight', 'low', 'semi_open',
  '"futura-pt-condensed", sans-serif', '{"a_type": null, "e_aperture": "semi_open", "axis": null, "contrast": "low", "terminals": null, "serifs": null, "x_height": null, "fixed_width": false, "width": "normal", "caps_only": false, "distinctive_w": false}'::jsonb,
  false, 'training', 'review'
)
ON CONFLICT (typeface_slug) DO UPDATE SET
  font_source = EXCLUDED.font_source,
  license_type = EXCLUDED.license_type,
  activation_status = EXCLUDED.activation_status,
  fallback_stack = EXCLUDED.fallback_stack,
  qa_status = EXCLUDED.qa_status,
  updated_at_utc = now();

INSERT INTO typefaces_core (
  typeface_slug, display_name, display_name_ascii,
  primary_category, sub_category, visual_cluster_id,
  dreyfus_tier, difficulty_base, rarity_tag,
  activation_status, font_source, license_type, license_url,
  is_variable_font, designer, foundry, release_year,
  year_tag, weight_structure, contrast_profile, aperture_profile,
  fallback_stack, structural_signature_json,
  expert_enabled, min_mode, qa_status
) VALUES (
  'garamond_atf_micro', 'Garamond ATF Micro', 'Garamond ATF Micro',
  'serif', 'old_style', 'cluster_oldstyle_A',
  'N', 'medium', 'uncommon',
  true, 'adobe', 'adobe_fonts', 'https://fonts.adobe.com/fonts/garamond-atf-micro',
  false, NULL, NULL, NULL,
  'classic', 'single_weight', 'medium', 'semi_open',
  '"garamond-atf-micro", serif', '{"a_type": null, "e_aperture": "semi_open", "axis": null, "contrast": "medium", "terminals": null, "serifs": "present", "x_height": null, "fixed_width": false, "width": "normal", "caps_only": false, "distinctive_w": false}'::jsonb,
  false, 'training', 'review'
)
ON CONFLICT (typeface_slug) DO UPDATE SET
  font_source = EXCLUDED.font_source,
  license_type = EXCLUDED.license_type,
  activation_status = EXCLUDED.activation_status,
  fallback_stack = EXCLUDED.fallback_stack,
  qa_status = EXCLUDED.qa_status,
  updated_at_utc = now();

INSERT INTO typefaces_core (
  typeface_slug, display_name, display_name_ascii,
  primary_category, sub_category, visual_cluster_id,
  dreyfus_tier, difficulty_base, rarity_tag,
  activation_status, font_source, license_type, license_url,
  is_variable_font, designer, foundry, release_year,
  year_tag, weight_structure, contrast_profile, aperture_profile,
  fallback_stack, structural_signature_json,
  expert_enabled, min_mode, qa_status
) VALUES (
  'garamond_atf_subhead', 'Garamond ATF Subhead', 'Garamond ATF Subhead',
  'serif', 'old_style', 'cluster_oldstyle_A',
  'N', 'medium', 'uncommon',
  true, 'adobe', 'adobe_fonts', 'https://fonts.adobe.com/fonts/garamond-atf-subhead',
  false, NULL, NULL, NULL,
  'classic', 'single_weight', 'medium', 'semi_open',
  '"garamond-atf-subhead", serif', '{"a_type": null, "e_aperture": "semi_open", "axis": null, "contrast": "medium", "terminals": null, "serifs": "present", "x_height": null, "fixed_width": false, "width": "normal", "caps_only": false, "distinctive_w": false}'::jsonb,
  false, 'training', 'review'
)
ON CONFLICT (typeface_slug) DO UPDATE SET
  font_source = EXCLUDED.font_source,
  license_type = EXCLUDED.license_type,
  activation_status = EXCLUDED.activation_status,
  fallback_stack = EXCLUDED.fallback_stack,
  qa_status = EXCLUDED.qa_status,
  updated_at_utc = now();

INSERT INTO typefaces_core (
  typeface_slug, display_name, display_name_ascii,
  primary_category, sub_category, visual_cluster_id,
  dreyfus_tier, difficulty_base, rarity_tag,
  activation_status, font_source, license_type, license_url,
  is_variable_font, designer, foundry, release_year,
  year_tag, weight_structure, contrast_profile, aperture_profile,
  fallback_stack, structural_signature_json,
  expert_enabled, min_mode, qa_status
) VALUES (
  'garamond_atf_text', 'Garamond ATF Text', 'Garamond ATF Text',
  'serif', 'old_style', 'cluster_oldstyle_A',
  'N', 'medium', 'uncommon',
  true, 'adobe', 'adobe_fonts', 'https://fonts.adobe.com/fonts/garamond-atf-text',
  false, NULL, NULL, NULL,
  'classic', 'single_weight', 'medium', 'semi_open',
  '"garamond-atf-text", serif', '{"a_type": null, "e_aperture": "semi_open", "axis": null, "contrast": "medium", "terminals": null, "serifs": "present", "x_height": null, "fixed_width": false, "width": "normal", "caps_only": false, "distinctive_w": false}'::jsonb,
  false, 'training', 'review'
)
ON CONFLICT (typeface_slug) DO UPDATE SET
  font_source = EXCLUDED.font_source,
  license_type = EXCLUDED.license_type,
  activation_status = EXCLUDED.activation_status,
  fallback_stack = EXCLUDED.fallback_stack,
  qa_status = EXCLUDED.qa_status,
  updated_at_utc = now();

INSERT INTO typefaces_core (
  typeface_slug, display_name, display_name_ascii,
  primary_category, sub_category, visual_cluster_id,
  dreyfus_tier, difficulty_base, rarity_tag,
  activation_status, font_source, license_type, license_url,
  is_variable_font, designer, foundry, release_year,
  year_tag, weight_structure, contrast_profile, aperture_profile,
  fallback_stack, structural_signature_json,
  expert_enabled, min_mode, qa_status
) VALUES (
  'garamond_premier_pro', 'Garamond Premier Pro', 'Garamond Premier Pro',
  'serif', 'old_style', 'cluster_oldstyle_A',
  'N', 'medium', 'uncommon',
  true, 'adobe', 'adobe_fonts', 'https://fonts.adobe.com/fonts/garamond-premier-pro',
  false, NULL, NULL, NULL,
  'classic', 'single_weight', 'medium', 'semi_open',
  '"garamond-premier-pro", serif', '{"a_type": null, "e_aperture": "semi_open", "axis": null, "contrast": "medium", "terminals": null, "serifs": "present", "x_height": null, "fixed_width": false, "width": "normal", "caps_only": false, "distinctive_w": false}'::jsonb,
  false, 'training', 'review'
)
ON CONFLICT (typeface_slug) DO UPDATE SET
  font_source = EXCLUDED.font_source,
  license_type = EXCLUDED.license_type,
  activation_status = EXCLUDED.activation_status,
  fallback_stack = EXCLUDED.fallback_stack,
  qa_status = EXCLUDED.qa_status,
  updated_at_utc = now();

INSERT INTO typefaces_core (
  typeface_slug, display_name, display_name_ascii,
  primary_category, sub_category, visual_cluster_id,
  dreyfus_tier, difficulty_base, rarity_tag,
  activation_status, font_source, license_type, license_url,
  is_variable_font, designer, foundry, release_year,
  year_tag, weight_structure, contrast_profile, aperture_profile,
  fallback_stack, structural_signature_json,
  expert_enabled, min_mode, qa_status
) VALUES (
  'garamond_premier_pro_caption', 'Garamond Premier Pro Caption', 'Garamond Premier Pro Caption',
  'serif', 'old_style', 'cluster_oldstyle_A',
  'N', 'medium', 'uncommon',
  true, 'adobe', 'adobe_fonts', 'https://fonts.adobe.com/fonts/garamond-premier-pro-caption',
  false, NULL, NULL, NULL,
  'classic', 'single_weight', 'medium', 'semi_open',
  '"garamond-premier-pro-caption", serif', '{"a_type": null, "e_aperture": "semi_open", "axis": null, "contrast": "medium", "terminals": null, "serifs": "present", "x_height": null, "fixed_width": false, "width": "normal", "caps_only": false, "distinctive_w": false}'::jsonb,
  false, 'training', 'review'
)
ON CONFLICT (typeface_slug) DO UPDATE SET
  font_source = EXCLUDED.font_source,
  license_type = EXCLUDED.license_type,
  activation_status = EXCLUDED.activation_status,
  fallback_stack = EXCLUDED.fallback_stack,
  qa_status = EXCLUDED.qa_status,
  updated_at_utc = now();

INSERT INTO typefaces_core (
  typeface_slug, display_name, display_name_ascii,
  primary_category, sub_category, visual_cluster_id,
  dreyfus_tier, difficulty_base, rarity_tag,
  activation_status, font_source, license_type, license_url,
  is_variable_font, designer, foundry, release_year,
  year_tag, weight_structure, contrast_profile, aperture_profile,
  fallback_stack, structural_signature_json,
  expert_enabled, min_mode, qa_status
) VALUES (
  'garamond_premier_pro_display', 'Garamond Premier Pro Display', 'Garamond Premier Pro Display',
  'serif', 'old_style', 'cluster_oldstyle_A',
  'N', 'medium', 'uncommon',
  true, 'adobe', 'adobe_fonts', 'https://fonts.adobe.com/fonts/garamond-premier-pro-display',
  false, NULL, NULL, NULL,
  'classic', 'single_weight', 'medium', 'semi_open',
  '"garamond-premier-pro-display", serif', '{"a_type": null, "e_aperture": "semi_open", "axis": null, "contrast": "medium", "terminals": null, "serifs": "present", "x_height": null, "fixed_width": false, "width": "normal", "caps_only": false, "distinctive_w": false}'::jsonb,
  false, 'training', 'review'
)
ON CONFLICT (typeface_slug) DO UPDATE SET
  font_source = EXCLUDED.font_source,
  license_type = EXCLUDED.license_type,
  activation_status = EXCLUDED.activation_status,
  fallback_stack = EXCLUDED.fallback_stack,
  qa_status = EXCLUDED.qa_status,
  updated_at_utc = now();

INSERT INTO typefaces_core (
  typeface_slug, display_name, display_name_ascii,
  primary_category, sub_category, visual_cluster_id,
  dreyfus_tier, difficulty_base, rarity_tag,
  activation_status, font_source, license_type, license_url,
  is_variable_font, designer, foundry, release_year,
  year_tag, weight_structure, contrast_profile, aperture_profile,
  fallback_stack, structural_signature_json,
  expert_enabled, min_mode, qa_status
) VALUES (
  'garamond_premier_pro_subhead', 'Garamond Premier Pro Subhead', 'Garamond Premier Pro Subhead',
  'serif', 'old_style', 'cluster_oldstyle_A',
  'N', 'medium', 'uncommon',
  true, 'adobe', 'adobe_fonts', 'https://fonts.adobe.com/fonts/garamond-premier-pro-subhead',
  false, NULL, NULL, NULL,
  'classic', 'single_weight', 'medium', 'semi_open',
  '"garamond-premier-pro-subhead", serif', '{"a_type": null, "e_aperture": "semi_open", "axis": null, "contrast": "medium", "terminals": null, "serifs": "present", "x_height": null, "fixed_width": false, "width": "normal", "caps_only": false, "distinctive_w": false}'::jsonb,
  false, 'training', 'review'
)
ON CONFLICT (typeface_slug) DO UPDATE SET
  font_source = EXCLUDED.font_source,
  license_type = EXCLUDED.license_type,
  activation_status = EXCLUDED.activation_status,
  fallback_stack = EXCLUDED.fallback_stack,
  qa_status = EXCLUDED.qa_status,
  updated_at_utc = now();

INSERT INTO typefaces_core (
  typeface_slug, display_name, display_name_ascii,
  primary_category, sub_category, visual_cluster_id,
  dreyfus_tier, difficulty_base, rarity_tag,
  activation_status, font_source, license_type, license_url,
  is_variable_font, designer, foundry, release_year,
  year_tag, weight_structure, contrast_profile, aperture_profile,
  fallback_stack, structural_signature_json,
  expert_enabled, min_mode, qa_status
) VALUES (
  'georgiapro', 'GeorgiaPro', 'GeorgiaPro',
  'serif', 'transitional', 'cluster_transitional_A',
  'N', 'medium', 'uncommon',
  true, 'adobe', 'adobe_fonts', 'https://fonts.adobe.com/fonts/georgiapro',
  false, NULL, NULL, NULL,
  'classic', 'single_weight', 'medium', 'semi_open',
  '"georgiapro", serif', '{"a_type": null, "e_aperture": "semi_open", "axis": null, "contrast": "medium", "terminals": null, "serifs": "present", "x_height": null, "fixed_width": false, "width": "normal", "caps_only": false, "distinctive_w": false}'::jsonb,
  false, 'training', 'review'
)
ON CONFLICT (typeface_slug) DO UPDATE SET
  font_source = EXCLUDED.font_source,
  license_type = EXCLUDED.license_type,
  activation_status = EXCLUDED.activation_status,
  fallback_stack = EXCLUDED.fallback_stack,
  qa_status = EXCLUDED.qa_status,
  updated_at_utc = now();

INSERT INTO typefaces_core (
  typeface_slug, display_name, display_name_ascii,
  primary_category, sub_category, visual_cluster_id,
  dreyfus_tier, difficulty_base, rarity_tag,
  activation_status, font_source, license_type, license_url,
  is_variable_font, designer, foundry, release_year,
  year_tag, weight_structure, contrast_profile, aperture_profile,
  fallback_stack, structural_signature_json,
  expert_enabled, min_mode, qa_status
) VALUES (
  'georgiapro_condensed', 'GeorgiaPro Condensed', 'GeorgiaPro Condensed',
  'serif', 'transitional', 'cluster_transitional_A',
  'N', 'medium', 'uncommon',
  true, 'adobe', 'adobe_fonts', 'https://fonts.adobe.com/fonts/georgiapro-condensed',
  false, NULL, NULL, NULL,
  'classic', 'single_weight', 'medium', 'semi_open',
  '"georgiapro-condensed", serif', '{"a_type": null, "e_aperture": "semi_open", "axis": null, "contrast": "medium", "terminals": null, "serifs": "present", "x_height": null, "fixed_width": false, "width": "normal", "caps_only": false, "distinctive_w": false}'::jsonb,
  false, 'training', 'review'
)
ON CONFLICT (typeface_slug) DO UPDATE SET
  font_source = EXCLUDED.font_source,
  license_type = EXCLUDED.license_type,
  activation_status = EXCLUDED.activation_status,
  fallback_stack = EXCLUDED.fallback_stack,
  qa_status = EXCLUDED.qa_status,
  updated_at_utc = now();

INSERT INTO typefaces_core (
  typeface_slug, display_name, display_name_ascii,
  primary_category, sub_category, visual_cluster_id,
  dreyfus_tier, difficulty_base, rarity_tag,
  activation_status, font_source, license_type, license_url,
  is_variable_font, designer, foundry, release_year,
  year_tag, weight_structure, contrast_profile, aperture_profile,
  fallback_stack, structural_signature_json,
  expert_enabled, min_mode, qa_status
) VALUES (
  'gill_sans_nova', 'Gill Sans Nova', 'Gill Sans Nova',
  'sans_serif', 'humanist', 'cluster_humanist_A',
  'N', 'easy', 'common',
  true, 'adobe', 'adobe_fonts', 'https://fonts.adobe.com/fonts/gill-sans-nova',
  false, NULL, NULL, NULL,
  'classic', 'single_weight', 'low', 'semi_open',
  '"gill-sans-nova", sans-serif', '{"a_type": null, "e_aperture": "semi_open", "axis": null, "contrast": "low", "terminals": null, "serifs": null, "x_height": null, "fixed_width": false, "width": "normal", "caps_only": false, "distinctive_w": false}'::jsonb,
  false, 'training', 'review'
)
ON CONFLICT (typeface_slug) DO UPDATE SET
  font_source = EXCLUDED.font_source,
  license_type = EXCLUDED.license_type,
  activation_status = EXCLUDED.activation_status,
  fallback_stack = EXCLUDED.fallback_stack,
  qa_status = EXCLUDED.qa_status,
  updated_at_utc = now();

INSERT INTO typefaces_core (
  typeface_slug, display_name, display_name_ascii,
  primary_category, sub_category, visual_cluster_id,
  dreyfus_tier, difficulty_base, rarity_tag,
  activation_status, font_source, license_type, license_url,
  is_variable_font, designer, foundry, release_year,
  year_tag, weight_structure, contrast_profile, aperture_profile,
  fallback_stack, structural_signature_json,
  expert_enabled, min_mode, qa_status
) VALUES (
  'gill_sans_nova_condensed', 'Gill Sans Nova Condensed', 'Gill Sans Nova Condensed',
  'sans_serif', 'humanist', 'cluster_humanist_A',
  'N', 'medium', 'uncommon',
  true, 'adobe', 'adobe_fonts', 'https://fonts.adobe.com/fonts/gill-sans-nova-condensed',
  false, NULL, NULL, NULL,
  'classic', 'single_weight', 'low', 'semi_open',
  '"gill-sans-nova-condensed", sans-serif', '{"a_type": null, "e_aperture": "semi_open", "axis": null, "contrast": "low", "terminals": null, "serifs": null, "x_height": null, "fixed_width": false, "width": "normal", "caps_only": false, "distinctive_w": false}'::jsonb,
  false, 'training', 'review'
)
ON CONFLICT (typeface_slug) DO UPDATE SET
  font_source = EXCLUDED.font_source,
  license_type = EXCLUDED.license_type,
  activation_status = EXCLUDED.activation_status,
  fallback_stack = EXCLUDED.fallback_stack,
  qa_status = EXCLUDED.qa_status,
  updated_at_utc = now();

INSERT INTO typefaces_core (
  typeface_slug, display_name, display_name_ascii,
  primary_category, sub_category, visual_cluster_id,
  dreyfus_tier, difficulty_base, rarity_tag,
  activation_status, font_source, license_type, license_url,
  is_variable_font, designer, foundry, release_year,
  year_tag, weight_structure, contrast_profile, aperture_profile,
  fallback_stack, structural_signature_json,
  expert_enabled, min_mode, qa_status
) VALUES (
  'gill_sans_nova_deco', 'Gill Sans Nova Deco', 'Gill Sans Nova Deco',
  'sans_serif', 'humanist', 'cluster_humanist_A',
  'N', 'medium', 'uncommon',
  true, 'adobe', 'adobe_fonts', 'https://fonts.adobe.com/fonts/gill-sans-nova-deco',
  false, NULL, NULL, NULL,
  'classic', 'single_weight', 'low', 'semi_open',
  '"gill-sans-nova-deco", sans-serif', '{"a_type": null, "e_aperture": "semi_open", "axis": null, "contrast": "low", "terminals": null, "serifs": null, "x_height": null, "fixed_width": false, "width": "normal", "caps_only": false, "distinctive_w": false}'::jsonb,
  false, 'training', 'review'
)
ON CONFLICT (typeface_slug) DO UPDATE SET
  font_source = EXCLUDED.font_source,
  license_type = EXCLUDED.license_type,
  activation_status = EXCLUDED.activation_status,
  fallback_stack = EXCLUDED.fallback_stack,
  qa_status = EXCLUDED.qa_status,
  updated_at_utc = now();

INSERT INTO typefaces_core (
  typeface_slug, display_name, display_name_ascii,
  primary_category, sub_category, visual_cluster_id,
  dreyfus_tier, difficulty_base, rarity_tag,
  activation_status, font_source, license_type, license_url,
  is_variable_font, designer, foundry, release_year,
  year_tag, weight_structure, contrast_profile, aperture_profile,
  fallback_stack, structural_signature_json,
  expert_enabled, min_mode, qa_status
) VALUES (
  'gill_sans_nova_extra_condensed', 'Gill Sans Nova Extra Condensed', 'Gill Sans Nova Extra Condensed',
  'sans_serif', 'humanist', 'cluster_humanist_A',
  'N', 'medium', 'uncommon',
  true, 'adobe', 'adobe_fonts', 'https://fonts.adobe.com/fonts/gill-sans-nova-extra-condensed',
  false, NULL, NULL, NULL,
  'classic', 'single_weight', 'low', 'semi_open',
  '"gill-sans-nova-extra-condens", sans-serif', '{"a_type": null, "e_aperture": "semi_open", "axis": null, "contrast": "low", "terminals": null, "serifs": null, "x_height": null, "fixed_width": false, "width": "normal", "caps_only": false, "distinctive_w": false}'::jsonb,
  false, 'training', 'review'
)
ON CONFLICT (typeface_slug) DO UPDATE SET
  font_source = EXCLUDED.font_source,
  license_type = EXCLUDED.license_type,
  activation_status = EXCLUDED.activation_status,
  fallback_stack = EXCLUDED.fallback_stack,
  qa_status = EXCLUDED.qa_status,
  updated_at_utc = now();

INSERT INTO typefaces_core (
  typeface_slug, display_name, display_name_ascii,
  primary_category, sub_category, visual_cluster_id,
  dreyfus_tier, difficulty_base, rarity_tag,
  activation_status, font_source, license_type, license_url,
  is_variable_font, designer, foundry, release_year,
  year_tag, weight_structure, contrast_profile, aperture_profile,
  fallback_stack, structural_signature_json,
  expert_enabled, min_mode, qa_status
) VALUES (
  'gill_sans_nova_inline', 'Gill Sans Nova Inline', 'Gill Sans Nova Inline',
  'sans_serif', 'humanist', 'cluster_humanist_A',
  'N', 'medium', 'uncommon',
  true, 'adobe', 'adobe_fonts', 'https://fonts.adobe.com/fonts/gill-sans-nova-inline',
  false, NULL, NULL, NULL,
  'classic', 'single_weight', 'low', 'semi_open',
  '"gill-sans-nova-inline", sans-serif', '{"a_type": null, "e_aperture": "semi_open", "axis": null, "contrast": "low", "terminals": null, "serifs": null, "x_height": null, "fixed_width": false, "width": "normal", "caps_only": false, "distinctive_w": false}'::jsonb,
  false, 'training', 'review'
)
ON CONFLICT (typeface_slug) DO UPDATE SET
  font_source = EXCLUDED.font_source,
  license_type = EXCLUDED.license_type,
  activation_status = EXCLUDED.activation_status,
  fallback_stack = EXCLUDED.fallback_stack,
  qa_status = EXCLUDED.qa_status,
  updated_at_utc = now();

INSERT INTO typefaces_core (
  typeface_slug, display_name, display_name_ascii,
  primary_category, sub_category, visual_cluster_id,
  dreyfus_tier, difficulty_base, rarity_tag,
  activation_status, font_source, license_type, license_url,
  is_variable_font, designer, foundry, release_year,
  year_tag, weight_structure, contrast_profile, aperture_profile,
  fallback_stack, structural_signature_json,
  expert_enabled, min_mode, qa_status
) VALUES (
  'gill_sans_nova_inline_condensed', 'Gill Sans Nova Inline Condensed', 'Gill Sans Nova Inline Condensed',
  'sans_serif', 'humanist', 'cluster_humanist_A',
  'N', 'medium', 'uncommon',
  true, 'adobe', 'adobe_fonts', 'https://fonts.adobe.com/fonts/gill-sans-nova-inline-condensed',
  false, NULL, NULL, NULL,
  'classic', 'single_weight', 'low', 'semi_open',
  '"gill-sans-nova-inline-conden", sans-serif', '{"a_type": null, "e_aperture": "semi_open", "axis": null, "contrast": "low", "terminals": null, "serifs": null, "x_height": null, "fixed_width": false, "width": "normal", "caps_only": false, "distinctive_w": false}'::jsonb,
  false, 'training', 'review'
)
ON CONFLICT (typeface_slug) DO UPDATE SET
  font_source = EXCLUDED.font_source,
  license_type = EXCLUDED.license_type,
  activation_status = EXCLUDED.activation_status,
  fallback_stack = EXCLUDED.fallback_stack,
  qa_status = EXCLUDED.qa_status,
  updated_at_utc = now();

INSERT INTO typefaces_core (
  typeface_slug, display_name, display_name_ascii,
  primary_category, sub_category, visual_cluster_id,
  dreyfus_tier, difficulty_base, rarity_tag,
  activation_status, font_source, license_type, license_url,
  is_variable_font, designer, foundry, release_year,
  year_tag, weight_structure, contrast_profile, aperture_profile,
  fallback_stack, structural_signature_json,
  expert_enabled, min_mode, qa_status
) VALUES (
  'gill_sans_nova_shadowed', 'Gill Sans Nova Shadowed', 'Gill Sans Nova Shadowed',
  'sans_serif', 'humanist', 'cluster_humanist_A',
  'N', 'medium', 'uncommon',
  true, 'adobe', 'adobe_fonts', 'https://fonts.adobe.com/fonts/gill-sans-nova-shadowed',
  false, NULL, NULL, NULL,
  'classic', 'single_weight', 'low', 'semi_open',
  '"gill-sans-nova-shadowed", sans-serif', '{"a_type": null, "e_aperture": "semi_open", "axis": null, "contrast": "low", "terminals": null, "serifs": null, "x_height": null, "fixed_width": false, "width": "normal", "caps_only": false, "distinctive_w": false}'::jsonb,
  false, 'training', 'review'
)
ON CONFLICT (typeface_slug) DO UPDATE SET
  font_source = EXCLUDED.font_source,
  license_type = EXCLUDED.license_type,
  activation_status = EXCLUDED.activation_status,
  fallback_stack = EXCLUDED.fallback_stack,
  qa_status = EXCLUDED.qa_status,
  updated_at_utc = now();

INSERT INTO typefaces_core (
  typeface_slug, display_name, display_name_ascii,
  primary_category, sub_category, visual_cluster_id,
  dreyfus_tier, difficulty_base, rarity_tag,
  activation_status, font_source, license_type, license_url,
  is_variable_font, designer, foundry, release_year,
  year_tag, weight_structure, contrast_profile, aperture_profile,
  fallback_stack, structural_signature_json,
  expert_enabled, min_mode, qa_status
) VALUES (
  'gill_sans_nova_shadowed_outline', 'Gill Sans Nova Shadowed Outline', 'Gill Sans Nova Shadowed Outline',
  'sans_serif', 'humanist', 'cluster_humanist_A',
  'N', 'medium', 'uncommon',
  true, 'adobe', 'adobe_fonts', 'https://fonts.adobe.com/fonts/gill-sans-nova-shadowed-outline',
  false, NULL, NULL, NULL,
  'classic', 'single_weight', 'low', 'semi_open',
  '"gill-sans-nova-shadowed-outl", sans-serif', '{"a_type": null, "e_aperture": "semi_open", "axis": null, "contrast": "low", "terminals": null, "serifs": null, "x_height": null, "fixed_width": false, "width": "normal", "caps_only": false, "distinctive_w": false}'::jsonb,
  false, 'training', 'review'
)
ON CONFLICT (typeface_slug) DO UPDATE SET
  font_source = EXCLUDED.font_source,
  license_type = EXCLUDED.license_type,
  activation_status = EXCLUDED.activation_status,
  fallback_stack = EXCLUDED.fallback_stack,
  qa_status = EXCLUDED.qa_status,
  updated_at_utc = now();

INSERT INTO typefaces_core (
  typeface_slug, display_name, display_name_ascii,
  primary_category, sub_category, visual_cluster_id,
  dreyfus_tier, difficulty_base, rarity_tag,
  activation_status, font_source, license_type, license_url,
  is_variable_font, designer, foundry, release_year,
  year_tag, weight_structure, contrast_profile, aperture_profile,
  fallback_stack, structural_signature_json,
  expert_enabled, min_mode, qa_status
) VALUES (
  'helvetica_lt_pro', 'Helvetica LT Pro', 'Helvetica LT Pro',
  'sans_serif', 'neo_grotesk', 'cluster_neo_grotesk_A',
  'N', 'easy', 'common',
  true, 'adobe', 'adobe_fonts', 'https://fonts.adobe.com/fonts/helvetica-lt-pro',
  false, NULL, NULL, NULL,
  'classic', 'single_weight', 'low', 'semi_open',
  '"helvetica-lt-pro", sans-serif', '{"a_type": null, "e_aperture": "semi_open", "axis": null, "contrast": "low", "terminals": null, "serifs": null, "x_height": null, "fixed_width": false, "width": "normal", "caps_only": false, "distinctive_w": false}'::jsonb,
  false, 'training', 'review'
)
ON CONFLICT (typeface_slug) DO UPDATE SET
  font_source = EXCLUDED.font_source,
  license_type = EXCLUDED.license_type,
  activation_status = EXCLUDED.activation_status,
  fallback_stack = EXCLUDED.fallback_stack,
  qa_status = EXCLUDED.qa_status,
  updated_at_utc = now();

INSERT INTO typefaces_core (
  typeface_slug, display_name, display_name_ascii,
  primary_category, sub_category, visual_cluster_id,
  dreyfus_tier, difficulty_base, rarity_tag,
  activation_status, font_source, license_type, license_url,
  is_variable_font, designer, foundry, release_year,
  year_tag, weight_structure, contrast_profile, aperture_profile,
  fallback_stack, structural_signature_json,
  expert_enabled, min_mode, qa_status
) VALUES (
  'helvetica_neue_lt_pro', 'Helvetica Neue LT Pro', 'Helvetica Neue LT Pro',
  'sans_serif', 'neo_grotesk', 'cluster_neo_grotesk_A',
  'N', 'medium', 'uncommon',
  true, 'adobe', 'adobe_fonts', 'https://fonts.adobe.com/fonts/helvetica-neue-lt-pro',
  false, NULL, NULL, NULL,
  'classic', 'single_weight', 'low', 'semi_open',
  '"helvetica-neue-lt-pro", sans-serif', '{"a_type": null, "e_aperture": "semi_open", "axis": null, "contrast": "low", "terminals": null, "serifs": null, "x_height": null, "fixed_width": false, "width": "normal", "caps_only": false, "distinctive_w": false}'::jsonb,
  false, 'training', 'review'
)
ON CONFLICT (typeface_slug) DO UPDATE SET
  font_source = EXCLUDED.font_source,
  license_type = EXCLUDED.license_type,
  activation_status = EXCLUDED.activation_status,
  fallback_stack = EXCLUDED.fallback_stack,
  qa_status = EXCLUDED.qa_status,
  updated_at_utc = now();

INSERT INTO typefaces_core (
  typeface_slug, display_name, display_name_ascii,
  primary_category, sub_category, visual_cluster_id,
  dreyfus_tier, difficulty_base, rarity_tag,
  activation_status, font_source, license_type, license_url,
  is_variable_font, designer, foundry, release_year,
  year_tag, weight_structure, contrast_profile, aperture_profile,
  fallback_stack, structural_signature_json,
  expert_enabled, min_mode, qa_status
) VALUES (
  'helvetica_neue_lt_pro_cond', 'Helvetica Neue LT Pro Cond', 'Helvetica Neue LT Pro Cond',
  'sans_serif', 'neo_grotesk', 'cluster_neo_grotesk_A',
  'N', 'medium', 'uncommon',
  true, 'adobe', 'adobe_fonts', 'https://fonts.adobe.com/fonts/helvetica-neue-lt-pro-cond',
  false, NULL, NULL, NULL,
  'classic', 'single_weight', 'low', 'semi_open',
  '"helvetica-neue-lt-pro-cond", sans-serif', '{"a_type": null, "e_aperture": "semi_open", "axis": null, "contrast": "low", "terminals": null, "serifs": null, "x_height": null, "fixed_width": false, "width": "normal", "caps_only": false, "distinctive_w": false}'::jsonb,
  false, 'training', 'review'
)
ON CONFLICT (typeface_slug) DO UPDATE SET
  font_source = EXCLUDED.font_source,
  license_type = EXCLUDED.license_type,
  activation_status = EXCLUDED.activation_status,
  fallback_stack = EXCLUDED.fallback_stack,
  qa_status = EXCLUDED.qa_status,
  updated_at_utc = now();

INSERT INTO typefaces_core (
  typeface_slug, display_name, display_name_ascii,
  primary_category, sub_category, visual_cluster_id,
  dreyfus_tier, difficulty_base, rarity_tag,
  activation_status, font_source, license_type, license_url,
  is_variable_font, designer, foundry, release_year,
  year_tag, weight_structure, contrast_profile, aperture_profile,
  fallback_stack, structural_signature_json,
  expert_enabled, min_mode, qa_status
) VALUES (
  'helvetica_neue_world', 'Helvetica Neue World', 'Helvetica Neue World',
  'sans_serif', 'neo_grotesk', 'cluster_neo_grotesk_A',
  'N', 'medium', 'uncommon',
  true, 'adobe', 'adobe_fonts', 'https://fonts.adobe.com/fonts/helvetica-neue-world',
  false, NULL, NULL, NULL,
  'classic', 'single_weight', 'low', 'semi_open',
  '"helvetica-neue-world", sans-serif', '{"a_type": null, "e_aperture": "semi_open", "axis": null, "contrast": "low", "terminals": null, "serifs": null, "x_height": null, "fixed_width": false, "width": "normal", "caps_only": false, "distinctive_w": false}'::jsonb,
  false, 'training', 'review'
)
ON CONFLICT (typeface_slug) DO UPDATE SET
  font_source = EXCLUDED.font_source,
  license_type = EXCLUDED.license_type,
  activation_status = EXCLUDED.activation_status,
  fallback_stack = EXCLUDED.fallback_stack,
  qa_status = EXCLUDED.qa_status,
  updated_at_utc = now();

INSERT INTO typefaces_core (
  typeface_slug, display_name, display_name_ascii,
  primary_category, sub_category, visual_cluster_id,
  dreyfus_tier, difficulty_base, rarity_tag,
  activation_status, font_source, license_type, license_url,
  is_variable_font, designer, foundry, release_year,
  year_tag, weight_structure, contrast_profile, aperture_profile,
  fallback_stack, structural_signature_json,
  expert_enabled, min_mode, qa_status
) VALUES (
  'itc_avant_garde_gothic_pro', 'ITC Avant Garde Gothic Pro', 'ITC Avant Garde Gothic Pro',
  'sans_serif', 'geometric', 'cluster_geometric_A',
  'N', 'easy', 'common',
  true, 'adobe', 'adobe_fonts', 'https://fonts.adobe.com/fonts/itc-avant-garde-gothic-pro',
  false, NULL, NULL, NULL,
  'classic', 'single_weight', 'low', 'semi_open',
  '"itc-avant-garde-gothic-pro", sans-serif', '{"a_type": null, "e_aperture": "semi_open", "axis": null, "contrast": "low", "terminals": null, "serifs": null, "x_height": null, "fixed_width": false, "width": "normal", "caps_only": false, "distinctive_w": false}'::jsonb,
  false, 'training', 'review'
)
ON CONFLICT (typeface_slug) DO UPDATE SET
  font_source = EXCLUDED.font_source,
  license_type = EXCLUDED.license_type,
  activation_status = EXCLUDED.activation_status,
  fallback_stack = EXCLUDED.fallback_stack,
  qa_status = EXCLUDED.qa_status,
  updated_at_utc = now();

INSERT INTO typefaces_core (
  typeface_slug, display_name, display_name_ascii,
  primary_category, sub_category, visual_cluster_id,
  dreyfus_tier, difficulty_base, rarity_tag,
  activation_status, font_source, license_type, license_url,
  is_variable_font, designer, foundry, release_year,
  year_tag, weight_structure, contrast_profile, aperture_profile,
  fallback_stack, structural_signature_json,
  expert_enabled, min_mode, qa_status
) VALUES (
  'itc_bodoni_seventytwo_pro', 'ITC Bodoni Seventytwo Pro', 'ITC Bodoni Seventytwo Pro',
  'serif', 'didone', 'cluster_didone_A',
  'N', 'medium', 'uncommon',
  true, 'adobe', 'adobe_fonts', 'https://fonts.adobe.com/fonts/itc-bodoni-seventytwo-pro',
  false, NULL, NULL, NULL,
  'classic', 'single_weight', 'very_high', 'semi_open',
  '"itc-bodoni-seventytwo-pro", serif', '{"a_type": null, "e_aperture": "semi_open", "axis": null, "contrast": "very_high", "terminals": null, "serifs": "present", "x_height": null, "fixed_width": false, "width": "normal", "caps_only": false, "distinctive_w": false}'::jsonb,
  false, 'training', 'review'
)
ON CONFLICT (typeface_slug) DO UPDATE SET
  font_source = EXCLUDED.font_source,
  license_type = EXCLUDED.license_type,
  activation_status = EXCLUDED.activation_status,
  fallback_stack = EXCLUDED.fallback_stack,
  qa_status = EXCLUDED.qa_status,
  updated_at_utc = now();

INSERT INTO typefaces_core (
  typeface_slug, display_name, display_name_ascii,
  primary_category, sub_category, visual_cluster_id,
  dreyfus_tier, difficulty_base, rarity_tag,
  activation_status, font_source, license_type, license_url,
  is_variable_font, designer, foundry, release_year,
  year_tag, weight_structure, contrast_profile, aperture_profile,
  fallback_stack, structural_signature_json,
  expert_enabled, min_mode, qa_status
) VALUES (
  'impact', 'Impact', 'Impact',
  'sans_serif', 'grotesk', 'cluster_grotesk_A',
  'N', 'easy', 'common',
  true, 'adobe', 'adobe_fonts', 'https://fonts.adobe.com/fonts/impact',
  false, NULL, NULL, NULL,
  'classic', 'single_weight', 'low', 'semi_open',
  '"impact", sans-serif', '{"a_type": null, "e_aperture": "semi_open", "axis": null, "contrast": "low", "terminals": null, "serifs": null, "x_height": null, "fixed_width": false, "width": "normal", "caps_only": false, "distinctive_w": false}'::jsonb,
  false, 'training', 'review'
)
ON CONFLICT (typeface_slug) DO UPDATE SET
  font_source = EXCLUDED.font_source,
  license_type = EXCLUDED.license_type,
  activation_status = EXCLUDED.activation_status,
  fallback_stack = EXCLUDED.fallback_stack,
  qa_status = EXCLUDED.qa_status,
  updated_at_utc = now();

INSERT INTO typefaces_core (
  typeface_slug, display_name, display_name_ascii,
  primary_category, sub_category, visual_cluster_id,
  dreyfus_tier, difficulty_base, rarity_tag,
  activation_status, font_source, license_type, license_url,
  is_variable_font, designer, foundry, release_year,
  year_tag, weight_structure, contrast_profile, aperture_profile,
  fallback_stack, structural_signature_json,
  expert_enabled, min_mode, qa_status
) VALUES (
  'king_s_caslon', 'King''s Caslon', 'King''s Caslon',
  'serif', 'old_style', 'cluster_oldstyle_A',
  'N', 'medium', 'uncommon',
  true, 'adobe', 'adobe_fonts', 'https://fonts.adobe.com/fonts/kings-caslon',
  false, NULL, NULL, NULL,
  'classic', 'single_weight', 'medium', 'semi_open',
  '"kings-caslon", serif', '{"a_type": null, "e_aperture": "semi_open", "axis": null, "contrast": "medium", "terminals": null, "serifs": "present", "x_height": null, "fixed_width": false, "width": "normal", "caps_only": false, "distinctive_w": false}'::jsonb,
  false, 'training', 'review'
)
ON CONFLICT (typeface_slug) DO UPDATE SET
  font_source = EXCLUDED.font_source,
  license_type = EXCLUDED.license_type,
  activation_status = EXCLUDED.activation_status,
  fallback_stack = EXCLUDED.fallback_stack,
  qa_status = EXCLUDED.qa_status,
  updated_at_utc = now();

INSERT INTO typefaces_core (
  typeface_slug, display_name, display_name_ascii,
  primary_category, sub_category, visual_cluster_id,
  dreyfus_tier, difficulty_base, rarity_tag,
  activation_status, font_source, license_type, license_url,
  is_variable_font, designer, foundry, release_year,
  year_tag, weight_structure, contrast_profile, aperture_profile,
  fallback_stack, structural_signature_json,
  expert_enabled, min_mode, qa_status
) VALUES (
  'king_s_caslon_display', 'King''s Caslon Display', 'King''s Caslon Display',
  'serif', 'old_style', 'cluster_oldstyle_A',
  'N', 'medium', 'uncommon',
  true, 'adobe', 'adobe_fonts', 'https://fonts.adobe.com/fonts/kings-caslon-display',
  false, NULL, NULL, NULL,
  'classic', 'single_weight', 'medium', 'semi_open',
  '"kings-caslon-display", serif', '{"a_type": null, "e_aperture": "semi_open", "axis": null, "contrast": "medium", "terminals": null, "serifs": "present", "x_height": null, "fixed_width": false, "width": "normal", "caps_only": false, "distinctive_w": false}'::jsonb,
  false, 'training', 'review'
)
ON CONFLICT (typeface_slug) DO UPDATE SET
  font_source = EXCLUDED.font_source,
  license_type = EXCLUDED.license_type,
  activation_status = EXCLUDED.activation_status,
  fallback_stack = EXCLUDED.fallback_stack,
  qa_status = EXCLUDED.qa_status,
  updated_at_utc = now();

INSERT INTO typefaces_core (
  typeface_slug, display_name, display_name_ascii,
  primary_category, sub_category, visual_cluster_id,
  dreyfus_tier, difficulty_base, rarity_tag,
  activation_status, font_source, license_type, license_url,
  is_variable_font, designer, foundry, release_year,
  year_tag, weight_structure, contrast_profile, aperture_profile,
  fallback_stack, structural_signature_json,
  expert_enabled, min_mode, qa_status
) VALUES (
  'ltc_bodoni_175', 'LTC Bodoni 175', 'LTC Bodoni 175',
  'serif', 'didone', 'cluster_didone_A',
  'N', 'medium', 'uncommon',
  true, 'adobe', 'adobe_fonts', 'https://fonts.adobe.com/fonts/ltc-bodoni-175',
  false, NULL, NULL, NULL,
  'classic', 'single_weight', 'very_high', 'semi_open',
  '"ltc-bodoni-175", serif', '{"a_type": null, "e_aperture": "semi_open", "axis": null, "contrast": "very_high", "terminals": null, "serifs": "present", "x_height": null, "fixed_width": false, "width": "normal", "caps_only": false, "distinctive_w": false}'::jsonb,
  false, 'training', 'review'
)
ON CONFLICT (typeface_slug) DO UPDATE SET
  font_source = EXCLUDED.font_source,
  license_type = EXCLUDED.license_type,
  activation_status = EXCLUDED.activation_status,
  fallback_stack = EXCLUDED.fallback_stack,
  qa_status = EXCLUDED.qa_status,
  updated_at_utc = now();

INSERT INTO typefaces_core (
  typeface_slug, display_name, display_name_ascii,
  primary_category, sub_category, visual_cluster_id,
  dreyfus_tier, difficulty_base, rarity_tag,
  activation_status, font_source, license_type, license_url,
  is_variable_font, designer, foundry, release_year,
  year_tag, weight_structure, contrast_profile, aperture_profile,
  fallback_stack, structural_signature_json,
  expert_enabled, min_mode, qa_status
) VALUES (
  'ltc_caslon_pro', 'LTC Caslon Pro', 'LTC Caslon Pro',
  'serif', 'old_style', 'cluster_oldstyle_A',
  'N', 'medium', 'uncommon',
  true, 'adobe', 'adobe_fonts', 'https://fonts.adobe.com/fonts/ltc-caslon-pro',
  false, NULL, NULL, NULL,
  'classic', 'single_weight', 'medium', 'semi_open',
  '"ltc-caslon-pro", serif', '{"a_type": null, "e_aperture": "semi_open", "axis": null, "contrast": "medium", "terminals": null, "serifs": "present", "x_height": null, "fixed_width": false, "width": "normal", "caps_only": false, "distinctive_w": false}'::jsonb,
  false, 'training', 'review'
)
ON CONFLICT (typeface_slug) DO UPDATE SET
  font_source = EXCLUDED.font_source,
  license_type = EXCLUDED.license_type,
  activation_status = EXCLUDED.activation_status,
  fallback_stack = EXCLUDED.fallback_stack,
  qa_status = EXCLUDED.qa_status,
  updated_at_utc = now();

INSERT INTO typefaces_core (
  typeface_slug, display_name, display_name_ascii,
  primary_category, sub_category, visual_cluster_id,
  dreyfus_tier, difficulty_base, rarity_tag,
  activation_status, font_source, license_type, license_url,
  is_variable_font, designer, foundry, release_year,
  year_tag, weight_structure, contrast_profile, aperture_profile,
  fallback_stack, structural_signature_json,
  expert_enabled, min_mode, qa_status
) VALUES (
  'linotype_didot', 'Linotype Didot', 'Linotype Didot',
  'serif', 'didone', 'cluster_didone_A',
  'N', 'easy', 'common',
  true, 'adobe', 'adobe_fonts', 'https://fonts.adobe.com/fonts/linotype-didot',
  false, NULL, NULL, NULL,
  'classic', 'single_weight', 'very_high', 'semi_open',
  '"linotype-didot", serif', '{"a_type": null, "e_aperture": "semi_open", "axis": null, "contrast": "very_high", "terminals": null, "serifs": "present", "x_height": null, "fixed_width": false, "width": "normal", "caps_only": false, "distinctive_w": false}'::jsonb,
  false, 'training', 'review'
)
ON CONFLICT (typeface_slug) DO UPDATE SET
  font_source = EXCLUDED.font_source,
  license_type = EXCLUDED.license_type,
  activation_status = EXCLUDED.activation_status,
  fallback_stack = EXCLUDED.fallback_stack,
  qa_status = EXCLUDED.qa_status,
  updated_at_utc = now();

INSERT INTO typefaces_core (
  typeface_slug, display_name, display_name_ascii,
  primary_category, sub_category, visual_cluster_id,
  dreyfus_tier, difficulty_base, rarity_tag,
  activation_status, font_source, license_type, license_url,
  is_variable_font, designer, foundry, release_year,
  year_tag, weight_structure, contrast_profile, aperture_profile,
  fallback_stack, structural_signature_json,
  expert_enabled, min_mode, qa_status
) VALUES (
  'linotype_didot_headline', 'Linotype Didot Headline', 'Linotype Didot Headline',
  'serif', 'didone', 'cluster_didone_A',
  'N', 'medium', 'uncommon',
  true, 'adobe', 'adobe_fonts', 'https://fonts.adobe.com/fonts/linotype-didot-headline',
  false, NULL, NULL, NULL,
  'classic', 'single_weight', 'very_high', 'semi_open',
  '"linotype-didot-headline", serif', '{"a_type": null, "e_aperture": "semi_open", "axis": null, "contrast": "very_high", "terminals": null, "serifs": "present", "x_height": null, "fixed_width": false, "width": "normal", "caps_only": false, "distinctive_w": false}'::jsonb,
  false, 'training', 'review'
)
ON CONFLICT (typeface_slug) DO UPDATE SET
  font_source = EXCLUDED.font_source,
  license_type = EXCLUDED.license_type,
  activation_status = EXCLUDED.activation_status,
  fallback_stack = EXCLUDED.fallback_stack,
  qa_status = EXCLUDED.qa_status,
  updated_at_utc = now();

INSERT INTO typefaces_core (
  typeface_slug, display_name, display_name_ascii,
  primary_category, sub_category, visual_cluster_id,
  dreyfus_tier, difficulty_base, rarity_tag,
  activation_status, font_source, license_type, license_url,
  is_variable_font, designer, foundry, release_year,
  year_tag, weight_structure, contrast_profile, aperture_profile,
  fallback_stack, structural_signature_json,
  expert_enabled, min_mode, qa_status
) VALUES (
  'neue_frutiger_world', 'Neue Frutiger World', 'Neue Frutiger World',
  'sans_serif', 'humanist', 'cluster_humanist_A',
  'N', 'easy', 'common',
  true, 'adobe', 'adobe_fonts', 'https://fonts.adobe.com/fonts/neue-frutiger-world',
  false, NULL, NULL, NULL,
  'classic', 'single_weight', 'low', 'semi_open',
  '"neue-frutiger-world", sans-serif', '{"a_type": null, "e_aperture": "semi_open", "axis": null, "contrast": "low", "terminals": null, "serifs": null, "x_height": null, "fixed_width": false, "width": "normal", "caps_only": false, "distinctive_w": false}'::jsonb,
  false, 'training', 'review'
)
ON CONFLICT (typeface_slug) DO UPDATE SET
  font_source = EXCLUDED.font_source,
  license_type = EXCLUDED.license_type,
  activation_status = EXCLUDED.activation_status,
  fallback_stack = EXCLUDED.fallback_stack,
  qa_status = EXCLUDED.qa_status,
  updated_at_utc = now();

INSERT INTO typefaces_core (
  typeface_slug, display_name, display_name_ascii,
  primary_category, sub_category, visual_cluster_id,
  dreyfus_tier, difficulty_base, rarity_tag,
  activation_status, font_source, license_type, license_url,
  is_variable_font, designer, foundry, release_year,
  year_tag, weight_structure, contrast_profile, aperture_profile,
  fallback_stack, structural_signature_json,
  expert_enabled, min_mode, qa_status
) VALUES (
  'neue_frutiger_world_ultlt', 'Neue Frutiger World UltLt', 'Neue Frutiger World UltLt',
  'sans_serif', 'humanist', 'cluster_humanist_A',
  'N', 'medium', 'uncommon',
  true, 'adobe', 'adobe_fonts', 'https://fonts.adobe.com/fonts/neue-frutiger-world-ultlt',
  false, NULL, NULL, NULL,
  'classic', 'single_weight', 'low', 'semi_open',
  '"neue-frutiger-world-ultlt", sans-serif', '{"a_type": null, "e_aperture": "semi_open", "axis": null, "contrast": "low", "terminals": null, "serifs": null, "x_height": null, "fixed_width": false, "width": "normal", "caps_only": false, "distinctive_w": false}'::jsonb,
  false, 'training', 'review'
)
ON CONFLICT (typeface_slug) DO UPDATE SET
  font_source = EXCLUDED.font_source,
  license_type = EXCLUDED.license_type,
  activation_status = EXCLUDED.activation_status,
  fallback_stack = EXCLUDED.fallback_stack,
  qa_status = EXCLUDED.qa_status,
  updated_at_utc = now();

INSERT INTO typefaces_core (
  typeface_slug, display_name, display_name_ascii,
  primary_category, sub_category, visual_cluster_id,
  dreyfus_tier, difficulty_base, rarity_tag,
  activation_status, font_source, license_type, license_url,
  is_variable_font, designer, foundry, release_year,
  year_tag, weight_structure, contrast_profile, aperture_profile,
  fallback_stack, structural_signature_json,
  expert_enabled, min_mode, qa_status
) VALUES (
  'optima_lt_pro', 'Optima LT Pro', 'Optima LT Pro',
  'sans_serif', 'humanist', 'cluster_humanist_A',
  'N', 'easy', 'common',
  true, 'adobe', 'adobe_fonts', 'https://fonts.adobe.com/fonts/optima-lt-pro',
  false, NULL, NULL, NULL,
  'classic', 'single_weight', 'low', 'semi_open',
  '"optima-lt-pro", sans-serif', '{"a_type": null, "e_aperture": "semi_open", "axis": null, "contrast": "low", "terminals": null, "serifs": null, "x_height": null, "fixed_width": false, "width": "normal", "caps_only": false, "distinctive_w": false}'::jsonb,
  false, 'training', 'review'
)
ON CONFLICT (typeface_slug) DO UPDATE SET
  font_source = EXCLUDED.font_source,
  license_type = EXCLUDED.license_type,
  activation_status = EXCLUDED.activation_status,
  fallback_stack = EXCLUDED.fallback_stack,
  qa_status = EXCLUDED.qa_status,
  updated_at_utc = now();

INSERT INTO typefaces_core (
  typeface_slug, display_name, display_name_ascii,
  primary_category, sub_category, visual_cluster_id,
  dreyfus_tier, difficulty_base, rarity_tag,
  activation_status, font_source, license_type, license_url,
  is_variable_font, designer, foundry, release_year,
  year_tag, weight_structure, contrast_profile, aperture_profile,
  fallback_stack, structural_signature_json,
  expert_enabled, min_mode, qa_status
) VALUES (
  'optima_nova_lt_pro', 'Optima Nova LT Pro', 'Optima Nova LT Pro',
  'sans_serif', 'humanist', 'cluster_humanist_A',
  'N', 'medium', 'uncommon',
  true, 'adobe', 'adobe_fonts', 'https://fonts.adobe.com/fonts/optima-nova-lt-pro',
  false, NULL, NULL, NULL,
  'classic', 'single_weight', 'low', 'semi_open',
  '"optima-nova-lt-pro", sans-serif', '{"a_type": null, "e_aperture": "semi_open", "axis": null, "contrast": "low", "terminals": null, "serifs": null, "x_height": null, "fixed_width": false, "width": "normal", "caps_only": false, "distinctive_w": false}'::jsonb,
  false, 'training', 'review'
)
ON CONFLICT (typeface_slug) DO UPDATE SET
  font_source = EXCLUDED.font_source,
  license_type = EXCLUDED.license_type,
  activation_status = EXCLUDED.activation_status,
  fallback_stack = EXCLUDED.fallback_stack,
  qa_status = EXCLUDED.qa_status,
  updated_at_utc = now();

INSERT INTO typefaces_core (
  typeface_slug, display_name, display_name_ascii,
  primary_category, sub_category, visual_cluster_id,
  dreyfus_tier, difficulty_base, rarity_tag,
  activation_status, font_source, license_type, license_url,
  is_variable_font, designer, foundry, release_year,
  year_tag, weight_structure, contrast_profile, aperture_profile,
  fallback_stack, structural_signature_json,
  expert_enabled, min_mode, qa_status
) VALUES (
  'optima_nova_lt_pro_cond', 'Optima Nova LT Pro Cond', 'Optima Nova LT Pro Cond',
  'sans_serif', 'humanist', 'cluster_humanist_A',
  'N', 'medium', 'uncommon',
  true, 'adobe', 'adobe_fonts', 'https://fonts.adobe.com/fonts/optima-nova-lt-pro-cond',
  false, NULL, NULL, NULL,
  'classic', 'single_weight', 'low', 'semi_open',
  '"optima-nova-lt-pro-cond", sans-serif', '{"a_type": null, "e_aperture": "semi_open", "axis": null, "contrast": "low", "terminals": null, "serifs": null, "x_height": null, "fixed_width": false, "width": "normal", "caps_only": false, "distinctive_w": false}'::jsonb,
  false, 'training', 'review'
)
ON CONFLICT (typeface_slug) DO UPDATE SET
  font_source = EXCLUDED.font_source,
  license_type = EXCLUDED.license_type,
  activation_status = EXCLUDED.activation_status,
  fallback_stack = EXCLUDED.fallback_stack,
  qa_status = EXCLUDED.qa_status,
  updated_at_utc = now();

INSERT INTO typefaces_core (
  typeface_slug, display_name, display_name_ascii,
  primary_category, sub_category, visual_cluster_id,
  dreyfus_tier, difficulty_base, rarity_tag,
  activation_status, font_source, license_type, license_url,
  is_variable_font, designer, foundry, release_year,
  year_tag, weight_structure, contrast_profile, aperture_profile,
  fallback_stack, structural_signature_json,
  expert_enabled, min_mode, qa_status
) VALUES (
  'optima_nova_lt_pro_titling', 'Optima Nova LT Pro Titling', 'Optima Nova LT Pro Titling',
  'sans_serif', 'humanist', 'cluster_humanist_A',
  'N', 'medium', 'uncommon',
  true, 'adobe', 'adobe_fonts', 'https://fonts.adobe.com/fonts/optima-nova-lt-pro-titling',
  false, NULL, NULL, NULL,
  'classic', 'single_weight', 'low', 'semi_open',
  '"optima-nova-lt-pro-titling", sans-serif', '{"a_type": null, "e_aperture": "semi_open", "axis": null, "contrast": "low", "terminals": null, "serifs": null, "x_height": null, "fixed_width": false, "width": "normal", "caps_only": false, "distinctive_w": false}'::jsonb,
  false, 'training', 'review'
)
ON CONFLICT (typeface_slug) DO UPDATE SET
  font_source = EXCLUDED.font_source,
  license_type = EXCLUDED.license_type,
  activation_status = EXCLUDED.activation_status,
  fallback_stack = EXCLUDED.fallback_stack,
  qa_status = EXCLUDED.qa_status,
  updated_at_utc = now();

INSERT INTO typefaces_core (
  typeface_slug, display_name, display_name_ascii,
  primary_category, sub_category, visual_cluster_id,
  dreyfus_tier, difficulty_base, rarity_tag,
  activation_status, font_source, license_type, license_url,
  is_variable_font, designer, foundry, release_year,
  year_tag, weight_structure, contrast_profile, aperture_profile,
  fallback_stack, structural_signature_json,
  expert_enabled, min_mode, qa_status
) VALUES (
  'p22_franklin_caslon', 'P22 Franklin Caslon', 'P22 Franklin Caslon',
  'serif', 'old_style', 'cluster_oldstyle_A',
  'N', 'medium', 'uncommon',
  true, 'adobe', 'adobe_fonts', 'https://fonts.adobe.com/fonts/p22-franklin-caslon',
  false, NULL, NULL, NULL,
  'classic', 'single_weight', 'medium', 'semi_open',
  '"p22-franklin-caslon", serif', '{"a_type": null, "e_aperture": "semi_open", "axis": null, "contrast": "medium", "terminals": null, "serifs": "present", "x_height": null, "fixed_width": false, "width": "normal", "caps_only": false, "distinctive_w": false}'::jsonb,
  false, 'training', 'review'
)
ON CONFLICT (typeface_slug) DO UPDATE SET
  font_source = EXCLUDED.font_source,
  license_type = EXCLUDED.license_type,
  activation_status = EXCLUDED.activation_status,
  fallback_stack = EXCLUDED.fallback_stack,
  qa_status = EXCLUDED.qa_status,
  updated_at_utc = now();

INSERT INTO typefaces_core (
  typeface_slug, display_name, display_name_ascii,
  primary_category, sub_category, visual_cluster_id,
  dreyfus_tier, difficulty_base, rarity_tag,
  activation_status, font_source, license_type, license_url,
  is_variable_font, designer, foundry, release_year,
  year_tag, weight_structure, contrast_profile, aperture_profile,
  fallback_stack, structural_signature_json,
  expert_enabled, min_mode, qa_status
) VALUES (
  'papyrus_std', 'Papyrus Std', 'Papyrus Std',
  'display', 'script', 'cluster_display_script_A',
  'N', 'easy', 'common',
  true, 'adobe', 'adobe_fonts', 'https://fonts.adobe.com/fonts/papyrus-std',
  false, NULL, NULL, NULL,
  'classic', 'single_weight', 'medium', 'semi_open',
  '"papyrus-std", cursive', '{"a_type": null, "e_aperture": "semi_open", "axis": null, "contrast": "medium", "terminals": null, "serifs": null, "x_height": null, "fixed_width": false, "width": "normal", "caps_only": false, "distinctive_w": false}'::jsonb,
  false, 'training', 'review'
)
ON CONFLICT (typeface_slug) DO UPDATE SET
  font_source = EXCLUDED.font_source,
  license_type = EXCLUDED.license_type,
  activation_status = EXCLUDED.activation_status,
  fallback_stack = EXCLUDED.fallback_stack,
  qa_status = EXCLUDED.qa_status,
  updated_at_utc = now();

INSERT INTO typefaces_core (
  typeface_slug, display_name, display_name_ascii,
  primary_category, sub_category, visual_cluster_id,
  dreyfus_tier, difficulty_base, rarity_tag,
  activation_status, font_source, license_type, license_url,
  is_variable_font, designer, foundry, release_year,
  year_tag, weight_structure, contrast_profile, aperture_profile,
  fallback_stack, structural_signature_json,
  expert_enabled, min_mode, qa_status
) VALUES (
  'rockwell', 'Rockwell', 'Rockwell',
  'serif', 'slab', 'cluster_slab_serif_A',
  'N', 'easy', 'common',
  true, 'adobe', 'adobe_fonts', 'https://fonts.adobe.com/fonts/rockwell',
  false, NULL, NULL, NULL,
  'classic', 'single_weight', 'low', 'semi_open',
  '"rockwell", serif', '{"a_type": null, "e_aperture": "semi_open", "axis": null, "contrast": "low", "terminals": null, "serifs": "present", "x_height": null, "fixed_width": false, "width": "normal", "caps_only": false, "distinctive_w": false}'::jsonb,
  false, 'training', 'review'
)
ON CONFLICT (typeface_slug) DO UPDATE SET
  font_source = EXCLUDED.font_source,
  license_type = EXCLUDED.license_type,
  activation_status = EXCLUDED.activation_status,
  fallback_stack = EXCLUDED.fallback_stack,
  qa_status = EXCLUDED.qa_status,
  updated_at_utc = now();

INSERT INTO typefaces_core (
  typeface_slug, display_name, display_name_ascii,
  primary_category, sub_category, visual_cluster_id,
  dreyfus_tier, difficulty_base, rarity_tag,
  activation_status, font_source, license_type, license_url,
  is_variable_font, designer, foundry, release_year,
  year_tag, weight_structure, contrast_profile, aperture_profile,
  fallback_stack, structural_signature_json,
  expert_enabled, min_mode, qa_status
) VALUES (
  'rockwell_condensed', 'Rockwell Condensed', 'Rockwell Condensed',
  'serif', 'slab', 'cluster_slab_serif_A',
  'N', 'medium', 'uncommon',
  true, 'adobe', 'adobe_fonts', 'https://fonts.adobe.com/fonts/rockwell-condensed',
  false, NULL, NULL, NULL,
  'classic', 'single_weight', 'low', 'semi_open',
  '"rockwell-condensed", serif', '{"a_type": null, "e_aperture": "semi_open", "axis": null, "contrast": "low", "terminals": null, "serifs": "present", "x_height": null, "fixed_width": false, "width": "normal", "caps_only": false, "distinctive_w": false}'::jsonb,
  false, 'training', 'review'
)
ON CONFLICT (typeface_slug) DO UPDATE SET
  font_source = EXCLUDED.font_source,
  license_type = EXCLUDED.license_type,
  activation_status = EXCLUDED.activation_status,
  fallback_stack = EXCLUDED.fallback_stack,
  qa_status = EXCLUDED.qa_status,
  updated_at_utc = now();

INSERT INTO typefaces_core (
  typeface_slug, display_name, display_name_ascii,
  primary_category, sub_category, visual_cluster_id,
  dreyfus_tier, difficulty_base, rarity_tag,
  activation_status, font_source, license_type, license_url,
  is_variable_font, designer, foundry, release_year,
  year_tag, weight_structure, contrast_profile, aperture_profile,
  fallback_stack, structural_signature_json,
  expert_enabled, min_mode, qa_status
) VALUES (
  'rockwell_nova', 'Rockwell Nova', 'Rockwell Nova',
  'serif', 'slab', 'cluster_slab_serif_A',
  'N', 'medium', 'uncommon',
  true, 'adobe', 'adobe_fonts', 'https://fonts.adobe.com/fonts/rockwell-nova',
  false, NULL, NULL, NULL,
  'classic', 'single_weight', 'low', 'semi_open',
  '"rockwell-nova", serif', '{"a_type": null, "e_aperture": "semi_open", "axis": null, "contrast": "low", "terminals": null, "serifs": "present", "x_height": null, "fixed_width": false, "width": "normal", "caps_only": false, "distinctive_w": false}'::jsonb,
  false, 'training', 'review'
)
ON CONFLICT (typeface_slug) DO UPDATE SET
  font_source = EXCLUDED.font_source,
  license_type = EXCLUDED.license_type,
  activation_status = EXCLUDED.activation_status,
  fallback_stack = EXCLUDED.fallback_stack,
  qa_status = EXCLUDED.qa_status,
  updated_at_utc = now();

INSERT INTO typefaces_core (
  typeface_slug, display_name, display_name_ascii,
  primary_category, sub_category, visual_cluster_id,
  dreyfus_tier, difficulty_base, rarity_tag,
  activation_status, font_source, license_type, license_url,
  is_variable_font, designer, foundry, release_year,
  year_tag, weight_structure, contrast_profile, aperture_profile,
  fallback_stack, structural_signature_json,
  expert_enabled, min_mode, qa_status
) VALUES (
  'rockwell_nova_condensed', 'Rockwell Nova Condensed', 'Rockwell Nova Condensed',
  'serif', 'slab', 'cluster_slab_serif_A',
  'N', 'medium', 'uncommon',
  true, 'adobe', 'adobe_fonts', 'https://fonts.adobe.com/fonts/rockwell-nova-condensed',
  false, NULL, NULL, NULL,
  'classic', 'single_weight', 'low', 'semi_open',
  '"rockwell-nova-condensed", serif', '{"a_type": null, "e_aperture": "semi_open", "axis": null, "contrast": "low", "terminals": null, "serifs": "present", "x_height": null, "fixed_width": false, "width": "normal", "caps_only": false, "distinctive_w": false}'::jsonb,
  false, 'training', 'review'
)
ON CONFLICT (typeface_slug) DO UPDATE SET
  font_source = EXCLUDED.font_source,
  license_type = EXCLUDED.license_type,
  activation_status = EXCLUDED.activation_status,
  fallback_stack = EXCLUDED.fallback_stack,
  qa_status = EXCLUDED.qa_status,
  updated_at_utc = now();

INSERT INTO typefaces_core (
  typeface_slug, display_name, display_name_ascii,
  primary_category, sub_category, visual_cluster_id,
  dreyfus_tier, difficulty_base, rarity_tag,
  activation_status, font_source, license_type, license_url,
  is_variable_font, designer, foundry, release_year,
  year_tag, weight_structure, contrast_profile, aperture_profile,
  fallback_stack, structural_signature_json,
  expert_enabled, min_mode, qa_status
) VALUES (
  'superclarendon', 'Superclarendon', 'Superclarendon',
  'serif', 'slab', 'cluster_slab_serif_A',
  'N', 'easy', 'common',
  true, 'adobe', 'adobe_fonts', 'https://fonts.adobe.com/fonts/superclarendon',
  false, NULL, NULL, NULL,
  'classic', 'single_weight', 'low', 'semi_open',
  '"superclarendon", serif', '{"a_type": null, "e_aperture": "semi_open", "axis": null, "contrast": "low", "terminals": null, "serifs": "present", "x_height": null, "fixed_width": false, "width": "normal", "caps_only": false, "distinctive_w": false}'::jsonb,
  false, 'training', 'review'
)
ON CONFLICT (typeface_slug) DO UPDATE SET
  font_source = EXCLUDED.font_source,
  license_type = EXCLUDED.license_type,
  activation_status = EXCLUDED.activation_status,
  fallback_stack = EXCLUDED.fallback_stack,
  qa_status = EXCLUDED.qa_status,
  updated_at_utc = now();

INSERT INTO typefaces_core (
  typeface_slug, display_name, display_name_ascii,
  primary_category, sub_category, visual_cluster_id,
  dreyfus_tier, difficulty_base, rarity_tag,
  activation_status, font_source, license_type, license_url,
  is_variable_font, designer, foundry, release_year,
  year_tag, weight_structure, contrast_profile, aperture_profile,
  fallback_stack, structural_signature_json,
  expert_enabled, min_mode, qa_status
) VALUES (
  'tahoma', 'Tahoma', 'Tahoma',
  'sans_serif', 'humanist', 'cluster_humanist_A',
  'N', 'easy', 'common',
  true, 'adobe', 'adobe_fonts', 'https://fonts.adobe.com/fonts/tahoma',
  false, NULL, NULL, NULL,
  'classic', 'single_weight', 'low', 'semi_open',
  '"tahoma", sans-serif', '{"a_type": null, "e_aperture": "semi_open", "axis": null, "contrast": "low", "terminals": null, "serifs": null, "x_height": null, "fixed_width": false, "width": "normal", "caps_only": false, "distinctive_w": false}'::jsonb,
  false, 'training', 'review'
)
ON CONFLICT (typeface_slug) DO UPDATE SET
  font_source = EXCLUDED.font_source,
  license_type = EXCLUDED.license_type,
  activation_status = EXCLUDED.activation_status,
  fallback_stack = EXCLUDED.fallback_stack,
  qa_status = EXCLUDED.qa_status,
  updated_at_utc = now();

INSERT INTO typefaces_core (
  typeface_slug, display_name, display_name_ascii,
  primary_category, sub_category, visual_cluster_id,
  dreyfus_tier, difficulty_base, rarity_tag,
  activation_status, font_source, license_type, license_url,
  is_variable_font, designer, foundry, release_year,
  year_tag, weight_structure, contrast_profile, aperture_profile,
  fallback_stack, structural_signature_json,
  expert_enabled, min_mode, qa_status
) VALUES (
  'trajan_color', 'Trajan Color', 'Trajan Color',
  'serif', 'old_style', 'cluster_oldstyle_A',
  'N', 'medium', 'uncommon',
  true, 'adobe', 'adobe_fonts', 'https://fonts.adobe.com/fonts/trajan-color',
  false, NULL, NULL, NULL,
  'classic', 'single_weight', 'medium', 'semi_open',
  '"trajan-color", serif', '{"a_type": null, "e_aperture": "semi_open", "axis": null, "contrast": "medium", "terminals": null, "serifs": "present", "x_height": null, "fixed_width": false, "width": "normal", "caps_only": false, "distinctive_w": false}'::jsonb,
  false, 'training', 'review'
)
ON CONFLICT (typeface_slug) DO UPDATE SET
  font_source = EXCLUDED.font_source,
  license_type = EXCLUDED.license_type,
  activation_status = EXCLUDED.activation_status,
  fallback_stack = EXCLUDED.fallback_stack,
  qa_status = EXCLUDED.qa_status,
  updated_at_utc = now();

INSERT INTO typefaces_core (
  typeface_slug, display_name, display_name_ascii,
  primary_category, sub_category, visual_cluster_id,
  dreyfus_tier, difficulty_base, rarity_tag,
  activation_status, font_source, license_type, license_url,
  is_variable_font, designer, foundry, release_year,
  year_tag, weight_structure, contrast_profile, aperture_profile,
  fallback_stack, structural_signature_json,
  expert_enabled, min_mode, qa_status
) VALUES (
  'trajan_pro_3', 'Trajan Pro 3', 'Trajan Pro 3',
  'serif', 'old_style', 'cluster_oldstyle_A',
  'N', 'easy', 'common',
  true, 'adobe', 'adobe_fonts', 'https://fonts.adobe.com/fonts/trajan-pro-3',
  false, NULL, NULL, NULL,
  'classic', 'single_weight', 'medium', 'semi_open',
  '"trajan-pro-3", serif', '{"a_type": null, "e_aperture": "semi_open", "axis": null, "contrast": "medium", "terminals": null, "serifs": "present", "x_height": null, "fixed_width": false, "width": "normal", "caps_only": false, "distinctive_w": false}'::jsonb,
  false, 'training', 'review'
)
ON CONFLICT (typeface_slug) DO UPDATE SET
  font_source = EXCLUDED.font_source,
  license_type = EXCLUDED.license_type,
  activation_status = EXCLUDED.activation_status,
  fallback_stack = EXCLUDED.fallback_stack,
  qa_status = EXCLUDED.qa_status,
  updated_at_utc = now();

INSERT INTO typefaces_core (
  typeface_slug, display_name, display_name_ascii,
  primary_category, sub_category, visual_cluster_id,
  dreyfus_tier, difficulty_base, rarity_tag,
  activation_status, font_source, license_type, license_url,
  is_variable_font, designer, foundry, release_year,
  year_tag, weight_structure, contrast_profile, aperture_profile,
  fallback_stack, structural_signature_json,
  expert_enabled, min_mode, qa_status
) VALUES (
  'trajan_sans_pro', 'Trajan Sans Pro', 'Trajan Sans Pro',
  'sans_serif', 'humanist', 'cluster_humanist_A',
  'N', 'medium', 'uncommon',
  true, 'adobe', 'adobe_fonts', 'https://fonts.adobe.com/fonts/trajan-sans-pro',
  false, NULL, NULL, NULL,
  'classic', 'single_weight', 'low', 'semi_open',
  '"trajan-sans-pro", sans-serif', '{"a_type": null, "e_aperture": "semi_open", "axis": null, "contrast": "low", "terminals": null, "serifs": null, "x_height": null, "fixed_width": false, "width": "normal", "caps_only": false, "distinctive_w": false}'::jsonb,
  false, 'training', 'review'
)
ON CONFLICT (typeface_slug) DO UPDATE SET
  font_source = EXCLUDED.font_source,
  license_type = EXCLUDED.license_type,
  activation_status = EXCLUDED.activation_status,
  fallback_stack = EXCLUDED.fallback_stack,
  qa_status = EXCLUDED.qa_status,
  updated_at_utc = now();

INSERT INTO typefaces_core (
  typeface_slug, display_name, display_name_ascii,
  primary_category, sub_category, visual_cluster_id,
  dreyfus_tier, difficulty_base, rarity_tag,
  activation_status, font_source, license_type, license_url,
  is_variable_font, designer, foundry, release_year,
  year_tag, weight_structure, contrast_profile, aperture_profile,
  fallback_stack, structural_signature_json,
  expert_enabled, min_mode, qa_status
) VALUES (
  'univers_next_pro', 'Univers Next Pro', 'Univers Next Pro',
  'sans_serif', 'neo_grotesk', 'cluster_neo_grotesk_A',
  'N', 'easy', 'common',
  true, 'adobe', 'adobe_fonts', 'https://fonts.adobe.com/fonts/univers-next-pro',
  false, NULL, NULL, NULL,
  'classic', 'single_weight', 'low', 'semi_open',
  '"univers-next-pro", sans-serif', '{"a_type": null, "e_aperture": "semi_open", "axis": null, "contrast": "low", "terminals": null, "serifs": null, "x_height": null, "fixed_width": false, "width": "normal", "caps_only": false, "distinctive_w": false}'::jsonb,
  false, 'training', 'review'
)
ON CONFLICT (typeface_slug) DO UPDATE SET
  font_source = EXCLUDED.font_source,
  license_type = EXCLUDED.license_type,
  activation_status = EXCLUDED.activation_status,
  fallback_stack = EXCLUDED.fallback_stack,
  qa_status = EXCLUDED.qa_status,
  updated_at_utc = now();

INSERT INTO typefaces_core (
  typeface_slug, display_name, display_name_ascii,
  primary_category, sub_category, visual_cluster_id,
  dreyfus_tier, difficulty_base, rarity_tag,
  activation_status, font_source, license_type, license_url,
  is_variable_font, designer, foundry, release_year,
  year_tag, weight_structure, contrast_profile, aperture_profile,
  fallback_stack, structural_signature_json,
  expert_enabled, min_mode, qa_status
) VALUES (
  'univers_next_pro_compressed', 'Univers Next Pro Compressed', 'Univers Next Pro Compressed',
  'sans_serif', 'neo_grotesk', 'cluster_neo_grotesk_A',
  'N', 'medium', 'uncommon',
  true, 'adobe', 'adobe_fonts', 'https://fonts.adobe.com/fonts/univers-next-pro-compressed',
  false, NULL, NULL, NULL,
  'classic', 'single_weight', 'low', 'semi_open',
  '"univers-next-pro-compressed", sans-serif', '{"a_type": null, "e_aperture": "semi_open", "axis": null, "contrast": "low", "terminals": null, "serifs": null, "x_height": null, "fixed_width": false, "width": "normal", "caps_only": false, "distinctive_w": false}'::jsonb,
  false, 'training', 'review'
)
ON CONFLICT (typeface_slug) DO UPDATE SET
  font_source = EXCLUDED.font_source,
  license_type = EXCLUDED.license_type,
  activation_status = EXCLUDED.activation_status,
  fallback_stack = EXCLUDED.fallback_stack,
  qa_status = EXCLUDED.qa_status,
  updated_at_utc = now();

INSERT INTO typefaces_core (
  typeface_slug, display_name, display_name_ascii,
  primary_category, sub_category, visual_cluster_id,
  dreyfus_tier, difficulty_base, rarity_tag,
  activation_status, font_source, license_type, license_url,
  is_variable_font, designer, foundry, release_year,
  year_tag, weight_structure, contrast_profile, aperture_profile,
  fallback_stack, structural_signature_json,
  expert_enabled, min_mode, qa_status
) VALUES (
  'univers_next_pro_condensed', 'Univers Next Pro Condensed', 'Univers Next Pro Condensed',
  'sans_serif', 'neo_grotesk', 'cluster_neo_grotesk_A',
  'N', 'medium', 'uncommon',
  true, 'adobe', 'adobe_fonts', 'https://fonts.adobe.com/fonts/univers-next-pro-condensed',
  false, NULL, NULL, NULL,
  'classic', 'single_weight', 'low', 'semi_open',
  '"univers-next-pro-condensed", sans-serif', '{"a_type": null, "e_aperture": "semi_open", "axis": null, "contrast": "low", "terminals": null, "serifs": null, "x_height": null, "fixed_width": false, "width": "normal", "caps_only": false, "distinctive_w": false}'::jsonb,
  false, 'training', 'review'
)
ON CONFLICT (typeface_slug) DO UPDATE SET
  font_source = EXCLUDED.font_source,
  license_type = EXCLUDED.license_type,
  activation_status = EXCLUDED.activation_status,
  fallback_stack = EXCLUDED.fallback_stack,
  qa_status = EXCLUDED.qa_status,
  updated_at_utc = now();

INSERT INTO typefaces_core (
  typeface_slug, display_name, display_name_ascii,
  primary_category, sub_category, visual_cluster_id,
  dreyfus_tier, difficulty_base, rarity_tag,
  activation_status, font_source, license_type, license_url,
  is_variable_font, designer, foundry, release_year,
  year_tag, weight_structure, contrast_profile, aperture_profile,
  fallback_stack, structural_signature_json,
  expert_enabled, min_mode, qa_status
) VALUES (
  'univers_next_pro_extended', 'Univers Next Pro Extended', 'Univers Next Pro Extended',
  'sans_serif', 'neo_grotesk', 'cluster_neo_grotesk_A',
  'N', 'medium', 'uncommon',
  true, 'adobe', 'adobe_fonts', 'https://fonts.adobe.com/fonts/univers-next-pro-extended',
  false, NULL, NULL, NULL,
  'classic', 'single_weight', 'low', 'semi_open',
  '"univers-next-pro-extended", sans-serif', '{"a_type": null, "e_aperture": "semi_open", "axis": null, "contrast": "low", "terminals": null, "serifs": null, "x_height": null, "fixed_width": false, "width": "normal", "caps_only": false, "distinctive_w": false}'::jsonb,
  false, 'training', 'review'
)
ON CONFLICT (typeface_slug) DO UPDATE SET
  font_source = EXCLUDED.font_source,
  license_type = EXCLUDED.license_type,
  activation_status = EXCLUDED.activation_status,
  fallback_stack = EXCLUDED.fallback_stack,
  qa_status = EXCLUDED.qa_status,
  updated_at_utc = now();

INSERT INTO typefaces_core (
  typeface_slug, display_name, display_name_ascii,
  primary_category, sub_category, visual_cluster_id,
  dreyfus_tier, difficulty_base, rarity_tag,
  activation_status, font_source, license_type, license_url,
  is_variable_font, designer, foundry, release_year,
  year_tag, weight_structure, contrast_profile, aperture_profile,
  fallback_stack, structural_signature_json,
  expert_enabled, min_mode, qa_status
) VALUES (
  'verdana', 'Verdana', 'Verdana',
  'sans_serif', 'humanist', 'cluster_humanist_A',
  'N', 'easy', 'common',
  true, 'adobe', 'adobe_fonts', 'https://fonts.adobe.com/fonts/verdana',
  false, NULL, NULL, NULL,
  'classic', 'single_weight', 'low', 'semi_open',
  '"verdana", sans-serif', '{"a_type": null, "e_aperture": "semi_open", "axis": null, "contrast": "low", "terminals": null, "serifs": null, "x_height": null, "fixed_width": false, "width": "normal", "caps_only": false, "distinctive_w": false}'::jsonb,
  false, 'training', 'review'
)
ON CONFLICT (typeface_slug) DO UPDATE SET
  font_source = EXCLUDED.font_source,
  license_type = EXCLUDED.license_type,
  activation_status = EXCLUDED.activation_status,
  fallback_stack = EXCLUDED.fallback_stack,
  qa_status = EXCLUDED.qa_status,
  updated_at_utc = now();

INSERT INTO typefaces_core (
  typeface_slug, display_name, display_name_ascii,
  primary_category, sub_category, visual_cluster_id,
  dreyfus_tier, difficulty_base, rarity_tag,
  activation_status, font_source, license_type, license_url,
  is_variable_font, designer, foundry, release_year,
  year_tag, weight_structure, contrast_profile, aperture_profile,
  fallback_stack, structural_signature_json,
  expert_enabled, min_mode, qa_status
) VALUES (
  'verdana_pro', 'Verdana Pro', 'Verdana Pro',
  'sans_serif', 'humanist', 'cluster_humanist_A',
  'N', 'medium', 'uncommon',
  true, 'adobe', 'adobe_fonts', 'https://fonts.adobe.com/fonts/verdana-pro',
  false, NULL, NULL, NULL,
  'classic', 'single_weight', 'low', 'semi_open',
  '"verdana-pro", sans-serif', '{"a_type": null, "e_aperture": "semi_open", "axis": null, "contrast": "low", "terminals": null, "serifs": null, "x_height": null, "fixed_width": false, "width": "normal", "caps_only": false, "distinctive_w": false}'::jsonb,
  false, 'training', 'review'
)
ON CONFLICT (typeface_slug) DO UPDATE SET
  font_source = EXCLUDED.font_source,
  license_type = EXCLUDED.license_type,
  activation_status = EXCLUDED.activation_status,
  fallback_stack = EXCLUDED.fallback_stack,
  qa_status = EXCLUDED.qa_status,
  updated_at_utc = now();

INSERT INTO typefaces_core (
  typeface_slug, display_name, display_name_ascii,
  primary_category, sub_category, visual_cluster_id,
  dreyfus_tier, difficulty_base, rarity_tag,
  activation_status, font_source, license_type, license_url,
  is_variable_font, designer, foundry, release_year,
  year_tag, weight_structure, contrast_profile, aperture_profile,
  fallback_stack, structural_signature_json,
  expert_enabled, min_mode, qa_status
) VALUES (
  'verdana_pro_condensed', 'Verdana Pro Condensed', 'Verdana Pro Condensed',
  'sans_serif', 'humanist', 'cluster_humanist_A',
  'N', 'medium', 'uncommon',
  true, 'adobe', 'adobe_fonts', 'https://fonts.adobe.com/fonts/verdana-pro-condensed',
  false, NULL, NULL, NULL,
  'classic', 'single_weight', 'low', 'semi_open',
  '"verdana-pro-condensed", sans-serif', '{"a_type": null, "e_aperture": "semi_open", "axis": null, "contrast": "low", "terminals": null, "serifs": null, "x_height": null, "fixed_width": false, "width": "normal", "caps_only": false, "distinctive_w": false}'::jsonb,
  false, 'training', 'review'
)
ON CONFLICT (typeface_slug) DO UPDATE SET
  font_source = EXCLUDED.font_source,
  license_type = EXCLUDED.license_type,
  activation_status = EXCLUDED.activation_status,
  fallback_stack = EXCLUDED.fallback_stack,
  qa_status = EXCLUDED.qa_status,
  updated_at_utc = now();

COMMIT;
