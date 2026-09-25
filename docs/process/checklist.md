# DWIGGINS — Journal de bord

**Ouvert le 2026-09-18.** L'ancien journal, 154 000 mots couvrant du 2026-03-19 au 2026-09-18, est
archivé dans [`docs/archive/checklist-2026-03-19-a-2026-09-18.md`](../archive/checklist-2026-03-19-a-2026-09-18.md).
Rien n'en a été supprimé.

## Ce qui s'écrit ici, et ce qui ne s'y écrit pas

Ce fichier est la **mémoire longue du quand** : ce qui a été fait, tel jour, et ce qui a été vérifié.
On y ajoute à la fin, c'est son métier.

**Deux choses n'y vont pas, et c'est ce qui l'a fait gonfler à sept mille lignes :**

**Où on en est** se met à jour dans la section du même nom en tête de `CLAUDE.md`, qui se charge
seule à chaque session. On la **réécrit**, on ne l'allonge jamais, et `npm run check:etat` la plafonne
à 700 mots. Trois fichiers d'état sont morts avant elle dans ce projet, deux périmés et un obèse.

**Pourquoi c'est comme ça** va dans les sept fiches `arbitrages`, listées dans
[`docs/README.md`](../README.md) : une décision et sa raison, une piste refusée et pourquoi, un piège
à ne pas redécouvrir. Chacune est plafonnée à 1500 mots. Si une fiche déborde, on la resserre ou on
la scinde sur une frontière de domaine, on ne relève pas le plafond.

## Comment lire

- `- [x]` = considéré comme fait · `- [ ]` = reste à faire.
- Le **statut** entre `backticks` = lecture honnête de l'état du code, pas forcément « coché ».
- Statuts : `Fait` · `En cours` · `À faire` · `Bloqueur` · `À décider` / `Plus tard`.

---

## Note — 2026-09-18 — le journal repart à zéro

L'ancien journal atteignait 154 024 mots et 238 sections, et la `CLAUDE.md` le désignait comme la
source de vérité de l'avancement : répondre à « on en est où » coûtait donc d'ouvrir 200 000 jetons.

**Les 238 sections ont toutes été triées**, registre dans `scripts/distillation/registre.json`,
vérifiable par `python3 scripts/distillation/registre.py --verifier`. **125 rangées**, dont le
pourquoi durable vit maintenant dans les sept fiches `arbitrages` (149 824 mots d'origine devenus
8 482, un rapport de dix-huit contre un). **113 écartées**, chacune avec un motif écrit qui dit
pourquoi et où son contenu vit : 29 578 mots de charte Figma qui appartiennent au fichier Figma,
31 282 mots pointés vers le document qui fait autorité sur leur sujet, et 13 202 mots de comptes
rendus et d'audits datés qui ne se relisent pas.

Trois règles de travail sont montées dans `CLAUDE.md` au passage, dont celle que trois incidents
distincts réclamaient : committer souvent, parce qu'une session qui meurt ne prévient personne.

---

## 2026-09-18 — Audit de securite, auto-pentest, et durcissement du bonus

Journee de securite avant mise en ligne. Le detail complet est dans l'archive
(quatre notes datees du 2026-09-18), voici l'essentiel pour la memoire longue.

**Audit initial, cinq trous fermes et verifies :** Next 16.1.6 vers 16.3.5 (30 avis
dont deux critiques, `npm audit` 14 vers 0) ; l'administration ne s'ouvre plus sans
compte en production (`lib/admin/gate.ts`, regle ecrite une seule fois) ; en-tetes
de securite et CSP (`next.config.ts`) ; limite de debit et controle d'origine
(`proxy.ts`, `lib/server/rate-limit.ts`, `lib/server/request-origin.ts`) ; identifiant
Neon retire d'une sauvegarde. Mot de passe Postgres change sur les quatre branches
apres qu'une erreur de pilote l'a affiche. Garde `check:security-gates`, eprouve sur mutation.

**Auto-pentest, une faille HAUTE trouvee et bouchee :** la porte de l'administration
gardait l'ecran mais pas la charge React de la page, que Next serialise en parallele ;
le HTML de la page de refus transportait les donnees du tableau de bord, et aurait
transporte noms et adresses en production. Corrige au niveau des donnees
(`lib/admin/guarded-sql.ts`), garde `check:admin-data-gate`. Nuclei (7987 modeles) :
aucune vraie faille. Second passage : en-tete `X-Powered-By` retire. Passe profonde :
aucun IDOR exploitable entre joueurs (verifie dans le code), cookie invite bien protege.

**Durcissement du bonus de vitesse en competition, sur decision du proprietaire :** le
score ne se decide plus sur le temps declare par le navigateur mais sur l'horloge du
serveur. Calcul extrait dans `lib/game/competition/scoring.ts`, garde
`check:competition-timing`, eprouve sur mutation. Effet de bord signale : un peu plus
de +2 qu'avant, ajustable par `COMPETITION_OVERHEAD_TOLERANCE_MS`.

**Methode :** tout mesure sur une copie jetable Neon, jamais sur la production, verifiee
intacte a 271 utilisateurs et 595 seances a chaque fois. Copies supprimees.

**Reste au proprietaire :** poser `DATABASE_URL`, `GAME_PROVIDER_SECRET` et les cles Clerk
chez Vercel ; sans Clerk, pas d'administration, c'est voulu.

## 2026-09-24, page des modes : proposition sur /dev/modes

**En cours, attend l'oeil de Marion.** Elle trouve `/play` vieille et sans envie de jouer. Proposition
posee sur `/dev/modes` (route dev, fermee en production), `/play` n'est pas touchee. Chaque carte montre
son mode au lieu de le decrire : une scene joue le mot comme le mode (Training change de face lentement,
Competition vite avec une barre qui se vide, Expert tient le mot sans le nommer), et le chiffre vivant
passe en grand. Arbitrages gardes : carte noire, couleur du mode sur pastille et contour seulement,
bouton creme. Fichiers : `features/modes/components/ModeSelectPreview.tsx`, `app/dev/modes/page.tsx`,
styles `pm2-` en fin de `app/globals.css`. Si GO : remplacer le corps de `ModeSelectPage`.

**Meme jour, fait :** l'onboarding ne se joue qu'une fois (cookie `jdt-onboarded`, `?replay=1` pour le
revoir) ; le menu mene aux pages (Compare vers `/compare`, How it works vers les regles, Profile ajoute) ;
le profil d'un nouveau joueur est la vraie page a zero au lieu de la maquette.
