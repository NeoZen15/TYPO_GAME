-- ============================================================
-- MIGRATION 018 : les clusters visuels, subdivises par la geometrie mesuree
-- Genere par scripts/build_visual_clusters.py le 2026-08-24
-- NON APPLIQUEE. Elle demande le feu vert explicite du proprietaire.
-- Retour arriere : 018_visual_clusters.rollback.sql
-- ============================================================
--
-- CE QUE LE CLUSTER DECIDE. Les deux fournisseurs s'en servent pour choisir les
-- mauvaises reponses : une police du meme cluster fait un leurre plus dur, et vaut
-- un malus de 175 a 350 points dans le tri. Trois clusters portaient 85 pour cent
-- du catalogue actif, donc ce malus ne discriminait plus rien.
--
-- CE QUI A ETE ESSAYE ET REJETE, detail dans le script generateur. La classification
-- heritee n'est PAS fausse : mesuree contre treize paires de reference elle fait
-- 10 sur 13, aussi bien que tout ce que la geometrie seule produit. Elle encode
-- l'histoire du dessin, et l'histoire predit la confusion mieux que les proportions.
-- Son defaut est le grain, pas la justesse. Elle est donc SUBDIVISEE, pas remplacee.
--
-- CE QUE CA CHANGE, MESURE : 12 clusters actifs deviennent 42, le plus gros
-- passe de 431 a 185 polices, et les deux rapprochements faux de la classification
-- heritee disparaissent, Playfair avec Abril Fatface et Bodoni avec Abril Fatface.
--
-- CE QUI RESTE IRREDUCTIBLE. Le paquet sans_serif/humanist compte 358 polices et
-- garde un noyau de 175 quel que soit le nombre de centres, de k egal 4 a k egal 30.
-- Ces 175 lineales sont geometriquement interchangeables sur les cinq grandeurs
-- mesurees. Les separer demande de reconnaitre les terminaisons et l'ouverture du e,
-- ce qui est une reconnaissance de forme et non une mesure.
--
-- LES 143 LIGNES NON MESUREES, dont les 108 Adobe, rejoignent le premier sous cluster
-- de leur famille de dessin. Adobe n'autorise aucun telechargement de fichier, donc
-- aucune mesure n'est possible. Le numero est arbitraire pour elles, la famille non :
-- une question sur Helvetica peut ainsi tirer Roboto comme leurre, ce qui est juste.
--
-- PIEGE DE REIMPORT : content/catalog/typefaces-core.json est mis en miroir par le
-- meme script, dans le meme commit.

BEGIN;

UPDATE typefaces_core SET
  visual_cluster_id = 'cluster_display_didone_00',
  updated_at_utc = now()
WHERE typeface_slug = ANY(ARRAY['abril_fatface']);

UPDATE typefaces_core SET
  visual_cluster_id = 'cluster_display_neo_grotesk_00',
  updated_at_utc = now()
WHERE typeface_slug = ANY(ARRAY['anton', 'bebas_neue']);

UPDATE typefaces_core SET
  visual_cluster_id = 'cluster_display_script_00',
  updated_at_utc = now()
WHERE typeface_slug = ANY(ARRAY['brush_script_std', 'papyrus_std']);

UPDATE typefaces_core SET
  visual_cluster_id = 'cluster_mono_didone_00',
  updated_at_utc = now()
WHERE typeface_slug = ANY(ARRAY['xanhmono']);

UPDATE typefaces_core SET
  visual_cluster_id = 'cluster_mono_geometric_00',
  updated_at_utc = now()
WHERE typeface_slug = ANY(ARRAY['b612mono', 'dmmono', 'jetbrains_mono', 'kodemono', 'monofett', 'novamono', 'redhatmono', 'sono', 'victormono']);

UPDATE typefaces_core SET
  visual_cluster_id = 'cluster_mono_grotesk_00',
  updated_at_utc = now()
WHERE typeface_slug = ANY(ARRAY['chivomono', 'fragmentmono', 'martianmono', 'overpassmono']);

UPDATE typefaces_core SET
  visual_cluster_id = 'cluster_mono_humanist_00',
  updated_at_utc = now()
WHERE typeface_slug = ANY(ARRAY['anonymouspro', 'firacode', 'firamono', 'inconsolata', 'intelonemono', 'lekton', 'majormonodisplay', 'mplus1code', 'oxygenmono', 'sometypemono', 'source_code_pro']);

UPDATE typefaces_core SET
  visual_cluster_id = 'cluster_mono_neo_grotesk_00',
  updated_at_utc = now()
