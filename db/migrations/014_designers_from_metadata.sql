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

BEGIN;

UPDATE typefaces_core SET designer = 'TypeTogether', updated_at_utc = now() WHERE typeface_slug = 'abrilfatface' AND (designer IS NULL OR designer = '');
UPDATE typefaces_core SET designer = 'Vernon Adams', updated_at_utc = now() WHERE typeface_slug = 'anton' AND (designer IS NULL OR designer = '');
UPDATE typefaces_core SET designer = 'Ryoichi Tsunekawa', updated_at_utc = now() WHERE typeface_slug = 'bebasneue' AND (designer IS NULL OR designer = '');
UPDATE typefaces_core SET designer = 'Colophon Foundry', updated_at_utc = now() WHERE typeface_slug = 'dmsans' AND (designer IS NULL OR designer = '');
UPDATE typefaces_core SET designer = 'Mike Abbink, Bold Monday', updated_at_utc = now() WHERE typeface_slug = 'ibmplexsans' AND (designer IS NULL OR designer = '');
UPDATE typefaces_core SET designer = 'Rasmus Andersson', updated_at_utc = now() WHERE typeface_slug = 'inter' AND (designer IS NULL OR designer = '');
UPDATE typefaces_core SET designer = 'JetBrains, Philipp Nurullin, Konstantin Bulenkov', updated_at_utc = now() WHERE typeface_slug = 'jetbrainsmono' AND (designer IS NULL OR designer = '');
UPDATE typefaces_core SET designer = 'Łukasz Dziedzic', updated_at_utc = now() WHERE typeface_slug = 'lato' AND (designer IS NULL OR designer = '');
UPDATE typefaces_core SET designer = 'Impallari Type', updated_at_utc = now() WHERE typeface_slug = 'librebaskerville' AND (designer IS NULL OR designer = '');
UPDATE typefaces_core SET designer = 'Sorkin Type', updated_at_utc = now() WHERE typeface_slug = 'merriweather' AND (designer IS NULL OR designer = '');
UPDATE typefaces_core SET designer = 'Julieta Ulanovsky, Sol Matas, Juan Pablo del Peral, Jacques Le Bailly', updated_at_utc = now() WHERE typeface_slug = 'montserrat' AND (designer IS NULL OR designer = '');
UPDATE typefaces_core SET designer = 'Vernon Adams, Cyreal, Jacques Le Bailly', updated_at_utc = now() WHERE typeface_slug = 'nunito' AND (designer IS NULL OR designer = '');
UPDATE typefaces_core SET designer = 'Steve Matteson', updated_at_utc = now() WHERE typeface_slug = 'opensans' AND (designer IS NULL OR designer = '');
UPDATE typefaces_core SET designer = 'Vernon Adams, Kalapi Gajjar, Cyreal', updated_at_utc = now() WHERE typeface_slug = 'oswald' AND (designer IS NULL OR designer = '');
UPDATE typefaces_core SET designer = 'Claus Eggers Sørensen', updated_at_utc = now() WHERE typeface_slug = 'playfairdisplay' AND (designer IS NULL OR designer = '');
UPDATE typefaces_core SET designer = 'Indian Type Foundry, Jonny Pinhorn, Ninad Kale', updated_at_utc = now() WHERE typeface_slug = 'poppins' AND (designer IS NULL OR designer = '');
UPDATE typefaces_core SET designer = 'ParaType', updated_at_utc = now() WHERE typeface_slug = 'ptserif' AND (designer IS NULL OR designer = '');
UPDATE typefaces_core SET designer = 'Matt McInerney, Pablo Impallari, Rodrigo Fuenzalida', updated_at_utc = now() WHERE typeface_slug = 'raleway' AND (designer IS NULL OR designer = '');
UPDATE typefaces_core SET designer = 'Christian Robertson, ParaType, Font Bureau', updated_at_utc = now() WHERE typeface_slug = 'roboto' AND (designer IS NULL OR designer = '');
UPDATE typefaces_core SET designer = 'Christian Robertson', updated_at_utc = now() WHERE typeface_slug = 'robotomono' AND (designer IS NULL OR designer = '');
UPDATE typefaces_core SET designer = 'Paul D. Hunt', updated_at_utc = now() WHERE typeface_slug = 'sourcecodepro' AND (designer IS NULL OR designer = '');
UPDATE typefaces_core SET designer = 'Paul D. Hunt', updated_at_utc = now() WHERE typeface_slug = 'sourcesans3' AND (designer IS NULL OR designer = '');
UPDATE typefaces_core SET designer = 'Wei Huang', updated_at_utc = now() WHERE typeface_slug = 'worksans' AND (designer IS NULL OR designer = '');

COMMIT;
