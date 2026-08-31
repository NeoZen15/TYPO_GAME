# Les polices jumelles, famille par famille

Relevé du 2026-08-31, sur `lib/game/twin-guard.ts` regénéré le matin même avec les 108
polices Adobe incluses dans la mesure.

**Deux polices sont jumelles quand les neuf grandeurs mesurées dans leurs fichiers diffèrent
de moins d'un pour cent, chacune, et qu'une famille n'existe que si chaque membre est jumeau
de chaque autre.** Ce n'est pas une ressemblance d'impression, c'est une mesure.

**351 polices** dans **61 familles**. Je propose d'en
**éteindre 284** et d'en garder **57** comme canoniques. **4 familles restent intactes**, ce sont de vraies polices différentes.

**Ce que « éteindre » veut dire.** `activation_status = false`. La ligne reste au catalogue,
avec son fichier et ses métadonnées, elle cesse simplement d'être jouable. Rien n'est détruit
et le retour arrière est une ligne de SQL.

**Pourquoi éteindre et pas reculer.** Reculer une police en `uncommon` reporte la question,
elle ne la répare pas. Aucun niveau d'expertise ne rend « Noto Sans Old Permic » répondable :
l'information n'est pas à l'écran. Le joueur expert la ratera exactement comme le débutant.

**Comment t'en servir.** Barre les lignes qui te gênent. Rien ne part en base avant que tu
aies parcouru. Ensuite j'écris la migration 020 avec son contrôle de comptes et son retour
arrière, testée sur branche jetable comme la 019.

---

## Les huit paires Adobe, les plus nettes

Sorties de la mesure de ce matin. Chacune est **le même caractère sous deux noms Adobe**.

- garder **Franklin Gothic Compressed**, éteindre Franklin Gothic URW Compressed
- garder **Franklin Gothic Condensed**, éteindre Franklin Gothic URW Condensed
- garder **Franklin Gothic Std**, éteindre Franklin Gothic URW
- garder **Futura 100**, éteindre Futura 100 Latin Ext
- garder **Futura 100 Book**, éteindre Futura 100 Latin Ext Book
- garder **Georgia**, éteindre GeorgiaPro
- garder **Helvetica Neue LT Pro**, éteindre Helvetica Neue World
- garder **Verdana**, éteindre Verdana Pro

## Les grosses suites d'écriture

Une police latine, déclinée avec une écriture supplémentaire. Le latin est identique.

- garder **Noto Sans**, éteindre **153** polices  
  154 polices : Noto Sans plus une écriture supplémentaire. Le latin est celui de Noto Sans,
  identique dans les 154.
- garder **Noto Serif**, éteindre **18** polices  
  19 éditions d'écriture de Noto Serif au même latin.
- **À TOI DE TRANCHER.** Une famille de 19 Noto Serif exotiques, Ahom, Dogra, Tangut, Yezidi, plus
  Koh Santepheap et les deux Noto arabes. Aucune n'est le Noto Serif ordinaire, et leur latin
  mesure différemment du sien, donc je ne peux pas dire « garde Noto Serif ». Mais demander à un
  joueur de nommer « Noto Serif Khitan Small Script » n'a pas de sens non plus. **Je propose de les
  éteindre toutes les 19**, plutôt que d'en couronner une au hasard. Dis-moi si tu préfères en
  garder une.
- garder **Anek Latin**, éteindre **9** polices  
  Anek Latin est la version latine, les neuf autres sont des écritures indiennes.
- garder **Castoro**, éteindre **8** polices  
  Castoro est une police nommée, les huit Tiro sont des éditions d'écriture.
- garder **Hind**, éteindre **8** polices  
  un membre est le préfixe des autres, donc le même dessin sous un nom allongé.
- garder **IBM Plex Sans**, éteindre **7** polices  
  IBM Plex Sans, les autres sont ses éditions d'écriture.
- garder **Mukta**, éteindre **4** polices  
  Mukta et ses quatre variantes régionales indiennes.
- garder **Noto Sans JP**, éteindre **4** polices  
  quatre éditions CJK d'un même latin.
