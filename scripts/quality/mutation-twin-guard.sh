# Test par mutation du garde check:twin-guard.
# Chaque mutation casse UNE regle. Le garde doit rougir a chaque fois.
set -u
cd /Users/launaymarion/Documents/JEUX_DE_TYPO/09_DEV/08_jeux-de-typo-v2
M=lib/game/twin-guard.ts
F=lib/game/training/question-shape.ts
T=lib/game/training/provider.ts
C=lib/game/competition/provider.ts
R=data/typography-profiles/indistinguishable-pairs.json
K=content/catalog/typefaces-core.json
# LA SAUVEGARDE PORTE LE CHEMIN COMPLET, PAS LE NOM DE FICHIER.
# Premiere version : cp $f /tmp/$(basename $f).mut. Or training/provider.ts et
# competition/provider.ts ont le MEME nom de base, donc la seconde sauvegarde
# ecrasait la premiere, et la restauration ecrivait le fournisseur de competition
# par dessus celui d'entrainement. Le fichier a reellement ete corrompu le
# 2026-08-24, et il a fallu le reprendre depuis git.
SAUVE=$(mktemp -d)
sauver(){ for f in $M $F $T $C $R $K; do
  mkdir -p "$SAUVE/$(dirname $f)"; cp "$f" "$SAUVE/$f"; done; }
restaurer(){ for f in $M $F $T $C $R $K; do cp "$SAUVE/$f" "$f"; done; }
sauver
ok=0; rate=0
essai(){ local n="$1"; shift; "$@" >/dev/null 2>&1
  if node scripts/quality/check-twin-guard.mjs >/dev/null 2>&1
    then echo "  RATE   $n"; rate=$((rate+1)); else echo "  attrape $n"; ok=$((ok+1)); fi
  restaurer; }

echo "mutations :"
essai "le filtre retire de question-shape" \
  perl -0pi -e 's/!sontJumelles\(correct\.typeface_slug, row\.typeface_slug\)/true/' $F
essai "le parametre retire de question-shape" \
  perl -0pi -e 's/sontJumelles: SontJumelles = JAMAIS_JUMELLES/inutilise: boolean = false/' $F
essai "question-shape importe le garde en alias, ce qui aveugle answer-position" \
  perl -0pi -e 's{^(export type SontJumelles)}{import { isIndistinguishableFrom } from "\@/lib/game/twin-guard";\n$1}m' $F
essai "le fournisseur d entrainement ne passe plus le test" \
  perl -0pi -e 's/,\n    isIndistinguishableFrom\n  \);/\n  );/' $T
essai "l import retire du fournisseur d entrainement" \
  perl -0pi -e 's{import \{ isIndistinguishableFrom \} from "\@/lib/game/twin-guard";\n}{}' $T
essai "l appel retire de la competition" \
  perl -0pi -e 's/!isIndistinguishableFrom\(correct\.typeface_slug, row\.typeface_slug\)/true/' $C
essai "l appel de competition sur les mauvais arguments" \
  perl -0pi -e 's/isIndistinguishableFrom\(correct\.typeface_slug, row\.typeface_slug\)/isIndistinguishableFrom(row.typeface_slug, row.typeface_slug)/' $C
essai "l import retire de la competition" \
  perl -0pi -e 's{import \{ isIndistinguishableFrom \} from "\@/lib/game/twin-guard";\n}{}' $C
essai "une famille supprimee du module" \
  perl -0pi -e 's/^  \["notosanshk".*\n//m' $M
essai "une police fantome ajoutee a une famille" \
  perl -0pi -e 's/\["notosanshk"/["police_qui_nexiste_pas", "notosanshk"/' $M
essai "une famille d un seul membre" \
  perl -0pi -e 's/^\] as const;/  ["roboto"],\n] as const;/m' $M
essai "le rapport change sans regenerer le module" \
  ./.venv/bin/python -c "
import json;d=json.load(open('$R'));d['familles'].append({'membres':['inter','lato'],'noms':['Inter','Lato'],'dans_la_portee_du_debutant':[]});json.dump(d,open('$R','w'))"
essai "une police du module retiree du catalogue" \
  ./.venv/bin/python -c "
import json;d=json.load(open('$K'));d['records']=[r for r in d['records'] if r['typeface_slug']!='notosanshk'];json.dump(d,open('$K','w'))"

restaurer
echo; echo "$ok attrapees, $rate ratees"
node scripts/quality/check-twin-guard.mjs
