// GENERE PAR scripts/build_twin_guard.py, ne pas editer a la main.
// Derniere generation : 2026-08-31.
//
// DES POLICES QUI DESSINENT LE LATIN A L'IDENTIQUE.
//
// Le jeu montre un mot et demande quelle police le dessine. Si deux polices du
// catalogue tracent le latin exactement pareil et sortent dans la meme manche,
// l'une comme bonne reponse et l'autre comme leurre, la question n'a pas de
// reponse : le joueur ne peut que deviner. 351 polices jouables sont dans ce cas,
// reparties en 61 familles.
//
// LE CAS QUI A FAIT OUVRIR LA CHASSE. Noto Sans JP, KR, SC et TC sont la meme
// police latine avec une ecriture supplementaire, et quatre d'entre elles etaient
// atteignables des le premier pool d'un debutant.
//
// COMMENT LA LISTE EST ETABLIE. Neuf grandeurs mesurees dans les fichiers, six de
// proportion et trois de forme. Deux polices sont jumelles si CHACUNE des
// grandeurs differe de moins d'un pour cent, et une famille n'existe que si
// CHAQUE membre est jumeau de CHAQUE autre. Un groupement de proche en proche
// reunissait Noto Sans et Noto Sans JP, qui different de 49 pour cent en graisse :
// une chaine de ressemblances n'est pas une ressemblance.
//
// CE QUE CA NE FAIT PAS. Aucune police n'est retiree du catalogue. Elles restent
// toutes jouables comme bonne reponse ; c'est seulement leur presence SIMULTANEE
// dans une meme manche qui est empechee. Retirer des polices serait une decision
// de produit, celle ci est une reparation de correction.