WHERE typeface_slug = ANY(ARRAY['azeretmono', 'cousine', 'datatype', 'digitalnumbers', 'fragmentmonosc', 'geistmono', 'googlesanscode', 'ibmplexmono', 'iosevkacharon', 'iosevkacharonmono', 'lilex', 'lxgwwenkaimonotc', 'ptmono', 'redditmono', 'roboto_mono', 'sharetechmono', 'sixtyfour', 'sixtyfourconvergence', 'spacemono', 'splinesansmono', 'synemono', 'ubuntumono', 'ubuntusansmono', 'vt323', 'workbench']);

UPDATE typefaces_core SET
  visual_cluster_id = 'cluster_mono_slab_00',
  updated_at_utc = now()
WHERE typeface_slug = ANY(ARRAY['courier_new', 'courier_std', 'courierprime', 'cutivemono']);

UPDATE typefaces_core SET
  visual_cluster_id = 'cluster_mono_transitional_00',
  updated_at_utc = now()
WHERE typeface_slug = ANY(ARRAY['libertinusmono']);

UPDATE typefaces_core SET
  visual_cluster_id = 'cluster_sans_serif_didone_00',
  updated_at_utc = now()
WHERE typeface_slug = ANY(ARRAY['italiana']);

UPDATE typefaces_core SET
  visual_cluster_id = 'cluster_sans_serif_geometric_00',
  updated_at_utc = now()
WHERE typeface_slug = ANY(ARRAY['afacad', 'afacadflux', 'albertsans', 'aldrich', 'anta', 'assistant', 'baijamjuree', 'bpmfhuninn', 'chakrapetch', 'didactgothic', 'dongle', 'dosis', 'elmssans', 'epilogue', 'eurostile', 'eurostile_condensed', 'eurostile_extended', 'exo', 'figtree', 'fredoka', 'futura_100', 'futura_100_book', 'futura_100_latin_ext', 'futura_100_latin_ext_book', 'futura_pt', 'futura_pt_bold', 'futura_pt_condensed', 'glory', 'hubballi', 'huninn', 'itc_avant_garde_gothic_pro', 'josefinsans', 'jost', 'jua', 'jura', 'k2d', 'kodchasan', 'kulimpark', 'kumbhsans', 'leaguespartan', 'lineseedjp', 'manjari', 'meerainimai', 'mina', 'montserrat', 'mplus1', 'mplus2', 'mulish', 'nationalpark', 'ntr', 'nunitosans', 'orbit', 'outfit', 'phetsarath', 'plusjakartasans', 'quantico', 'questrial', 'quicksand', 'raleway', 'redhatdisplay', 'redhattext', 'saira', 'snpro', 'sulphurpoint', 'suse', 'susemono', 'teachers', 'tsukimirounded', 'urbanist', 'zain', 'zenkurenaido']);

UPDATE typefaces_core SET
  visual_cluster_id = 'cluster_sans_serif_geometric_01',
  updated_at_utc = now()
WHERE typeface_slug = ANY(ARRAY['abel', 'alumnisans', 'alumnisanssc', 'anybody', 'asapcondensed', 'blinker', 'chathura', 'dohyeon', 'economica', 'gemunulibre', 'genos', 'geo', 'homenaje', 'kdamthmorpro', 'miriamlibre', 'mohave', 'monomaniacone', 'newamsterdam', 'rajdhani', 'sairacondensed', 'sairaextracondensed', 'sairasemicondensed', 'smoochsans', 'strait', 'teko', 'textmeone', 'voltaire', 'winkyrough', 'winkysans', 'wireone', 'zcoolqingkehuangyou']);

UPDATE typefaces_core SET
  visual_cluster_id = 'cluster_sans_serif_geometric_02',
  updated_at_utc = now()
WHERE typeface_slug = ANY(ARRAY['alexandria', 'armata', 'asimovian', 'braahone', 'calsans', 'capriola', 'changa', 'kronaone', 'lexend', 'lexenddeca', 'lexendexa', 'lexendgiga', 'lexendmega', 'lexendpeta', 'lexendtera', 'lexendzetta', 'michroma', 'momotrustdisplay', 'montserratalternates', 'montserratsubrayada', 'montserratunderline', 'orbitron', 'parkinsans', 'paytoneone', 'poppins', 'readexpro', 'russoone', 'sarpanch', 'sourgummy', 'syncopate', 'tektur']);

UPDATE typefaces_core SET
  visual_cluster_id = 'cluster_sans_serif_geometric_03',
  updated_at_utc = now()
WHERE typeface_slug = ANY(ARRAY['alata', 'alatsi', 'anuphan', 'asap', 'averagesans', 'b612', 'basic', 'beiruti', 'chauphilomeneone', 'dhurjati', 'dm_sans', 'electrolize', 'exo2', 'geom', 'instrumentsans', 'koho', 'kosugimaru', 'lxgwmarkergothic', 'madimione', 'mallanna', 'mandali', 'marmelad', 'metrophobic', 'momotrustsans', 'monda', 'mplus1p', 'niramit', 'nunito', 'play', 'prompt', 'reemkufi', 'reemkufifun', 'tomorrow', 'wixmadefordisplay', 'wixmadefortext']);

