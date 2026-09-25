#!/usr/bin/env python3
"""Create immutable resume/material snapshots and restore them safely."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
from datetime import datetime, timezone
from pathlib import Path


MANIFEST_NAME = "versions.json"


def slug(value: str) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9]+", "-", value.strip()).strip("-").lower()
    return cleaned or "material"


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def read_manifest(store: Path) -> list[dict]:
    manifest = store / MANIFEST_NAME
    if not manifest.exists():
        return []
    data = json.loads(manifest.read_text(encoding="utf-8"))
    if not isinstance(data, list):
        raise SystemExit(f"Manifest must contain a JSON list: {manifest}")
    return data


def write_manifest(store: Path, entries: list[dict]) -> None:
    manifest = store / MANIFEST_NAME
    manifest.write_text(
        json.dumps(entries, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )


def snapshot(args: argparse.Namespace) -> int:
    source = args.source.expanduser().resolve()
    store = args.store.expanduser().resolve()
    if not source.is_file():
        raise SystemExit(f"Source file not found: {source}")
    if store == Path("/") or store == Path.home().resolve():
        raise SystemExit("Choose a specific private version folder.")

    store.mkdir(parents=True, exist_ok=True)
    created_at = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    version_id = f"resume-{created_at}-{slug(args.target)}-v01"
    destination = store / f"{version_id}{source.suffix}"
    counter = 1
    while destination.exists():
        counter += 1
        version_id = f"resume-{created_at}-{slug(args.target)}-v{counter:02d}"
        destination = store / f"{version_id}{source.suffix}"

    shutil.copy2(source, destination)
    entries = read_manifest(store)
    entry = {
        "version_id": version_id,
        "parent_version": args.parent_version,
        "source_path": str(source),
        "target": args.target,
        "created_at": created_at,
        "content_hash": sha256(destination),
        "file_name": destination.name,
        "status": "active",
    }
    entries.append(entry)
    write_manifest(store, entries)
    print(json.dumps(entry, ensure_ascii=False, indent=2))
    return 0


def list_versions(args: argparse.Namespace) -> int:
    store = args.store.expanduser().resolve()
    entries = read_manifest(store)
    if not entries:
        print("No versions recorded.")
        return 0
    for entry in entries:
        print(
            f"{entry.get('version_id', '')}\t{entry.get('status', '')}\t"
            f"{entry.get('target', '')}\t{entry.get('file_name', '')}"
        )
    return 0


def restore(args: argparse.Namespace) -> int:
    store = args.store.expanduser().resolve()
    output = args.output.expanduser().resolve()
    entries = read_manifest(store)
    matches = [entry for entry in entries if entry.get("version_id") == args.version]
    if not matches:
        raise SystemExit(f"Version not found: {args.version}")
    entry = matches[0]
    source = store / str(entry.get("file_name", ""))
    if not source.is_file():
        raise SystemExit(f"Version file missing: {source}")
    if output.exists() and not args.overwrite:
        raise SystemExit(
            f"Output exists: {output}; choose a new path or pass --overwrite after confirmation."
        )
    if output == Path("/") or output == Path.home().resolve():
        raise SystemExit("Choose a specific output file.")
    output.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, output)
    print(f"Restored {args.version} to {output}")
    print(f"Content hash: {sha256(output)}")
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    subparsers = parser.add_subparsers(dest="command", required=True)

    snapshot_parser = subparsers.add_parser("snapshot", help="Create a new immutable snapshot")
    snapshot_parser.add_argument("source", type=Path)
    snapshot_parser.add_argument("--store", required=True, type=Path)
    snapshot_parser.add_argument("--target", required=True, help="Role family or JD label")
    snapshot_parser.add_argument("--parent-version", default="")
    snapshot_parser.set_defaults(handler=snapshot)

    list_parser = subparsers.add_parser("list", help="List recorded versions")
    list_parser.add_argument("store", type=Path)
    list_parser.set_defaults(handler=list_versions)

    restore_parser = subparsers.add_parser("restore", help="Copy a selected version to a new path")
    restore_parser.add_argument("store", type=Path)
    restore_parser.add_argument("--version", required=True)
    restore_parser.add_argument("--output", required=True, type=Path)
    restore_parser.add_argument("--overwrite", action="store_true")
    restore_parser.set_defaults(handler=restore)
    return parser


def main() -> int:
    args = build_parser().parse_args()
    return args.handler(args)


if __name__ == "__main__":
    raise SystemExit(main())

