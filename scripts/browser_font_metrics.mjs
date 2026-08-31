/**
 * browser_font_metrics.mjs
 *
 * MESURE LES MEMES NEUF GRANDEURS QUE LES SCRIPTS PYTHON, MAIS DANS UN NAVIGATEUR.
 *
 * POURQUOI CE JUMEAU EXISTE. Les 108 polices Adobe n'ont pas de fichier chez nous et
 * n'en auront jamais : leurs conditions interdisent l'auto hebergement. Elles etaient
 * donc absentes de measure_typeface_geometry.py, absentes des paires indistinguables,
 * et absentes du garde des jumelles, verifie le 2026-08-31 : zero slug Adobe sur 108.
 * Or c'est le lot le plus dense en quasi jumelles du catalogue, onze Franklin Gothic,
 * huit Gill Sans Nova, sept Clarendon, sept Futura, sept Garamond, six Baskerville.
 * Le seul endroit ou ces polices existent est un navigateur qui charge la feuille du
 * projet web Adobe. C'est donc la qu'on les mesure.
 *
 * LA DIFFERENCE DE METHODE, ET CE QU'ELLE COUTE. Le Python lit des CONTOURS. Ici on
 * lit des PIXELS, parce qu'un navigateur ne rend pas ses contours de glyphe. Les six
 * grandeurs de proportion se prennent sur les boites d'encre exactes que donne
 * TextMetrics et ne perdent rien. Les trois autres, la graisse, le contraste et
 * l'anneau, se prennent au balayage d'une trame et portent donc une erreur de
 * numerisation. C'est pour la borner qu'on peut lancer ce script sur des polices
 * Google, dont on connait deja la mesure exacte : voir --valider.
 *
 * L'INSTANCE MESUREE EST CELLE QUE LE JEU AFFICHE. Meme regle que dans
 * scripts/font_instance.py : le poids demande est celui du `@font-face` injecte. Les
 * polices Adobe du kit sont statiques, une variation par fichier, donc le navigateur
 * n'a rien a interpoler et la question de l'instance ne se pose pas pour elles.
 *
 * Usage :
 *   node scripts/browser_font_metrics.mjs --adobe
 *   node scripts/browser_font_metrics.mjs --valider 40
 *
 * Le serveur de developpement doit tourner : la page a besoin d'une origine pour
 * charger /fonts et la feuille d'Adobe.
 */

import { chromium } from "playwright";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const ORIGINE = process.env.ORIGINE ?? "http://localhost:3002";
const KIT = "content/catalog/adobe-fonts-kit.json";
const ASSETS = "content/catalog/font-runtime-assets.json";
const GEOMETRIE = "data/typography-profiles/geometry-measured.json";
const SORTIE_ADOBE = "data/typography-profiles/adobe-measured.json";

// Taille de rendu. Plus elle est grande, plus la trame est fine et plus la graisse,
// le contraste et l'anneau sont justes. Mesure du 2026-08-31 : a 1000, la regularite
// de l'anneau s'ecartait de 1,18 pour cent en mediane des contours, pour un seuil de
// jumelage fixe a UN pour cent, donc inutilisable. A 2000, la part de pixels de bord
// est divisee par deux et l'adoucissement gamma du canevas pese d'autant moins.
const TAILLE = 2000;

const lireJson = (chemin) => JSON.parse(readFileSync(chemin, "utf8"));

const args = process.argv.slice(2);
const modeAdobe = args.includes("--adobe");
const indexValider = args.indexOf("--valider");
const nbValider = indexValider >= 0 ? Number(args[indexValider + 1] ?? 40) : 0;

if (!modeAdobe && !nbValider) {
  console.error("Rien a faire : passer --adobe ou --valider <n>.");
  process.exit(2);
}