UPDATE typefaces_core SET
  visual_cluster_id = 'cluster_sans_serif_grotesk_00',
  updated_at_utc = now()
WHERE typeface_slug = ANY(ARRAY['archivo', 'archivoblack', 'arsenal', 'arsenalsc', 'astasans', 'atkinsonhyperlegible', 'atkinsonhyperlegiblemono', 'atkinsonhyperlegiblenext', 'barlow', 'bbhbartle', 'bbhhegarty', 'chivo', 'cossettetexte', 'fahkwang', 'federo', 'funnelsans', 'gayathri', 'harmattan', 'heebo', 'hostgrotesk', 'impact', 'kantumruypro', 'karla', 'karlatamilinclined', 'karlatamilupright', 'kosugi', 'librefranklin', 'liter', 'monasans', 'mozillaheadline', 'mozillatext', 'natasans', 'numans', 'overpass', 'padauk', 'publicsans', 'puritan', 'ramabhadra', 'rethinksans', 'rocknrollone', 'schibstedgrotesk', 'seymourone', 'shipporiantique', 'shipporiantiqueb1', 'specialgothic', 'specialgothicexpandedone', 'stacksansheadline', 'stacksansnotch', 'stacksanstext', 'tiktoksans', 'titilliumweb', 'tuffy', 'vendsans']);

UPDATE typefaces_core SET
  visual_cluster_id = 'cluster_sans_serif_grotesk_01',
  updated_at_utc = now()
WHERE typeface_slug = ANY(ARRAY['archivonarrow', 'barlowcondensed', 'barlowsemicondensed', 'bayon', 'bbhbogle', 'cossettetitre', 'fjallaone', 'gidugu', 'hubotsans', 'leaguegothic', 'oswald', 'pathwaygothicone', 'pragatinarrow', 'sixcaps', 'specialgothiccondensedone', 'truculenta']);

UPDATE typefaces_core SET
  visual_cluster_id = 'cluster_sans_serif_humanist_00',
  updated_at_utc = now()
WHERE typeface_slug = ANY(ARRAY['adventpro', 'agdasima', 'akshar', 'benchnine', 'bubblerone', 'cabincondensed', 'comic_sans_ms', 'dotgothic16', 'encodesans', 'encodesanscondensed', 'encodesanssemicondensed', 'finlandica', 'georama', 'gill_sans_nova', 'gill_sans_nova_condensed', 'gill_sans_nova_deco', 'gill_sans_nova_extra_condensed', 'gill_sans_nova_inline', 'gill_sans_nova_inline_condensed', 'gill_sans_nova_shadowed', 'gill_sans_nova_shadowed_outline', 'marvel', 'moulpali', 'myanmarsanspro', 'neue_frutiger_world', 'neue_frutiger_world_ultlt', 'newscycle', 'notoemoji', 'notosansarabicui', 'notosansbengaliui', 'notosansdevanagariui', 'notosansgujaratiui', 'notosansgurmukhiui', 'notosanskannadaui', 'notosanskhmerui', 'notosanslaoui', 'notosansmalayalamui', 'notosansmyanmarui', 'notosansnko_todelist', 'notosansoriyaui', 'notosanssinhalaui', 'notosanstamilui', 'notosansteluguui', 'notosansthaiui', 'opensanshebrewcondensed', 'optima_lt_pro', 'optima_nova_lt_pro', 'optima_nova_lt_pro_cond', 'optima_nova_lt_pro_titling', 'portlligatsans', 'ptsansnarrow', 'redditsanscondensed', 'share', 'tahoma', 'trajan_sans_pro', 'verdana', 'verdana_pro', 'verdana_pro_condensed', 'yanonekaffeesatz']);

UPDATE typefaces_core SET
  visual_cluster_id = 'cluster_sans_serif_humanist_01',
  updated_at_utc = now()
WHERE typeface_slug = ANY(ARRAY['doppioone', 'hammersmithone', 'kanit', 'mochiypopone', 'mochiypoppone', 'palanquindark', 'rem', 'secularone', 'sunflower']);

UPDATE typefaces_core SET
  visual_cluster_id = 'cluster_sans_serif_humanist_02',
  updated_at_utc = now()
