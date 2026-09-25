# Screening, Tailoring, Tracking, and Review Workflow

Read this reference for role screening, company recommendations, application records, follow-up, or review.

## A. Screen companies and roles

Start from the user's master resume and experience library, not from generic keywords. For each company or job source:

1. Capture the official company page, campaign name, role name, location, eligibility, deadline, source URL, and retrieval date.
2. Separate hard constraints from preferences. Mark each as `pass`, `fail`, or `unknown`.
3. Extract JD requirements into technical skills, responsibilities, domain knowledge, communication requirements, education/eligibility, and working conditions.
4. Link each requirement to one or more experience records. Use `strong`, `partial`, or `missing` evidence; do not award evidence for an unverified keyword.
5. Recommend roles with a short rationale, strongest evidence, gaps, and trade-offs. Let the user make the final selection.

### Default transparent scoring

Use the settings weights when available. Otherwise use the following starting point only:

| Dimension | Default weight | What to inspect |
|---|---:|---|
| Experience/technical fit | 35 | Verified tools, methods, domain work, and level |
| Role fit | 20 | Match between actual work and day-to-day responsibilities |
| Location fit | 15 | Preferred city, mobility, travel, and shift constraints |
| User preference fit | 15 | Industry, company type, role family, work mode |
| Evidence strength | 10 | Quality and recency of source material |
| Process feasibility | 5 | Open application, deadline, login/upload burden, duplicate limits |

Show the score components or use qualitative labels. Avoid false precision when the JD or resume is incomplete. A hard eligibility failure or unresolved high-impact question takes priority over a high soft-fit score.

### Company recommendation output

Return a compact table:

| Company | Role(s) to consider | Fit | Why | Main gap/risk | Application feasibility | Suggested action |
|---|---|---|---|---|---|---|

Do not recommend a company solely because it is famous. Explain which role family is supported by the user's evidence and which roles are only exploratory leads.

## B. Build a JD-specific resume

For the selected role:

1. Choose a positioning bucket: technical support/solutions, design/R&D/engineering, private technical, central/SOE, foreign electrical/automation, university/admin, management/operations, or another user-approved bucket.
2. Build a requirement-to-evidence matrix before rewriting.
3. Reorder relevant experiences, projects, skills, and optional achievements.
4. Rewrite for clarity and relevance while preserving the user's actual scope, tool use, dates, title, and result status.
5. Mark gaps that need user input. Do not fill a gap with a plausible claim.
6. Produce a change summary: retained, emphasized, compressed, omitted, and still unverified.
7. Save a new version name and link it to the JD/application card. Do not silently overwrite the master resume.

If the requested output is DOCX/PDF, use a document or resume-building capability if available and perform the required render/visual check. The tailored content and audit map remain the source of truth.

## C. Prepare and fill an application

Before opening the browser, make a missing-fields checklist:

- required identity/contact and education fields;
- role, location, source, and referral fields;
- high-signal optional fields: projects, research, papers, awards, certificates, competitions, publications;
- uploads and their exact destination;
- sensitive or ambiguous questions;
- browser actions that require user confirmation.

Read the live page before acting. Map labels, visible values, hidden codes, required markers, validation state, and current page/section. Fill only values that have a confirmed source or user confirmation. Keep a field summary as the work proceeds.

## D. Record outcomes and follow-up

After every meaningful state change, update the application card and the private changelog with:

- company, campaign, role, and location;
- exact event and date;
- raw portal status and canonical status;
- evidence source or screenshot reference;
- resume version and positioning used;
- fields filled, omitted, or left for the user;
- blocker and next action;
- follow-up date or reminder if appropriate.

For assessment completion, record completion only. For interviews, record the confirmed round and date only. For offers or rejections, require explicit evidence. Preserve user-confirmed updates while labeling the evidence boundary if the portal has not independently confirmed them.

## E. Reconcile and review

When asked for a current job-search summary, cross-check the application cards, index/dashboard, changelog, follow-up queue, and relevant source messages. Flag conflicts instead of choosing a status silently.

Useful review outputs include:

- applications needing follow-up this week;
- missing fields that block a deadline;
- roles where the resume has weak evidence coverage;
- duplicate applications or repeated uploads;
- funnel counts by stage, with unknowns excluded from success claims;
- lessons from interviews or rejections that are supported by the user's notes.

