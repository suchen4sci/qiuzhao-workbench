# Advanced Features

Read this reference only when the user asks for resume history, rollback, attachment control, portal-specific field handling, or interview preparation.

## 1. Resume version management and rollback

Treat the master resume as immutable source material. Every tailored resume or material change gets a new version ID and a record containing:

- parent version and creation date;
- target employer, campaign, role, and JD source;
- positioning choice;
- content hash when a local file is available;
- requirement-to-evidence map;
- retained, emphasized, compressed, omitted, and unresolved content;
- status: active, superseded, or archived.

Use `scripts/version_resume.py` for deterministic file snapshots and safe restoration. Example:

```bash
python3 scripts/version_resume.py snapshot /private/master-resume.docx \
  --store /private/30-materials/versions --target power-electronics

python3 scripts/version_resume.py list /private/30-materials/versions

python3 scripts/version_resume.py restore /private/30-materials/versions \
  --version resume-20260904-power-electronics-v01 \
  --output /private/30-materials/rollback-review.docx
```

The restore command writes to a new output path by default. Do not overwrite the master or an existing target without explicit confirmation. A rollback is a new derivative version, not deletion of later history.

## 2. Attachment version, destination, and upload-result tracking

Before uploading, create or update a private manifest row with the exact:

- file name, path, kind, version, and SHA-256 hash;
- employer, campaign, role, portal/domain, and application card;
- upload policy and user confirmation state;
- upload status, timestamp, and visible evidence reference;
- rejection/error message and next action if the portal refuses it.

Use `scripts/attachment_manifest.py` to record a local file's hash and destination metadata. The script does not upload anything and cannot prove portal success. The browser workflow must update `upload_status` only after the visible page confirms the filename or success state.

Never reuse an attachment merely because the filename is similar. Check target role, language, date, size/type requirement, and version.

## 3. Recruitment-site field adapters

Maintain a private or project-local adapter registry with one adapter per domain or campaign. Keep it separate from the profile field library.

An adapter may include:

- canonical field → visible-label aliases;
- control type: text, date, select, searchable-select, table, upload, checkbox;
- parent/child dependencies;
- whether visible and hidden values must both be checked;
- known validation or save behavior;
- last verified date and affected portal version.

An adapter must not include:

- a user's actual name, school, phone number, grades, answer text, or document path;
- credentials, cookies, tokens, CAPTCHA solutions, or 2FA codes;
- an assertion that a currently visible campaign is open without current evidence.

When a label is ambiguous, use the adapter only to locate the field, then resolve the value from the user's confirmed field library. If a portal changes its UI, mark the adapter stale and stop relying on the affected rule until rechecked.

## 4. JD + resume + experience library → interview preparation

Generate an interview pack only from three explicit inputs:

1. the current JD or an official role summary;
2. the exact resume version used or intended for the role;
3. linked experience records with source/evidence states.

The pack should contain:

```markdown
# Interview preparation: <company> — <role>

## Role understanding
- What the role appears to own
- Required skills and working context
- Confirmed unknowns

## 60–90 second introduction

## Requirement-to-evidence map
| Requirement | Evidence | Safe claim | Follow-up risk |
|---|---|---|---|

## Project deep dives
### Project / experience
- Context and objective
- My actual contribution
- Method/tools
- Verified result or current limitation
- Likely follow-up questions

## Question families
- JD and technical fundamentals
- Resume bullet deep dives
- Collaboration and problem solving
- Motivation and role fit
- Gaps, transitions, or constraints

## Questions to ask the interviewer

## Truth boundary and open questions

## Final review checklist
```

The generated answers must preserve the user's actual scope. Clearly distinguish coursework, simulation, prototype, internship support, research output, team contribution, and production ownership. Add likely follow-up questions where a claim is broad or evidence is partial. Do not infer an interview round, interviewer identity, or next step from the existence of a JD.