WHERE typeface_slug = ANY(ARRAY['abeezee', 'alegreyasanssc', 'amiko', 'biryani', 'chocolateclassicalsans', 'comme', 'durusans', 'encodesansexpanded', 'encodesanssemiexpanded', 'firasans', 'juliussansone', 'krub', 'kufam', 'lunasima', 'martelsans', 'menbere', 'nobile', 'notokufiarabic', 'notomusic', 'notosans', 'notosansadlam', 'notosansadlamunjoined', 'notosansanatolianhieroglyphs', 'notosansarabic', 'notosansarmenian', 'notosansavestan', 'notosansbalinese', 'notosansbamum', 'notosansbassavah', 'notosansbatak', 'notosansbengali', 'notosansbhaiksuki', 'notosansbrahmi', 'notosansbuginese', 'notosansbuhid', 'notosanscanadianaboriginal', 'notosanscarian', 'notosanscaucasianalbanian', 'notosanschakma', 'notosanscham', 'notosanscherokee', 'notosanschorasmian', 'notosanscoptic', 'notosanscuneiform', 'notosanscypriot', 'notosanscyprominoan', 'notosansdeseret', 'notosansdevanagari', 'notosansduployan', 'notosansegyptianhieroglyphs', 'notosanselbasan', 'notosanselymaic', 'notosansethiopic', 'notosansgeorgian', 'notosansglagolitic', 'notosansgothic', 'notosansgrantha', 'notosansgujarati', 'notosansgunjalagondi', 'notosansgurmukhi', 'notosanshanifirohingya', 'notosanshanunoo', 'notosanshatran', 'notosansimperialaramaic', 'notosansindicsiyaqnumbers', 'notosansinscriptionalpahlavi', 'notosansinscriptionalparthian', 'notosansjavanese', 'notosanskaithi', 'notosanskannada', 'notosanskawi', 'notosanskayahli', 'notosanskharoshthi', 'notosanskhmer', 'notosanskhojki', 'notosanskhudawadi', 'notosanslao', 'notosanslaolooped', 'notosanslepcha', 'notosanslimbu', 'notosanslineara', 'notosanslinearb', 'notosanslisu', 'notosanslycian', 'notosanslydian', 'notosansmahajani', 'notosansmalayalam', 'notosansmandaic', 'notosansmanichaean', 'notosansmarchen', 'notosansmasaramgondi', 'notosansmath', 'notosansmayannumerals', 'notosansmedefaidrin', 'notosansmeeteimayek', 'notosansmendekikakui', 'notosansmeroitic', 'notosansmiao', 'notosansmodi', 'notosansmongolian', 'notosansmono', 'notosansmro', 'notosansmultani', 'notosansmyanmar', 'notosansnabataean', 'notosansnagmundari', 'notosansnandinagari', 'notosansnewa', 'notosansnewtailue', 'notosansnko', 'notosansnkounjoined', 'notosansnushu', 'notosansogham', 'notosansolchiki', 'notosansoldhungarian', 'notosansolditalic', 'notosansoldnortharabian', 'notosansoldpermic', 'notosansoldpersian', 'notosansoldsogdian', 'notosansoldsoutharabian', 'notosansoldturkic', 'notosansoriya', 'notosansosage', 'notosansosmanya', 'notosanspahawhhmong', 'notosanspalmyrene', 'notosanspaucinhau', 'notosansphagspa', 'notosansphoenician', 'notosanspsalterpahlavi', 'notosansrejang', 'notosansrunic', 'notosanssamaritan', 'notosanssaurashtra', 'notosanssharada', 'notosansshavian', 'notosanssiddham', 'notosanssignwriting', 'notosanssinhala', 'notosanssogdian', 'notosanssorasompeng', 'notosanssoyombo', 'notosanssundanese', 'notosanssunuwar', 'notosanssylotinagri', 'notosanssymbols', 'notosanssymbols2', 'notosanssyriac', 'notosanssyriaceastern', 'notosanssyriacwestern', 'notosanstagalog', 'notosanstagbanwa', 'notosanstaile', 'notosanstaitham', 'notosanstaiviet', 'notosanstakri', 'notosanstamil', 'notosanstamilsupplement', 'notosanstangsa', 'notosanstelugu', 'notosansthaana', 'notosansthai', 'notosansthailooped', 'notosanstifinagh', 'notosanstirhuta', 'notosansugaritic', 'notosansvai', 'notosansvithkuqi', 'notosanswancho', 'notosanswarangciti', 'notosansyi', 'notosanszanabazarsquare', 'nototraditionalnushu', 'notoznamennymusicalnotation', 'open_sans', 'opensanshebrew', 'orienta', 'oxygen', 'ptsanscaption', 'radiocanada', 'sansation', 'tasaexplorer', 'telex', 'unbounded']);

UPDATE typefaces_core SET
  visual_cluster_id = 'cluster_sans_serif_humanist_03',
  updated_at_utc = now()
WHERE typeface_slug = ANY(ARRAY['alegreyasans', 'amaranth', 'belleza', 'cantoraone', 'elmessiri', 'galdeano', 'gotu', 'gurajada', 'inder', 'istokweb', 'lato', 'libertinussans', 'mitr', 'mukta', 'muktamahee', 'muktamalar', 'muktavaani', 'philosopher', 'prozalibre', 'rosario', 'ruluko', 'scada', 'tauri', 'tenorsans', 'voces', 'ysabeau', 'ysabeauinfant', 'ysabeauoffice', 'ysabeausc', 'zcoolxiaowei']);

