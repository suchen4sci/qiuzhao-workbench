# Additional Functions and Extension Roadmap

These functions make the workflow useful beyond one application. They should be added only when the host environment supports them and the user opts in.

## Implemented in the current public workflow

The following four functions are now part of the main skill instructions and have dedicated schemas/procedures in `references/advanced-features.md`.

### 1. Resume versioning and rollback

Immutable source versions, named tailored derivatives, content hashes, change maps, and safe restore-to-new-path behavior.

### 2. Attachment and document control

Attachment kind, version, SHA-256, exact employer/campaign/role/portal destination, upload state, and visible evidence. Add PDF text extraction and render checks when the host supports them.

### 3. Recruitment-site field adapters

Neutral label aliases, control types, dependencies, validation quirks, and freshness dates, kept separate from personal answers and credentials.

### 4. JD-based interview preparation

Role-specific preparation generated from the official JD, exact resume version, and linked experience evidence, with follow-up risks and truth boundaries.

## Next recommended functions

### 5. Answer-library governance

Reuse common answers only when their source, language, length limit, date, and employer-specific restrictions are known. Mark answers as reusable, one-off, expired, or needs-review. Do not turn a company-specific answer into a global default.

### 6. Follow-up queue and reminders

Generate follow-up tasks from deadlines, submitted dates, assessment windows, interview dates, and user-defined waiting periods. Do not claim an outcome merely because a reminder is due.

### 7. Reconciliation and audit

Detect conflicts across application cards, dashboards, email notes, screenshots, and user messages. Show the conflict and ask which source is authoritative. Add a dry-run mode that reports proposed edits without writing or clicking.

## Useful later extensions

- duplicate-role and duplicate-portal detection;
- multilingual field and resume variants;
- application-funnel and time-saved analytics with privacy-safe aggregates;
- post-interview and rejection learning loop based on recorded evidence;
- anonymized public-progress export for social posts;
- browser session recovery and stale-page detection;
- accessibility-friendly manual handoff instructions;
- encrypted or OS-keychain-backed local secrets, if the host explicitly provides secure storage;
- import/export to CSV or JSON without including high-sensitivity fields by default.

## Design rule for extensions

Every new function should answer four questions before implementation:

1. What private data does it read?
2. What external side effect can it cause?
3. What evidence proves success?
4. What is the user-controlled stop point?
