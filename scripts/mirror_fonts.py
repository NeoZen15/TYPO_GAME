"""
mirror_fonts.py
JEUX DE TYPO -- mirror WOFF2 assets into public/fonts and update manifest paths.

This script reads the current font manifest structure:
{
  "meta": {...},
  "summary": {...},
  "fonts": [
    {
      "slug": "roboto",
      "assetStatus": "mapped",
      "woff2Files": ["roboto__abc.woff2", ...]
    }
  ]
}

It copies mapped Google WOFF2 files from a flat source directory into:
    public/fonts/<slug>/<filename>.woff2

Then it updates each manifest font entry with:
- runtimeFiles: list[str] of browser paths
- runtimePath: first browser path, used as the V1 canonical asset

Usage:
    python scripts/mirror_fonts.py \
      --manifest content/typefaces/font-manifest-v4.json \
      --source /abs/path/to/01_woff2 \
      --dest public/fonts \
      --dry-run
"""

from __future__ import annotations

import argparse
import json
import shutil
import sys
from pathlib import Path

# Basic Latin lowercase a-z. A runtime split must cover these to render Latin words.
_BASIC_LATIN_LOWER = tuple(range(ord("a"), ord("z") + 1))


def covers_basic_latin(path: Path) -> bool:
    """Return True if the woff2 at *path* has cmap entries for every a-z glyph.

    Google multi-split families are content-hash named, so sorted()[0] can be a
    NON-Latin fragment (Cyrillic/Greek/Vietnamese-only, etc.). Choosing such a
    split as runtimePath makes the whole typeface render in the browser fallback
    serif, which is fatal for a typeface-recognition game. We probe the cmap so
    runtimePath can be pinned to a split that actually carries Latin letters.
    Any read error returns False so the caller falls back to legacy behaviour.
    """
    try:
        from fontTools.ttLib import TTFont

        cmap = TTFont(str(path), lazy=True).getBestCmap() or {}
        return all(cp in cmap for cp in _BASIC_LATIN_LOWER)
    except Exception:
        return False


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Mirror WOFF2 files into public/fonts and update manifest runtime paths."
    )
    parser.add_argument("--manifest", required=True, help="Path to font-manifest JSON")
    parser.add_argument("--source", required=True, help="Flat source directory containing .woff2")
    parser.add_argument("--dest", required=True, help="Destination directory (ex: public/fonts)")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Preview copies without writing anything",
    )
    return parser.parse_args()


def load_manifest(path: Path) -> dict:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        print(f"ERREUR : manifest introuvable: {path}")
        sys.exit(1)
    except json.JSONDecodeError as exc:
        print(f"ERREUR : manifest JSON invalide: {exc}")
        sys.exit(1)

    fonts = payload.get("fonts")
    if not isinstance(fonts, list):
        print("ERREUR : structure de manifest invalide, liste 'fonts' absente")
        sys.exit(1)

    return payload


def main() -> None:
    args = parse_args()
    manifest_path = Path(args.manifest).expanduser().resolve()
    source_root = Path(args.source).expanduser().resolve()
    dest_root = Path(args.dest).expanduser().resolve()

    if not source_root.exists():
        print(f"ERREUR : dossier source introuvable: {source_root}")
        sys.exit(1)

    manifest = load_manifest(manifest_path)
    fonts = manifest["fonts"]

    copied = 0
    skipped_system_local = 0
    skipped_unmapped = 0
    missing: list[str] = []

    for entry in fonts:
        slug = str(entry.get("slug", "")).strip()
        asset_status = str(entry.get("assetStatus", "")).strip()
        woff2_files = [str(name).strip() for name in entry.get("woff2Files") or [] if str(name).strip()]

        if not slug:
            missing.append("missing-slug-entry")
            continue

        if asset_status == "system_local":
            skipped_system_local += 1
            continue

        if asset_status != "mapped":
            skipped_unmapped += 1
            continue

        if not woff2_files:
            missing.append(f"{slug}: no woff2Files in manifest")
            continue

        runtime_files: list[str] = []
        # browser_path -> source file, so we can probe Latin coverage below.
        runtime_pairs: list[tuple[str, Path]] = []

        for filename in sorted(woff2_files):
            src = source_root / filename
            dst = dest_root / slug / filename

            if not src.exists():
                missing.append(f"{slug}/{filename}")
                continue

            browser_path = f"/fonts/{slug}/{filename}"
            runtime_files.append(browser_path)
            runtime_pairs.append((browser_path, src))

            if args.dry_run:
                print(f"[DRY] {src} -> {dst}")
            else:
                dst.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(src, dst)

            copied += 1

        if runtime_files:
            # HARDENING: pin runtimePath to the first split that COVERS basic Latin
            # (a-z), not sorted()[0]. For multi-split Google families the lowest-hash
            # split is often a non-Latin fragment, which would render the typeface as
            # the browser fallback serif. Fall back to sorted()[0] only when no split
            # covers Latin (genuinely non-Latin faces). We also float the chosen split
            # to runtimeFiles[0] so the runtimePath == runtimeFiles[0] invariant holds.
            canonical = next(
                (bp for bp, src in runtime_pairs if covers_basic_latin(src)),
                runtime_files[0],
            )
            entry["runtimeFiles"] = [canonical] + [
                bp for bp in runtime_files if bp != canonical
            ]
            entry["runtimePath"] = canonical

    print("\nResultat :")
    print(f"  Copiees               : {copied}")
    print(f"  Sautees system_local  : {skipped_system_local}")
    print(f"  Sautees unmapped      : {skipped_unmapped}")
    if missing:
        print(f"  Manquants             : {len(missing)}")
        for item in missing[:20]:
            print(f"    {item}")

    if not args.dry_run:
        manifest_path.write_text(
            json.dumps(manifest, indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8",
        )
        print(f"\nManifest mis a jour : {manifest_path}")

    if missing:
        sys.exit(1)


if __name__ == "__main__":
    main()
