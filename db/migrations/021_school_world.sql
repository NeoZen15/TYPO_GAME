-- ============================================================
-- MIGRATION 021 -- le monde scolaire : ecoles, classes, invitations, assignations
-- Requiert : 002 (catalogue) et 003 (users, sessions) appliquees
-- Specifie par : docs/game/architecture-backend.md section 4
-- Contrat rempli par : docs/product/spec-creation-exercice.md
-- ============================================================
--
-- CE QUE CETTE MIGRATION REND POSSIBLE, ET RIEN DE PLUS. Un professeur peut
-- appartenir a un etablissement, y tenir des classes, y inviter des eleves, et
-- publier des assignations qui portent un CONTRAT. Elle ne cree aucune session,
-- ne touche aucun etat pedagogique, et n'ouvre aucun chemin de lecture : la
-- porte de lecture professeur et les axes de session sont la migration 022 et le
-- code qui va avec.
--
-- LA LICENCE VIT SUR L'ECOLE, JAMAIS SUR LE PROFESSEUR (architecture section 4).
-- Un professeur qui part ne fait pas partir la licence de ses classes.
--
-- LE PROVISIONNEMENT N'OUVRE AUCUN POUVOIR RESIDUEL. C'est le professeur qui
-- invite l'eleve, et c'est ce meme eleve qui detient ensuite des donnees que le
-- professeur ne doit pas lire. Donc : aucune colonne de mot de passe ici, aucune
-- trace d'usurpation, et l'invitation ne porte qu'un jeton a usage unique que
-- l'eleve echange lui meme.
--
-- POURQUOI LE PERIMETRE EST EN JSONB ET LES FACES IMPOSEES EN TABLE. Un
-- perimetre designe des BRANCHES du catalogue (`category:serif`), qui ne sont pas
-- des entites : les stocker en lignes obligerait a inventer une table de
-- categories que le catalogue porte deja en colonnes. Une face imposee, elle, EST
-- une entite du catalogue, donc elle est une ligne avec sa cle etrangere : une
-- assignation ne peut pas nommer une police qui n'existe pas.
-- ============================================================

-- ============================================================
-- 1. ENUMS
-- ============================================================

CREATE TYPE app.school_role_enum AS ENUM (
  'teacher',
  'admin'
);

CREATE TYPE app.invitation_status_enum AS ENUM (
  'pending',
  'accepted',
  'revoked',
  'expired'
);

-- Les trois types que le professeur choisit, et ce sont des EFFETS et non des
-- ambiances (spec section 15, arbitrage 3 du 2026-09-10). Le mode et la politique
-- de progression de la session en decoulent, ils ne sont jamais choisis a la main.
CREATE TYPE app.assignment_kind_enum AS ENUM (
  'exercise',
  'control',
  'competition'
);

-- Le cran d'exigence, traduit par le moteur en proximite de distracteurs
-- (spec section 13). 'expert' est un palier de distracteurs, JAMAIS le format de
-- reponse ecrite, non assignable en V1 (arbitrage 1).
CREATE TYPE app.exigence_enum AS ENUM (
  'accessible',
  'balanced',
  'challenging',
  'expert'
);

CREATE TYPE app.assignment_state_enum AS ENUM (
  'draft',
  'scheduled',
  'open',
  'closed',
  'cancelled'
);

-- ============================================================
-- 2. schools -- porteur de la licence et du compteur de sieges
-- ============================================================

