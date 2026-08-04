# Scoring & Selection — Math Spec (v3.1)

> # DOCUMENT DE RECHERCHE — AUCUNE AUTORITÉ SUR L'IMPLÉMENTATION
>
> **Décision du propriétaire, 2026-07-29.** Ce document **ne spécifie plus le produit**. Il change de nature : il devient un document de recherche et d'exploration, et il est **volontairement sorti de la hiérarchie documentaire** de DWIGGINS.
>
> **Pourquoi, et ce n'est pas une question de version.** Ce document ne décrit pas un ancien état du moteur, il décrit **une autre philosophie pédagogique**. Le moteur de DWIGGINS repose sur la maîtrise continue, la répétition espacée, une progression sans fin et la séparation stricte entre compétence et engagement. Ce document repose sur un autre paradigme : boîtes 0 à 5, intervalles en **jours**, sessions bornées (`R_session ∈ [8,12]`), examens de promotion, progression par niveaux d'XP. Les deux ne peuvent pas coexister comme sources de vérité sans produire des ambiguïtés permanentes, et à terme deux moteurs concurrents issus de deux documents.
>
> **Ce que ce document reste.** Une mémoire du raisonnement qui a conduit au moteur actuel, et une réserve d'idées : modèles mathématiques, pistes, hypothèses. Ce n'est pas une archive oubliée, c'est un espace de recherche encore utile.
>
> **Ce que ce document n'est plus.** Une référence dans laquelle on vient piocher une formule au gré des besoins. **Aucune règle issue d'ici ne peut être implémentée directement.** Le chemin de retour est explicite et obligatoire :
>
> 1. réévaluer l'idée au regard de `docs/game/vision-produit-dwiggins.md` ;
> 2. la reformuler si nécessaire ;
> 3. l'intégrer **explicitement** dans une spécification vivante (spec moteur, ou architecture backend) ;
> 4. alors seulement elle acquiert une valeur normative et peut être développée.
>
> **Avertissement au lecteur pressé.** Une formule bien écrite n'est pas une formule applicable. Si une section d'ici vous paraît directement implémentable, c'est précisément le piège que ce bandeau existe pour éviter.
>
> Hiérarchie de décision, dont ce document est exclu : **Vision Produit** (les principes) puis **Spec Moteur** (leur traduction en règles pédagogiques) puis **Architecture Backend** (leur implémentation technique) puis les contrats d'API, les specs d'interface et les documents d'exécution. Voir `docs/game/vision-produit-dwiggins.md` §13.
>
> Piège de numérotation à connaître : les invariants `I1` à `I14` **de ce document** n'ont aucun rapport avec les invariants `I-01` à `I-24` du projet. « I7 » ici désigne l'arène qui n'affecte pas les boîtes ; « I-07 » dans la spec moteur désigne l'entrée d'une nouvelle typographie au pool.

Status: draft
Last update: 2026-06-15
Counterpart (contexte): `docs/game/perceptual-progression-spec.md`
Engine source-of-truth: `docs/game/training-database-master-recap-v7.md`

Formules, tables, pseudocode. Constantes en §13. Conventions/invariants en §0/§15.

---

## 0bis. Corrections v3 (par rapport à v2)

| # | Faille v2 | Correctif v3 |
|---|---|---|
| 1 | combo mort à 80 % de réussite | **jauge de combo tolérante** (§5.5) — une erreur ne remet pas à zéro |
| 2 | blocage au cran 3 (maîtrise impossible) | **examen de promotion** sans pénalité (§2.4) |
| 3 | la chance (QCM) gonfle la maîtrise | montée **seulement si rapide** (confiant) + temps de réponse utilisé (§2.1) |
| 4 | deux pilotes de difficulté | **un seul contrôleur** (§8.3) — bande de confort, plus de nudge concurrent |
| 5 | fin de partie vide | **spine long terme** + mode Maître + collection 2000 (§17) |
| 6 | compétition ne donne pas d'XP | **filet d'XP plafonné** depuis l'arène (§6.2) |
| 7 | rien à dépenser | **monnaie « jetons » + sinks** (§16) |
| 8 | vise la réussite, pas l'apprentissage | sélection par **valeur d'apprentissage** (§8.4) |