/**
 * LA MESURE, TELLE QU'ELLE TOURNE DANS LA PAGE.
 *
 * Chaque grandeur reprend mot pour mot la definition du Python, avec le pixel a la
 * place du contour :
 *   graisse    encre du n divisee par l'aire de sa boite. Somme des couvertures
 *              alpha, ce qui vaut mieux qu'un comptage binaire : un bord adouci
 *              compte pour sa fraction et non pour zero ou un.
 *   contraste  epaisseur d'encre sur la ligne mediane du o, divisee par celle de sa
 *              colonne mediane. La somme des couvertures le long d'une ligne EST la
 *              somme des segments pleins que le Python calcule par croisements.
 *   anneau     on isole la contreforme du o par remplissage du fond depuis le bord,
 *              on prend son centre, puis on tire un rayon tous les trois degres. Le
 *              premier pixel d'encre donne le contour interieur, le dernier le
 *              contour exterieur, leur difference l'epaisseur. Regularite = la plus
 *              mince divisee par la plus epaisse.
 *   ouverture_c part de la hauteur du c restee vide sur la colonne posee a 92 pour
 *              cent de sa largeur.
 *   etages_g   nombre de contours du g, soit ses morceaux d'encre plus ses trous.
 */
const MESURE_DANS_LA_PAGE = async ({ faces, taille }) => {
  const ctx = document.createElement("canvas").getContext("2d", { willReadFrequently: true });

  const trame = (famille, poids, style, ch) => {
    ctx.canvas.width = 1;
    ctx.canvas.height = 1;
    ctx.font = `${style} ${poids} ${taille}px "${famille}"`;
    const m = ctx.measureText(ch);
    const gauche = m.actualBoundingBoxLeft;
    const haut = m.actualBoundingBoxAscent;
    const largeur = gauche + m.actualBoundingBoxRight;
    const hauteur = haut + m.actualBoundingBoxDescent;
    if (!(largeur > 0) || !(hauteur > 0)) return null;

    const marge = 2;
    const w = Math.ceil(largeur) + marge * 2;
    const h = Math.ceil(hauteur) + marge * 2;
    ctx.canvas.width = w;
    ctx.canvas.height = h;
    ctx.font = `${style} ${poids} ${taille}px "${famille}"`;
    ctx.fillStyle = "#000";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(ch, gauche + marge, haut + marge);
    const px = ctx.getImageData(0, 0, w, h).data;

    // Couverture d'encre par pixel, entre 0 et 1.
    const encre = new Float32Array(w * h);
    for (let i = 0; i < w * h; i += 1) encre[i] = px[i * 4 + 3] / 255;
    return { encre, w, h, marge, largeur, hauteur, avance: m.width };
  };

  const sommeLigne = (t, y) => {
    if (y < 0 || y >= t.h) return null;
    let s = 0;
    for (let x = 0; x < t.w; x += 1) s += t.encre[y * t.w + x];
    return s;
  };

  const sommeColonne = (t, x) => {
    if (x < 0 || x >= t.w) return null;
    let s = 0;
    for (let y = 0; y < t.h; y += 1) s += t.encre[y * t.w + x];
    return s;
  };

  // Remplissage du fond depuis le bord : ce qui n'est ni encre ni atteint est un trou.
  const regions = (t, seuil = 0.5) => {
    const dedans = new Uint8Array(t.w * t.h);
    for (let i = 0; i < dedans.length; i += 1) dedans[i] = t.encre[i] >= seuil ? 1 : 0;
    const vu = new Uint8Array(t.w * t.h);
    const pile = [];
    for (let x = 0; x < t.w; x += 1) { pile.push(x, x + (t.h - 1) * t.w); }
    for (let y = 0; y < t.h; y += 1) { pile.push(y * t.w, y * t.w + t.w - 1); }
    while (pile.length) {
      const i = pile.pop();
      if (vu[i] || dedans[i]) continue;
      vu[i] = 1;
      const x = i % t.w, y = (i - x) / t.w;
      if (x > 0) pile.push(i - 1);
      if (x < t.w - 1) pile.push(i + 1);
      if (y > 0) pile.push(i - t.w);
      if (y < t.h - 1) pile.push(i + t.w);
    }
    // Composantes d'encre et trous, comptes separement.
    const marque = new Int32Array(t.w * t.h).fill(-1);
    let morceaux = 0, trous = [];
    for (let dep = 0; dep < dedans.length; dep += 1) {
      if (marque[dep] >= 0) continue;
      const estEncre = dedans[dep] === 1;
      if (!estEncre && vu[dep]) continue;          // fond exterieur
      const groupe = [];
      const p = [dep];
      marque[dep] = morceaux;
      while (p.length) {
        const i = p.pop();
        groupe.push(i);
        const x = i % t.w, y = (i - x) / t.w;
        const voisins = [];
        if (x > 0) voisins.push(i - 1);
        if (x < t.w - 1) voisins.push(i + 1);
        if (y > 0) voisins.push(i - t.w);
        if (y < t.h - 1) voisins.push(i + t.w);
        for (const v of voisins) {
          if (marque[v] >= 0) continue;
          if ((dedans[v] === 1) !== estEncre) continue;
          if (!estEncre && vu[v]) continue;
          marque[v] = morceaux;
          p.push(v);
        }
      }
      if (!estEncre) trous.push(groupe);
      morceaux += 1;
    }
    const morceauxEncre = new Set();
    for (let i = 0; i < dedans.length; i += 1) if (dedans[i] === 1 && marque[i] >= 0) morceauxEncre.add(marque[i]);
    return { dedans, trous, nbMorceaux: morceauxEncre.size };
  };

  // Couverture en un point quelconque, interpolee sur les quatre pixels voisins.
  const couverture = (t, fx, fy) => {
    const x0 = Math.floor(fx), y0 = Math.floor(fy);
    const tx = fx - x0, ty = fy - y0;
    const a = t.encre[y0 * t.w + x0];
    const b = t.encre[y0 * t.w + x0 + 1];
    const c = t.encre[(y0 + 1) * t.w + x0];
    const d = t.encre[(y0 + 1) * t.w + x0 + 1];
    return a * (1 - tx) * (1 - ty) + b * tx * (1 - ty) + c * (1 - tx) * ty + d * tx * ty;
  };

  const anneau = (t) => {
    const { trous } = regions(t);
    if (!trous.length) return null;
    const contreforme = trous.reduce((a, b) => (a.length >= b.length ? a : b));
    let sx = 0, sy = 0;
    for (const i of contreforme) { const x = i % t.w; sx += x; sy += (i - x) / t.w; }
    const cx = sx / contreforme.length, cy = sy / contreforme.length;

    const epaisseurs = [];
    for (let deg = 0; deg < 360; deg += 3) {
      const a = (deg * Math.PI) / 180;
      // y vers le bas dans une trame, donc le sinus est retourne pour que l'angle
      // tourne dans le meme sens que dans le Python.
      const dx = Math.cos(a), dy = -Math.sin(a);
      // Le bord se lit SOUS le pixel. Marcher au pixel entier quantifiait le rayon,
      // et sur le point mince d'un o contraste, ou l'anneau ne fait que quelques
      // dizaines de pixels, un demi pixel d'erreur suffit a fausser le rapport de
      // plusieurs pour cent. On echantillonne donc la couverture en bilineaire et on
      // interpole la position exacte ou elle croise la moitie.
      let rInt = null, rExt = null;
      const rMax = Math.hypot(t.w, t.h);
      const pas = 0.25;
      let precedent = null;
      for (let r = 0; r < rMax; r += pas) {
        const fx = cx + dx * r, fy = cy + dy * r;
        if (fx < 0 || fy < 0 || fx >= t.w - 1 || fy >= t.h - 1) break;
        const c = couverture(t, fx, fy);
        if (precedent !== null) {
          const avant = precedent.c, apres = c;
          if (avant < 0.5 && apres >= 0.5) {
            const f = (0.5 - avant) / (apres - avant);
            const bord = precedent.r + f * pas;
            if (rInt === null) rInt = bord;
          } else if (avant >= 0.5 && apres < 0.5) {
            const f = (avant - 0.5) / (avant - apres);
            rExt = precedent.r + f * pas;
          }
        }
        precedent = { r, c };
      }
      if (rInt !== null && rExt !== null && rExt > rInt) epaisseurs.push(rExt - rInt);
    }
    if (epaisseurs.length < 12) return null;
    const mince = Math.min(...epaisseurs), epais = Math.max(...epaisseurs);
    return epais > 0 ? Number((mince / epais).toFixed(4)) : null;
  };

  const resultats = {};
  for (const face of faces) {
    const { cle, famille, poids = 400, style = "normal" } = face;
    try {
      const tn = trame(famille, poids, style, "n");
      const to = trame(famille, poids, style, "o");
      const tx = trame(famille, poids, style, "x");
      const tH = trame(famille, poids, style, "H");
      const tc = trame(famille, poids, style, "c");
      const tg = trame(famille, poids, style, "g");
      if (!tn || !to || !tx || !tH) { resultats[cle] = { erreur: "x, H, o ou n absente" }; continue; }

      let encreN = 0;
      for (let i = 0; i < tn.encre.length; i += 1) encreN += tn.encre[i];

      const ligneMediane = Math.round(to.marge + to.hauteur / 2);
      const colonneMediane = Math.round(to.marge + to.largeur / 2);
      const fut = sommeLigne(to, ligneMediane);
      const barre = sommeColonne(to, colonneMediane);

      let ouverture = null;
      if (tc) {
        const colonne = Math.round(tc.marge + tc.largeur * 0.92);
        const pleine = sommeColonne(tc, colonne);
        if (pleine !== null && tc.hauteur > 0) ouverture = Number((1 - pleine / tc.hauteur).toFixed(4));
      }

      let etages = null;
      if (tg) { const r = regions(tg); etages = r.nbMorceaux + r.trous.length; }

      resultats[cle] = {
        x_sur_cap: Number((tx.hauteur / tH.hauteur).toFixed(4)),
        hauteur_x: Number((tx.hauteur / taille).toFixed(4)),
        hauteur_cap: Number((tH.hauteur / taille).toFixed(4)),
        chasse: Number((tn.avance / taille).toFixed(4)),
        graisse: Number((encreN / (tn.largeur * tn.hauteur)).toFixed(4)),
        rondeur: Number((to.largeur / to.hauteur).toFixed(4)),
        contraste: fut && barre ? Number((fut / barre).toFixed(4)) : null,
        regularite_anneau: anneau(to),
        ouverture_c: ouverture,
        etages_g: etages,
      };
    } catch (e) {
      resultats[cle] = { erreur: String(e && e.message ? e.message : e) };
    }
  }
  return resultats;
};

