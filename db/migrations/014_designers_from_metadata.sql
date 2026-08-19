-- ============================================================
-- MIGRATION 014 -- designers manquants, depuis les metadonnees Google Fonts
-- Genere par scripts/build_rarity_from_popularity.py le 2026-08-19
-- NON APPLIQUEE. Elle demande le feu vert explicite du proprietaire.
-- ============================================================
--
-- 23 polices actives n'avaient pas de designer.
--
-- LA CLAUSE WHERE EST DOUBLEE, exprès. Le script ne selectionne que les vides, et
-- le SQL le revérifie : entre la generation du fichier et son application,
-- quelqu'un peut avoir saisi un nom a la main, et une donnee automatique ne doit
-- pas ecraser un travail humain.
--
-- foundry et release_year restent vides et ne sont pas traites ici. L'instantane
-- ne les contient pas, et dateAdded est la date d'entree chez Google, pas
-- l'annee de creation de la typographie. Les confondre serait inventer une histoire.
--
-- PIEGE DE REIMPORT, meme piege documente par db/migrations/010_license_type_ufl.sql.
-- scripts/import_catalog_json.py fait ON CONFLICT (typeface_slug) DO UPDATE SET
-- designer = EXCLUDED.designer, et content/catalog/typefaces-core.json garde ces
-- 23 slugs a vide. Un reimport du catalogue APRES cette migration REVIDE en
-- silence les designers qu'elle vient de remplir, sans erreur, sans avertissement.
-- Tant que le JSON n'a pas ete regenere avec ces noms, ne pas relancer l'import
-- du catalogue une fois 014 appliquee.

BEGIN;

UPDATE typefaces_core SET designer = 'TypeTogether', updated_at_utc = now() WHERE typeface_slug = 'abril_fatface' AND (designer IS NULL OR designer = '');
UPDATE typefaces_core SET designer = 'Vernon Adams', updated_at_utc = now() WHERE typeface_slug = 'anton' AND (designer IS NULL OR designer = '');
UPDATE typefaces_core SET designer = 'Ryoichi Tsunekawa', updated_at_utc = now() WHERE typeface_slug = 'bebas_neue' AND (designer IS NULL OR designer = '');
UPDATE typefaces_core SET designer = 'Colophon Foundry', updated_at_utc = now() WHERE typeface_slug = 'dm_sans' AND (designer IS NULL OR designer = '');
UPDATE typefaces_core SET designer = 'Mike Abbink, Bold Monday', updated_at_utc = now() WHERE typeface_slug = 'ibm_plex_sans' AND (designer IS NULL OR designer = '');
UPDATE typefaces_core SET designer = 'Rasmus Andersson', updated_at_utc = now() WHERE typeface_slug = 'inter' AND (designer IS NULL OR designer = '');
UPDATE typefaces_core SET designer = 'JetBrains, Philipp Nurullin, Konstantin Bulenkov', updated_at_utc = now() WHERE typeface_slug = 'jetbrains_mono' AND (designer IS NULL OR designer = '');
UPDATE typefaces_core SET designer = 'Łukasz Dziedzic', updated_at_utc = now() WHERE typeface_slug = 'lato' AND (designer IS NULL OR designer = '');
UPDATE typefaces_core SET designer = 'Impallari Type', updated_at_utc = now() WHERE typeface_slug = 'libre_baskerville' AND (designer IS NULL OR designer = '');
UPDATE typefaces_core SET designer = 'Sorkin Type', updated_at_utc = now() WHERE typeface_slug = 'merriweather' AND (designer IS NULL OR designer = '');
UPDATE typefaces_core SET designer = 'Julieta Ulanovsky, Sol Matas, Juan Pablo del Peral, Jacques Le Bailly', updated_at_utc = now() WHERE typeface_slug = 'montserrat' AND (designer IS NULL OR designer = '');
UPDATE typefaces_core SET designer = 'Vernon Adams, Cyreal, Jacques Le Bailly', updated_at_utc = now() WHERE typeface_slug = 'nunito' AND (designer IS NULL OR designer = '');
UPDATE typefaces_core SET designer = 'Steve Matteson', updated_at_utc = now() WHERE typeface_slug = 'open_sans' AND (designer IS NULL OR designer = '');
UPDATE typefaces_core SET designer = 'Vernon Adams, Kalapi Gajjar, Cyreal', updated_at_utc = now() WHERE typeface_slug = 'oswald' AND (designer IS NULL OR designer = '');
UPDATE typefaces_core SET designer = 'Claus Eggers Sørensen', updated_at_utc = now() WHERE typeface_slug = 'playfair_display' AND (designer IS NULL OR designer = '');
UPDATE typefaces_core SET designer = 'Indian Type Foundry, Jonny Pinhorn, Ninad Kale', updated_at_utc = now() WHERE typeface_slug = 'poppins' AND (designer IS NULL OR designer = '');
UPDATE typefaces_core SET designer = 'ParaType', updated_at_utc = now() WHERE typeface_slug = 'pt_serif' AND (designer IS NULL OR designer = '');
UPDATE typefaces_core SET designer = 'Matt McInerney, Pablo Impallari, Rodrigo Fuenzalida', updated_at_utc = now() WHERE typeface_slug = 'raleway' AND (designer IS NULL OR designer = '');
UPDATE typefaces_core SET designer = 'Christian Robertson, ParaType, Font Bureau', updated_at_utc = now() WHERE typeface_slug = 'roboto' AND (designer IS NULL OR designer = '');
UPDATE typefaces_core SET designer = 'Christian Robertson', updated_at_utc = now() WHERE typeface_slug = 'roboto_mono' AND (designer IS NULL OR designer = '');
UPDATE typefaces_core SET designer = 'Paul D. Hunt', updated_at_utc = now() WHERE typeface_slug = 'source_code_pro' AND (designer IS NULL OR designer = '');
UPDATE typefaces_core SET designer = 'Paul D. Hunt', updated_at_utc = now() WHERE typeface_slug = 'source_sans_3' AND (designer IS NULL OR designer = '');
UPDATE typefaces_core SET designer = 'Wei Huang', updated_at_utc = now() WHERE typeface_slug = 'work_sans' AND (designer IS NULL OR designer = '');

COMMIT;