**v3.1** (2ᵉ passage critique) : #H « rapide » rendu **relatif au joueur** (§2.1, accessibilité) · #I état **« à rafraîchir »** sans éteindre l'axe (§4.1) · bande de confort rendue effective (§8.4) · jetons rééquilibrés (§16) · ajout **Modes & sous-modes** (§1·B) et **MVP v0** (§18).

---

## 0. Conventions

```
σ(z) = 1/(1+e^(−z))     clamp(x,a,b)=min(b,max(a,x))     1[cond]∈{0,1}
norm(x sur S)=x/(max_S x + ε), ε=1e−9     now = timestamp UTC
```
Points ≥ 0. Boîtes ∈ {0..5}. Palier/axe allumé ne s'éteint jamais (§15).

---

## 1. Hiérarchie & notation

```
Axe A_i (i=1..8)   Palier P (~35, P∈A_i)   Sous-palier τ∈{1,2,3}
Sous-dim (axe 3) δ∈{aperture,contrast,axis,terminals,x_height,width}
Typo f   Joueur u   Défi q
```
| Symb | Déf | Domaine |
|---|---|---|
| `c` | correct | {0,1} |
| `t` | temps réponse (s) | ≥0 |
| `b(u,f)` | boîte Leitner | {0..5} |
| `ls(u,f)` | last_seen | timestamp |
| `d_P` | tier difficulté palier | {1,2,3} |
| `τ` | sous-palier | {1,2,3} |
| `db(f)` | difficulty_base | [0,1] |
| `a(P)` | précision récente palier | [0,1] |
| `ā` | précision glissante joueur | [0,1] |
| `meter` | jauge de combo | [0,100] |
| `D` | streak quotidien (j) | ≥0 |
| `coins` | porte-monnaie | ≥0 |

---

## 1·B. Modes & sous-modes