const ecrire = (chemin, contenu) => {
  mkdirSync(dirname(chemin), { recursive: true });
  writeFileSync(chemin, `${JSON.stringify(contenu, null, 1)}\n`, "utf8");
};

const navigateur = await chromium.launch();
const page = await navigateur.newPage();
const reponse = await page.goto(ORIGINE, { waitUntil: "domcontentloaded" }).catch(() => null);
if (!reponse) {
  console.error(`Le serveur ne repond pas sur ${ORIGINE}. Lancer npm run dev, ou passer ORIGINE=...`);
  await navigateur.close();
  process.exit(1);
}

if (modeAdobe) {
  const kit = lireJson(KIT);
  await page.evaluate(async (feuille) => {
    const lien = document.createElement("link");
    lien.rel = "stylesheet";
    lien.href = feuille;
    document.head.appendChild(lien);
    await new Promise((r) => { lien.onload = r; lien.onerror = r; setTimeout(r, 15000); });
  }, kit.meta.stylesheet);

  const faces = kit.families.map((f) => ({ cle: f.typeface_slug, famille: f.css_family }));
  await page.evaluate(async (noms) => {
    // Le jeu demande 400 : c'est ce que `.game-v2-word` porte et ce qu'aucun
    // descripteur ne surcharge pour une police Adobe (getRuntimeFontFace rend null).
    await Promise.all(noms.map((n) => document.fonts.load(`400 100px "${n}"`).catch(() => null)));
  }, faces.map((f) => f.famille));

  const mesures = await page.evaluate(MESURE_DANS_LA_PAGE, { faces, taille: TAILLE });
  const bonnes = Object.fromEntries(Object.entries(mesures).filter(([, v]) => !v.erreur));
  const ratees = Object.entries(mesures).filter(([, v]) => v.erreur);

  ecrire(SORTIE_ADOBE, {
    meta: {
      mesurees: Object.keys(bonnes).length,
      echecs: ratees.length,
      taille_de_rendu: TAILLE,
      methode: "trame de pixels dans un navigateur, les fichiers Adobe restant chez Adobe",
      kit: kit.meta.kit_id,
    },
    mesures: bonnes,
  });
  console.log(`${Object.keys(bonnes).length} polices Adobe mesurees, ${ratees.length} echecs`);
  for (const [slug, v] of ratees.slice(0, 10)) console.log(`  ${slug} : ${v.erreur}`);
  console.log(`ecrit dans ${SORTIE_ADOBE}`);
}

