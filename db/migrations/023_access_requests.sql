-- ============================================================
-- MIGRATION 023 -- les demandes d'acces enseignant
-- Requiert : 021 (monde scolaire) appliquee
-- NON APPLIQUEE EN PRODUCTION. Elle demande le feu vert explicite du
-- proprietaire. Appliquee le 2026-09-10 sur la branche jetable
-- `jetable-schema-scolaire-2026-09-10` uniquement.
-- ============================================================
--
-- LE MODELE, DECIDE PAR LE PROPRIETAIRE LE 2026-09-10, ET C'EST LE PLUS SIMPLE
-- QUI TIENNE. Il n'y a pas d'inscription libre : un enseignant DEMANDE, le
-- proprietaire valide, et le compte, l'ecole et la classe sont crees derriere.
--
-- POURQUOI UNE TABLE ET PAS UNE BOITE MAIL. Une demande par courriel ne laisse ni
-- file d'attente, ni trace de qui a decide quoi, ni moyen de savoir combien de
-- demandes attendent. Une ligne le fait, et elle coute une table.
--
-- CE QU'ELLE NE PORTE JAMAIS : aucun mot de passe, aucun secret. Le compte est
-- cree chez Clerk et l'enseignant choisit lui meme son mot de passe, comme
-- l'exige l'architecture pour les eleves et pour la meme raison : provisionner ne
-- doit ouvrir aucun pouvoir residuel sur le compte de quelqu'un d'autre.
--
-- ET PAS D'ADRESSE DANS `users`, VOLONTAIREMENT. La table `users` n'a pas de
-- colonne email et n'en aura pas : l'adresse est la propriete de Clerk, et la
-- dupliquer creerait deux verites pour une meme personne. La detection de
-- doublons du tableau de bord se fait donc en deux temps : les demandes entre
-- elles par l'adresse ici, et l'existence d'un compte en interrogeant Clerk au
-- moment de l'affichage. Aucune colonne a ajouter pour ca.
--
-- POURQUOI `created_user_id` EST EXIGE SUR UNE DEMANDE ACCEPTEE. Le geste
-- d'acceptation cree le compte Clerk, donc l'identifiant existe immediatement et
-- la ligne `users` avec lui, puis l'ecole si besoin, puis l'appartenance
-- enseignante, puis l'invitation. Rien n'est cree sur un refus. La contrainte
-- rend donc impossible une demande marquee acceptee sans que le compte existe :
-- si une etape echoue, la demande reste en attente et le tableau de bord le
-- montre, au lieu d'afficher un professeur qui n'existe pas.
-- ============================================================

-- Le vocabulaire du tableau de bord, mot pour mot : Pending / Approved /
-- Rejected. Trois colonnes dans l'interface, trois valeurs ici, et pas de
-- quatrieme etat cache.
CREATE TYPE app.access_request_status_enum AS ENUM (
  'pending',
  'approved',
  'rejected'
);

CREATE TABLE access_requests (
  request_id      uuid                             PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Ce que la personne declare. Rien n'est verifie a ce stade, c'est une
  -- demande : la verification est le geste humain de validation.
  full_name       text                             NOT NULL CHECK (length(btrim(full_name)) > 0),
  email           text                             NOT NULL CHECK (position('@' in email) > 1),
  school_name     text                             NOT NULL CHECK (length(btrim(school_name)) > 0),
  -- Ce qu'elle enseigne, en clair. Sert a la decision, jamais au moteur.
  teaches         text,
  message         text,

  status          app.access_request_status_enum   NOT NULL DEFAULT 'pending',
  created_at      timestamptz                      NOT NULL DEFAULT now(),
  decided_at      timestamptz,
  decided_by      uuid                             REFERENCES users (user_id) ON DELETE RESTRICT,
  -- Le compte cree derriere, quand la demande est acceptee. Permet de retrouver
  -- d'ou vient un professeur, et de ne jamais provisionner deux fois.
  created_user_id uuid                             REFERENCES users (user_id) ON DELETE RESTRICT,
  created_school_id uuid                           REFERENCES schools (school_id) ON DELETE RESTRICT,
  -- L'invitation envoyee par Clerk apres acceptation. Stockee pour que le
  -- tableau de bord puisse dire « invitation envoyee, pas encore acceptee » sans
  -- le deviner, et pour ne jamais en envoyer deux.
  clerk_invitation_id text                         UNIQUE,

  CONSTRAINT chk_access_request_decided
    CHECK ((status = 'pending') = (decided_at IS NULL)),
  CONSTRAINT chk_access_request_approved_has_account
    CHECK (status <> 'approved' OR (created_user_id IS NOT NULL AND created_school_id IS NOT NULL))
);

-- Une adresse ne peut avoir qu'une demande en attente : deux formulaires
-- remplis deux fois ne font pas deux enseignants.
CREATE UNIQUE INDEX uq_access_requests_pending_email
  ON access_requests (lower(email))
  WHERE status = 'pending';

CREATE INDEX idx_access_requests_status ON access_requests (status, created_at DESC);
