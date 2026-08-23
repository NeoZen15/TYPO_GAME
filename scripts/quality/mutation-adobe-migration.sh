# Test par mutation du garde check:adobe-migration.
# Chaque mutation casse UNE regle. Le garde doit rougir a chaque fois.
# Un garde qui reste vert sur une mutation ne garde rien.
set -u
cd /Users/launaymarion/Documents/JEUX_DE_TYPO/09_DEV/08_jeux-de-typo-v2
M=db/migrations/016_adobe_catalog_rows.sql
R=db/migrations/016_adobe_catalog_rows.rollback.sql
K=content/catalog/adobe-fonts-kit.json
L=app/layout.tsx
C=lib/game/competition/provider.ts
E=db/migrations/015_adobe_fonts_source.sql
cp $M /tmp/m.bak; cp $R /tmp/r.bak; cp $K /tmp/k.bak; cp $L /tmp/l.bak; cp $E /tmp/e.bak; cp $C /tmp/c.bak
restaurer() { cp /tmp/m.bak $M; cp /tmp/r.bak $R; cp /tmp/k.bak $K; cp /tmp/l.bak $L; cp /tmp/e.bak $E; cp /tmp/c.bak $C; }

ok=0; rate=0
essai() {
  local nom="$1"; shift
  "$@" >/dev/null 2>&1
  if node scripts/quality/check-adobe-migration.mjs >/dev/null 2>&1; then
    echo "  RATE   $nom : le garde est reste vert"; rate=$((rate+1))
  else
    echo "  attrape $nom"; ok=$((ok+1))
  fi
  restaurer
}

echo "mutations :"
essai "famille CSS qui derive d'un caractere" \
  sed -i '' 's/"adobe-caslon-pro", serif/"adobe-caslon-pr", serif/' $M
essai "contraste desaccorde de sa signature" \
  sed -i '' "s/'classic', 'single_weight', 'medium', 'semi_open'/'classic', 'single_weight', 'high', 'semi_open'/" $M
essai "ouverture desaccordee de sa signature" \
  sed -i '' "s/'classic', 'single_weight', 'medium', 'semi_open'/'classic', 'single_weight', 'medium', 'open'/" $M
essai "valeur d'enum inventee" \
  sed -i '' "s/'serif', 'old_style', 'cluster_oldstyle_A'/'grotesque', 'old_style', 'cluster_oldstyle_A'/" $M
essai "slug en majuscules" \
  sed -i '' "s/'adobe_caslon_pro', 'Adobe Caslon Pro'/'Adobe_Caslon_Pro', 'Adobe Caslon Pro'/" $M
essai "espace en trop dans le nom" \
  sed -i '' "s/'Adobe Caslon Pro', 'Adobe Caslon Pro'/'Adobe Caslon Pro ', 'Adobe Caslon Pro'/" $M
essai "cluster hors convention" \
  sed -i '' "s/'cluster_oldstyle_A'/'oldstyle'/" $M
essai "min_mode hors du CHECK" \
  sed -i '' "s/false, 'training', 'review'/false, 'entrainement', 'review'/" $M
essai "une famille du kit oubliee par la migration" \
  perl -0pi -e 's/INSERT INTO typefaces_core \(.*?adobe_caslon_pro.*?updated_at_utc = now\(\);\n\n//s' $M
essai "une famille de la migration absente du kit" \
  sed -i '' 's/"typeface_slug": "adobe_caslon_pro"/"typeface_slug": "adobe_caslon_prox"/' $K
essai "COMMIT manquant" \
  sed -i '' 's/^COMMIT;$//' $M
essai "retour arriere qui n eteint plus rien" \
  sed -i '' "s/WHERE font_source = 'adobe'/WHERE false/" $R
essai "retour arriere qui oublie un rallumage" \
  perl -0pi -e "s/UPDATE typefaces_core SET\n  font_source = 'local',.*?WHERE typeface_slug = 'arial';//s" $R
essai "le layout ne charge plus la feuille Adobe" \
  sed -i '' 's/ADOBE_KIT_STYLESHEET/ADOBE_KIT_ABSENT/g' $L
essai "le preconnect disparait" \
  sed -i '' 's|use.typekit.net|use.absent.net|g' $L
essai "la 015 ne cree plus la valeur d enum" \
  sed -i '' "s/ADD VALUE IF NOT EXISTS 'adobe_fonts'/ADD VALUE IF NOT EXISTS 'autre'/" $E
essai "une colonne retiree de la liste sans retirer sa valeur" \
  sed -i '' 's/  is_variable_font, designer, foundry, release_year,/  designer, foundry, release_year,/' $M
essai "signature illisible" \
  sed -i '' 's/{"a_type": null, "e_aperture": "semi_open"/{"a_type": null "e_aperture": "semi_open"/' $M

essai "branche Adobe supprimee du pool de competition" \
  sed -i '' "s/tc.font_source::text = 'adobe'/tc.font_source::text = 'google'/" $C
essai "parenthese du groupe Adobe retiree" \
  perl -0pi -e 's/^      AND \(\n(        -- Une police Adobe)/      AND\n$1/m' $C
essai "groupe Adobe nie" \
  perl -0pi -e 's/^      AND \(\n(        -- Une police Adobe)/      AND NOT (\n$1/m' $C
essai "OR du groupe Adobe devenu AND" \
  perl -0pi -e "s/'adobe'\n        OR EXISTS \(/'adobe'\n        AND EXISTS (/m" $C
essai "ouverture du groupe Adobe polluee" \
  perl -0pi -e 's/^      AND \(\n(        -- Une police Adobe)/      AND (extra\n$1/m' $C

restaurer
echo
echo "$ok attrapees, $rate ratees"
node scripts/quality/check-adobe-migration.mjs