- garder **Noto Serif JP**, éteindre **4** polices  
  quatre éditions CJK d'un même latin.

## Les paires et triplets

- garder **Kaisei Decol**, éteindre Kaisei HarunoUmi, Kaisei Opti, Kaisei Tokumin  
  quatre Kaisei partageant un latin identique. Choix arbitraire, assumé : dis-moi si tu en préfères une autre.
- garder **WDXL Lubrifont JP N**, éteindre WDXL Lubrifont SC, WDXL Lubrifont TC, ZCOOL QingKe HuangYou  
  trois WDXL plus une ZCOOL au même latin.
- garder **Afacad**, éteindre Afacad Flux  
  un membre est le préfixe des autres, donc le même dessin sous un nom allongé.
- garder **Akatab**, éteindre Tirra  
  deux polices tifinagh au même latin.
- garder **Alumni Sans**, éteindre Alumni Sans SC  
  un membre est le préfixe des autres, donc le même dessin sous un nom allongé.
- garder **Amiri**, éteindre Amiri Quran  
  un membre est le préfixe des autres, donc le même dessin sous un nom allongé.
- garder **Arimo**, éteindre tharlon  
  Tharlon est birmane, son latin est celui d'Arimo.
- garder **Arsenal**, éteindre Arsenal SC  
  un membre est le préfixe des autres, donc le même dessin sous un nom allongé.
- garder **Atkinson Hyperlegible**, éteindre Atkinson Hyperlegible Next  
  un membre est le préfixe des autres, donc le même dessin sous un nom allongé.
- garder **Baskervville**, éteindre Baskervville SC  
  un membre est le préfixe des autres, donc le même dessin sous un nom allongé.
- garder **Bodoni Moda**, éteindre Bodoni Moda SC  
  un membre est le préfixe des autres, donc le même dessin sous un nom allongé.
- garder **Bona Nova**, éteindre Bona Nova SC  
  un membre est le préfixe des autres, donc le même dessin sous un nom allongé.
- garder **Cascadia Code**, éteindre Cascadia Mono  
  Cascadia Mono est Cascadia Code sans les ligatures.
- garder **Charis SIL**, éteindre Abyssinica SIL  
  le latin d'Abyssinica SIL est celui de Charis SIL.
- garder **Cormorant**, éteindre Cormorant Garamond  
  un membre est le préfixe des autres, donc le même dessin sous un nom allongé.
- garder **Fragment Mono**, éteindre Fragment Mono SC  
  un membre est le préfixe des autres, donc le même dessin sous un nom allongé.
- garder **Franklin Gothic Compressed**, éteindre Franklin Gothic URW Compressed  
  même chose, en comprimé.
- garder **Franklin Gothic Condensed**, éteindre Franklin Gothic URW Condensed  
  même chose, en condensé.
- garder **Franklin Gothic Std**, éteindre Franklin Gothic URW  
  Franklin Gothic Std et Franklin Gothic URW : deux éditions Adobe du même caractère.
- garder **Futura 100**, éteindre Futura 100 Latin Ext  
  un membre est le préfixe des autres, donc le même dessin sous un nom allongé.
- garder **Futura 100 Book**, éteindre Futura 100 Latin Ext Book  
  Futura 100 Book et sa version Latin Ext : même dessin, jeu de caractères plus large.
- garder **Georgia**, éteindre GeorgiaPro  
  un membre est le préfixe des autres, donc le même dessin sous un nom allongé.
- garder **Helvetica Neue LT Pro**, éteindre Helvetica Neue World  
  Helvetica Neue LT Pro et Helvetica Neue World : deux éditions du même caractère.
- garder **Huninn**, éteindre Bpmf Huninn  
  BPMF Huninn est Huninn avec du bopomofo en plus.
- garder **IBM Plex Mono**, éteindre Lilex  
  Lilex dérive d'IBM Plex Mono.
- garder **Iosevka Charon**, éteindre Iosevka Charon Mono  
  un membre est le préfixe des autres, donc le même dessin sous un nom allongé.
- garder **M PLUS 1**, éteindre M PLUS 2  
  M PLUS 1 et M PLUS 2 partagent leur latin.
