# Onboarding and Workspace Setup

Read this reference for the first use, migration, or any request to create a job-search database.

## 1. Choose the data boundary

Offer three paths and let the user choose:

| Option | Use when | Rule |
|---|---|---|
| Existing Obsidian vault | The user already has a job-search vault | Reuse its index, folders, templates, and log. Do not duplicate notes. |
| Existing Markdown folder | The user has local notes but not an Obsidian vault | Add only the missing scaffold and keep the user's naming conventions. |
| New local workspace | The user is starting from zero | Run `scripts/init_job_workspace.py <path>` and create the portable Markdown structure. |

Do not silently scan the user's home directory. Ask for a specific folder or use the current workspace only when the user clearly authorizes it. Keep source resumes and attachments outside the public skill repository. If a source file is inside the repository, recommend moving it to a private workspace before continuing.

## 2. First-use questions

Ask these questions once, then store the answers in the private `00-system/settings.md` file. If an answer is unavailable, write `needs-confirmation` rather than guessing.

### Profile and search scope

- What graduation year/window and degree level should be used for eligibility checks?
- Which locations, role families, industries, work modes, and company types are preferred?
- Which are hard constraints or exclusions: location, travel, shift work, salary, sponsorship, clearance, or employment status?
- Which files are authoritative for the master resume, education, projects, certificates, publications, awards, and attachments?
- Should the system use a single master resume, multiple language versions, or an existing resume library?

### Automation preferences

Ask separately; do not collapse these into one “automation on/off” switch.

| Setting | Values | Safe meaning |
|---|---|---|
| `auto_save` | `never`, `safe_draft`, `ask_each_time` | `safe_draft` may save an explicitly identified draft section on the named portal after showing the target. It never means final submission. |
| `auto_check` | `manual`, `safe_only`, `ask_each_time` | `safe_only` covers non-substantive UI checkboxes only. Consent, privacy, legal, eligibility, demographic, health, family, work authorization, and declaration boxes remain manual. |
| `auto_upload` | `never`, `ask_each_time` | Default to `ask_each_time`; verify destination, file type, filename, and visible upload state. |
| `auto_submit` | `manual_confirmation` | Ask the user's preference, but keep final submission behind a per-run, named-employer and named-role confirmation. A stored preference cannot silently click Submit. |
| `review_level` | `field_summary`, `section_review`, `full_manual` | Controls how much is shown before a draft save or upload. Use `full_manual` for high-risk portals. |

Explain the final-submission rule explicitly: the skill can prepare and, where authorized, fill a form, but the user must see what will be submitted and confirm the exact destination immediately before submission.

## 3. Create the private settings record

Use this shape in `00-system/settings.md`. It is a template, not a place for passwords, OTPs, API keys, or raw identity documents.

```yaml
---
type: job-search-settings
schema_version: 1
workspace_kind: obsidian | markdown
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
weights:
  experience_fit: 35
  role_fit: 20
  location_fit: 15
  preference_fit: 15
  evidence_strength: 10
  process_feasibility: 5
last_reviewed: YYYY-MM-DD
---
```

The weights are defaults only. Ask before changing them. A hard eligibility failure or an unresolved high-impact fact overrides a high score.

## 4. Onboarding acceptance check

Before leaving onboarding, report:

- selected workspace and whether it is new or reused;
- source files found and files still missing;
- preferences recorded and defaults still pending;
- automation settings and the fact that `auto_submit` remains manually confirmed;
- private files created or updated;
- any migration, duplicate, or privacy risk.

Do not begin a real browser application until the user has had a chance to correct the settings.