UPDATE typefaces_core SET
  visual_cluster_id = 'cluster_sans_serif_humanist_04',
  updated_at_utc = now()
WHERE typeface_slug = ANY(ARRAY['aclonica', 'arya', 'blackhansans', 'candal', 'lalezar', 'merriweathersans', 'wendyone']);

UPDATE typefaces_core SET
  visual_cluster_id = 'cluster_sans_serif_humanist_05',
  updated_at_utc = now()
WHERE typeface_slug = ANY(ARRAY['alumnisansinlineone', 'firasanscondensed', 'firasansextracondensed', 'sansita', 'timmana']);

UPDATE typefaces_core SET
  visual_cluster_id = 'cluster_sans_serif_humanist_06',
  updated_at_utc = now()
WHERE typeface_slug = ANY(ARRAY['42dotsans', 'andika', 'aronesans', 'cabin', 'cagliostro', 'cambay', 'cantarell', 'commissioner', 'facultyglyphic', 'fustat', 'geologica', 'gfsneohellenic', 'gowundodum', 'kanchenjunga', 'kiteone', 'livvic', 'mirandasans', 'moderustic', 'molengo', 'mooli', 'mplusrounded1c', 'palanquin', 'quattrocentosans', 'redditsans', 'sarabun', 'sarala', 'sen', 'shanti', 'spinnaker', 'tajawal', 'trispace', 'varela', 'varelaround']);

UPDATE typefaces_core SET
  visual_cluster_id = 'cluster_sans_serif_humanist_07',
  updated_at_utc = now()
WHERE typeface_slug = ANY(ARRAY['actor', 'akatab', 'alansans', 'alef', 'amarna', 'ancizarsans', 'antic', 'athiti', 'chironheihk', 'encodesanssc', 'epundasans', 'gafata', 'gothica1', 'gudea', 'hind', 'hindguntur', 'hindmadurai', 'hindmysuru', 'hindsiliguri', 'hindvadodara', 'imprima', 'inriasans', 'kedebideri', 'khula', 'mada', 'mavenpro', 'murecho', 'nanumgothic', 'notosanshebrew', 'notosanshk', 'notosansjp', 'notosanskr', 'notosanssc', 'notosanstc', 'ptsans', 'recursive', 'signika', 'signikanegative', 'source_sans_3', 'thasadith', 'tirra', 'ubuntusans', 'varta']);

UPDATE typefaces_core SET
  visual_cluster_id = 'cluster_sans_serif_humanist_08',
  updated_at_utc = now()
WHERE typeface_slug = ANY(ARRAY['acme', 'anaheim', 'anekbangla', 'anekdevanagari', 'anekgujarati', 'anekgurmukhi', 'anekkannada', 'aneklatin', 'anekmalayalam', 'anekodia', 'anektamil', 'anektelugu', 'cascadiacode', 'cascadiamono', 'farro', 'fresca', 'gidole', 'khand', 'magra', 'mousememoirs', 'narnoor', 'rambla', 'ropasans', 'ruda', 'viga']);

UPDATE typefaces_core SET
  visual_cluster_id = 'cluster_sans_serif_neo_grotesk_00',
  updated_at_utc = now()
WHERE typeface_slug = ANY(ARRAY['aksarabaligalang', 'allertastencil', 'almarai', 'arial', 'arial_narrow', 'arial_nova', 'arial_nova_condensed', 'arial_rounded_mt_pro', 'arimo', 'bevietnampro', 'bizudpgothic', 'bytesized', 'carlito', 'carme', 'carroisgothic', 'catamaran', 'convergence', 'darkergrotesque', 'decovaralpha', 'dhyana', 'doto', 'dotum', 'dotumche', 'ekmukta', 'familjengrotesk', 'franklin_gothic', 'franklin_gothic_atf', 'franklin_gothic_compressed', 'franklin_gothic_condensed', 'franklin_gothic_extra_compressed', 'franklin_gothic_std', 'franklin_gothic_std_cond', 'franklin_gothic_urw', 'franklin_gothic_urw_compressed', 'franklin_gothic_urw_condensed', 'franklin_gothic_urw_extra_compressed', 'gantari', 'geist', 'golostext', 'gulim', 'gulimche', 'hankengrotesk', 'hannari', 'hedvigletterssans', 'helvetica_lt_pro', 'helvetica_neue_lt_pro', 'helvetica_neue_lt_pro_cond', 'helvetica_neue_world', 'hindcolombo', 'hindjalandhar', 'hindkochi', 'ibm_plex_sans', 'ibmplexsansarabic', 'ibmplexsansdevanagari', 'ibmplexsanshebrew', 'ibmplexsansjp', 'ibmplexsanskr', 'ibmplexsansthai', 'ibmplexsansthailooped', 'inclusivesans', 'inter', 'intertight', 'jaldi', 'jejugothic', 'khmer', 'kokoro', 'lohitbengali', 'lohitdevanagari', 'lohittamil', 'mako', 'manrope', 'matangi', 'mavenprovfbeta', 'mergeone', 'momosignature', 'nats', 'nicomoji', 'nikukyu', 'nokora', 'ojuju', 'onest', 'pattaya', 'podkovavfbeta', 'preahvihear', 'radiocanadabig', 'roboto', 'robotoflex', 'roundedmplus1c', 'rubik', 'sankofadisplay', 'savate', 'sawarabigothic', 'siemreap', 'sintony', 'snippet', 'sofiasans', 'sora', 'souliyo', 'spacegrotesk', 'splinesans', 'stick', 'storyscript', 'tasaorbiter', 'tharlon', 'ubuntu', 'univers_next_pro', 'univers_next_pro_compressed', 'univers_next_pro_condensed', 'univers_next_pro_extended', 'vazirmatn', 'work_sans', 'yaldevi', 'yaldevicolombo', 'yantramanav', 'zalandosans', 'zalandosansexpanded', 'zalandosanssemiexpanded', 'zcoolkuaile', 'zenkakugothicantique', 'zenkakugothicnew', 'zenmarugothic']);

