// ============================================================================
// check:assigned-integrity
//
// POURQUOI CE GARDE EXISTE, ET POURQUOI IL EST ARRIVE AVEC L'ECRIVAIN.
//
// Cinq gardes imposent au fournisseur d'ENTRAINEMENT les proprietes du plan de
// double demarrage. Tous nomment un chemin `lib/game/training/*` et le lisent
// comme du texte. La competition a donc vecu six mois sans aucune d'elles, la
// porte etant verte : deux reponses simultanees ecrivaient deux faits pour une
// question, et 121 sessions sont restees actives cinq mois parce que le balayage
// porte `AND s.mode = 'training'`. check:competition-integrity est ne de cette
// facture, et ce fichier est son equivalent pour le troisieme ecrivain, ecrit le
// meme jour que lui pour que la dette n'existe pas.
//
// SIX PROPRIETES, sur lib/game/assigned/writer.ts.
//   1. Un seul enonce atomique, arbitre par la garde d'ingestion.
//   2. Zero ligne ecrite veut dire doublon : on rend ce que la base a enregistre.
//   3. Les compteurs s'incrementent DANS l'instruction, jamais en JavaScript.
//   4. La maitrise n'est touchee que sous `update_mastery` et au premier essai.
//   5. La fenetre est verifiee a chaque question ET a chaque reponse.
//   6. Le budget vient du contrat, jamais d'une constante, et le jeton signe
//      decide de la face et des options, jamais le corps de la requete.
//
// IL LIT DU CODE, PAS DE LA PROSE. Les commentaires SQL et les lignes de
// commentaire JS sont retires avant toute verification : la premiere version du
// garde de competition passait avec le predicat supprime, parce que le
// commentaire au dessus le citait par son nom.
// ============================================================================

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const WRITER = "lib/game/assigned/writer.ts";
const CONTRACT = "lib/game/assigned/contract.ts";

const read = (relative) => fs.readFileSync(path.join(ROOT, relative), "utf8");

const stripSqlComments = (text) =>
  text
    .split("\n")
    .map((line) => {
      const at = line.indexOf("--");
      return at === -1 ? line : line.slice(0, at);
    })
    .join("\n");

const stripJsComments = (text) =>
  text
    .split("\n")
    .filter((line) => {
      const trimmed = line.trimStart();
      return !trimmed.startsWith("//") && !trimmed.startsWith("*") && !trimmed.startsWith("/*");
    })
    .join("\n");

const codeOf = (text) => stripSqlComments(stripJsComments(text));

// Le corps d'une declaration de premier niveau, jusqu'a la suivante. Borner
// chaque regle a une fonction est ce qui empeche un besoin d'etre satisfait par
// une instruction sans rapport ailleurs dans le fichier.
const functionBody = (source, name) => {
  const at = source.search(new RegExp(`^(export )?const ${name} = `, "m"));
  if (at === -1) return null;
  const rest = source.slice(at + 10);
  const next = rest.search(/^(export )?const [A-Za-z]/m);
  return next === -1 ? source.slice(at) : source.slice(at, at + 10 + next);
};

const failures = [];
const requireIn = (haystack, needle, where, why) => {
  if (!haystack.includes(needle)) failures.push(`${where} : \`${needle}\` manque. ${why}`);
};
const refuseIn = (haystack, needle, where, why) => {
  if (haystack.includes(needle)) failures.push(`${where} : \`${needle}\` est present. ${why}`);
};

if (!fs.existsSync(path.join(ROOT, WRITER))) {
  console.error(`check:assigned-integrity a echoue.\n\n  - ${WRITER} est absent : l'ecrivain assigne a disparu.`);
  process.exit(1);
}

const writer = read(WRITER);
const answer = functionBody(writer, "submitAssignedAnswer");
const builder = functionBody(writer, "buildAssignedQuestion");

if (!answer) failures.push(`${WRITER} n'exporte plus submitAssignedAnswer.`);
if (!builder) failures.push(`${WRITER} n'exporte plus buildAssignedQuestion.`);

