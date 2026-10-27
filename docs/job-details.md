# Job details

The job sheet has three sections: Job, Application and Activity. Its compact header keeps the company, title, location, compensation, board status, candidate fit score and the latest packet match rating visible. Edit job, original posting and close controls share that header. A persistent footer presents one next action based on the current work and prerequisites, plus Shortlist for idle leads. Each section has its own reading position inside the sheet's main work area; the header and footer never scroll independently.

Opening a job immediately shows its identity header and a skeleton while the sheet code or full job source loads. The loading status is announced to assistive technology, skeletons respect reduced motion, and the sheet can be closed while loading. Source failures keep the header visible and offer Retry before enabling the full details and workflow actions.

## Information and decisions

Job opens with the original description, tags and crew assessment. Its Packet match to job section offers **Reevaluate with packet** in every board stage, including submitted and closed jobs, once a packet and current extracted brief exist. It queues an isolated Scout assessment using the complete resume, cover letter, form answers, note, claims, structured job brief and Profile evidence. Active work, pending questions, workspace capacity and runtime/account gates retain their usual protections; brief edits must be saved first.

Reevaluation refreshes candidate fit and saves a separate advisory 0–100 packet match rating with reasons, candidate-fit reasoning, evaluation time, run ID and exact packet digest/context revision. The rating measures requirement coverage, relevance, consistency and tailoring; it is not a hiring probability or packet approval. Status, documents, review feedback, independent review evidence and approvals remain intact. Packet or adopted brief changes, including corrected job details, clear the current rating while retaining historical events. Cancellation, missing/invalid ratings and changed inputs never publish a replacement score. User questions release capacity and resume the same isolated evaluation with saved answer provenance.

Posting provenance lives in a secondary disclosure. Application groups the complete brief and requirements, documents, reviews and export. Confirmed briefs use a compact summary until the user chooses to review or edit them. Deep-review reports load only when Reviews first opens. Export format/layout controls live beside their approval request rather than in the persistent header.

The next action prioritizes current work, pending user questions and uncertain submissions. An unavailable brief leads to preparation; a current extracted brief supports fit evaluation; drafting requires confirmation and personal answers. Drafting uses the isolated application draft endpoint with the chosen application agent. Packet review, exact-document export approval and recording an actual manual submission remain separate decisions. Runtime/account details appear beside launch actions, and unavailable agents explain what needs attention.

An agent working on another job or standalone conversation does not disable this job's launch actions. The same agent can run across independent queues within the workspace concurrency limit; active work and pending questions on this job retain their existing protections.

Activity contains status bookkeeping, external application registration, lessons, tracking evidence, submission receipts and saved history. Saved history loads from the session-protected `/api/cards/:id/history` route (the latest 200 job events, without event payloads) and merges recent run events from the workspace snapshot, so older jobs keep their history after it leaves the snapshot's latest 100 events. Uncertain submission outcomes open their evidence rather than suggesting another submission. Recording a status never contacts an employer or grants export/submission permission.

## Editing a job

Edit job opens the same form used by Add job, prefilled with company, title, posting URL, location, salary, full description and tags. Fetch from link can fill supported public postings for review; editing never offers the Scout action that creates another job. Application registration remains a separate action in Activity. Cancel, Escape, outside dismissal and navigation protect unsaved edits, and failed saves keep the form open with its draft. Saving updates the existing job and refreshes its details and board card.

The user-session-only `PUT /api/cards/:id` endpoint accepts the form fields and the opened job's `expectedUpdatedAt`. Stale versions, owned jobs, active attached runs and uncertain submissions block writes. Posting changes invalidate the application brief, candidate fit, packet match rating, packet review, form assessments and unused export/browser approvals in one transaction. URL or description edits clear old captured markup so extraction uses the edited posting. Tags alone preserve reviewed evidence and approvals; identical saves append no events. Status, application tracking, user lessons, packet files, discovery provenance and history remain attached to the same job. Agent job-correction permissions remain limited to company, title, location and salary.

Save or discard other job-detail drafts before opening the posting editor. Its fields remain stable while workspace polling continues; conflicting changes require reopening the editor.

## Live agents and job chat

Active workflow and attached conversation runs appear as named agent avatars in the header. Hover and keyboard focus show their public current activity, latest commentary and elapsed time. Clicking an avatar opens its existing conversation at `/chat/<thread>?run=<run-id>` and focuses the matching turn. Touch users can open the same conversation directly. Multiple workers retain separate links; administrative seat reservations and coordinating parents with an active worker are omitted. Waiting agents show Waiting for you. Opening chat never cancels a run.

Ordinary application workflows and source extraction use the same bounded, sanitized activity channel as chat and deep-review stages. Source extraction joins the existing application conversation or creates one. Provider activity retains at most 80 entries and 4,000 characters per commentary entry; private reasoning bodies and raw tool payloads are excluded. Completed activity is saved on the run and included in indexed conversation history. Compact streams overlay only active runs and a terminal handoff, keeping saved history paged. Run-targeted links load the relevant history page and continue following live work when it is the latest page.

## Drafts and accessibility

Sections mount on first visit and remain mounted afterward. Collapsed editors use the shared accordion's mounted panels, so tab and disclosure changes preserve drafts. Brief edits, lesson text, tracking identifiers, email thread drafts, external submission fields and external verification evidence participate in the sheet's unsaved-changes guard. Closing, leaving the page or following a job-chat link requires saving or explicitly discarding pending edits. Selecting another section does not discard them.

The sheet uses Base UI dialog semantics, focus management, tabs and accordions, with the same shared materials and reduced-motion treatment as the rest of the app. Recessed segmented tabs, raised clay reading and application sections, a serif job title and tactile agent controls preserve the app's material identity within the compact layout. Its footer accounts for mobile safe areas, and Electron's existing title-bar bounds apply to the sheet and backdrop.

Regression coverage includes initial reading layout, mobile bounds, draft preservation/save/close behavior, live workflow previews, turn-targeted chat navigation, saved turn replay, source-extraction progress and existing deep-review/board flows. Provider calls remain outside automated verification.