UPDATE typefaces_core SET
  visual_cluster_id = 'cluster_sans_serif_neo_grotesk_01',
  updated_at_utc = now()
WHERE typeface_slug = ANY(ARRAY['allerta', 'bricolagegrotesque', 'carroisgothicsc', 'daysone', 'gasoekone', 'jejuhallasan', 'khyay', 'lemonadavfbeta', 'matemasie', 'notable', 'otomanopeeone', 'rubikmonoone', 'rubikone', 'sciencegothic', 'signikanegativesc', 'signikasc']);

UPDATE typefaces_core SET
  visual_cluster_id = 'cluster_sans_serif_neo_grotesk_02',
  updated_at_utc = now()
WHERE typeface_slug = ANY(ARRAY['bizudgothic', 'englebert', 'francoisone', 'ibmplexsanscondensed', 'jaro', 'jockeyone', 'mpluscodelatin', 'rationale', 'robotocondensed', 'rumraisin', 'sharetech', 'sofiasanscondensed', 'sofiasansextracondensed', 'sofiasanssemicondensed', 'sticknobills', 'strong', 'tiny5', 'ubuntucondensed', 'wdxllubrifontjpn', 'wdxllubrifontsc', 'wdxllubrifonttc']);

UPDATE typefaces_core SET
  visual_cluster_id = 'cluster_sans_serif_neo_grotesk_03',
  updated_at_utc = now()
WHERE typeface_slug = ANY(ARRAY['amstelvaralpha', 'cuprum', 'denkone', 'dorsa', 'hanna', 'hermeneusone', 'jejumyeongjo', 'kopubbatang', 'markazitextvfbeta', 'mingzat', 'pavanam', 'pontanosans', 'qahiri', 'rokkittvfbeta', 'sirivennela', 'stylish', 'tacone', 'tenaliramakrishna', 'yuseimagic']);

UPDATE typefaces_core SET
  visual_cluster_id = 'cluster_sans_serif_old_style_00',
  updated_at_utc = now()
WHERE typeface_slug = ANY(ARRAY['nuosusil']);

UPDATE typefaces_core SET
  visual_cluster_id = 'cluster_sans_serif_transitional_00',
  updated_at_utc = now()
WHERE typeface_slug = ANY(ARRAY['bpmfzihikaistd']);

UPDATE typefaces_core SET
  visual_cluster_id = 'cluster_serif_didone_00',
  updated_at_utc = now()
WHERE typeface_slug = ANY(ARRAY['abhayalibre', 'anticdidone', 'bentham', 'bevan', 'bitter', 'bodoni_std', 'bodoni_urw', 'bodonimoda', 'bodonimodasc', 'cactusclassicalserif', 'caladea', 'cambo', 'cantataone', 'domine', 'faustina', 'fjordone', 'frankruhllibre', 'gfsdidot', 'hinamincho', 'ibmplexserif', 'imbue', 'inriaserif', 'instrumentserif', 'itc_bodoni_seventytwo_pro', 'kalnia', 'kohsantepheap', 'ledger', 'librebodoni', 'linotype_didot', 'linotype_didot_headline', 'ltc_bodoni_175', 'oldstandardtt', 'oranienbaum', 'playfair_display', 'playfairdisplaysc', 'poltawskinowy', 'prata', 'robotoserif', 'rozhaone', 'rufina', 'sreekrushnadevaraya', 'suranna', 'taviraj', 'tienne', 'trirong', 'trocchi', 'uchen', 'ultra', 'unna', 'vidaloka']);

