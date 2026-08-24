# Charte DWIGGINS, les six manques

Feuille de route d'exécution, écrite le 2026-08-24 après comparaison sous-section
par sous-section avec le sommaire de Tercio. **Une étape à la fois.** Chaque
étape se termine par sa vérification, sa ligne dans
`docs/process/checklist.md`, et seulement ensuite on passe à la suivante.

Fichier Figma : `3kfcrtrbWHYs4Evsfi26mq`, une seule page, cadres de 1920 x 1080.
État de départ : 54 pages, sept sections, numérotation continue.

## Règles de fabrication, valables pour les six étapes

- **Relever la convention du chapitre avant de cloner une page.** Le chapitre
  logo est sur fond ivoire `#e1e1d7` à encre `#191510`. Les autres chapitres
  sont sur fond noir à encre ivoire. Se tromper rend le texte invisible.
- Jamais de gros titre centré au milieu d'une page.
- Jamais de ligne de méta sous un visuel : ni conditions de capture, ni noms de
  classes, ni facteur d'agrandissement. **Mais un calque nommé `fiche` peut
  contenir une spécification légitime : lire avant de supprimer.**
- Colonne d'explication : x 96, largeur 200, libellé Inter Medium 10 à 12 pour
  cent d'approche, corps Inter Regular 12 à 150 pour cent, premier bloc à y 254.
- Colonne de contenu : x 370, largeur 1180.
- Les chiffres en Geist Mono. Les règles en rapport quand c'est possible, avec
  l'exemple chiffré en dessous.
- Ne rien déclarer qui n'ait été relevé dans le code ou dans le navigateur.
- Pas d'emojis, pas de tiret séparateur.
- **La renumérotation passe en dernier**, une seule fois, après la dernière page
  ajoutée. Elle renumérote les cadres et les folios par ordre de lecture, puis
  reconstruit les sept intercalaires et la couverture depuis le document.

## Hors périmètre, décidé par Marion

La page du badge, les pages Do et Don't, le chapitre des éléments visuels, le
co-branding, et tout le marketing tant que le produit n'est pas en ligne.

---

## Étape 1. La signature de marque

**Pourquoi.** La marque a une signature, elle est dans le produit, et la charte
ne la mentionne nulle part. C'est le manque le plus gênant des six.

**La matière, relevée dans le code.** `features/landing/components/LandingExperience.tsx`
ligne 254 porte la forme longue, « Every typeface has one. Train your eye to
read it. », et ligne 446 la forme courte, « A game for reading type. Train your
eye to recognize typefaces. »

**Où.** Dans Le discours, **avant** les quatre adjectifs, comme Tercio qui place
Brand signature en page 12 et Brand speech en page 14. La rangée du discours est
en y 1440 : intercalaire en 18837, puis Calme, Direct, Précis, Pince-sans-rire.
Il faut donc **décaler les quatre adjectifs de 2080 vers la droite** et poser la
signature en 20917.

**Contenu.** La forme longue en grand, la forme courte en dessous, et les règles
d'emploi : où chacune s'écrit, ce qui ne se traduit pas, ce qui ne se raccourcit
pas. Ne pas inventer une troisième forme.

**Contrôle.** Les deux formes présentes au mot près, l'ordre de lecture correct,
et aucun cadre déplacé hors de sa rangée.

---

## Étape 2. Des exemples de messages

**Pourquoi.** Le chapitre du discours donne quatre adjectifs et vingt-quatre
conseils, mais ne montre pas un seul message écrit dans cette voix. Une règle
sans exemple ne s'applique pas. Tercio y consacre quatre pages, pages 25 à 28.

**La matière, à relever avant d'écrire.** `content/copy.ts` pour les phrases
vivantes, `docs/game/vision-produit-dwiggins.md` paragraphe 166 pour les
formulations de franchissement de palier, et les huit phrases mortes listées
dans `checklist.md` autour de la ligne 920, dont Marion doit dire si certaines
doivent revivre.

**Où.** Dans Le discours, après les quatre adjectifs.

**Contenu.** Une à deux pages. Chaque message montré tel qu'il s'affiche, et en
regard **lequel des quatre adjectifs il satisfait**. C'est ce croisement qui rend
le chapitre utilisable : on ne lit pas une règle, on voit une phrase et la règle
qui l'a produite.

**Contrôle.** Chaque message doit exister dans le produit. Aucun exemple inventé.

---

## Étape 3. Les règles éditoriales

**Pourquoi.** On a les adjectifs, pas la mécanique. Elevo y consacre deux pages,
18 et 19 : grammaire, structure, conjugaison, temps employés.

