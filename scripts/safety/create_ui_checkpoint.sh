#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

TIMESTAMP="${1:-$(date +"%Y-%m-%d-%H%M%S")}"
CHECKPOINT_DIR="backups/checkpoints/$TIMESTAMP"
FILES_DIR="$CHECKPOINT_DIR/files"
META_DIR="$CHECKPOINT_DIR/meta"

mkdir -p "$FILES_DIR" "$META_DIR"

CRITICAL_FILES=(
  "app/globals.css"
  "app/layout.tsx"
  "app/page.tsx"
  "features/modes/components/ModeSelectPage.tsx"
  "features/game/components/GameScreen.tsx"
  "features/modes/components/ModeRulesPage.tsx"
  "features/onboarding/components/OnboardingFlow.tsx"
  "docs/front-ui-master-spec.md"
  "docs/ui-consistency-contract.md"
  "progress.md"
)

copied_count=0

for file in "${CRITICAL_FILES[@]}"; do
  if [[ -f "$file" ]]; then
    mkdir -p "$FILES_DIR/$(dirname "$file")"
    cp "$file" "$FILES_DIR/$file"
    copied_count=$((copied_count + 1))
  fi
done

{
  echo "timestamp=$TIMESTAMP"
  echo "root=$ROOT_DIR"
  echo "copied_files=$copied_count"
} > "$META_DIR/checkpoint.env"

git rev-parse --abbrev-ref HEAD > "$META_DIR/git-branch.txt" 2>/dev/null || true
git status --short -b > "$META_DIR/git-status.txt" 2>/dev/null || true
git remote -v > "$META_DIR/git-remote.txt" 2>/dev/null || true
git diff -- app/globals.css \
  app/layout.tsx \
  app/page.tsx \
  features/modes/components/ModeSelectPage.tsx \
  features/game/components/GameScreen.tsx \
  features/modes/components/ModeRulesPage.tsx \
  features/onboarding/components/OnboardingFlow.tsx \
  docs/front-ui-master-spec.md \
  docs/ui-consistency-contract.md \
  progress.md > "$META_DIR/critical-files.diff" 2>/dev/null || true
git diff > "$META_DIR/worktree.diff" 2>/dev/null || true
git diff --cached > "$META_DIR/staged.diff" 2>/dev/null || true
git ls-files --others --exclude-standard > "$META_DIR/untracked-files.txt" 2>/dev/null || true

cat > "$META_DIR/README.md" <<EOF
# UI Checkpoint

- Created: $TIMESTAMP
- Root: $ROOT_DIR
- Critical files copied: $copied_count

Contents:
- \`files/\`: point-in-time copies of critical UI files
- \`meta/git-status.txt\`: branch + worktree summary
- \`meta/worktree.diff\`: unstaged diff snapshot
- \`meta/staged.diff\`: staged diff snapshot
- \`meta/critical-files.diff\`: diff limited to high-risk UI files
- \`meta/untracked-files.txt\`: untracked files at checkpoint time
EOF

echo "Checkpoint created: $CHECKPOINT_DIR"
echo "Critical files copied: $copied_count"