**Décompte : 3 modes · 10 sous-modes · 7 formats de question.**
(Mode = grand contexte ; sous-mode = façon de jouer, avec son déblocage et ses points ; format = type d'une question, §5.1, traversant les sous-modes.)

### Mode 1 — ENTRAÎNEMENT (« l'Œil ») — 5 sous-modes
| Sous-mode | Rôle | Déblocage | Points |
|---|---|---|---|
| **Découverte** | rencontrer de nouvelles typos | dès le départ (auto) | scoring standard §5 |
| **Révision** | revoir au bon moment (rappel espacé) | dès le départ (auto) | scoring standard §5 |
| **Examen** | l'épreuve qui fait passer un cran | auto quand une typo est prête (§2.4) | 0 sauf **+50** si réussi ; échec = 0, sans pénalité |
| **Chasse au sosie** | démêler les typos confondues | quand l'axe Confusion s'active | scoring standard §5 (τ=3 fréquent) |
| **Maître** | endgame : que du difficile + Expert | quand les 8 axes sont allumés | base **×1.5** (§17) |

### Mode 2 — COMPÉTITION (« l'Arène ») — 3 sous-modes
| Sous-mode | Rôle | Déblocage | Points |
|---|---|---|---|
| **Blitz** | 2 min chrono, score max | niveau joueur ≥ 5 | arène 1 / 2 pts (§7) + filet XP §6.2 |
| **Duel** | 1 vs 1 sur la même série | après Blitz (amis ou matchmaking ELO) | arène + filet XP §6.2 |
| **Ligue** | classement hebdo Bronze→Diamant | auto dès la 1ʳᵉ compétition | classement par `S_week` (§7) |

### Mode 3 — EXPERT — 2 sous-modes
| Sous-mode | Rôle | Déblocage | Points |
|---|---|---|---|
| **Nommer** | taper le nom d'une typo (sans options) | par typo, quand maîtrisée en reconnaissance (`expert_enabled`) | base **25** (+8 vitesse) |
| **Sans filet** | série Expert chronométrée | ≥ 20 typos en Expert | base 25 + bonus série |

### Comment on « passe » d'un mode à l'autre (synthèse)
```
Entraînement = toujours ouvert (cœur). Découverte/Révision mixés en session ;
   Examen/Chasse/Maître se débloquent par la progression de l'œil, pas par un menu.
Compétition  = se débloque par le niveau joueur (Blitz @L5), puis Duel, puis Ligue auto.
Expert       = se débloque typo par typo (maîtrise), pas globalement.
```
Invariant de couche : seuls Entraînement + Expert nourrissent les boîtes/axes ; Compétition ne nourrit que l'XP plafonnée (I7).

---

## 2. Maîtrise par typo

### 2.1 Confiance & transition (corrige #3)
```
confident(c,t) = (c=1) ∧ (t ≤ θ_conf · RT_med(u))   // RAPIDE = relatif au joueur (corrige #H)
   RT_med(u) = médiane glissante des temps de réponse de u (plancher RT_med_floor)
   si n_réponses(u) < 8 : confident = (c=1)          // bénéfice du doute au démarrage
τ_min(b) = [_, 1, 1, 2, 2, 3][b]               // assoupli (corrige #2)

Transition (défi normal) :
  confident ∧ τ ≥ τ_min(b) :  b ← min(5, b+1)
  c=1 ∧ ¬confident          :  b ← b            // juste mais lent → on tient (anti-devinette)
  c=1 ∧ τ < τ_min(b)        :  b ← b
  c=0                       :  b ← max(1, b−1)
```
Justification : un QCM deviné est souvent faux (≈75 %) ou anormalement lent POUR CE JOUEUR ⇒ pas de montée. Un joueur naturellement lent/prudent (ou en situation de handicap) n'est PAS pénalisé : le seuil est relatif à SA propre médiane (accessibilité).

### 2.2 Réapparition & décroissance
```
I = [0,1,3,7,21,60] j      due(u,f) ⇔ now ≥ ls + I[b]
oubli : now − ls > λ_decay·I[b] ⇒ b ← max(1, b−1)      // λ_decay = 2.0 ; batch nocturne + à la rencontre
```

### 2.3 Maîtrise
```
mastered(u,f) ⇔ b ≥ 4
```

### 2.4 Examen de promotion (corrige #2)
But : franchir b=3→4 et 4→5 sans rester coincé, et sans punir l'essai.
```
éligible_exam(f) ⇔ b∈{3,4} ∧ a(P) ≥ 0.85 ∧ due(f)
si éligible : servir un défi « stretch » à τ = τ_min(b+1), EN IGNORANT la bande de confort §8.3
  examen réussi (confident) : b ← b+1
  examen échoué            : b ← b            // AUCUNE pénalité (≠ défi normal)
fréquence : au plus 1 examen / 5 défis (anti-saturation)
```

---

## 3. Probabilité de succès (logistique) — contrainte, pas cible

```
z = ω0 + ω1·b + ω2·a(P) − ω3·(τ−1) − ω4·db(f)        Psucc = σ(z)
```
Sert de **contrainte** de confort (§8.3) et de mesure d'info (§8.4), plus de « cible » directe.
Fallback avant télémétrie (corrige le cold-start du modèle) :
```
Psucc_fb = clamp(0.35 + 0.13·b − 0.15·(τ−1) − 0.20·db, 0.05, 0.98)
```
On utilise `Psucc_fb` tant que < N_fit=2000 réponses loggées, puis le modèle ajusté (§11).

---

## 4. Progression

### 4.1 Allumage
```
R(P) = { f : prédicat(P) }      m(P)=|{f∈R(P): déjà répondu correct}| (typos DISTINCTES = généralisation, pas mémo)      a(P)=moy(c) sur W_acc=10
lit(P) ⇔ a(P) ≥ A_thr ∧ m(P) ≥ M_thr         // 0.80 ; 5
emerging(P) ⇔ ¬lit(P) ∧ exposed(P) ≥ M_thr
lit(A) ⇔ |{P∈A:lit(P)}| / |{P∈A:¬roadmap}| ≥ X_thr     // 0.70
needs_refresh(P) ⇔ lit(P) ∧ m_current(P)/m_peak(P) < refresh_thr   // 0.60 — AFFICHAGE seul, n'éteint jamais (corrige #I, I13)
```

### 4.2 Table palier → prédicat `R(P)`
*(résumé ; libellés produit des 35 paliers : `perceptual-progression-spec.md` §4·B)*
**Règle : un palier nomme un concept général, jamais une typo précise.**
`SS`=structural_signature. Axe 1 forme (proxy) · Axe 2 familles (`serifs`,`fixed_width`,`primary_category`,`sub_category`) · Axe 3 structure (1 palier = 1 champ `SS`: `e_aperture`,`contrast`,`axis`,`terminals`,`x_height`,`width`) · Axe 4 rythme (rendu paragraphe) · Axe 5 signatures (`a_type`,`distinctive_w`,marqueurs glyphe) · Axe 6 confusion (**par famille** de sosies ; paires = `confusion_pairs`, jamais une typo nommée) · Axes 7-8 `roadmap`.

---

## 5. Score d'une réponse

### 5.1 Base par type
| type | base | bonus_v |
|---|---|---|
| binaire | 6 | 3 |
| comparaison | 8 | 3 |
| identification | 10 | 5 |
| intrus | 12 | 4 |
| appariement | 12 | 4 |
| repère le détail | 15 | 5 |
| expert | 25 | 8 |

### 5.2 Coefficient difficulté (borné)
```
k = 1 + α(d_P−1) + γ(τ−1) + β·db(f)        k ∈ [1, 2.5]
```

### 5.3 Bonus vitesse (continu)
```
v = c · bonus_v · clamp((T−t)/T, 0, 1)      // T = 2 s
```

### 5.4 Rendements décroissants (anti-farm)
S'applique **uniquement** en révision libre d'une typo déjà maîtrisée (sinon la sélection §8.2 ne ressert pas une maîtrisée non due → ρ=1) :
```
ρ = 1                            si b < 4
  = max(ρ_min, r_decay^{r(u,f)}) si b ≥ 4      // 0.5 ; 0.1
```

### 5.5 Jauge de combo (corrige #1)
```
meter : init 0 / session
  c=1 : meter ← min(100, meter + κ_up)        // κ_up = 8
  c=0 : meter ← max(0,   meter − κ_dn)        // κ_dn = 20  (PAS de remise à zéro)
M_combo = 1 + meter/100        ∈ [1, 2]
```
À 80 % de réussite : dérive ≈ +2.4/réponse → la jauge se remplit en ~40 réponses et survit aux erreurs.

### 5.6 Streak quotidien
```
M_streak(D): [0,2]→1.00; [3,6]→1.10; [7,29]→1.20; [30,99]→1.35; ≥100→1.50
```

### 5.7 Bonus d'événement (à plat)
```
E = 50·1[b:3→4] + 100·1[palier s'allume] + 500·1[axe s'allume]
  + 30·1[session sans-faute] + 50·1[objectif du jour]
```

### 5.8 Formule finale
```
g      = base·k·ρ·c + v
points = g · M_streak · M_combo + E          // ≥ 0
```

---

## 6. XP & niveau

### 6.1 Entraînement / Expert
```
XP_total += points
cost(N→N+1)=S_lvl·N   cumXP(N)=50·N·(N−1)   L=max{N:cumXP(N)≤XP_total}
```
`cumXP: 2→100, 5→1000, 10→4500, 20→19000, 50→122500`.

### 6.2 Filet d'XP depuis la compétition (corrige #6)
```
fin de match compétition : XP_total += clamp(ξ·S_match, 0, X_match_cap)   // ξ=2, cap 200
plafond quotidien arène→XP : X_comp_day = 600
```
La compétition alimente l'XP/niveau **mais jamais** les boîtes/axes (invariant I7).

---

## 7. Arène

```
arena_pts = c·(1 + 1[t<2])      S_week += arena_pts      // reset hebdo
ELO : expected = 1/(1+10^((R_opp−R)/400)) ; R ← R + K(g)·(result−expected)
K(g): <20 parties→40 ; R<2000→24 ; R≥2000→16
division : file 30 ; top 7 montent / bottom 5 descendent / semaine
saison ELO : trimestrielle (soft reset vers la moyenne + blason de saison)
```

---

## 8. Sélection du défi

### 8.1 Poids d'un palier
```
due_pressure(P)=|{f∈R(P):due(f)}|
emergence(P)=1[emerging]·clamp(a/A_thr,0,1)·clamp(m/M_thr,0,1)
explore(P)=(|R(P)|−exposed(P))/|R(P)|
breadth(P)=1[axe(P) jamais touché aujourd'hui]              // anti-tunnel (corrige starvation)
gate(P)=1[prérequis ok]·1[¬roadmap]
w(P)=gate·(w_due·norm(due)+w_emerg·emergence+w_explore·explore+w_breadth·breadth)
P ~ softmax(w/θ)
```

### 8.2 Éligibilité typo
```
elig(f)= ¬just_missed(f) ∧ (now−ls ≥ W_repeat) ∧ active(f) ∧ (b<4 ∨ due(f))
```

### 8.3 Contrôleur de difficulté UNIQUE (corrige #4)
Une seule grandeur pilote : la **bande de confort** `[p_lo,p_hi]`, fonction de la précision glissante `ā` (W_adj=8) :
```
ā < 0.50 : [p_lo,p_hi]=[0.75,0.90]   (plus facile)
ā > 0.90 : [p_lo,p_hi]=[0.55,0.80]   (plus dur)
sinon    : [p_lo,p_hi]=[0.65,0.85]
```
Plus de second ajustement, plus de « force τ−1 ». La bande bouge, c'est tout.

### 8.4 Choix (f,τ) par valeur d'apprentissage (corrige #8)
```
info(f,τ)   = 1 − 2·|Psucc(f,τ) − center|         // center = (p_lo+p_hi)/2 → la bande pilote vraiment (corrige #D)
promo(f)    = 1[éligible_exam(f)]                 // §2.4
V(f,τ) = v_due·1[due(f)] + v_promo·promo(f) + v_info·info(f,τ) + v_new·1[b(f)=0]

(f*,τ*) = argmax_{f∈elig, τ≥τ_min(b(f))} V(f,τ)
          s.t.  Psucc(f,τ) ∈ [p_lo,p_hi]          // sauf examen §2.4 qui ignore la bande
```
La réussite n'est plus l'objectif : c'est une **contrainte de confort**. On maximise l'apprentissage dedans.

### 8.5 Distracteurs (n=3)
```
τ=1: primary_category ≠   |  τ=2: même cat, visual_cluster ≠  |  τ=3: même visual_cluster OU confusion_pairs
fallback si confusion data absente : τ=3 → repli sur visual_cluster (log "tau3_fallback")   // corrige dépendance contenu
```

### 8.6 Interleaving & cold start
```
pas le même P sur 2 défis consécutifs ; pas le même type sur 3 consécutifs
cold start (parties=0) : K_cal=10 défis, τ=1..2, 1 typo-témoin/axe live, pas de E, init b∈{1,2,3}
```

---

## 9. Boucle principale (pseudocode)

```
function nextChallenge(u):
    if calibrating(u): return calibrationChallenge(u)
    P = selectPalier(u)                                   # §8.1
    if (cand := promotionCandidate(u)) and budgetExam(u): # §2.4
        return examChallenge(u, cand)
    (f,τ) = argmaxLearningValue(u, P, band(ā))            # §8.3–8.4
    return Challenge(P, challengeType(P), f, τ, buildDistractors(f,τ))   # §8.5

function resolve(u,q,c,t):
    applyDecay(u,q.f)                                     # §2.2
    if q.isExam: updateBoxExam(u,q,c,t)                   # §2.4 (no penalty)
    else:        updateBox(u,q.f,c,t,q.τ)                 # §2.1
    pushAccuracy(q.P,c); pushAbar(u,c)                    # §4 / §8.3
    ev = evalLighting(u,q.P)                              # §5.7
    if q.mode == competition:
        S_week += arenaPts(c,t); updateElo(u)             # §7
        XP_total += clamp(ξ·matchScore(u),0,X_match_cap)  # §6.2 (en fin de match)
    else:
        XP_total += score(u,q,c,t,ev)                     # §5.8
    updateLevel(u); updateMeter(u,c); updateStreak(u)     # §6 / §5.5 / §5.6
    earnCoins(u,ev)                                       # §16
    log(eventRow(u,q,c,t))                                # §11
    ls(u,q.f) = now
```

---

## 10. Session & couverture
```
R_session∈[8,12]   mix={dues:0.50, émergents:0.35, découverte:0.15}
G_day=15 bonnes réponses   N_new∈[3,5]/session   rare exclu si L<L_rare(10)
intra-session : 2 premiers défis à τ=1 (échauffement)
```

---

## 11. Télémétrie (1 ligne/réponse)
```
{user_id,ts,mode,palier_id,axis_id,typeface_slug,challenge_type,tau,is_exam,
 box_before,box_after,correct,response_ms,confident,k,rho,v,m_streak,combo_meter,
 event_bonus,points,xp_after,level_after,coins_after,arena_pts,elo_after,psucc_pred}
→ user_event_fact ; régression psucc_pred vs correct ⇒ ré-estimation ω (N_fit=2000)
```

---

## 12. Exemples chiffrés (v3)
**Ex.1 — QCM dur, rapide, régulier.** base=10,bonus_v=5 ; k=2.05 (d_P=2,τ=3,db=0.6) ; c=1,t=1.0→v=2.5 ; confident (rapide pour CE joueur) ; b=2→ρ=1 ; D=12→×1.20 ; meter=40→×1.40.
`g=10·2.05+2.5=23.0` ; `points=23.0·1.20·1.40=38.6`.
**Ex.2 — Farm d'une maîtrisée.** k≈1, ρ=0.5³=0.125, v=1.25 → `g=10·0.125+1.25=2.5`. (Farm ≈ nul.)
**Ex.3 — Examen de promotion réussi.** comme Ex.1 + `b:3→4 (+50)` → `points=38.6+50=88.6`. Échoué → 0 point d'event, `b` inchangé.
**Ex.4 — Juste mais lent (devinette probable).** c=1 mais lent POUR CE JOUEUR (t > θ_conf·RT_med) → `b` inchangé ; v=0 (t>2 s) → `g=base·k` seulement, pas de progression de cran.

---

## 13. Constantes (tunables)
| Const | Valeur | | Const | Valeur |
|---|---|---|---|---|
| `T` | 2 s | | `θ_conf / RT_med_floor` | 1.3 / 1.5 s |
| `α/γ/β` | .25/.25/.50 → k∈[1,2.5] | | `τ_min(b)` | _,1,1,2,2,3 |
| `A_thr/M_thr/X_thr` | .80/5/.70 | | `λ_decay / refresh_thr` | 2.0 / .60 |
| `W_acc/W_adj` | 10/8 | | `I[]` | 0,1,3,7,21,60 j |
| `κ_up/κ_dn` | 8/20 (combo) | | `r_decay/ρ_min` | .5/.1 |
| `S_lvl` | 100 | | `M_streak` | 1.0–1.5 |
| `E` | 50/100/500/30/50 | | `ξ/X_match_cap/X_comp_day` | 2/200/600 |
| `K(g)` | 40/24/16 | | `N_div/P_up/P_down` | 30/7/5 |
| `w_due/emerg/explore/breadth` | .4/.3/.15/.15 | | `θ` | 0.5 |
| `v_due/v_promo/v_info/v_new` | .3/.4/.2/.1 | | bande conf. | [.65,.85] (±) |
| `W_repeat` | 10 q / 24 h | | `R_session/G_day/N_new` | 8–12/15/3–5 |
| `L_rare/K_cal/N_fit` | 10/10/2000 | | `ω0..ω4` | 0/.9/1.5/.8/1.2 *(à ajuster)* |

**Jetons (§16)** gains : objectif jour +15 · palier +10 · axe +50 · streak 7/30/100 → +25/+75/+200 (≈30–50/j).
**Jetons** coûts : streak_freeze 1 gratuit/sem. puis 60 (max 1 actif) · hint 20 (entraînement seul) · cosmétique 200–1000.

---

## 14. Dépendances data
`structural_signature.*` (R axes 1/3/5, τ) · `primary_category`/`sub_category`/`visual_cluster_id` (R axe 2, distracteurs) · `confusion_pairs` (R axe 6, τ=3) · `difficulty_base`/`dreyfus_tier` (k, Psucc) · `rarity_tag` (L_rare) · `activation_status` (éligibilité) · `expert_enabled`/`min_mode` (type=expert) · `usage`*(à ajouter)* (axe 7) · `b`,`ls` par user×typo.

---

## 15. Invariants formels
```
I1 points ≥ 0.                          I2 b ∈ {0..5}.
I3 lit(P), lit(A) monotones.            I4 typo ratée non re-servie avant W_repeat.
I5 b atteint 4/5 seulement via confident ∧ τ≥τ_min (anti-facile + anti-chance).
I6 XP_total, L monotones croissants.
I7 arène (S_week, ELO) n'affecte ni b ni axes ; n'alimente que l'XP plafonnée (§6.2).
I8 ρ∈[.1,1] ; M_combo∈[1,2] ; M_streak∈[1,1.5] ; k∈[1,2.5].
I9 palier roadmap exclu des dénominateurs d'allumage.
I10 examen échoué ne baisse jamais b (corrige le blocage).
I11 coins n'influencent ni b, ni XP, ni rang (monnaie de dépense pure).
I12 un seul contrôleur de difficulté : la bande de confort (pas de double pilotage).
I13 needs_refresh est un état d'AFFICHAGE : il n'éteint jamais lit(P)/lit(A).
I14 « confiant » = rapide RELATIVEMENT au joueur ⇒ aucun désavantage pour les joueurs lents/prudents.
```

---

## 16. Monnaie de dépense — « jetons » (corrige #7)
Rôle : **dépense**, PAS une jauge de progression (≠ XP/maîtrise/rang ⇒ pas de confusion d'empilement).
```
gains : objectif du jour +15 ; palier allumé +10 ; axe allumé +50 ; streak 7/30/100 j → +25/+75/+200
        → joueur régulier ≈ 30–50 jetons/jour (faucet ≈ sink visé)
sinks : streak_freeze (**1 gratuit/semaine**, puis 60 jetons l'unité ; max 1 actif — filet, pas béquille) ;
        hint (20, révèle le tell — ENTRAÎNEMENT seul, jamais en compétition) ;
        cosmétique de profil (200–1000, sink long terme)
```

---

## 17. Endgame / long terme (corrige #5)
Une fois les 8 axes allumés, la progression continue par :
```
1. Spine collection : +50 par 1ʳᵉ maîtrise, répété sur ~2000 typos (les axes n'en exigent qu'une fraction)
   → métrique visible mastered_total / |catalogue actif|.
2. Mode Maître : débloqué quand tous axes lit ; défis τ=3 + Expert uniquement ; base ×1.5.
3. Conversions Expert : +25 par typo passée de « reconnue » à « nommée » (Expert sans options).
4. Maintenance : la décroissance (§2.2) crée un flux de révisions dues → l'œil s'entretient.
5. Saisons d'arène (§7) : objectif compétitif récurrent indépendant de l'œil.
```

---

## 18. MVP v0 — périmètre minimal jouable (à tester AVANT le reste)

Constat : tout ci-dessus est non validé et plus riche que l'étape actuelle (~28 typos). On construit d'abord le strict minimum, on teste avec de vrais joueurs, puis on branche le reste.

```
Mode/sous-modes : ENTRAÎNEMENT seul — Découverte + Révision. QCM 4 choix.
Points          : base par type + bonus vitesse + objectif du jour + M_streak.   (PAS de combo, PAS de jetons)
Maîtrise        : boîtes Leitner 0–5, +1/−1, intervalles 1/3/7/21/60 j.           (PAS d'examen, PAS de RT-gating, PAS de décroissance)
Progression     : paliers + axes qui s'allument = LE cœur émotionnel (gardé).
Sélection       : dues d'abord + palier émergent + un peu de découverte ; difficulté = Psucc_fb.  (PAS de valeur d'apprentissage, PAS de bande dynamique)
Profil          : niveau/XP + carte des axes + streak.
Hors v0         : Compétition (Blitz/Duel/Ligue), Expert (Nommer/Sans filet), Examen/Chasse/Maître, jetons, modèle logistique ajusté.
```

**Ordre de branchement ensuite :**
```
Phase 2 (après tuning data v0) : combo, confiant-relatif (#H), Examen de promotion, décroissance + « à rafraîchir », jetons, valeur d'apprentissage, bande dynamique, Chasse au sosie.
Phase 3 : Compétition (ELO, Ligue, divisions), filet XP, saisons, Duel/Blitz.
Phase 4 : Expert (Nommer/Sans filet), axes 7-8 (roadmap), mode Maître.
```
Règle : on ne règle finement (κ, ω, bandes…) qu'avec la télémétrie v0, jamais à l'avance.