if (answer) {
  const sqlCode = codeOf(answer);
  const where = `${WRITER} submitAssignedAnswer`;

  // 1. L'enonce atomique.
  // LE BESOIN PORTE SA PARENTHESE, ET C'EST LA MUTATION QUI L'A APPRIS. Ecrit
  // sans elle, `INSERT INTO event_ingestion_guard` restait satisfait par un
  // `INSERT INTO event_ingestion_guard_x` : un prefixe est toujours inclus dans
  // le nom qu'on a renomme, donc la regle passait sur le defaut exact qu'elle
  // garde. Trouve en testant ce garde par mutation le 2026-09-10, la seule facon
  // dont ce genre de trou se montre.
  requireIn(sqlCode, "INSERT INTO event_ingestion_guard (idempotency_key", where,
    "le fait et son unicite doivent etre ecrits par une seule instruction. Sans la ligne de garde, deux soumissions en vol ecrivent deux faits pour une question.");
  requireIn(sqlCode, "ON CONFLICT (user_id, session_id, idempotency_key) DO NOTHING", where,
    "cette cle primaire EST l'arbitrage : user_event_fact est partitionnee, elle ne porte aucun index unique sur la cle d'idempotence seule et ne peut rien arbitrer elle meme.");
  requireIn(sqlCode, "FROM n, g", where,
    "le fait doit etre SELECTionne depuis la CTE de garde. Un INSERT pose a cote ecrirait l'evenement que la garde soit gagnee ou non.");

  // 2. Le doublon.
  requireIn(answer, "if (written.length === 0)", where,
    "une soumission qui n'a rien ecrit doit s'arreter avant les compteurs, sinon elle ajoute une question repondue pour un mot qu'elle n'a pas enregistre.");
  const dupAt = answer.indexOf("if (written.length === 0)");
  const dupBranch = dupAt === -1 ? "" : answer.slice(dupAt, dupAt + 260);
  requireIn(dupBranch, "return duplicateAssignedAnswerResponse", `${where}, branche du doublon`,
    "un jeton rejoue est une reprise ordinaire : on rend ce que la base a enregistre, jamais une erreur.");

  // 3. Les compteurs, dans l'instruction.
  requireIn(sqlCode, "question_count = question_count + 1", where,
    "calcule en JavaScript depuis une lecture anterieure, deux reponses simultanees partent de la meme valeur et la seconde efface la premiere.");
  requireIn(sqlCode, "correct_count = correct_count + ", where,
    "meme perte de mise a jour, et la contrainte chk_correct_lte_total rend la paire incoherente si une seule des deux est atomique.");
  refuseIn(sqlCode, "question_count = ${", where,
    "une affectation absolue depuis JavaScript est exactement la perte de mise a jour que la forme incrementale evite.");

  // 4. La maitrise, sous politique et au premier essai seulement.
  const gate = "if (writesMastery && attemptIndex === 1)";
  requireIn(answer, gate, where,
    "un controle mesure et une competition fait performer : ni l'un ni l'autre ne deplace la maitrise (I-22). Sans cette porte, un controle ecrirait le pool de l'eleve.");
  const gateAt = answer.indexOf(gate);
  const guarded = gateAt === -1 ? "" : answer.slice(gateAt);
  const writes = (answer.match(/INSERT INTO user_typeface_state/g) ?? []).length;
  if (writes !== 1) {
    failures.push(`${where} : ${writes} ecriture(s) de l'etat personnel, il en faut exactement une, et sous la porte de politique.`);
  } else if (!guarded.includes("INSERT INTO user_typeface_state")) {
    failures.push(`${where} : l'ecriture de l'etat personnel est hors de la porte \`${gate}\`, donc un controle l'atteindrait.`);
  }

  requireIn(sqlCode, "in_active_pool", where,
    "l'ecriture de maitrise doit poser in_active_pool explicitement : une reponse de devoir enregistre la maitrise SANS faire entrer la face dans le pool personnel, et c'est la frontiere qui empeche le professeur de dessiner l'espace prive de l'eleve.");
  refuseIn(sqlCode, "in_active_pool = true", where,
    "un devoir ne fait jamais entrer une face dans le pool : la seule porte d'entree est la regle du moteur.");

  // 5 et 6. La fenetre, le budget, le jeton.
  requireIn(answer, 'context.window_state === "after"', where,
    "une reponse qui arrive apres l'echeance ne compte pas, et la seance se ferme. Verifier la fenetre a la seule ouverture laisse repondre indefiniment.");
  requireIn(answer, "verifyQuestionToken", where,
    "la face demandee et les options viennent d'un jeton signe : sans verification, le client choisit la question a laquelle il repond.");
  requireIn(answer, "signed.options.includes(payload.answerSlug)", where,
    "une reponse hors des options signees doit etre refusee, sinon le client repond ce qu'il veut.");
}

if (builder) {
  const where = `${WRITER} buildAssignedQuestion`;
  requireIn(builder, 'context.window_state !== "open"', where,
    "la fenetre est verifiee a CHAQUE question : une seance peut rester ouverte pendant que l'echeance passe.");
  requireIn(builder, "isBudgetSpent(context.resolved, context.question_count)", where,
    "le budget vient du contrat, jamais d'une constante : c'est ce que check:session-lifecycle protege depuis la disparition de TRAINING_TOTAL_ROUNDS.");
  requireIn(builder, "if (context.adaptive)", where,
    "l'etat personnel n'est lu que si le devoir est adaptatif (I-25). Sur un controle, cette lecture n'a pas lieu du tout.");
  requireIn(builder, "proximityFor(", where,
    "le cran d'exigence du contrat doit atteindre le choix des leurres, sinon le professeur reglerait un cadran debranche.");
}

// Le contrat lui meme : la politique par type, une fois pour toutes.
const contract = codeOf(read(CONTRACT));
requireIn(contract, 'control: "observe_only"', CONTRACT,
  "un controle qui ecrirait la maitrise cesserait d'etre une mesure.");
requireIn(contract, 'competition: "observe_only"', CONTRACT,
  "la compétition n'influence jamais la progression, et la base le refuse de toute facon.");

// Le nombre de questions ne redevient jamais une constante.
refuseIn(codeOf(writer), "TOTAL_ROUNDS", WRITER,
  "une constante de longueur de seance est exactement ce que l'invariant I-17 et check:session-lifecycle interdisent.");

if (failures.length > 0) {
  console.error("check:assigned-integrity a echoue.\n");
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log(
  "check:assigned-integrity OK : enonce atomique arbitre par la garde d'ingestion, doublon rendu et non jete, " +
    "compteurs incrementes dans l'instruction, maitrise ecrite sous politique et au premier essai seulement, " +
    "fenetre verifiee a la question et a la reponse, budget du contrat et jeton signe."
);
