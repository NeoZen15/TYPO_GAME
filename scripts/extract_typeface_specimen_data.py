#!/usr/bin/env python3
"""Extract specimen-oriented metadata from runtime WOFF2 files.

This script extends the existing catalogue/runtime pipeline with the kind of
font metadata a specimen page or interactive type tester needs:
- family/subfamily names
- weight/style records
- glyph and codepoint counts
- variable axes

Usage:
  ./.venv/bin/python scripts/extract_typeface_specimen_data.py
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

from fontTools.ttLib import TTFont


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Extract specimen metadata from runtime WOFF2 fonts")
    parser.add_argument(
        "--manifest",
        default="content/typefaces/font-manifest-v4.json",
        help="Existing runtime manifest JSON",
    )
    parser.add_argument(
        "--public-root",
        default="public",
        help="Root directory used to resolve runtime paths",
    )
    parser.add_argument(
        "--output",
        default="content/typography/generated/font-specimen-data.json",
        help="Output JSON path",
    )
    return parser.parse_args()


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def boolish_italic(font: TTFont, subfamily: str | None) -> bool:
    if subfamily and "italic" in subfamily.lower():
        return True
    if "post" in font and getattr(font["post"], "italicAngle", 0) != 0:
        return True
    if "OS/2" in font:
        return bool(font["OS/2"].fsSelection & 0b1)
    return False


def collect_codepoints(font: TTFont) -> list[int]:
    cmap = font.getBestCmap() or {}
    return sorted(int(codepoint) for codepoint in cmap.keys())


def extract_font_record(font_path: Path) -> dict[str, Any]:
    font = TTFont(font_path)
    name_table = font["name"]
    family_name = name_table.getDebugName(1)
    subfamily_name = name_table.getDebugName(2)
    postscript_name = name_table.getDebugName(6)
    weight = font["OS/2"].usWeightClass if "OS/2" in font else 400
    codepoints = collect_codepoints(font)
    axes: list[dict[str, Any]] = []

    if "fvar" in font:
        axes = [
            {
                "tag": axis.axisTag,
                "name": axis.axisNameID and name_table.getDebugName(axis.axisNameID),
                "min": axis.minValue,
                "default": axis.defaultValue,
                "max": axis.maxValue,
            }
            for axis in font["fvar"].axes
        ]

    return {
        "file": str(font_path),
        "familyName": family_name,
        "subfamilyName": subfamily_name,
        "postscriptName": postscript_name,
        "weight": weight,
        "italic": boolish_italic(font, subfamily_name),
        "isVariable": "fvar" in font,
        "axes": axes,
        "glyphCount": len(font.getGlyphOrder()),
        "codepointCount": len(codepoints),
        "sampleCodepoints": codepoints[:48],
    }


def main() -> None:
    args = parse_args()
    manifest_path = Path(args.manifest).resolve()
    public_root = Path(args.public_root).resolve()
    output_path = Path(args.output).resolve()

    if not manifest_path.exists():
        raise SystemExit(f"Manifest not found: {manifest_path}")
    if not public_root.exists():
        raise SystemExit(f"Public root not found: {public_root}")

    manifest = load_json(manifest_path)
    fonts = manifest.get("fonts", [])

    records: list[dict[str, Any]] = []
    for font in fonts:
        runtime_files = font.get("runtimeFiles") or []
        style_records: list[dict[str, Any]] = []

        for runtime_path in runtime_files:
            absolute_path = public_root / runtime_path.lstrip("/")
            if not absolute_path.exists():
                continue
            style_records.append(extract_font_record(absolute_path))

        unique_axes = []
        seen_axis_tags: set[str] = set()
        for record in style_records:
            for axis in record["axes"]:
                tag = axis["tag"]
                if tag in seen_axis_tags:
                    continue
                seen_axis_tags.add(tag)
                unique_axes.append(axis)

        weights = sorted({record["weight"] for record in style_records})
        glyph_count = max((record["glyphCount"] for record in style_records), default=0)
        codepoint_count = max((record["codepointCount"] for record in style_records), default=0)

        records.append(
            {
                "slug": font["slug"],
                "displayName": font.get("displayName"),
                "fontSource": font.get("fontSource"),
                "assetStatus": font.get("assetStatus"),
                "runtimePath": font.get("runtimePath"),
                "runtimeFiles": runtime_files,
                "styleCount": len(style_records),
                "weights": weights,
                "glyphCount": glyph_count,
                "codepointCount": codepoint_count,
                "isVariable": any(record["isVariable"] for record in style_records),
                "axes": unique_axes,
                "styles": style_records,
            }
        )

    payload = {
        "meta": {
            "sourceManifest": str(manifest_path),
            "publicRoot": str(public_root),
            "generator": "scripts/extract_typeface_specimen_data.py",
        },
        "records": records,
    }
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote specimen data: {output_path}")
    print(f"Records: {len(records)}")


if __name__ == "__main__":
    main()