**La matière.** Les conventions déjà appliquées dans `content/copy.ts` et les
règles que Marion a posées lui même : pas d'emojis, pas de tiret séparateur,
virgules et deux-points à la place, pas de point d'exclamation.

**Où.** Dans Le discours, après les exemples de messages.

**Contenu.** Une page en bandes : la structure des phrases, la ponctuation, la
casse (quand les capitales, quand la casse de phrase), les nombres et leurs
unités, et ce qui ne s'écrit jamais.

**Contrôle.** Chaque règle doit être vérifiable sur un texte existant du produit.

---

## Étape 4. La direction stratégique

**Pourquoi.** L'introduction dit ce qu'on est et pourquoi c'est utile, jamais
**pourquoi maintenant**. Tercio ouvre son document là dessus, page 6, en trois
cartes : Observation, Conviction, Direction, chacune avec une annotation grise en
bas de carte qui dit le rôle de la carte.

**Où.** Dans l'Introduction, à la fin de la rangée y 1440.

**Contenu.** Trois cartes. Le constat, la conviction, la direction. Le modèle de
carte de Tercio : une pastille d'étiquette en haut, l'affirmation en 26 px, et
en bas de carte une annotation grise précédée d'un filet, qui explique ce que la
carte fait là.

**Contrôle.** Trois affirmations, aucune qui répète une page existante de
l'introduction.

---

## Étape 5. Le contraste sur les fiches de couleur

**Pourquoi.** Elevo imprime le rapport de contraste dans la fiche de chaque
couleur, page 47, à côté du hex, du RGB, du CMJN et du Pantone. Mettre
l'accessibilité dans la définition de la couleur plutôt qu'en annexe.

**Les valeurs, déjà calculées le 2026-08-23**, contre le noir de marque
`#141019` et contre l'ivoire `#e1e1d7`, à recalculer pour vérification :

| Couleur | contre `#141019` | contre `#e1e1d7` |
|---|---|---|
| jaune de marque `#ffd213` | 12,95 | 1,10 |
| ivoire de marque `#e1e1d7` | 14,27 | — |
| noir de marque `#141019` | — | 14,27 |
| vert de réponse `#00c853` | 8,40 | 1,70 |
| rouge de réponse `#ff0000` | 4,70 | 3,04 |
| mode training `#40d38f` | 9,78 | 1,46 |
| mode compétition `#ff934a` | 8,52 | 1,67 |
| mode expert `#58a9ff` | 7,63 | 1,87 |
| carte 1 `#8ea2ff` | 7,84 | 1,82 |
| carte 2 `#67d6b6` | 10,62 | 1,34 |
| carte 3 `#f5bf6a` | 11,22 | 1,27 |
| carte 4 `#f39ab1` | 9,01 | 1,58 |

**Où.** Pas de page nouvelle. On ajoute une ligne aux fiches existantes des pages
de couleur, section 04.

**Contenu.** Une ligne `CONTRASTE` par couleur, dans le même registre que les
lignes de valeur déjà présentes, avec la valeur et l'encre contre laquelle elle
est mesurée. Ne pas afficher un rapport sans dire contre quoi.

**Contrôle.** Chaque valeur recalculée avant d'être écrite. Aucune fiche laissée
sans sa ligne.

**Question ouverte à poser à Marion, pas à trancher seul.** Elevo et Tercio
portent aussi le CMJN et le Pantone. Si DWIGGINS ne s'imprime jamais, il faut
l'écrire, sinon l'absence se lira comme un oubli.

---

## Étape 6. Un exemple en usage par chapitre

**Pourquoi.** Deux chapitres sur trois chez Tercio se terminent par une page
« Example in use » qui montre toutes les règles du chapitre fonctionnant
ensemble, et le panneau y **déborde du bord droit de la page**, coupé net, pour
qu'il lise comme un morceau de réalité et non comme une illustration cadrée.
Chez nous, aucun chapitre ne se termine ainsi.

**Où.** Deux pages : une à la fin de La couleur, une à la fin de La typographie.

**Contenu.** Du vrai matériau du site, pris à sa taille, qui emploie toutes les
règles du chapitre à la fois. Pour la couleur : un écran où les couleurs de
mode, les couleurs de réponse et le couple ivoire et noir coexistent. Pour la
typographie : un écran où les quatre rôles typographiques sont visibles en même
temps.

**Contrôle.** Aucune valeur écrite sur ces pages : elles montrent, elles ne
cotent pas. Le panneau déborde à droite.

---

## Après la sixième étape

Renumérotation complète, reconstruction des sept intercalaires et de la
couverture, puis contrôle de cohérence sur toutes les pages : position et encre
du folio, présence du fil d'Ariane, position de la signature, gabarit de la
colonne de gauche, texte débordant du cadre.
