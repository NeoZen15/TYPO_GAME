-- ============================================================
-- MIGRATION 022 -- les trois axes de session
-- Requiert : 003 (sessions) et 021 (assignments) appliquees
-- Specifie par : docs/game/architecture-backend.md sections 2 et 2.2
-- ============================================================
--
-- APPLIQUEE EN PRODUCTION le 2026-09-10, sur feu vert explicite du proprietaire.
-- Branche `production` (br-crimson-union-abwblcwc) du projet Neon TYP-WE_SITE.
-- Point de restauration pris avant : instantane `avant-021-022-monde-scolaire-2026-09-10`.
-- Verifie apres coup : 8 tables scolaires, 3 axes sur sessions et 3 sur le journal,
-- les trois contraintes en place, 595 sessions et 1716 faits retrogarnis sans un
-- seul NULL, et la forme d'insertion du fournisseur d'entrainement toujours
-- acceptee grace aux defauts. Le rollback est dans le fichier voisin.
--
--
-- CE QU'ELLE DEBLOQUE, ET C'EST LE MUR QUE TOUT L'ESPACE PROF CONTOURNAIT.
-- Sans ces trois colonnes, une reponse ne dit pas POURQUOI elle existe. Un
-- professeur ne peut donc pas lire « ce que mes exercices ont produit » sans lire
-- l'entrainement libre de l'eleve, ce que la vision interdit (I-15, I-16). Tout
-- l'espace professeur tourne aujourd'hui sur un mock a cause de cette absence.
--
-- TROIS QUESTIONS DISTINCTES, TROIS COLONNES, ET PAS UNE DE PLUS.
--   context            : a qui appartiennent les donnees, qui peut les lire
--   progression_policy : quel effet pedagogique la session produit
--   assignment_id      : de quel contrat elle depend
--
-- LES QUATRE CONTEXTES MOTEUR N'AJOUTENT AUCUN AXE. Ils sont des combinaisons de
-- `mode`, `context` et `progression_policy` (matrice en architecture 2.2) :
--   entrainement personnel  training     + personal           + update_mastery
--   exercice assigne        training     + teacher_assignment + update_mastery
--   controle assigne        training     + teacher_assignment + observe_only
--   competition assignee    competition  + teacher_assignment + observe_only
--   competition personnelle competition  + personal           + observe_only
--
-- LES DEUX DEFAUTS SONT UN ECHAFAUDAGE DE TRANSITION, ET ILS DOIVENT TOMBER.
-- L'architecture exige que la politique soit explicite et jamais deduite, donc
-- jamais implicite. Mais le code en production insere des sessions sans nommer
-- ces colonnes : sans defaut, cette migration casserait l'entrainement a la
-- seconde ou elle est appliquee. Les defauts existent donc pour que la base
-- puisse partir AVANT le code, et la migration qui branche le chemin assigne doit
-- les retirer dans le meme commit que le fournisseur qui les renseigne :
--   ALTER TABLE sessions ALTER COLUMN context DROP DEFAULT;
--   ALTER TABLE sessions ALTER COLUMN progression_policy DROP DEFAULT;
-- Tant que ces deux lignes ne sont pas passees, une session peut naitre avec une
-- politique que personne n'a choisie, et c'est exactement ce que l'invariant
-- I-22 refuse.
-- ============================================================

-- ============================================================
-- 1. ENUMS
-- ============================================================

CREATE TYPE app.session_context_enum AS ENUM (
  'personal',
  'teacher_assignment'
);

CREATE TYPE app.progression_policy_enum AS ENUM (
  'update_mastery',
  'observe_only'
);

-- ============================================================
-- 2. sessions
-- ============================================================

ALTER TABLE sessions
  ADD COLUMN context            app.session_context_enum     NOT NULL DEFAULT 'personal',
  ADD COLUMN progression_policy app.progression_policy_enum,
  ADD COLUMN assignment_id      uuid                         REFERENCES assignments (assignment_id) ON DELETE RESTRICT;

-- Les sessions deja jouees sont toutes personnelles, et leur effet est celui que
-- le code a reellement produit : l'entrainement a ecrit le mastery, la
-- competition et l'expert ne l'ont jamais ecrit (mesure le 2026-09-10, seul le
-- fournisseur d'entrainement ecrit user_typeface_state).
UPDATE sessions
   SET progression_policy = CASE
         WHEN mode = 'training' THEN 'update_mastery'::app.progression_policy_enum
         ELSE 'observe_only'::app.progression_policy_enum
       END
 WHERE progression_policy IS NULL;

ALTER TABLE sessions
  ALTER COLUMN progression_policy SET NOT NULL,
  ALTER COLUMN progression_policy SET DEFAULT 'update_mastery';

-- Une session assignee sans contrat est impossible, et un contrat sur une session
-- personnelle aussi. Les deux sens, sur la ligne.
ALTER TABLE sessions
  ADD CONSTRAINT chk_session_assignment_requires_context
    CHECK ((context = 'teacher_assignment') = (assignment_id IS NOT NULL));

-- I-22 rendu INVIOLABLE au niveau de la ligne : aucune competition ne peut
-- exister avec une politique qui ecrirait la maitrise, en personnel comme en
-- assigne. Un bug applicatif ne suffit plus.
ALTER TABLE sessions
  ADD CONSTRAINT chk_session_competition_never_writes_mastery
    CHECK (mode <> 'competition' OR progression_policy = 'observe_only');

-- Une seule session par eleve et par assignation : c'est ce qui rend la reprise
-- naturelle (spec section 18). L'eleve retrouve sa session ouverte et continue la
-- ou il s'etait arrete, au lieu d'en ouvrir une deuxieme et de repartir de zero.
CREATE UNIQUE INDEX uq_sessions_one_per_assignment
  ON sessions (assignment_id, user_id)
  WHERE assignment_id IS NOT NULL;

CREATE INDEX idx_sessions_assignment
  ON sessions (assignment_id)
  WHERE assignment_id IS NOT NULL;

-- ============================================================
-- 3. user_event_fact -- la propagation des trois axes
-- ============================================================
--
-- POURQUOI DUPLIQUER PLUTOT QUE JOINDRE. Une lecture ne doit jamais avoir besoin
-- d'une jointure pour connaitre ses droits : la porte de lecture professeur
-- filtre sur ces colonnes, et un filtre de securite qui depend d'une jointure est
-- un filtre qu'on peut oublier d'ecrire. C'est deja la raison pour laquelle
-- `mode` est duplique ici.

ALTER TABLE user_event_fact
  ADD COLUMN context            app.session_context_enum     NOT NULL DEFAULT 'personal',
  ADD COLUMN progression_policy app.progression_policy_enum,
  ADD COLUMN assignment_id      uuid;

UPDATE user_event_fact
   SET progression_policy = CASE
         WHEN mode = 'training' THEN 'update_mastery'::app.progression_policy_enum
         ELSE 'observe_only'::app.progression_policy_enum
       END
 WHERE progression_policy IS NULL;

ALTER TABLE user_event_fact
  ALTER COLUMN progression_policy SET NOT NULL,
  ALTER COLUMN progression_policy SET DEFAULT 'update_mastery';

ALTER TABLE user_event_fact
  ADD CONSTRAINT chk_fact_assignment_requires_context
    CHECK ((context = 'teacher_assignment') = (assignment_id IS NOT NULL));

-- L'index de la porte de lecture professeur : toute lecture destinee a un
-- professeur passe par (assignment_id), et par rien d'autre.
CREATE INDEX idx_uef_assignment
  ON user_event_fact (assignment_id, typeface_slug)
  WHERE assignment_id IS NOT NULL;
