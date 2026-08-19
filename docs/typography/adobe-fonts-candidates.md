# Polices Adobe Fonts candidates au catalogue

Relevé le 2026-08-19, police par police, sur les pages publiques de
`fonts.adobe.com`. Méthode : requête sur `fonts.adobe.com/fonts/<slug>`, avec
contrôle des codes HTTP pour écarter les redirections 302 vers la page de
recherche, qu'un simple résumé de page aurait prises pour des succès. Contrôle
négatif : un slug inventé renvoie bien un 404.

**60 noms cherchés, 60 présents.** Aucun n'exige un achat séparé, tous sont dans
la bibliothèque incluse à l'abonnement Creative Cloud.

## Le nom diffère souvent, c'est le slug qui compte

| Ce qu'on cherche | Le vrai nom chez Adobe | slug | fonderie |
|---|---|---|---|
| Futura | Futura PT | `futura-pt` | Paratype |
| Didot | Linotype Didot | `linotype-didot` | Monotype |
| Univers | Univers Next | `univers-next` | Monotype |
| Frutiger | Neue Frutiger World | `neue-frutiger-world` | Monotype |
| Franklin Gothic | ITC Franklin Gothic | `itc-franklin-gothic` | Monotype |
| Avant Garde | ITC Avant Garde Gothic | `itc-avant-garde-gothic` | Monotype |
| Akzidenz-Grotesk | Akzidenz-Grotesk Next | `akzidenz-grotesk-next` | Monotype |
| Trade Gothic | Trade Gothic Next | `trade-gothic-next` | Monotype |
| Bembo | Bembo MT Pro | `bembo-mt` | Monotype |
| Clarendon | Clarendon URW | `clarendon-urw` | URW |
| Comic Sans | Comic Sans MS | `comic-sans-ms` | Microsoft |
| Sofia Pro | Sofia | `sofia` | Mostardesign |
| Gill Sans | Gill Sans Nova | `gill-sans-nova` | Monotype |

## Priorité 1, le grand public peut les nommer

Helvetica `helvetica` Monotype · Futura PT `futura-pt` Paratype · Times New Roman
`times-new-roman` Microsoft · Gill Sans Nova `gill-sans-nova` Monotype · Adobe
Garamond `adobe-garamond` Adobe · Garamond Premier `garamond-premier` Adobe ·
Bodoni `bodoni` Monotype · Linotype Didot `linotype-didot` Monotype ·
Baskerville `baskerville` Monotype · Optima `optima` Monotype · Rockwell
`rockwell` Monotype · ITC Franklin Gothic `itc-franklin-gothic` Monotype ·
Univers Next `univers-next` Monotype · Neue Frutiger World `neue-frutiger-world`
Monotype · ITC Avant Garde Gothic `itc-avant-garde-gothic` Monotype · Impact
`impact` Monotype · Comic Sans MS `comic-sans-ms` Microsoft · Papyrus `papyrus`
Monotype · Brush Script `brush-script` Adobe · Copperplate `copperplate` URW ·
Courier `courier` Adobe · Eurostile `eurostile` URW · Cooper Black `cooper-black`
Adobe · Trajan `trajan` Adobe · Clarendon URW `clarendon-urw` URW · Adobe Caslon
`adobe-caslon` Adobe · Arial `arial` Microsoft · Verdana `verdana` Microsoft ·
Georgia `georgia` Microsoft · Tahoma `tahoma` Microsoft

## Priorité 2, très reconnaissables

Proxima Nova `proxima-nova` Mark Simonson · Avenir `avenir` Monotype · DIN 2014
`din-2014` Paratype · Akzidenz-Grotesk Next `akzidenz-grotesk-next` Monotype ·
Neue Haas Grotesk `neue-haas-grotesk` Monotype · Museo `museo` exljbris · Museo
Sans `museo-sans` exljbris · Brandon Grotesque `brandon-grotesque` HVD · Sofia
`sofia` Mostardesign · Freight `freight` The Freight Collection · Interstate
`interstate` Frere-Jones · Trade Gothic Next `trade-gothic-next` Monotype ·
Sabon `sabon` Monotype · Bembo MT Pro `bembo-mt` Monotype

## Priorité 3, classiques Adobe, connus des graphistes

Minion `minion-3` · Myriad `myriad` · Warnock `warnock` · Chaparral `chaparral` ·
Acumin `acumin` · Bickham Script `bickham-script` · Lithos `lithos` · Poplar
`poplar` · Rosewood `rosewood` · Tekton `tekton` · Birch `birch` · Blackoak
`blackoak` · Utopia `utopia` · Adobe Text `adobe-text`. Toutes Adobe Originals.

## Déjà au catalogue, à ne pas ajouter

Source Sans 3, servie et libre. C'est le seul vrai recoupement sur les 60.
Attention, `Sofia Sans` que nous avons déjà est une police libre différente de
`Sofia` de Mostardesign.

## La réserve à lever, et elle est réelle

Ces 60 familles sont **dans la bibliothèque**. Cela ne prouve pas que les 60
soient disponibles en **webfont**. Certaines familles d'Adobe Fonts sont
utilisables sur le bureau seulement. Les blocs « Desktop » et « Web » des pages
publiques sont du gabarit générique, identique d'une fiche à l'autre, et l'un des
relevés a même montré une variable non interpolée
(`{{familyCtrl.selectedVariation.preferred_family_name}}`). Ils ne permettent donc
de rien conclure par famille.

Seul test fiable : ajouter la famille à un projet web depuis le compte. Celles
qui ne proposent pas le web ne s'y ajouteront pas.

## Pour plus tard, si on veut sortir de l'abonnement

L'abonnement Creative Cloud ne couvre **jamais** l'auto-hébergement. Il faut une
licence webfont achetée à la fonderie. La bonne nouvelle est la concentration :
**Monotype détient la grande majorité de la priorité 1**, donc un seul
interlocuteur pour l'essentiel. Les autres sont Microsoft (Arial, Verdana,
Georgia, Tahoma, Times New Roman, Comic Sans), Adobe, URW, Paratype, et quelques
fonderies indépendantes pour la priorité 2.
