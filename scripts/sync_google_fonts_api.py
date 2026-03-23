"""
sync_google_fonts_api.py

Pull metadata from the official Google Fonts Developer API and compare it against the
local JEUX DE TYPO catalog.

This script is intentionally metadata-only:
- it does not change the main catalog,
- it does not mirror runtime assets,
- it does not try to replace the existing snapshot-based pipeline.

It acts as an external radar for:
- newly available Google Fonts families,
- families that disappeared from the public API,
- metadata changes since the previous API sync,
- local/runtime status of families already known by the catalog.

Official docs:
- https://developers.google.com/fonts/docs/developer_api
- https://developers.google.com/fonts/docs/css2
- https://developers.google.com/fonts/faq/privacy

Usage:
    .venv/bin/python scripts/sync_google_fonts_api.py \
      --catalog-dir content/catalog \
      --output-dir content/catalog/google-api-sync

With explicit API key:
    .venv/bin/python scripts/sync_google_fonts_api.py \
      --api-key "$GOOGLE_FONTS_API_KEY"

Offline test mode:
    .venv/bin/python scripts/sync_google_fonts_api.py \
      --catalog-dir content/catalog \
      --output-dir content/catalog/google-api-sync \
      --input-json /path/to/webfonts-api-response.json
"""

from __future__ import annotations

import argparse
import json
import os
import re
import unicodedata
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import urlopen

API_URL = "https://www.googleapis.com/webfonts/v1/webfonts"
DEFAULT_CATALOG_DIR = Path("content/catalog")
DEFAULT_OUTPUT_DIR = Path("content/catalog/google-api-sync")
SNAPSHOT_FILENAME = "google-api-snapshot.json"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Sync Google Fonts Developer API metadata into local reports.")
    parser.add_argument("--catalog-dir", default=str(DEFAULT_CATALOG_DIR))
    parser.add_argument("--output-dir", default=str(DEFAULT_OUTPUT_DIR))
    parser.add_argument("--api-key", help="Google Fonts Developer API key. Defaults to GOOGLE_FONTS_API_KEY env var.")
    parser.add_argument("--input-json", help="Offline mode: read a saved Developer API JSON response instead of calling the API.")
    parser.add_argument("--sort", choices=("alpha", "date", "popularity", "style", "trending"), default="alpha")
    parser.add_argument("--family")
    parser.add_argument("--subset")
    parser.add_argument("--category", choices=("serif", "sans-serif", "monospace", "display", "handwriting"))
    parser.add_argument(
        "--capability",
        action="append",
        choices=("WOFF2", "VF", "FAMILY_TAGS"),
        help="Repeatable Developer API capability flag.",
    )
    parser.add_argument("--timeout", type=int, default=20)
    return parser.parse_args()


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=True) + "\n", encoding="utf-8")


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def normalize_ascii(value: str) -> str:
    normalized = unicodedata.normalize("NFD", value)
    normalized = "".join(ch for ch in normalized if unicodedata.category(ch) != "Mn")
    return "".join(ch for ch in normalized.lower() if ch.isalnum())


def camel_to_snake(value: str) -> str:
    first_pass = re.sub(r"(.)([A-Z][a-z]+)", r"\1_\2", value)
    second_pass = re.sub(r"([a-z0-9])([A-Z])", r"\1_\2", first_pass)
    second_pass = re.sub(r"[^A-Za-z0-9]+", "_", second_pass)
    return re.sub(r"_+", "_", second_pass).strip("_").lower()


def family_to_slug(family_name: str) -> str:
    return camel_to_snake(family_name)


def normalized_slug_key(value: str) -> str:
    return normalize_ascii(value.replace("_", " "))


def build_request_url(args: argparse.Namespace, api_key: str) -> str:
    params: list[tuple[str, str]] = [("key", api_key), ("sort", args.sort)]
    if args.family:
        params.append(("family", args.family))
    if args.subset:
        params.append(("subset", args.subset))
    if args.category:
        params.append(("category", args.category))
    for capability in args.capability or []:
        params.append(("capability", capability))
    return f"{API_URL}?{urlencode(params, doseq=True)}"