- garder **M PLUS 1 Code**, éteindre M PLUS Code Latin  
  deux noms pour le même latin M PLUS Code.
- garder **M PLUS Rounded 1c**, éteindre roundedmplus1c  
  M PLUS Rounded 1c et Rounded M+ 1c sont la même police.
- garder **Markazi Text**, éteindre markazitextvfbeta  
  un membre est le préfixe des autres, donc le même dessin sous un nom allongé.
- garder **Maven Pro**, éteindre mavenprovfbeta  
  un membre est le préfixe des autres, donc le même dessin sous un nom allongé.
- garder **Mochiy Pop One**, éteindre Mochiy Pop P One  
  Mochiy Pop One et Mochiy Pop P One partagent leur latin.
- garder **Noto Sans Symbols**, éteindre Noto Traditional Nushu  
  deux Noto au même latin.
- garder **Podkova**, éteindre podkovavfbeta  
  un membre est le préfixe des autres, donc le même dessin sous un nom allongé.
- garder **Reem Kufi**, éteindre Reem Kufi Fun  
  un membre est le préfixe des autres, donc le même dessin sous un nom allongé.
- garder **Roboto**, éteindre Vazirmatn  
  Vazirmatn est persane, son latin est celui de Roboto.
- garder **Roboto Slab**, éteindre Hanuman  
  Hanuman est khmère, son latin est celui de Roboto Slab.
- garder **Sedan**, éteindre Sedan SC  
  un membre est le préfixe des autres, donc le même dessin sous un nom allongé.
- garder **Shippori Mincho**, éteindre Shippori Mincho B1  
  un membre est le préfixe des autres, donc le même dessin sous un nom allongé.
- garder **Source Sans 3**, éteindre Mada  
  Mada est arabe, son latin vient de Source Sans.
- garder **Spectral**, éteindre Spectral SC  
  un membre est le préfixe des autres, donc le même dessin sous un nom allongé.
- garder **Stack Sans Headline**, éteindre Stack Sans Notch  
  deux coupes d'une même Stack Sans.
- garder **Verdana**, éteindre Verdana Pro  
  un membre est le préfixe des autres, donc le même dessin sous un nom allongé.
- garder **Yrsa**, éteindre Rasa  
  Rasa est gujarati, Yrsa est sa jumelle latine, mêmes dessinateurs.
- garder **Ysabeau**, éteindre Ysabeau Office  
  un membre est le préfixe des autres, donc le même dessin sous un nom allongé.
- garder **Zen Antique**, éteindre Zen Antique Soft  
  un membre est le préfixe des autres, donc le même dessin sous un nom allongé.
- garder **Zen Kaku Gothic New**, éteindre Zen Kaku Gothic Antique  
  deux Zen Kaku Gothic au même latin.

## Les familles que je ne touche pas

De vraies polices différentes, par des dessinateurs différents, qui mesurent pareil par
hasard. En éteindre une serait une perte sèche et le choix serait arbitraire. **L'exclusion
dans une même manche, déjà en place, est exactement le bon outil pour celles-là.**

- El Messiri, Philosopher, ZCOOL XiaoWei  
  El Messiri, Philosopher et ZCOOL XiaoWei sont trois polices différentes.
- Lexend, Lexend Deca, Readex Pro  
  Lexend et Lexend Deca sont sœurs, Readex Pro est une autre famille. Je n'éteins rien ici.
- 42dot Sans, Asta Sans  
  42dot Sans et Asta Sans sont deux polices différentes.
- Alyamama, Ancizar Serif  
  Al Yamama et Ancizar Serif sont deux polices différentes.

---

## Ce que ça change au catalogue

Le catalogue annonce 1279 polices jouables. Après ce nettoyage il en annoncerait **environ
995**. Si ce chiffre compte pour toi, dis-le, ça change la réponse.

Aucune des 23 polices Adobe du premier pool n'est concernée : vérifié, zéro collision de
jumelles dedans, et la seule qui appartient à une famille jumelle est Georgia, dont la jumelle
Georgia Pro n'est pas servie au débutant.
