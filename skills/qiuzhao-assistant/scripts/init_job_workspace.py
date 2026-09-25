#!/usr/bin/env python3
"""Create a non-destructive, Markdown-first job-search workspace scaffold."""

from __future__ import annotations

import argparse
from pathlib import Path


FILES = {
    "00-system/settings.md": """---
type: job-search-settings
schema_version: 1
automation:
  auto_save: ask_each_time
  auto_check: manual
  auto_upload: ask_each_time
  auto_submit: manual_confirmation
  review_level: section_review
privacy:
  public_repo_data_allowed: false
  store_credentials: false
  redact_logs: true
preferences:
  recruitment_types: []
  application_strategy: needs-confirmation
  locations: []
  role_families: []
  industries: []
  hard_constraints: []
  exclusions: []
last_reviewed: ""
---

# Job-search settings

Complete this file during onboarding. Never store passwords, OTPs, API keys, or raw identity documents here.
""",
    "00-system/field-dictionary.md": """# Field dictionary

| Field ID | Label | Type | Source | Status | Sensitivity | Allowed use |
|---|---|---|---|---|---|---|
| `profile.full_name` | Full name | text |  | needs-confirmation | high | application |
| `education.highest_degree` | Highest degree | text |  | needs-confirmation | medium | resume, application |
| `preferences.locations` | Preferred locations | list |  | needs-confirmation | low | screening |

Add a source and verification date before reusing a field. Keep high-sensitivity values private.
""",
    "00-system/changelog.md": """# Changelog

| Date | Action | Record | Evidence | Next action |
|---|---|---|---|---|
""",
    "10-profile/basic-info.md": """---
type: profile
status: needs-confirmation
---

# Basic information

Keep private identity and contact data here. Do not copy this file into a public repository.
""",
    "10-profile/education.md": """---
type: education
status: needs-confirmation
---

# Education

Record institution, degree, major, dates, and any application-specific identifiers only after verification.
""",
    "10-profile/preferences.md": """---
type: preferences
status: needs-confirmation
---

# Search preferences

## Locations

## Role families

## Industries and company types

## Hard constraints and exclusions
""",
    "10-profile/application-fields.md": """---
type: application-field-library
status: needs-confirmation
---

# Reusable application fields

| Field ID | Portal label | Value | Source | Status | Valid until | Notes |
|---|---|---|---|---|---|---|
""",
    "20-experience/experience-index.md": """# Experience index

Link verified project, internship, research, award, and leadership records here.
""",
    "30-materials/master-resume.md": """---
type: master-resume
version: v01
status: draft
---

# Master resume

Keep the canonical resume here or link to a private source file. Create a new version for each materially tailored application.
""",
    "40-companies/company-index.md": """# Company index

Track company-level facts separately from individual job descriptions.
""",
    "50-applications/applications-index.md": """# Applications index

| Company | Role | Location | Status | Applied | Next follow-up | Card |
|---|---|---|---|---|---|---|
""",
    "60-interviews/interview-index.md": """# Interview index

| Company | Role | Round | Date | Status | Preparation note |
|---|---|---|---|---|---|
""",
    "70-reviews/review-index.md": """# Review index

Use this area for weekly reviews, interview debriefs, and evidence-backed improvements.
""",
    ".gitignore": """# Keep personal job-search data out of public repositories.
attachments/
30-materials/attachments/
50-applications/cards/
*.pdf
*.doc
*.docx
*.xls
*.xlsx
*.png
*.jpg
*.jpeg
*.zip
settings.local.md
""",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Create a non-destructive Markdown job-search workspace scaffold."
    )
    parser.add_argument("root", type=Path, help="Specific local folder to initialize")
    parser.add_argument(
        "--dry-run", action="store_true", help="List missing files without creating them"
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    root = args.root.expanduser().resolve()
    user_home = Path.home().resolve()

    if root in {Path("/"), user_home}:
        raise SystemExit("Refusing to initialize a broad system or home directory; choose a specific folder.")

    created = []
    existing = []
    for relative_path, content in FILES.items():
        target = root / relative_path
        if target.exists():
            existing.append(relative_path)
            continue
        if not args.dry_run:
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(content, encoding="utf-8")
        created.append(relative_path)

    action = "Would create" if args.dry_run else "Created"
    print(f"{action} {len(created)} files under {root}")
    for relative_path in created:
        print(f"  + {relative_path}")
    if existing:
        print(f"Left {len(existing)} existing files unchanged")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

