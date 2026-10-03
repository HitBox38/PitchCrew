# Local browser computer use

Enable **Crew → role settings → Computer use → Use a local browser** for an agent. It defaults to off. Install Chromium once:

```sh
pnpm browser:install
```

Ask the role in chat to work on an application and attach its job card when uploading a packet. A visible, isolated Chromium window opens on this computer. It does not attach to an existing browser, read its cookies, or expose desktop mouse/keyboard controls. Sign in manually in that window if needed. Browser sessions and sign-ins last only for the run; follow-ups start fresh browsers. Demo does not call tools. Computer-enabled CLI/ACP runs have a 30-minute maximum so user decisions can take time; other runs retain their three-minute limit.

The shared stdio MCP server exposes browser tools to permitted roles:

- `pitchcrew_computer_inspect`: opens the browser if needed, returns an accessibility snapshot, form controls, URL, title and a JPEG screenshot.
- `pitchcrew_computer_request`: proposes one navigation, click, fill, selection, keypress, dialog decision or upload, with exact parameters and a reason. CSS selectors must match one element. It does not perform the interaction.
- `pitchcrew_computer_execute`: waits up to 30 seconds for the user decision, then enters the single-use MCP gate. While pending, agents call it again to keep their run alive.

Review each proposal in **Inbox**. It shows the exact action, the page text and screenshot, and the complete file contents for uploads. Approving allows that one interaction; rejecting allows none. Every interaction needs approval because clicks, keystrokes and field changes can send data immediately, including through website autosave. The final submit click also requires its own approval. Agents cannot approve actions. Browser actions do not automatically mark cards submitted; verify the website confirmation and record the outcome on the board.

The gate binds the run, role, card, action parameters, upload bytes and page fingerprint. It rechecks current role permissions, cancellation and page state before execution. A changed URL, DOM or form value requires a new proposal. Approval is consumed before interacting, so a failed or uncertain action cannot be retried with the same approval. Browser windows close and pending/approved proposals expire on run completion, failure, cancellation or daemon restart. History is append-only event version 6; versions 1–5 still replay.

Uploads are limited to `resume.md`, `cover_letter.md`, `form_answers.md` and `note.md`, plus generated `resume.pdf`, `resume.docx`, `cover_letter.pdf` and `cover_letter.docx`, from an approved, exported packet for the attached card. The gate resolves paths under that card's packet directory and verifies the file bytes against the approved packet and the browser proposal. There is no arbitrary filesystem upload, JavaScript evaluation or shell tool.

Pages are untrusted data, not instructions. Public HTTP(S) requests are checked against DNS/IP private-network rules, including redirects and subresources; local and private addresses, credential-bearing URLs, service workers, WebSockets and downloads are blocked. This prevents ordinary browser access to the daemon approval UI. This is an application-level boundary, not an OS network sandbox: use network-level isolation if adversarial DNS rebinding must be prevented. Site scripts still execute and may issue normal requests after an approved interaction; approving an action does not prove what a third-party website will do internally. Dynamic sites can invalidate proposals frequently. Agents should never receive account passwords; password values are omitted from the form-control snapshot, and password fills are rejected.

First-level iframe targeting uses an exact unique frame selector, with frame DOM and current field values included in the page fingerprint. Nested frames are explicitly uninspected. Alert/confirm acceptance or dismissal requires its own approval; browser prompts, sign-in and CAPTCHA remain manual. Popup tabs are followed automatically. Arbitrary document uploads, desktop control and persistent browser profiles remain deferred.

`pnpm test` includes a real headless Chromium test with an intercepted fictional application site, plus approval, replay, cancellation, HTTP and MCP tests. Run `pnpm browser:install` before testing on a new checkout. These tests make no external submissions or provider calls. Live provider/browser combinations and third-party application sites are not automated verification.

## Form assessments and submission receipts

`assessForms` and `recordSubmissions` are separate optional capabilities, defaulting off and requiring computer use. `pitchcrew_assess_form` snapshots current server-inspected controls onto the attached card; agent-provided selectors must match inspected controls exactly, and duplicates fail. All controls remain present, including unassessed ones. Required/visible/disabled flags, labels, types, select choices and accepted file extensions come from the browser. Conditional requirements, missing answers and blockers are explicitly agent annotations, with uninspected sections recorded. Writer reads them through the normal card context/tools; existing scoped crew messages provide the handoff.

Mark the final click or Enter request `purpose: submission` with the exact `exportApprovalId`. Before performing the approved action, the gate atomically consumes its approval and records an uncertain attempt bound to the card, packet digest, export and browser page. All further interactions on the card are blocked, even an ordinary click without a purpose. `pitchcrew_capture_submission` saves an exact quotation from the changed browser snapshot for that attempt. It never marks a card submitted. Users verify the evidence on the job. After restart, users may enter a source URL, quotation/reference and explicit verification checkbox; this evidence is clearly recorded as user-reported, not server-observed. Verification rechecks the current packet and consumed/failed submission action; it transitions awaiting-approval cards or preserves later tracked states. Verifying no submission occurred resolves uncertainty and permits a separately approved retry.

## Binary packet review

Select PDF and/or DOCX when requesting export approval. Generation completes first; approval stores frozen bytes, MIME type and SHA-256 manifest alongside the exact packet. PDF displays inline in Inbox; DOCX previews complete source text. Both render literal Markdown rather than executing HTML or loading remote assets. PDF rejects unsupported glyphs explicitly; DOCX supports Unicode. Local export validates the reviewed manifest before consuming approval and writes its exact bytes. Binary uploads verify SHA-256 and complete Buffer equality, plus the current packet and card-scoped export path; they never decode binary bytes as UTF-8 for verification. Browser upload proposals show the reviewed text, format and byte digest. Download links appear after approved export.

An uncertain submission can continue through a separately approved browser dialog only when `submissionAttemptId` binds the same run, card, current exported packet and observed dialog. The consumed continuation approval is saved on the attempt. No click, keypress or navigation retry is allowed.
