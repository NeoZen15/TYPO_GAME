-- ============================================================
-- RETOUR ARRIERE de la migration 017
-- Genere par scripts/build_017_tail_rarity.py le 2026-08-23
-- ============================================================
--
-- Rend leur rarete d'origine aux 87 lignes de la queue, et rallume Adobe Blank.
-- Rallumer Adobe Blank remet dans le jeu une police qui n'affiche rien : ce
-- fichier existe pour la symetrie, pas parce que ce retour est souhaitable.

BEGIN;

UPDATE typefaces_core SET rarity_tag = 'common'::app.rarity_tag_enum, updated_at_utc = now()
WHERE typeface_slug = ANY(ARRAY['42dotsans', 'aksarabaligalang', 'amstelvaralpha', 'arefruqaaink', 'batang', 'batangche', 'chirongoroundtc', 'chironsunghk', 'decovaralpha', 'dhyana', 'digitalnumbers', 'dotum', 'dotumche', 'ekmukta', 'finlandica', 'fragmentmonosc', 'gulim', 'gulimche', 'gungsuh', 'gungsuhche', 'hanna', 'hannari', 'hermeneusone', 'hindcolombo', 'hindjalandhar', 'hindkochi', 'jejugothic', 'jejuhallasan', 'jejumyeongjo', 'jsmathcmbx10', 'jsmathcmex10', 'jsmathcmmi10', 'jsmathcmr10', 'jsmathcmsy10', 'jsmathcmti10', 'khyay', 'kokoro', 'kopubbatang', 'lemonadavfbeta', 'lohitbengali', 'lohitdevanagari', 'lohittamil', 'markazitextvfbeta', 'mavenprovfbeta', 'mergeone', 'montserratsubrayada', 'myanmarsanspro', 'nats', 'nicomoji', 'nikukyu', 'notocoloremoji', 'notocoloremojicompattest', 'notonaskharabicui', 'notosansarabicui', 'notosansbengaliui', 'notosansdevanagariui', 'notosansgujaratiui', 'notosansgurmukhiui', 'notosanskannadaui', 'notosanskhmerui', 'notosanslaoui', 'notosansmalayalamui', 'notosansmyanmarui', 'notosansnko_todelist', 'notosansoriyaui', 'notosanssinhalaui', 'notosanstamilui', 'notosansteluguui', 'notosansthaiui', 'notoserifnyiakengpuachuehmong', 'oflsortsmillgoudytt', 'opensanshebrew', 'opensanshebrewcondensed', 'otomanopeeone', 'podkovavfbeta', 'reemkufiink', 'rokkittvfbeta', 'roundedmplus1c', 'rubikone', 'signikanegativesc', 'signikasc', 'sitara', 'souliyo', 'strong', 'thabit', 'tharlon', 'yaldevicolombo']);

UPDATE typefaces_core SET activation_status = true, updated_at_utc = now()
WHERE typeface_slug = 'adobeblank';

COMMIT;