UPDATE typefaces_core SET
  visual_cluster_id = 'cluster_serif_humanist_00',
  updated_at_utc = now()
WHERE typeface_slug = ANY(ARRAY['asul']);

UPDATE typefaces_core SET
  visual_cluster_id = 'cluster_serif_old_style_00',
  updated_at_utc = now()
WHERE typeface_slug = ANY(ARRAY['abyssinicasil', 'adamina', 'adobe_caslon_pro', 'adobe_garamond_pro', 'alegreya', 'alegreyasc', 'alice', 'alike', 'alikeangular', 'almendra', 'almendrasc', 'amethysta', 'ancizarserif', 'asar', 'average', 'big_caslon_fb', 'brawler', 'copperplate', 'copperplate_condensed', 'coustard', 'crimsonpro', 'daibannasil', 'davidlibre', 'eczar', 'fenix', 'fraunces', 'gabriela', 'garamond_atf_micro', 'garamond_atf_subhead', 'garamond_atf_text', 'garamond_premier_pro', 'garamond_premier_pro_caption', 'garamond_premier_pro_display', 'garamond_premier_pro_subhead', 'habibi', 'headlandone', 'hedviglettersserif', 'inika', 'inknutantiqua', 'king_s_caslon', 'king_s_caslon_display', 'kottaone', 'kurale', 'labrada', 'laila', 'librecaslontext', 'ltc_caslon_pro', 'maname', 'markazitext', 'martel', 'mate', 'matesc', 'merriweather', 'montaga', 'namdhinggo', 'neuton', 'p22_franklin_caslon', 'petrona', 'platypi', 'portlligatslab', 'rosarivo', 'sahitya', 'sawarabimincho', 'stoke', 'trajan_color', 'trajan_pro_3', 'youngserif']);

UPDATE typefaces_core SET
  visual_cluster_id = 'cluster_serif_old_style_01',
  updated_at_utc = now()
WHERE typeface_slug = ANY(ARRAY['amiri', 'amiriquran', 'arefruqaa', 'bellefair', 'benne', 'bonanova', 'bonanovasc', 'buenard', 'cardo', 'castorotitling', 'caudex', 'cinzel', 'cormorant', 'cormorantgaramond', 'cormorantinfant', 'cormorantsc', 'cormorantunicase', 'cormorantupright', 'crimsontext', 'ebgaramond', 'goudybookletter1911', 'joan', 'librecaslondisplay', 'lindenhill', 'nanummyeongjo', 'ovo', 'quattrocento', 'radley', 'ramaraja', 'ruwudu', 'sedan', 'sedansc', 'sortsmillgoudy']);

UPDATE typefaces_core SET
  visual_cluster_id = 'cluster_serif_slab_00',
  updated_at_utc = now()
WHERE typeface_slug = ANY(ARRAY['aleo', 'andadapro', 'anticslab', 'arbutus', 'arbutusslab', 'arvo', 'besley', 'bhutukaexpandedone', 'biorhyme', 'biorhymeexpanded', 'breeserif', 'clarendon_text_pro', 'clarendon_urw', 'clarendon_urw_extra_narrow', 'clarendon_urw_extra_wide', 'clarendon_wide', 'clarendon_wide_sc', 'clarendon_wide_stencil', 'cooper_black_std', 'copse', 'creteround', 'cutive', 'enriqueta', 'epundaslab', 'faunaone', 'glegoo', 'graduate', 'grandifloraone', 'hanuman', 'heptaslab', 'josefinslab', 'kameron', 'kayphodu', 'maidenorange', 'montaguslab', 'noticiatext', 'padyakkeexpandedone', 'podkova', 'pridi', 'ptserifcaption', 'robotoslab', 'rockwell', 'rockwell_condensed', 'rockwell_nova', 'rockwell_nova_condensed', 'rokkitt', 'sanchez', 'scopeone', 'slabo13px', 'slabo27px', 'solway', 'stintultracondensed', 'stintultraexpanded', 'superclarendon', 'sura', 'suwannaphum', 'wellfleet', 'zillaslab', 'zillaslabhighlight']);

UPDATE typefaces_core SET
  visual_cluster_id = 'cluster_serif_transitional_00',
  updated_at_utc = now()
