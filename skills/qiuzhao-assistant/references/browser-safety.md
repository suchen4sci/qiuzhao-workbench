# Browser Application Safety

Read this reference for live portal inspection, form filling, draft saving, checkbox selection, uploads, or submission.

## Automation preference resolution

At the start of a browser run, read the private settings and state the effective policy:

- `auto_save`: whether draft sections may be saved automatically;
- `auto_check`: whether safe, non-substantive boxes may be selected;
- `auto_upload`: whether uploads need a separate confirmation;
- `auto_submit`: always show the exact employer, campaign, role, and final action immediately before submission;
- `review_level`: how much field/section state to show.

If settings are missing or ambiguous, pause and ask. Do not inherit permissions from another website or another application.

## Action classes

### May be automated after mapping and verification

- reading visible field labels and required markers;
- filling ordinary, low-risk fields from confirmed records;
- selecting a simple role option when the visible value and underlying value can be verified;
- safe, non-substantive interface checkboxes if `auto_check: safe_only` is enabled;
- showing a field summary and validation state;
- saving a draft section only when the destination and action are clear and `auto_save` permits it.

### Require user handoff or explicit confirmation

- login, password, QR login, CAPTCHA, hCaptcha/reCAPTCHA, OTP, and 2FA;
- identity numbers, legal declarations, citizenship, political status, health, disability, family, criminal, work authorization, sponsorship, salary, relocation, or disciplinary questions;
- consent, privacy, data-sharing, eligibility, or certification checkboxes;
- school/major selectors, linked province/city controls, virtualized or brittle dropdowns when the selected value cannot be independently verified;
- resume, photo, ID, transcript, portfolio, or any sensitive file upload unless the exact destination, filename, and type are confirmed;
- `Complete`, `Submit`, `Apply`, `Confirm`, `Withdraw`, `Reapply`, or equivalent final actions.

An onboarding setting may express the user's preference for automation, but it does not remove these risk gates. In particular, `auto_submit` is stored as a preference only; final submission requires a current, explicit confirmation tied to the named employer and role.

## Field mapping protocol

For every filled section:

1. Read the current page and identify the portal, campaign, role, account state, and section.
2. Build a mapping of portal label → canonical field → source → status.
3. Fill only confirmed values. Keep unknown fields visibly unresolved.
4. Re-read actual visible values after filling. For dependent dropdowns, re-check child values after parent changes.
5. Check server-side validation or section state; do not hide stale warnings with scripts.
6. Record filled, intentionally omitted, failed, and user-owned fields.

For custom controls, use the escalation sequence below instead of stopping merely because one or two element actions failed. Never treat an attempted click, selection, upload, or save as success without visible evidence.

## Browser operation and recovery order

Prefer the fastest reliable method supported by the current tools. Escalate in response to an observed problem rather than running every method for every field.

1. **Element automation.** Use Playwright-style locators for ordinary buttons, links, text fields, standard dropdowns, uploads, tabs, and repeated form sections. Ground selectors in the observed page and reuse the logged-in session.
2. **Element actions with keyboard recovery.** On failure, inspect the error and current state. If an autofill suggestion or dismissible overlay is blocking the field, use Escape; use Tab, arrow keys, and Enter when appropriate, or select a real visible dropdown option. Recheck selected text, dependent fields, and validation messages. Do not use Escape to evade a required consent or authentication step.
3. **Visual interaction.** Use a screenshot and the available Computer Use capability when controls are covered, custom widgets are not accessible, upload feedback is ambiguous, or the DOM contradicts the visible page. Ground visual actions in a fresh image and verify their effects. A successful DOM check does not need a redundant screenshot.
4. **Targeted user handoff.** Retain the original confirmation and handoff rules above for login, QR/OTP/2FA, CAPTCHA or other anti-bot checks, unclear sensitive declarations, missing necessary material, permission prompts, and final submission. Ordinary dropdown failures alone are not a reason to hand off before recovery has been tried. Reuse relevant authorization already given for this destination and action; do not ask for the same information again.
5. **Verification and recording.** Verify actual field values and validation state after edits, filenames and intended versions after uploads, and draft-save or submission evidence separately. Log meaningful results and the next action; only mark submitted with an explicit success confirmation.

Each retry must test a new explanation or respond to a changed page state. Do not repeat an unchanged failed action, restart a whole workflow unnecessarily, or switch to an undocumented API. If the available supported methods cannot produce a verifiable result, record the exact field, observed blocker, intended value, methods tried, and smallest required user action. Continue independent fields when possible.

Resolve routine errors autonomously. Give progress updates about findings and completed work rather than ending the turn on each transient error. Report a blocker when user input or an external change is actually required. This workflow does not expand the browser tool's capabilities or override its platform-level permission requirements.

## Upload and save protocol

For resume file uploads, first read [resume-upload.md](resume-upload.md) for variant selection, browser file-chooser operations, parser overwrite checks, and persistence verification.

Before an upload, state: destination portal, employer/campaign/role, file path or selected filename, file type, and whether the file contains sensitive information. After the upload, verify the visible filename or upload status. If it cannot be verified, do not continue to submission.

For a draft save, state the section and portal target. A save is not evidence of submission. If a portal's “save” button may trigger an application or lock a choice, treat it as a higher-risk action and ask before clicking.

## Final submission protocol

Immediately before a final action, show a concise confirmation block:

```text
Employer: <confirmed employer>
Campaign: <confirmed campaign>
Role: <confirmed role>
Portal: <current URL/domain>
Status: <ready / unresolved fields>
Evidence after submit: <where it will be checked>
Action: Submit this application now?
```

Proceed only after an affirmative confirmation for that exact application, unless the user's newest message explicitly authorizes submitting that named role now. After clicking, independently verify a success page, confirmation text, application-record row, or status tracker. Otherwise mark the result `needs-confirmation`, not `submitted`.

