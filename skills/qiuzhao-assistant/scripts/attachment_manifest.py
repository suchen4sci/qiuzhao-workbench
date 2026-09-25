#!/usr/bin/env python3
"""Record private attachment metadata without uploading anything."""

from __future__ import annotations

import argparse
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path


def file_hash(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def load_entries(path: Path) -> list[dict]:
    if not path.exists():
        return []
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, list):
        raise SystemExit(f"Manifest must contain a JSON list: {path}")
    return data


def save_entries(path: Path, entries: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(entries, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def record(args: argparse.Namespace) -> int:
    source = args.file.expanduser().resolve()
    manifest = args.manifest.expanduser().resolve()
    if not source.is_file():
        raise SystemExit(f"Attachment not found: {source}")
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    entries = load_entries(manifest)
    attachment_id = f"attachment-{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}-{len(entries)+1:03d}"
    entry = {
        "attachment_id": attachment_id,
        "file_name": source.name,
        "file_path": str(source),
        "kind": args.kind,
        "version_id": args.version_id,
        "content_hash": file_hash(source),
        "target_portal": args.target_portal,
        "employer": args.employer,
        "campaign": args.campaign,
        "role": args.role,
        "upload_status": "prepared",
        "prepared_at": now,
        "uploaded_at": "",
        "upload_evidence": "",
    }
    entries.append(entry)
    save_entries(manifest, entries)
    print(json.dumps(entry, ensure_ascii=False, indent=2))
    return 0


def verify(args: argparse.Namespace) -> int:
    manifest = args.manifest.expanduser().resolve()
    entries = load_entries(manifest)
    matches = [entry for entry in entries if entry.get("attachment_id") == args.attachment_id]
    if not matches:
        raise SystemExit(f"Attachment not found: {args.attachment_id}")
    entry = matches[0]
    source = Path(str(entry.get("file_path", ""))).expanduser()
    if not source.is_file():
        raise SystemExit(f"Attachment file missing: {source}")
    current_hash = file_hash(source)
    expected_hash = entry.get("content_hash")
    print(f"Expected hash: {expected_hash}")
    print(f"Current hash:  {current_hash}")
    if current_hash != expected_hash:
        raise SystemExit("Attachment changed since it was recorded.")
    print(f"Hash verified for {args.attachment_id}")
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    subparsers = parser.add_subparsers(dest="command", required=True)

    record_parser = subparsers.add_parser("record", help="Record a prepared attachment")
    record_parser.add_argument("file", type=Path)
    record_parser.add_argument("--manifest", required=True, type=Path)
    record_parser.add_argument("--kind", default="other")
    record_parser.add_argument("--version-id", default="")
    record_parser.add_argument("--target-portal", required=True)
    record_parser.add_argument("--employer", required=True)
    record_parser.add_argument("--campaign", default="")
    record_parser.add_argument("--role", required=True)
    record_parser.set_defaults(handler=record)

    verify_parser = subparsers.add_parser("verify", help="Verify a recorded attachment hash")
    verify_parser.add_argument("--manifest", required=True, type=Path)
    verify_parser.add_argument("--attachment-id", required=True)
    verify_parser.set_defaults(handler=verify)
    return parser


def main() -> int:
    args = build_parser().parse_args()
    return args.handler(args)


if __name__ == "__main__":
    raise SystemExit(main())