def fetch_api_payload(args: argparse.Namespace) -> dict[str, Any]:
    if args.input_json:
        return load_json(Path(args.input_json).expanduser().resolve())

    api_key = args.api_key or os.getenv("GOOGLE_FONTS_API_KEY")
    if not api_key:
        raise SystemExit("Missing Google Fonts API key. Provide --api-key or set GOOGLE_FONTS_API_KEY.")

    url = build_request_url(args, api_key)
    try:
        with urlopen(url, timeout=args.timeout) as response:  # nosec B310 - official public API URL
            return json.loads(response.read().decode("utf-8"))
    except HTTPError as error:
        body = error.read().decode("utf-8", errors="ignore").strip()
        hint = "Google Fonts Developer API request failed."
        if error.code in {400, 403}:
            hint += " Check that GOOGLE_FONTS_API_KEY is a real key and that the Web Fonts Developer API is enabled for that project."
        raise SystemExit(f"{hint} HTTP {error.code}. URL: {url}\n{body}") from error
    except URLError as error:
        raise SystemExit(f"Google Fonts Developer API request failed: network error: {error}") from error


def load_catalog(catalog_dir: Path) -> tuple[dict[str, dict[str, Any]], dict[str, dict[str, Any]], set[str]]:
    typefaces_payload = load_json(catalog_dir / "typefaces-core.json")
    runtime_payload = load_json(catalog_dir / "font-runtime-assets.json")

    typefaces_by_slug = {record["typeface_slug"]: record for record in typefaces_payload["records"]}
    runtime_ready_slugs = {
        record["typeface_slug"]
        for record in runtime_payload["records"]
        if record.get("runtime_status") == "ready"
    }
    aliases = {normalized_slug_key(slug): slug for slug in typefaces_by_slug}
    return typefaces_by_slug, {slug: typefaces_by_slug[slug] for slug in typefaces_by_slug}, runtime_ready_slugs | set(aliases.values())


def build_runtime_ready_set(catalog_dir: Path) -> set[str]:
    runtime_payload = load_json(catalog_dir / "font-runtime-assets.json")
    return {
        record["typeface_slug"]
        for record in runtime_payload["records"]
        if record.get("runtime_status") == "ready"
    }


def build_catalog_aliases(typefaces_by_slug: dict[str, dict[str, Any]]) -> dict[str, str]:
    return {normalized_slug_key(slug): slug for slug in typefaces_by_slug}


def normalize_api_item(item: dict[str, Any], index: int) -> dict[str, Any]:
    family = item["family"]
    slug = family_to_slug(family)
    files = item.get("files") or {}
    axes = item.get("axes") or []
    tags = item.get("tags") or []
    return {
        "api_rank": index + 1,
        "family": family,
        "typeface_slug": slug,
        "normalized_slug_key": normalized_slug_key(slug),
        "category": item.get("category"),
        "version": item.get("version"),
        "last_modified": item.get("lastModified"),
        "variants": item.get("variants") or [],
        "subsets": item.get("subsets") or [],
        "files": files,
        "file_variant_count": len(files),
        "menu": item.get("menu"),
        "axes": axes,
        "axes_count": len(axes),
        "tags": tags,
        "tags_count": len(tags),
        "color_capabilities": item.get("color_capabilities") or [],
    }


def changed_fields(previous: dict[str, Any], current: dict[str, Any]) -> list[str]:
    tracked = [
        "category",
        "version",
        "last_modified",
        "file_variant_count",
        "axes_count",
        "tags_count",
        "variants",
        "subsets",
    ]
    return [field for field in tracked if previous.get(field) != current.get(field)]


