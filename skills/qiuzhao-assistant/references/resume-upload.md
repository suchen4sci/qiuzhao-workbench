# Resume upload workflow

Use this reference when uploading a resume file to a recruitment portal. Keep personal paths, hashes, candidate data and application results in the private workspace, not this skill.

## Required operation order

For every application/template, resolve and upload the intended resume PDF FIRST, then fill or restore the remaining form and supporting attachments. Once the correct resume has been uploaded, do not replace/reupload it during ordinary filling. If the user explicitly requests a replacement, take a complete backup first and perform one upload before restoring other fields. Verify before saving; preserve the saved preview when the user asks not to re-enter or refresh. In that case, record that reload-based persistence verification was not performed instead of claiming it passed. Resume upload is the first material step, never an afterthought at the end of filling.

1. Resolve the requested resume variant to one existing file. If the requested variant does not exist and several plausible variants exist, ask which one; do not silently substitute. Check the actual file type and size.
2. Inspect the current page upload control. Distinguish resume attachment, transcript, and resume-parser import. A parser may overwrite an already completed form.
3. Before a parser upload, save the draft when needed and capture current form values through the supported read-only DOM API. Keep that snapshot private for comparison and recovery.
4. Prefer the browser tool's file chooser interface. Read its current file-upload documentation. In the verified cua_repl browser API, start `tab.playwright.waitForEvent('filechooser')` before clicking the observed upload control, await the chooser, and call `chooser.setFiles(absolutePath)`. Use `chooser.isMultiple()` for multi-file inputs. This is browser element automation; a native file picker and screenshot clicking are not normally necessary. Do not assume locator.setInputFiles exists.
5. When the input is hidden, click its observed visible upload button or label. Inspect the actual page rather than guessing selectors or upload endpoints.
6. After setFiles, inspect the page for filename, attachment item, progress, parsing confirmation, rejection, or error. File chooser success alone is not proof that the server retained the attachment.
7. If parsing offers an overwrite choice, preserve the user's reviewed form unless replacement is requested. Compare project dates, responsibilities, identity fields, education, awards and language scores against the pre-upload snapshot and confirmed knowledge. Correct changes using supported UI operations.
8. Save and reopen/reload only after save confirmation. Verify the retained attachment filename, and preview/download it if supported to verify the version. If the page exposes only parsed fields and no retained file, record parsing separately; do not claim an attachment exists.
9. Update the private attachment manifest with exact local path, SHA-256, bytes, requested variant, destination, timestamp, observed filename/result, and whether saved/reloaded verification passed. Record pending checks honestly. Uploading or saving a resume is not submitting a job application.

## Observed portal behavior

On a Hotjob resume-editing page, the visible `上传文件简历` button contained a hidden file input and stated that files would be automatically parsed and filled. Clicking that button opened a single-file chooser through the browser API. After setFiles, a dialog said `上传新简历将替换现有简历内容，请确认是否继续`. Continuing displayed the PDF filename but replaced the entire form with parsed values, clearing previously completed fields and transcript attachments. Reloading before saving restored the previously saved draft and removed the newly displayed PDF. Therefore this entry point is a whole-resume import, not a verified append-only attachment uploader. Prefer importing before filling a new application. For an existing complete draft, inventory all fields, selects and attachments, and prepare a full restoration plan before continuing; a text-only snapshot is insufficient. Do not call the upload complete until both the attachment and restored form survive saving and reopening.

File chooser handles can expire across turns: if setFiles reports an unknown chooser id, reobserve the current upload button and obtain a fresh chooser. Do not repeat setFiles on the stale handle.

## Skill versus knowledge

## Mandatory save gate

Before EVERY manual save, verify the actual resume file and supporting attachments, including filename, version, and destination association. After save, reopen and verify persistence. A parser's temporary filename, a successful upload response, and form completeness cannot substitute for a retained original-file record. If that evidence is missing, keep attachment status unverified and block final submission or a ready/completed claim. Restore and save damaged fields separately when necessary; explicitly label that action as form recovery, not attachment completion.

When investigating a missing filename, check whether the upload UI renders a temporary local File.name rather than a server-returned attachment. If so, repeated parser imports will not establish retention and can repeatedly erase reviewed fields. Record that distinction and stop unchanged retries. Keep only one active editor for a shared resume where practical; multiple autosaving editors are a stale-write risk, not a proven cause without evidence.

- Skill: reusable operation sequence, tool choice, recovery and verification rules.
- Private knowledge: personal facts, exact resume files, variant aliases, application-specific field values and upload evidence.
- Never copy a personal resume, ID, phone number, browser session, cookie or token into the reusable skill.
