-- ============================================================
-- MIGRATION 017 : la queue du catalogue, que la 013 n'a pas pu classer
-- Genere par scripts/build_017_tail_rarity.py le 2026-08-23
-- NON APPLIQUEE. Elle demande le feu vert explicite du proprietaire.
-- Requiert la migration 013.
-- Retour arriere : 017_tail_rarity.rollback.sql
-- ============================================================
--
-- CE QU'ELLE REPARE. La 013 classe 1090 polices d'apres le classement de popularite
-- de Google. Elle en laisse 87 de cote, parce que Google ne les classe pas :
-- 42dot Sans, Aref Ruqaa Ink, Batang, BatangChe, Chiron GoRound TC, Chiron Sung HK, Dhyana, Digital Numbers
-- et les autres. Faute d'ordre, elles avaient garde la rarete par defaut, common, et
-- se retrouvaient dans la portee du debutant au meme titre qu'Helvetica.
--
-- L'absence du classement est en elle meme le signal. Une police que Google ne range
-- nulle part n'est pas une police que le grand public sait nommer. Elles passent donc
-- en rare, restent jouables, mais au dernier palier.
--
-- ET UNE LIGNE S'ETEINT. Adobe Blank porte les 52 lettres latines et n'en dessine
-- aucune : l'avance de chaque glyphe vaut zero, mesure avec fontkit. Une manche
-- l'aurait affichee comme un mot vide en demandant au joueur de la nommer. Ce n'est
-- pas une police a reconnaitre, c'est un outil de typographe. Le garde
-- check:latin-coverage teste desormais l'encre et empeche son retour.
--
-- PIEGE DE REIMPORT. content/catalog/typefaces-core.json a ete mis en miroir dans le
-- meme commit par scripts/build_017_tail_rarity.py, donc un reimport ne defera rien.

BEGIN;

UPDATE typefaces_core SET
  rarity_tag = 'rare'::app.rarity_tag_enum,
  updated_at_utc = now()
WHERE typeface_slug = ANY(ARRAY['42dotsans', 'aksarabaligalang', 'amstelvaralpha', 'arefruqaaink', 'batang', 'batangche', 'chirongoroundtc', 'chironsunghk', 'decovaralpha', 'dhyana', 'digitalnumbers', 'dotum', 'dotumche', 'ekmukta', 'finlandica', 'fragmentmonosc', 'gulim', 'gulimche', 'gungsuh', 'gungsuhche', 'hanna', 'hannari', 'hermeneusone', 'hindcolombo', 'hindjalandhar', 'hindkochi', 'jejugothic', 'jejuhallasan', 'jejumyeongjo', 'jsmathcmbx10', 'jsmathcmex10', 'jsmathcmmi10', 'jsmathcmr10', 'jsmathcmsy10', 'jsmathcmti10', 'khyay', 'kokoro', 'kopubbatang', 'lemonadavfbeta', 'lohitbengali', 'lohitdevanagari', 'lohittamil', 'markazitextvfbeta', 'mavenprovfbeta', 'mergeone', 'montserratsubrayada', 'myanmarsanspro', 'nats', 'nicomoji', 'nikukyu', 'notocoloremoji', 'notocoloremojicompattest', 'notonaskharabicui', 'notosansarabicui', 'notosansbengaliui', 'notosansdevanagariui', 'notosansgujaratiui', 'notosansgurmukhiui', 'notosanskannadaui', 'notosanskhmerui', 'notosanslaoui', 'notosansmalayalamui', 'notosansmyanmarui', 'notosansnko_todelist', 'notosansoriyaui', 'notosanssinhalaui', 'notosanstamilui', 'notosansteluguui', 'notosansthaiui', 'notoserifnyiakengpuachuehmong', 'oflsortsmillgoudytt', 'opensanshebrew', 'opensanshebrewcondensed', 'otomanopeeone', 'podkovavfbeta', 'reemkufiink', 'rokkittvfbeta', 'roundedmplus1c', 'rubikone', 'signikanegativesc', 'signikasc', 'sitara', 'souliyo', 'strong', 'thabit', 'tharlon', 'yaldevicolombo']);

UPDATE typefaces_core SET
  activation_status = false,
  updated_at_utc = now()
WHERE typeface_slug = 'adobeblank';

COMMIT;
