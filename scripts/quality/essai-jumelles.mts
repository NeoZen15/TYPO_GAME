// Preuve de comportement : une jumelle ne sort plus comme leurre.
import { pickDistractors } from "@/lib/game/training/question-shape";
import { twinsOf, isIndistinguishableFrom } from "@/lib/game/twin-guard";

const ligne = (slug: string, cluster = "cluster_sans_serif_humanist_02") => ({
  typeface_slug: slug, display_name: slug, primary_category: "sans_serif",
  visual_cluster_id: cluster, difficulty_base: "easy", rarity_tag: "common",
  mastery_level: 3, next_due_after_q: 0, state_id: slug, session_errors: 0,
  consecutive_session_errors: 0, consecutive_correct: 0, adaptive_coef: 1,
});

const jumelles = twinsOf("notosansjp");
console.log(`Noto Sans JP a ${jumelles.length} jumelles : ${jumelles.join(", ")}`);

// 1. Un pool ou les jumelles sont les leurres les plus tentants du tri.
const pool = [ligne("notosansjp"), ...jumelles.map((s) => ligne(s)),
              ligne("roboto"), ligne("inter"), ligne("lato"), ligne("open_sans"),
              ligne("figtree"), ligne("manrope")];
const correct = pool[0];
let fautes = 0;
for (let q = 0; q < 200; q += 1) {
  const leurres = pickDistractors(pool, correct, q, "graine-test", isIndistinguishableFrom);
  if (leurres.length !== 3) { console.log(`  q=${q} : ${leurres.length} leurres au lieu de 3`); fautes++; }
  for (const l of leurres) {
    if (isIndistinguishableFrom(correct.typeface_slug, l.typeface_slug)) {
      if (fautes < 3) console.log(`  q=${q} : ${l.typeface_slug} est une jumelle et sort comme leurre`);
      fautes++;
    }
  }
}
console.log(`1. 200 manches, ${fautes} faute(s)`);

// 2. Le repli : un pool ou il ne reste PAS trois leurres non jumeaux.
const petit = [ligne("notosansjp"), ...jumelles.map((s) => ligne(s)), ligne("roboto")];
const leurres = pickDistractors(petit, petit[0], 0, "graine-test", isIndistinguishableFrom);
console.log(`2. pool de ${petit.length} dont ${jumelles.length} jumelles : ${leurres.length} leurres rendus`);
console.log(`   ${leurres.length === 3 ? "le repli fonctionne, l'ecran n'est pas casse" : "DEFAUT : moins de quatre boutons"}`);

// 3. Une police sans jumelle n'est pas affectee.
const normal = [ligne("roboto"), ligne("inter"), ligne("lato"), ligne("open_sans"), ligne("figtree")];
const l3 = pickDistractors(normal, normal[0], 0, "graine-test", isIndistinguishableFrom);
console.log(`3. police sans jumelle : ${l3.length} leurres, ${l3.map((x) => x.typeface_slug).join(", ")}`);