export const TWIN_FAMILIES: readonly (readonly string[])[] = [
  // 154 polices : Noto Kufi Arabic, Noto Music, Noto Sans ...
  ["notokufiarabic", "notomusic", "notosans", "notosansadlam", "notosansadlamunjoined", "notosansanatolianhieroglyphs", "notosansarabic", "notosansarmenian", "notosansavestan", "notosansbalinese", "notosansbamum", "notosansbassavah", "notosansbatak", "notosansbengali", "notosansbhaiksuki", "notosansbrahmi", "notosansbuginese", "notosansbuhid", "notosanscanadianaboriginal", "notosanscarian", "notosanscaucasianalbanian", "notosanschakma", "notosanscham", "notosanscherokee", "notosanschorasmian", "notosanscoptic", "notosanscuneiform", "notosanscypriot", "notosanscyprominoan", "notosansdeseret", "notosansdevanagari", "notosansduployan", "notosansegyptianhieroglyphs", "notosanselbasan", "notosanselymaic", "notosansethiopic", "notosansgeorgian", "notosansglagolitic", "notosansgothic", "notosansgrantha", "notosansgujarati", "notosansgunjalagondi", "notosansgurmukhi", "notosanshanifirohingya", "notosanshanunoo", "notosanshatran", "notosansimperialaramaic", "notosansindicsiyaqnumbers", "notosansinscriptionalpahlavi", "notosansinscriptionalparthian", "notosansjavanese", "notosanskaithi", "notosanskannada", "notosanskawi", "notosanskayahli", "notosanskharoshthi", "notosanskhmer", "notosanskhojki", "notosanskhudawadi", "notosanslao", "notosanslaolooped", "notosanslepcha", "notosanslimbu", "notosanslineara", "notosanslinearb", "notosanslisu", "notosanslycian", "notosanslydian", "notosansmahajani", "notosansmalayalam", "notosansmandaic", "notosansmanichaean", "notosansmarchen", "notosansmasaramgondi", "notosansmath", "notosansmayannumerals", "notosansmedefaidrin", "notosansmeeteimayek", "notosansmendekikakui", "notosansmeroitic", "notosansmiao", "notosansmodi", "notosansmongolian", "notosansmro", "notosansmultani", "notosansmyanmar", "notosansnabataean", "notosansnagmundari", "notosansnandinagari", "notosansnewa", "notosansnewtailue", "notosansnko", "notosansnkounjoined", "notosansnushu", "notosansogham", "notosansolchiki", "notosansoldhungarian", "notosansolditalic", "notosansoldnortharabian", "notosansoldpermic", "notosansoldpersian", "notosansoldsogdian", "notosansoldsoutharabian", "notosansoldturkic", "notosansoriya", "notosansosage", "notosansosmanya", "notosanspahawhhmong", "notosanspalmyrene", "notosanspaucinhau", "notosansphagspa", "notosansphoenician", "notosanspsalterpahlavi", "notosansrejang", "notosansrunic", "notosanssamaritan", "notosanssaurashtra", "notosansshavian", "notosanssiddham", "notosanssignwriting", "notosanssinhala", "notosanssogdian", "notosanssorasompeng", "notosanssoyombo", "notosanssundanese", "notosanssunuwar", "notosanssylotinagri", "notosanssymbols2", "notosanssyriac", "notosanssyriaceastern", "notosanssyriacwestern", "notosanstagalog", "notosanstagbanwa", "notosanstaile", "notosanstaitham", "notosanstaiviet", "notosanstakri", "notosanstamil", "notosanstamilsupplement", "notosanstangsa", "notosanstelugu", "notosansthaana", "notosansthai", "notosansthailooped", "notosanstifinagh", "notosanstirhuta", "notosansugaritic", "notosansvai", "notosansvithkuqi", "notosanswancho", "notosanswarangciti", "notosansyi", "notosanszanabazarsquare", "notoznamennymusicalnotation"],
  // 19 polices : Koh Santepheap, Noto Naskh Arabic, Noto Nastaliq Urdu ...
  ["kohsantepheap", "notonaskharabic", "notonastaliqurdu", "notoserifahom", "notoserifbalinese", "notoserifdivesakuru", "notoserifdogra", "notoserifgrantha", "notoserifkhitansmallscript", "notoserifkhojki", "notoserifmakasar", "notoserifnphmong", "notoserifolduyghur", "notoseriforiya", "notoserifottomansiyaq", "notoseriftangut", "notoseriftoto", "notoserifvithkuqi", "notoserifyezidi"],
  // 19 polices : Noto Rashi Hebrew, Noto Serif, Noto Serif Armenian ...
  ["notorashihebrew", "notoserif", "notoserifarmenian", "notoserifbengali", "notoserifdevanagari", "notoserifethiopic", "notoserifgeorgian", "notoserifgujarati", "notoserifgurmukhi", "notoserifhebrew", "notoserifkannada", "notoserifkhmer", "notoseriflao", "notoserifmalayalam", "notoserifsinhala", "notoseriftamil", "notoseriftelugu", "notoserifthai", "notoseriftibetan"],
  // 10 polices : Anek Bangla, Anek Devanagari, Anek Gujarati ...
  ["anekbangla", "anekdevanagari", "anekgujarati", "anekgurmukhi", "anekkannada", "aneklatin", "anekmalayalam", "anekodia", "anektamil", "anektelugu"],
  // 9 polices : Castoro, Tiro Bangla, Tiro Devanagari Hindi ...
  ["castoro", "tirobangla", "tirodevanagarihindi", "tirodevanagarimarathi", "tirodevanagarisanskrit", "tirogurmukhi", "tirokannada", "tirotamil", "tirotelugu"],
  // 9 polices : Hind, Hind Colombo, Hind Guntur ...
  ["hind", "hindcolombo", "hindguntur", "hindjalandhar", "hindkochi", "hindmadurai", "hindmysuru", "hindsiliguri", "hindvadodara"],
  // 8 polices : Anuphan, IBM Plex Sans, IBM Plex Sans Arabic ...
  ["anuphan", "ibm_plex_sans", "ibmplexsansarabic", "ibmplexsansdevanagari", "ibmplexsanshebrew", "ibmplexsanskr", "ibmplexsansthai", "ibmplexsansthailooped"],
  // 5 polices : Ek Mukta, Mukta, Mukta Mahee ...
  ["ekmukta", "mukta", "muktamahee", "muktamalar", "muktavaani"],
  // 5 polices : Noto Sans HK, Noto Sans JP, Noto Sans KR ...
  ["notosanshk", "notosansjp", "notosanskr", "notosanssc", "notosanstc"],
  // 5 polices : Noto Serif HK, Noto Serif JP, Noto Serif KR ...
  ["notoserifhk", "notoserifjp", "notoserifkr", "notoserifsc", "notoseriftc"],
  // 4 polices : Kaisei Decol, Kaisei HarunoUmi, Kaisei Opti ...
  ["kaiseidecol", "kaiseiharunoumi", "kaiseiopti", "kaiseitokumin"],
  // 4 polices : WDXL Lubrifont JP N, WDXL Lubrifont SC, WDXL Lubrifont TC ...
  ["wdxllubrifontjpn", "wdxllubrifontsc", "wdxllubrifonttc", "zcoolqingkehuangyou"],
  // 3 polices : El Messiri, Philosopher, ZCOOL XiaoWei
  ["elmessiri", "philosopher", "zcoolxiaowei"],
  // 3 polices : Lexend, Lexend Deca, Readex Pro
  ["lexend", "lexenddeca", "readexpro"],
  // 2 polices : Noto Sans Symbols, Noto Traditional Nushu
  ["notosanssymbols", "nototraditionalnushu"],
  // 2 polices : 42dot Sans, Asta Sans
  ["42dotsans", "astasans"],
  // 2 polices : Abyssinica SIL, Charis SIL
  ["abyssinicasil", "charissil"],
  // 2 polices : Afacad, Afacad Flux
  ["afacad", "afacadflux"],
  // 2 polices : Akatab, Tirra
  ["akatab", "tirra"],
  // 2 polices : Alumni Sans, Alumni Sans SC
  ["alumnisans", "alumnisanssc"],
  // 2 polices : Alyamama, Ancizar Serif
  ["alyamama", "ancizarserif"],
  // 2 polices : Amiri, Amiri Quran
  ["amiri", "amiriquran"],
  // 2 polices : Arimo, tharlon
  ["arimo", "tharlon"],
  // 2 polices : Arsenal, Arsenal SC
  ["arsenal", "arsenalsc"],
  // 2 polices : Atkinson Hyperlegible, Atkinson Hyperlegible Next
  ["atkinsonhyperlegible", "atkinsonhyperlegiblenext"],
  // 2 polices : Baskervville, Baskervville SC
  ["baskervville", "baskervvillesc"],
  // 2 polices : Bodoni Moda, Bodoni Moda SC
  ["bodonimoda", "bodonimodasc"],
  // 2 polices : Bona Nova, Bona Nova SC
  ["bonanova", "bonanovasc"],
  // 2 polices : Bpmf Huninn, Huninn
  ["bpmfhuninn", "huninn"],
  // 2 polices : Cascadia Code, Cascadia Mono
  ["cascadiacode", "cascadiamono"],
  // 2 polices : Cormorant, Cormorant Garamond
  ["cormorant", "cormorantgaramond"],
  // 2 polices : Fragment Mono, Fragment Mono SC
  ["fragmentmono", "fragmentmonosc"],
  // 2 polices : Franklin Gothic Compressed, Franklin Gothic URW Compressed
  ["franklin_gothic_compressed", "franklin_gothic_urw_compressed"],
  // 2 polices : Franklin Gothic Condensed, Franklin Gothic URW Condensed
  ["franklin_gothic_condensed", "franklin_gothic_urw_condensed"],
  // 2 polices : Franklin Gothic Std, Franklin Gothic URW
  ["franklin_gothic_std", "franklin_gothic_urw"],
  // 2 polices : Futura 100, Futura 100 Latin Ext
  ["futura_100", "futura_100_latin_ext"],
  // 2 polices : Futura 100 Book, Futura 100 Latin Ext Book
  ["futura_100_book", "futura_100_latin_ext_book"],
  // 2 polices : Georgia, GeorgiaPro
  ["georgia", "georgiapro"],
  // 2 polices : Hanuman, Roboto Slab
  ["hanuman", "robotoslab"],
  // 2 polices : Helvetica Neue LT Pro, Helvetica Neue World
  ["helvetica_neue_lt_pro", "helvetica_neue_world"],
  // 2 polices : IBM Plex Mono, Lilex
  ["ibmplexmono", "lilex"],
  // 2 polices : Iosevka Charon, Iosevka Charon Mono
  ["iosevkacharon", "iosevkacharonmono"],
  // 2 polices : Mada, Source Sans 3
  ["mada", "source_sans_3"],
  // 2 polices : Markazi Text, markazitextvfbeta
  ["markazitext", "markazitextvfbeta"],
  // 2 polices : Maven Pro, mavenprovfbeta
  ["mavenpro", "mavenprovfbeta"],
  // 2 polices : Mochiy Pop One, Mochiy Pop P One
  ["mochiypopone", "mochiypoppone"],
  // 2 polices : M PLUS 1, M PLUS 2
  ["mplus1", "mplus2"],
  // 2 polices : M PLUS 1 Code, M PLUS Code Latin
  ["mplus1code", "mpluscodelatin"],
  // 2 polices : M PLUS Rounded 1c, roundedmplus1c
  ["mplusrounded1c", "roundedmplus1c"],
  // 2 polices : Podkova, podkovavfbeta
  ["podkova", "podkovavfbeta"],
  // 2 polices : Rasa, Yrsa
  ["rasa", "yrsa"],
  // 2 polices : Reem Kufi, Reem Kufi Fun
  ["reemkufi", "reemkufifun"],
  // 2 polices : Roboto, Vazirmatn
  ["roboto", "vazirmatn"],
  // 2 polices : Sedan, Sedan SC
  ["sedan", "sedansc"],
  // 2 polices : Shippori Mincho, Shippori Mincho B1
  ["shipporimincho", "shipporiminchob1"],
  // 2 polices : Spectral, Spectral SC
  ["spectral", "spectralsc"],
  // 2 polices : Stack Sans Headline, Stack Sans Notch
  ["stacksansheadline", "stacksansnotch"],
  // 2 polices : Verdana, Verdana Pro
  ["verdana", "verdana_pro"],
  // 2 polices : Ysabeau, Ysabeau Office
  ["ysabeau", "ysabeauoffice"],
  // 2 polices : Zen Antique, Zen Antique Soft
  ["zenantique", "zenantiquesoft"],
  // 2 polices : Zen Kaku Gothic Antique, Zen Kaku Gothic New
  ["zenkakugothicantique", "zenkakugothicnew"],
] as const;

// Index construit une fois : slug vers l'ensemble de ses jumelles, elle comprise.
const TWINS_BY_SLUG = new Map<string, ReadonlySet<string>>();
for (const family of TWIN_FAMILIES) {
  const set = new Set(family);
  for (const slug of family) {
    TWINS_BY_SLUG.set(slug, set);
  }
}

/** Vrai si les deux polices dessinent le latin a l'identique. Faux pour une police
 *  comparee a elle meme : l'appelant filtre deja la bonne reponse separement. */
export const isIndistinguishableFrom = (slug: string, other: string): boolean =>
  slug !== other && (TWINS_BY_SLUG.get(slug)?.has(other) ?? false);

/** Les jumelles d'une police, elle exclue. Vide si elle n'en a pas. */
export const twinsOf = (slug: string): readonly string[] =>
  [...(TWINS_BY_SLUG.get(slug) ?? [])].filter((other) => other !== slug);