CREATE TABLE schools (
  school_id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name                text        NOT NULL CHECK (length(btrim(name)) > 0),
  seats               int         NOT NULL DEFAULT 0 CHECK (seats >= 0),
  licence_expires_at  timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE school_members (
  school_id  uuid                  NOT NULL REFERENCES schools (school_id) ON DELETE RESTRICT,
  user_id    uuid                  NOT NULL REFERENCES users (user_id) ON DELETE RESTRICT,
  role       app.school_role_enum  NOT NULL,
  created_at timestamptz           NOT NULL DEFAULT now(),

  PRIMARY KEY (school_id, user_id)
);

CREATE INDEX idx_school_members_user ON school_members (user_id);

-- ============================================================
-- 3. classes et appartenances
-- ============================================================

CREATE TABLE classes (
  class_id     uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id    uuid        NOT NULL REFERENCES schools (school_id) ON DELETE RESTRICT,
  name         text        NOT NULL CHECK (length(btrim(name)) > 0),
  level        text,
  -- Le code court que l'eleve tape une fois. Le QR est ecarte, decision du
  -- proprietaire ; le flux de rattachement lui meme reste a specifier.
  join_code    text        NOT NULL UNIQUE CHECK (join_code ~ '^[A-Z0-9]{6}$'),
  archived     boolean     NOT NULL DEFAULT false,
  created_by   uuid        NOT NULL REFERENCES users (user_id) ON DELETE RESTRICT,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_classes_school ON classes (school_id) WHERE archived = false;

CREATE TABLE class_members (
  class_id   uuid        NOT NULL REFERENCES classes (class_id) ON DELETE RESTRICT,
  user_id    uuid        NOT NULL REFERENCES users (user_id) ON DELETE RESTRICT,
  joined_at  timestamptz NOT NULL DEFAULT now(),

  PRIMARY KEY (class_id, user_id)
);

CREATE INDEX idx_class_members_user ON class_members (user_id);

CREATE TABLE invitations (
  invitation_id    uuid                        PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id         uuid                        NOT NULL REFERENCES classes (class_id) ON DELETE RESTRICT,
  email            text                        NOT NULL,
  -- A usage unique, echange par l'eleve. Le professeur ne definit jamais de mot
  -- de passe et ne peut jamais se connecter a la place de l'eleve.
  token            text                        NOT NULL UNIQUE,
  status           app.invitation_status_enum  NOT NULL DEFAULT 'pending',
  invited_by       uuid                        NOT NULL REFERENCES users (user_id) ON DELETE RESTRICT,
  accepted_user_id uuid                        REFERENCES users (user_id) ON DELETE RESTRICT,
  created_at       timestamptz                 NOT NULL DEFAULT now(),
  expires_at       timestamptz                 NOT NULL,
  accepted_at      timestamptz,

  CONSTRAINT chk_invitation_accepted_has_user
    CHECK ((status = 'accepted') = (accepted_user_id IS NOT NULL)),
  CONSTRAINT chk_invitation_accepted_has_date
    CHECK ((status = 'accepted') = (accepted_at IS NOT NULL))
);

CREATE INDEX idx_invitations_class ON invitations (class_id, status);

-- ============================================================
-- 4. assignments -- LE CONTRAT, commun a toute la classe (I-25)
-- ============================================================

CREATE TABLE assignments (
  assignment_id   uuid                          PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id        uuid                          NOT NULL REFERENCES classes (class_id) ON DELETE RESTRICT,
  teacher_id      uuid                          NOT NULL REFERENCES users (user_id) ON DELETE RESTRICT,
  title           text                          NOT NULL CHECK (length(btrim(title)) > 0),
  kind            app.assignment_kind_enum      NOT NULL,

  -- ---- le contrat, identique pour tous les destinataires ----
  -- Le terrain : des branches du catalogue, en selecteurs et non en faces
  -- developpees. Developper figerait le catalogue du jour de la publication.
  scope           jsonb                         NOT NULL DEFAULT '[]'::jsonb,
  -- Les paires retenues par le professeur apres arbitrage (spec section 10).
  confusions      jsonb                         NOT NULL DEFAULT '[]'::jsonb,
  exigence        app.exigence_enum             NOT NULL,
  -- I-25 : l'adaptation joue A L'INTERIEUR du contrat, elle ne le modifie jamais.
  adaptive        boolean                       NOT NULL DEFAULT false,
  -- Les quatre parts du mix, hypothese de V1 mesuree et non verite figee.
  mix             jsonb                         NOT NULL DEFAULT
                    '{"consolidation":45,"upkeep":20,"targeted":20,"novelty":15}'::jsonb,
  -- Un budget de questions pour l'exercice et le controle, jamais pour la
  -- competition, qui est une fenetre de deux minutes (arbitrage 2).
  question_count  int                           CHECK (question_count IS NULL OR question_count BETWEEN 5 AND 60),
  duration_ms     int                           CHECK (duration_ms IS NULL OR duration_ms > 0),

  -- ---- la fenetre ----
  available_from  timestamptz                   NOT NULL,
  due_at          timestamptz                   NOT NULL,

  -- ---- etat et provenance ----
  state           app.assignment_state_enum     NOT NULL DEFAULT 'draft',
  -- 'recommendation:consolidate' | ':separate' | ':push' | 'from_scratch' |
  -- 'duplicate:<assignment_id>'. Ne sert pas au moteur : sert a savoir un jour
  -- si les recommandations sont utilisees et si elles produisent mieux.
  origin          text                          NOT NULL,
  edited          boolean                       NOT NULL DEFAULT false,
  created_at      timestamptz                   NOT NULL DEFAULT now(),
  updated_at      timestamptz                   NOT NULL DEFAULT now(),
  published_at    timestamptz,
  closed_at       timestamptz,

  CONSTRAINT chk_assignment_window
    CHECK (due_at > available_from),
  -- Les deux faces de l'arbitrage 2, posees sur la ligne : une competition n'a
  -- pas de budget de questions, et tout le reste en a un.
  CONSTRAINT chk_assignment_budget
    CHECK ((kind = 'competition') = (question_count IS NULL)),
  CONSTRAINT chk_assignment_duration
    CHECK ((kind = 'competition') = (duration_ms IS NOT NULL)),
  CONSTRAINT chk_assignment_scope_shape
    CHECK (jsonb_typeof(scope) = 'array' AND jsonb_typeof(confusions) = 'array'),
  CONSTRAINT chk_assignment_published
    CHECK ((state IN ('draft')) = (published_at IS NULL)),
  CONSTRAINT chk_assignment_closed
    CHECK ((state IN ('closed', 'cancelled')) = (closed_at IS NOT NULL))
);

CREATE INDEX idx_assignments_class_state ON assignments (class_id, state, due_at);
CREATE INDEX idx_assignments_teacher ON assignments (teacher_id, created_at DESC);

-- Les faces imposees : nommees par le professeur, GARANTIES demandees a chaque
-- eleve. Une table et non un tableau, pour que la cle etrangere existe : une
-- assignation ne peut pas nommer une police absente du catalogue.
CREATE TABLE assignment_targets (
  assignment_id uuid NOT NULL REFERENCES assignments (assignment_id) ON DELETE CASCADE,
  typeface_slug text NOT NULL REFERENCES typefaces_core (typeface_slug) ON DELETE RESTRICT,

  PRIMARY KEY (assignment_id, typeface_slug)
);

-- Qui a recu le devoir, FIGE A LA PUBLICATION (spec section 17). On peut ajouter
-- un destinataire tant que l'exercice n'est pas ferme, jamais en retirer un qui a
-- deja repondu : ses reponses existent.
CREATE TABLE assignment_recipients (
  assignment_id uuid        NOT NULL REFERENCES assignments (assignment_id) ON DELETE CASCADE,
  user_id       uuid        NOT NULL REFERENCES users (user_id) ON DELETE RESTRICT,
  added_at      timestamptz NOT NULL DEFAULT now(),

  PRIMARY KEY (assignment_id, user_id)
);

CREATE INDEX idx_assignment_recipients_user ON assignment_recipients (user_id);