def main() -> None:
    args = parse_args()
    catalog_dir = Path(args.catalog_dir).expanduser().resolve()
    output_dir = Path(args.output_dir).expanduser().resolve()
    output_dir.mkdir(parents=True, exist_ok=True)

    api_payload = fetch_api_payload(args)
    items = api_payload.get("items") or []
    if not isinstance(items, list):
        raise SystemExit("Invalid Google Fonts Developer API payload: missing items list")

    typefaces_payload = load_json(catalog_dir / "typefaces-core.json")
    typefaces_by_slug = {record["typeface_slug"]: record for record in typefaces_payload["records"]}
    catalog_aliases = build_catalog_aliases(typefaces_by_slug)
    runtime_ready_slugs = build_runtime_ready_set(catalog_dir)

    previous_snapshot_path = output_dir / SNAPSHOT_FILENAME
    previous_snapshot = load_json(previous_snapshot_path) if previous_snapshot_path.exists() else {"records": []}
    previous_by_slug = {record["typeface_slug"]: record for record in previous_snapshot.get("records", [])}

    normalized_records: list[dict[str, Any]] = []
    known_families: list[dict[str, Any]] = []
    new_to_local: list[dict[str, Any]] = []
    changed_since_last_sync: list[dict[str, Any]] = []
    current_api_slugs: set[str] = set()

    for index, item in enumerate(items):
        normalized = normalize_api_item(item, index)
        normalized_records.append(normalized)
        slug = normalized["typeface_slug"]
        current_api_slugs.add(slug)

        matched_slug = slug if slug in typefaces_by_slug else catalog_aliases.get(normalized["normalized_slug_key"])
        previous = previous_by_slug.get(slug)

        if previous is not None:
            diffs = changed_fields(previous, normalized)
            if diffs:
                changed_since_last_sync.append(
                    {
                        "typeface_slug": slug,
                        "family": normalized["family"],
                        "changed_fields": diffs,
                        "previous": {field: previous.get(field) for field in diffs},
                        "current": {field: normalized.get(field) for field in diffs},
                    }
                )

        if matched_slug:
            local = typefaces_by_slug[matched_slug]
            known_families.append(
                {
                    "api_family": normalized["family"],
                    "api_slug": slug,
                    "catalog_slug": matched_slug,
                    "matched_by": "exact" if matched_slug == slug else "normalized_alias",
                    "api_rank": normalized["api_rank"],
                    "api_category": normalized["category"],
                    "api_version": normalized["version"],
                    "api_last_modified": normalized["last_modified"],
                    "local_activation_status": bool(local.get("activation_status")),
                    "local_expert_enabled": bool(local.get("expert_enabled")),
                    "local_qa_status": local.get("qa_status"),
                    "local_primary_category": local.get("primary_category"),
                    "local_runtime_ready": matched_slug in runtime_ready_slugs,
                }
            )
        else:
            new_to_local.append(
                {
                    "api_family": normalized["family"],
                    "typeface_slug": slug,
                    "api_rank": normalized["api_rank"],
                    "category": normalized["category"],
                    "version": normalized["version"],
                    "last_modified": normalized["last_modified"],
                    "variants": normalized["variants"],
                    "subsets": normalized["subsets"],
                    "axes_count": normalized["axes_count"],
                    "tags_count": normalized["tags_count"],
                }
            )

    missing_from_api: list[dict[str, Any]] = []
    for slug, local in sorted(typefaces_by_slug.items()):
        if local.get("font_source") != "google":
            continue
        local_key = normalized_slug_key(slug)
        if slug in current_api_slugs or local_key in {record["normalized_slug_key"] for record in normalized_records}:
            continue
        missing_from_api.append(
            {
                "catalog_slug": slug,
                "display_name": local.get("display_name"),
                "activation_status": bool(local.get("activation_status")),
                "expert_enabled": bool(local.get("expert_enabled")),
                "qa_status": local.get("qa_status"),
            }
        )

    meta = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source": "google_fonts_developer_api" if not args.input_json else "google_fonts_developer_api_saved_payload",
        "request": {
            "sort": args.sort,
            "family": args.family,
            "subset": args.subset,
            "category": args.category,
            "capabilities": args.capability or [],
            "input_json": args.input_json,
            "api_url": None if args.input_json else build_request_url(args, args.api_key or os.getenv("GOOGLE_FONTS_API_KEY") or "REDACTED"),
        },
        "counts": {
            "api_family_total": len(normalized_records),
            "known_local_total": len(known_families),
            "new_to_local_total": len(new_to_local),
            "missing_from_api_total": len(missing_from_api),
            "changed_since_last_sync_total": len(changed_since_last_sync),
            "known_local_active_total": sum(1 for record in known_families if record["local_activation_status"]),
            "known_local_runtime_ready_total": sum(1 for record in known_families if record["local_runtime_ready"]),
        },
        "notes": [
            "Developer API is used here as an external metadata radar, not as the core runtime source.",
            "CSS/Web API is intentionally not used as the primary game runtime because the active subset is self-hosted and controlled locally.",
            "If you self-host the runtime subset, end-user browser requests do not go to Google Fonts servers.",
        ],
    }

    write_json(previous_snapshot_path, {"meta": meta, "records": normalized_records})
    write_json(output_dir / "sync-meta.json", meta)
    write_json(output_dir / "known-families.json", {"meta": meta, "records": known_families})
    write_json(output_dir / "new-to-local.json", {"meta": meta, "records": new_to_local})
    write_json(output_dir / "missing-from-api.json", {"meta": meta, "records": missing_from_api})
    write_json(output_dir / "changed-since-last-sync.json", {"meta": meta, "records": changed_since_last_sync})

    print(
        json.dumps(
            {
                "output_dir": str(output_dir),
                "api_family_total": len(normalized_records),
                "known_local_total": len(known_families),
                "new_to_local_total": len(new_to_local),
                "missing_from_api_total": len(missing_from_api),
                "changed_since_last_sync_total": len(changed_since_last_sync),
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