if (nbValider) {
  const assets = lireJson(ASSETS).records.filter((r) => r.file_role === "primary" && r.runtime_status === "ready");
  const geo = lireJson(GEOMETRIE).mesures;
  const formes = lireJson("data/typography-profiles/shapes-measured.json").mesures;
  // On ecarte les polices a axe optique : le canevas regle cet axe sur SA taille de
  // rendu, 1000, quand le Python l'a fige a 128. Les comparer melangerait deux
  // instances differentes et l'ecart mesure ne dirait plus rien de la methode.
  const candidats = assets.filter((r) => geo[r.typeface_slug] && formes[r.typeface_slug]
    && !(geo[r.typeface_slug].instance || {}).opsz);
  const pas = Math.max(1, Math.floor(candidats.length / nbValider));
  const choisis = candidats.filter((_, i) => i % pas === 0).slice(0, nbValider);

  await page.evaluate(async (records) => {
    const style = document.createElement("style");
    style.textContent = records.map((r) => `@font-face { font-family: "JDT__${r.slug}"; src: url("${r.chemin}") format("woff2"); font-weight: ${r.poids}; font-style: ${r.style}; font-display: block; }`).join("\n");
    document.head.appendChild(style);
    await Promise.all(records.map((r) => document.fonts.load(`${r.poids} 100px "JDT__${r.slug}"`).catch(() => null)));
  }, choisis.map((r) => ({ slug: r.typeface_slug, chemin: r.runtime_path, poids: r.weight ?? 400, style: r.style ?? "normal" })));

  const faces = choisis.map((r) => ({ cle: r.typeface_slug, famille: `JDT__${r.typeface_slug}`, poids: r.weight ?? 400, style: r.style ?? "normal" }));
  const mesures = await page.evaluate(MESURE_DANS_LA_PAGE, { faces, taille: TAILLE });

  const grandeurs = ["x_sur_cap", "hauteur_x", "hauteur_cap", "chasse", "graisse", "rondeur", "contraste", "regularite_anneau", "ouverture_c"];
  const ecarts = Object.fromEntries(grandeurs.map((g) => [g, []]));
  const parPolice = Object.fromEntries(grandeurs.map((g) => [g, []]));
  let etagesJustes = 0, etagesCompares = 0, comparees = 0;
  for (const [slug, m] of Object.entries(mesures)) {
    if (m.erreur) continue;
    const ref = { ...geo[slug], ...formes[slug] };
    comparees += 1;
    for (const g of grandeurs) {
      const a = m[g], b = ref[g];
      if (a === null || b === null || a === undefined || b === undefined || b === 0) continue;
      const d = Math.abs(a - b) / Math.abs(b) * 100;
      ecarts[g].push(d);
      parPolice[g].push({ slug, d, trame: a, contour: b });
    }
    if (m.etages_g !== null && ref.etages_g !== null && ref.etages_g !== undefined) {
      etagesCompares += 1;
      if (m.etages_g === ref.etages_g) etagesJustes += 1;
    }
  }

  const mediane = (xs) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : NaN; };
  console.log(`\nTrame de pixels contre contours, sur ${comparees} polices Google mesurees des deux facons.`);
  console.log(`${"grandeur".padEnd(20)}${"mediane".padStart(10)}${"90e centile".padStart(14)}${"pire".padStart(10)}`);
  for (const g of grandeurs) {
    const xs = ecarts[g];
    if (!xs.length) { console.log(`${g.padEnd(20)}${"aucune".padStart(10)}`); continue; }
    const s = [...xs].sort((a, b) => a - b);
    const p90 = s[Math.floor(s.length * 0.9)];
    console.log(`${g.padEnd(20)}${mediane(xs).toFixed(3).padStart(9)}%${p90.toFixed(3).padStart(13)}%${s[s.length - 1].toFixed(3).padStart(9)}%`);
  }
  console.log(`etages_g            ${etagesJustes}/${etagesCompares} identiques`);
  console.log("\nLes polices qui s'ecartent le plus, grandeur par grandeur :");
  for (const g of grandeurs) {
    const pires = [...parPolice[g]].sort((a, b) => b.d - a.d).slice(0, 3).filter((x) => x.d > 1);
    if (!pires.length) continue;
    console.log(`  ${g}`);
    for (const x of pires) console.log(`    ${x.slug.padEnd(24)} trame ${String(x.trame).padStart(9)}  contour ${String(x.contour).padStart(9)}  ${x.d.toFixed(2)}%`);
  }
}

await navigateur.close();
