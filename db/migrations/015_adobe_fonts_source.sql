-- ============================================================
-- MIGRATION 015 : les polices servies par Adobe Fonts entrent au catalogue
-- NON APPLIQUEE. Elle demande le feu vert explicite du proprietaire.
-- ============================================================
--
-- POURQUOI UNE NOUVELLE PROVENANCE ET UNE NOUVELLE LICENCE.
--
-- Toutes les polices du catalogue sont aujourd'hui des FICHIERS que nous servons
-- depuis public/fonts, sous une licence libre qui nous en donne le droit. Les
-- polices Adobe ne fonctionnent pas comme ca : leurs conditions interdisent
-- explicitement de telecharger et d'heberger les fichiers. Le droit de les
-- afficher vient d'un abonnement Creative Cloud actif, et c'est le CDN d'Adobe qui
-- sert la police au navigateur du joueur, jamais nous.
--
-- Il faut donc deux valeurs nouvelles, et deux seulement :
--   font_source = 'adobe'        dit COMMENT la police se rend, par nom de famille
--                                declaree dans la feuille du projet web, sans fichier
--   license_type = 'adobe_fonts' dit POURQUOI nous avons le droit de la montrer
--
-- CE QUE CELA NE DEBLOQUE PAS. Aucune police aujourd'hui refusee ne devient
-- servable par accident : seules les lignes dont quelqu'un pose explicitement
-- license_type a 'adobe_fonts' passent la porte. Times New Roman en 'proprietary'
-- reste bloquee. La clause de licence des deux requetes de pool n'a pas change d'un
-- caractere, et les deux gardes qui la surveillent au caractere pres passent
-- toujours.
--
-- LE JOUR OU L'ABONNEMENT S'ARRETE, ces polices cessent de s'afficher et le
-- navigateur les remplace par un repli. Le joueur devrait alors nommer une typo
-- qui n'est pas a l'ecran, ce qui est exactement le defaut que le garde de
-- couverture latine a corrige pour une autre cause. Ces lignes sont donc une
-- COUCHE, jamais le socle : desactiver ces lignes suffit a revenir a un jeu qui
-- tourne sur les seules polices libres.
--
-- LE PROJET WEB EST VERROUILLE SUR SES DOMAINES. Il porte aujourd'hui localhost et
-- 127.0.0.1. Le domaine de production doit y etre ajoute AVANT la mise en ligne,
-- sinon ces polices ne s'afficheront pas une fois le site publie.
--
-- PIEGE DE REIMPORT, meme convention que 010, 013 et 014. Le prochain passage de
-- scripts/import_catalog_json.py fait ON CONFLICT DO UPDATE sur license_type et
-- font_source depuis content/catalog/typefaces-core.json. Tant que ce JSON ne
-- porte pas ces lignes, un reimport les ecraserait.
--
-- RETOUR ARRIERE. Les deux valeurs d'enum ne se retirent pas simplement en
-- PostgreSQL, mais elles sont inertes tant qu'aucune ligne ne les porte. Pour
-- annuler l'effet il suffit donc de la derniere instruction de ce fichier, jouee
-- a l'envers :
--   UPDATE typefaces_core SET activation_status = false
--   WHERE font_source::text = 'adobe';

BEGIN;

-- 1. Les deux valeurs d'enum. IF NOT EXISTS pour que rejouer le fichier soit sans effet.
ALTER TYPE app.font_source_enum ADD VALUE IF NOT EXISTS 'adobe';
ALTER TYPE app.license_type_enum ADD VALUE IF NOT EXISTS 'adobe_fonts';

COMMIT;

-- ============================================================
-- LES LIGNES ELLES MEMES SONT DANS LA MIGRATION 016.
--
-- Ce fichier ne fait plus que creer les deux valeurs d'enum, et il s'arrete la.
-- Deux raisons.
--
-- PostgreSQL refuse d'utiliser une valeur d'enum ajoutee dans la meme transaction,
-- donc les lignes ne peuvent de toute facon pas etre ecrites ici. Une premiere
-- version de ce fichier inserait Helvetica LT Pro dans une seconde transaction :
-- elle aurait echoue, l'INSERT omettait structural_signature_json qui est NOT NULL
-- et contraint par chk_contrast_coherence et chk_aperture_coherence a s'accorder
-- avec les colonnes contrast_profile et aperture_profile.
--
-- Et les 108 polices du projet web arrivent ensemble, generees depuis
-- content/catalog/adobe-fonts-kit.json plutot que recopiees a la main. Helvetica LT
-- Pro en fait partie. La 016 la porte, avec les 107 autres.
