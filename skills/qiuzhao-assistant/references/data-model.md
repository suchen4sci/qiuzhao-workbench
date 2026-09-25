# Portable Data Model

Use Markdown with YAML frontmatter so the workspace works in Obsidian and in an ordinary local folder. Keep the model small enough for a person to inspect and edit by hand.

## Recommended workspace layout

```text
job-search-workspace/
├── 00-system/
│   ├── settings.md
│   ├── field-dictionary.md
│   └── changelog.md
├── 10-profile/
│   ├── basic-info.md
│   ├── education.md
│   ├── preferences.md
│   └── application-fields.md
├── 20-experience/
│   ├── experience-index.md
│   ├── projects/
│   ├── internships/
│   ├── research/
│   └── awards/
├── 30-materials/
│   ├── master-resume.md
│   ├── tailored/
│   └── attachments/
├── 40-companies/
│   ├── company-index.md
│   └── jd/
├── 50-applications/
│   ├── applications-index.md
│   └── cards/
├── 60-interviews/
├── 70-reviews/
└── .gitignore
```

When an existing vault uses another structure, map concepts rather than forcing these names. A useful mapping is more important than folder uniformity.

## Field record

Every reusable field should have a source and verification state. For sensitive fields, store the value only in the private workspace and never echo it into a public log.

```yaml
field_id: education.highest_degree
label: Highest degree
value: ""
value_type: text
source: "path/to/private/source"
status: needs-confirmation
verified_at: ""
expires_at: ""
sensitivity: medium
allowed_use: [resume, application]
notes: ""
```

Use these status values consistently:

- `confirmed`: backed by a source and checked by the user;
- `user-confirmed`: explicitly supplied or corrected by the user;
- `source-verified`: checked against an official source or document;
- `needs-confirmation`: a plausible candidate value that must be reviewed;
- `unknown`: no safe value is available;
- `expired`: previously valid but no longer safe to reuse.

Never turn an empty field into a plausible value. For public examples, use `REDACTED`, `EXAMPLE`, or an empty value.

## Experience record

Store atomic experience blocks instead of only one polished resume paragraph. This makes JD-specific tailoring auditable.

```yaml
---
type: experience
experience_id: project.example
title: Example project
experience_kind: project | internship | research | award | leadership
period: "YYYY-MM to YYYY-MM"
role: ""
status: confirmed
source_files: []
skills: []
industries: []
evidence: []
last_reviewed: YYYY-MM-DD
---
```

The body should separate context, the user's actual contribution, methods/tools, verified results, limitations, and interview-safe wording. Do not create numeric impact unless the user or a source confirms it.

## Company, JD, and application records

Use one company record for company-level facts, one JD record per role or campaign, and one application card per actual application path. Reuse existing cards and preserve aliases when a portal uses a different campaign name.

```yaml
---
type: application
company: ""
campaign: ""
role: ""
location: ""
source_url: ""
jd_url: ""
source_checked_at: YYYY-MM-DD
status: screening
priority: ""
resume_version: ""
positioning: ""
applied_at: ""
deadline: ""
next_follow_up: ""
evidence_state: needs-confirmation
---
```

Recommended sections:

```markdown
## Selection
| Priority | Role | Location | Fit | Trade-off | Evidence gap | Decision |
|---|---|---|---|---|---|---|

## JD evidence

## Tailoring map
| JD requirement | Source experience | Resume change | Evidence state |
|---|---|---|---|

## Form summary
| Section | Filled | Intentionally omitted | Needs user |
|---|---|---|---|

## Timeline
| Date | Event | Status | Source/evidence | Next action |
|---|---|---|---|---|

## Follow-up

## Open questions
```

## Status vocabulary

Use a controlled vocabulary but allow a portal's exact wording in `source_status`:

`screening`, `shortlisted`, `needs-login`, `draft-filled`, `draft-saved`, `submitted`, `assessment-complete`, `interview-scheduled`, `interview-complete`, `offer`, `offer-approval`, `rejected`, `withdrawn`, `closed`, `skipped`, `blocked`, `needs-confirmation`.

The canonical status must describe the latest evidenced stage. Keep the raw portal label separately if it is ambiguous. Never infer `submitted` from a filled page or `offer` from an interview invitation.

## Changelog and privacy

The private changelog records date, action, affected record, evidence, and next action. Redact values, filenames, IDs, and contact details in any log copied into a public issue or repository. Do not commit the user's workspace, attachments, browser exports, or generated application cards to the public skill repository.

## Version, attachment, adapter, and interview records

The advanced feature records below are intentionally separate from the public skill package. They belong in the user's private workspace.

### Resume/material version

```yaml
---
type: material-version
material_id: resume
version_id: resume-YYYY-MM-DD-target-v01
parent_version: ""
source_path: ""
target_jd: ""
created_at: YYYY-MM-DD
content_hash: ""
status: active | superseded | archived
---
```

Keep the original source unchanged. A rollback creates a new output/version derived from the selected historical version; it does not erase the version history.

### Attachment manifest row

```yaml
attachment_id: attachment-YYYYMMDD-001
file_name: ""
file_path: ""
kind: resume | photo | transcript | certificate | portfolio | other
version_id: ""
content_hash: ""
target_portal: ""
employer: ""
campaign: ""
role: ""
upload_status: not-uploaded | prepared | uploaded | rejected | needs-confirmation
uploaded_at: ""
upload_evidence: ""
```

The target is part of the record because the same file can be safe for one application and wrong for another. Never mark `uploaded` without visible portal evidence.

### Portal adapter

Adapters contain UI knowledge only: label aliases, field types, dependencies, and known quirks. They must not contain a person's answer values, credentials, cookies, or application history.

```yaml
adapter_id: portal.example.com
domain: example.com
scope: domain | campaign
verified_at: YYYY-MM-DD
label_aliases:
  full_name: ["Full name", "Name"]
field_rules:
  - canonical_field: education.school
    control: searchable-select
    requires_visible_and_hidden_value_check: true
known_quirks: []
```

### Interview preparation pack

```yaml
---
type: interview-pack
pack_id: interview-YYYY-MM-DD-company-role-v01
company: ""
role: ""
jd_source: ""
resume_version: ""
experience_sources: []
created_at: YYYY-MM-DD
status: draft | reviewed | archived
---
```

The body should include a role summary, 60–90 second introduction, requirement-to-evidence map, likely question families, project deep dives, gap handling, truthful boundary notes, questions to ask, and a review checklist.