WHERE typeface_slug = ANY(ARRAY['alkalami', 'aoboshione', 'artifika', 'baskerville_bt', 'baskerville_display_pt', 'baskerville_no2', 'baskerville_poster_pt', 'baskerville_urw', 'baskerville_urw_regular_oblique', 'belgrano', 'berthold_baskerville_pro', 'castoro', 'dmserifdisplay', 'dmseriftext', 'donegalone', 'georgia', 'georgiapro', 'georgiapro_condensed', 'gungsuh', 'hahmlet', 'holtwoodonesc', 'idiqlat', 'jsmathcmbx10', 'judson', 'kiwimaru', 'libre_baskerville', 'lisubosa', 'marcellus', 'markoone', 'notonaskharabicui', 'notoserifmyanmar', 'notoserifnyiakengpuachuehmong', 'odormeanchey', 'peralta', 'ramsina', 'sitara', 'songmyung', 'sourceserif4', 'suezone', 'thabit', 'times_new_roman', 'tirobangla', 'tirodevanagarihindi', 'tirodevanagarimarathi', 'tirodevanagarisanskrit', 'tirogurmukhi', 'tirokannada', 'tirotamil', 'tirotelugu', 'uoqmunthenkhung', 'vastshadow', 'volkhov', 'vollkorn', 'vollkornsc', 'zenantique', 'zenantiquesoft']);

UPDATE typefaces_core SET
  visual_cluster_id = 'cluster_serif_transitional_01',
  updated_at_utc = now()
WHERE typeface_slug = ANY(ARRAY['arapey', 'bacasimeantique', 'baskervville', 'baskervvillesc', 'batang', 'brygada1918', 'gildadisplay', 'imfellfrenchcanonsc', 'junge', 'kaiseidecol', 'kaiseiharunoumi', 'kaiseiopti', 'kaiseitokumin', 'lora', 'lustria', 'marcellussc', 'notoserifhk', 'notoserifjp', 'notoserifkr', 'notoserifsc', 'notoseriftc', 'oflsortsmillgoudytt', 'shipporimincho', 'shipporiminchob1', 'wittgenstein']);

UPDATE typefaces_core SET
  visual_cluster_id = 'cluster_serif_transitional_02',
  updated_at_utc = now()
WHERE typeface_slug = ANY(ARRAY['bizudpmincho', 'danfo', 'jsmathcmex10', 'kadwa', 'karma', 'literata', 'maitree', 'manuale', 'notonaskharabic', 'notonastaliqurdu', 'notorashihebrew', 'notoserif', 'notoserifahom', 'notoserifarmenian', 'notoserifbalinese', 'notoserifbengali', 'notoserifdevanagari', 'notoserifdivesakuru', 'notoserifdogra', 'notoserifethiopic', 'notoserifgeorgian', 'notoserifgrantha', 'notoserifgujarati', 'notoserifgurmukhi', 'notoserifhebrew', 'notoserifhentaigana', 'notoserifkannada', 'notoserifkhitansmallscript', 'notoserifkhmer', 'notoserifkhojki', 'notoseriflao', 'notoserifmakasar', 'notoserifmalayalam', 'notoserifnphmong', 'notoserifolduyghur', 'notoseriforiya', 'notoserifottomansiyaq', 'notoserifsinhala', 'notoseriftamil', 'notoseriftangut', 'notoseriftelugu', 'notoserifthai', 'notoseriftibetan', 'notoseriftodhri', 'notoseriftoto', 'notoserifvithkuqi', 'notoserifyezidi', 'quando', 'rhodiumlibre', 'texturina', 'trykker', 'yujimai', 'yujisyuku']);

UPDATE typefaces_core SET
  visual_cluster_id = 'cluster_serif_transitional_03',
  updated_at_utc = now()
WHERE typeface_slug = ANY(ARRAY['annapurnasil', 'balthazar', 'batangche', 'charissil', 'dellarespira', 'fanwoodtext', 'gelasio', 'gulzar', 'ibarrarealnova', 'imfelldoublepica', 'imfelldoublepicasc', 'imfelldwpicasc', 'imfellenglishsc', 'imfellgreatprimersc', 'jacquesfrancois', 'jomolhari', 'jsmathcmmi10', 'jsmathcmr10', 'jsmathcmti10', 'lateef', 'libertinusserif', 'lusitana', 'newsreader', 'parastoo', 'peddana', 'poly', 'pt_serif', 'scheherazadenew', 'spectral', 'spectralsc', 'stixtwomath', 'stixtwotext', 'sumana', 'suravaram', 'taiheritagepro', 'tinos', 'zenoldmincho']);

UPDATE typefaces_core SET
  visual_cluster_id = 'cluster_serif_transitional_04',
  updated_at_utc = now()
WHERE typeface_slug = ANY(ARRAY['alyamama', 'bizudmincho', 'diphylleia', 'esteban', 'gentiumbookplus', 'gentiumplus', 'gowunbatang', 'grenze', 'gungsuhche', 'gupter', 'halant', 'imfelldwpica', 'imfellenglish', 'imfellfrenchcanon', 'imfellgreatprimer', 'jsmathcmsy10', 'kreon', 'mirza', 'newtegomin', 'piazzolla', 'prociono', 'rasa', 'vesperlibre', 'yrsa', 'yujiboku']);

COMMIT;
