# Inbox redesign

## Agreed direction

- Use an email-style, full-width request list. Each row shows the agent, subject, job, time and attachment indicator.
- Opening a request replaces the list with a reading view, with a way back to the list.
- Show the request's documents as attachment tiles instead of expanded inline documents.
- Use one attachment tile per file, with explicit filenames and formats (for example, `resume.pdf`, `resume.docx` and `resume.md`). Each tile opens that file's own viewer rather than grouping formats into document tabs.
- Opening an attachment displays a large dialog with controls suited to its file type.
- Attachment dialogs are read-only. Changes go back to Writer rather than editing the frozen documents in the viewer.
- PDF review offers page navigation, zoom and fit controls. DOCX review offers a document preview and source text. Markdown review has a visible Rendered / Source toggle with copying in both modes.
- Approve and Reject appear only in the request reading view. Attachment dialogs contain inspection controls, with no approval actions. Packet approval continues to cover the entire packet rather than individual files.
- Track read/unread separately from resolution. New requests use bold text and an unread dot; opening a request marks it read without resolving it.
- Use Needs action for unresolved approvals and submission follow-ups, and History for completed requests. A read request remains in Needs action until resolved; approval status alone does not determine whether a submission follow-up is complete.
- Packet-export and browser-action requests share one list, sorted newest first, with clear request-type labels. Both Needs action and History offer All / Packets / Browser filters.
- Browser reading views keep the requested action, target and exact values visible. Frozen screenshots and captured page text appear as separate evidence tiles opening large image/text viewers.
- Packet reading views offer a separate Ask Writer for changes action that opens the job conversation with the packet referenced. The user writes and sends the instructions there; this handoff does not reject the packet or start Writer automatically. Reject remains a simple decline.
- Completed requests stay open with their outcome visible and Next request / Back to inbox controls. Exported-file downloads remain available where applicable. Do not automatically open the next request.
- Approving a packet keeps its reading view open and presents a submission-method choice: Submit myself or Let an agent submit. Choosing either method exports the approved files automatically, replacing the separate Export packet click in this flow.
- Provide search across agent, job, subject and attachment filename, an unread filter and mark-read/mark-unread controls. Do not add stars, archiving or deletion as part of this redesign.
- Attachment dialogs offer Previous / Next controls across the current request's attachments, updating the filename and type-specific toolbar for each file. Escape or Close returns to the reading view and restores focus to the attachment tile.
- Provide browser-style file viewing controls, including explicit Zoom in / Zoom out and Find in document. File search is separate from Inbox list search.
- Include a Download button in the attachment viewer toolbar to save the current file in its original format.

## Post-approval submission handoff

- After packet approval, offer Submit myself and Let an agent submit in the request reading view.
- Approval alone does not choose a submission method or launch an agent.
- The manual path should lead to the reviewed files and employer application page. The agent path should lead to a job-scoped application task with visible progress and any required user input.
- Choosing Let an agent submit starts agent-assisted preparation, not blanket permission to submit. The agent fills the form and attaches the reviewed files under existing browser permissions, then requests user approval of the exact final submission action. After approval, the agent performs that action. Existing supervision of other browser interactions remains in force.
- Submit myself exports the reviewed files, then presents their downloads and the employer application link. Let an agent submit exports the same reviewed files before queuing agent preparation. Approval alone does not export files.
- An export failure keeps the user on the request with a visible error and retry. Do not launch agent preparation until export succeeds. Reuse an existing valid export when continuing the same approved packet rather than consuming approval a second time.
- Let an agent submit opens a small agent chooser with Submitter as the default. Show the selected agent's name and effective browser permissions, allow choosing another eligible agent, and queue preparation only when the user presses Start preparation.
- Resolve the default by the built-in Submitter identity, retaining its current user-configured display name and settings. Do not substitute Writer based on who drafted the packet.
- If Submitter is unavailable, keep it selected with a clear blocker and disable Start preparation. Offer Set up Submitter, an explicit choice of another eligible agent, and Submit myself. Do not switch agents, enable roles or grant capabilities automatically.
- Setup and recovery should preserve the approved request and any successful export so the user can return and continue without repeating those steps.
- After Start preparation successfully queues the task, open its job-attached conversation with the selected agent's browser panel visible. Keep live progress, agent questions, private manual sign-in/CAPTCHA handling and exact-action approval in that conversation's existing browser flow. If queued for capacity, show that waiting state rather than implying the agent has started.
- Inbox retains an application-progress summary and Continue application link to that exact conversation/task. Returning to Inbox or closing the browser panel does not cancel the work.
- After the agent executes the separately approved final submission action, show the captured confirmation in the same job conversation with I verified submission, I verified it was not submitted and Verify later controls. The agent's success report alone does not mark the job submitted.
- Verify later leaves the submission outcome uncertain and keeps further submission attempts blocked until the user resolves it. Inbox reflects the actual verified outcome or the outstanding verification need.
- Retain job-details verification as another entry point to the same saved submission attempt and decision. Resolving from either location updates both, rather than creating independent confirmations.
- A user switching from agent preparation to manual completion takes control of the same embedded browser. Pause agent actions and inspection, retain the current form and attached files, and let the user finish there or explicitly return control to the agent.
- Preserve the existing private takeover behavior: invalidate unused browser approvals, require fresh inspection on return, and keep the agent paused after controller disconnection or lease expiry. Taking control cannot bypass an unresolved submission attempt.
- After Submit myself exports the packet, keep its submission follow-up in Needs action as Ready for you to submit, with file downloads, the employer application link and I've submitted. Leaving it for later does not mark it submitted or resolve the follow-up.
- I've submitted records the user's manual submission through the existing bookkeeping path after they have applied. Share the saved outcome with job details; do not create a second independent submission record. An unresolved browser submission attempt must be resolved through verification instead of this manual shortcut.
- Offer Not applying on an outstanding submission follow-up. After the user confirms, mark the job Withdrawn and move the follow-up to History with its outcome visible. This updates local bookkeeping only and does not communicate with the employer. Withdrawing from the board or job details resolves the same follow-up.

### Lifecycle and recovery

- Keep Stop preparation distinct from Not applying. Stop retains the existing cancellation and queue-pause behavior, preserves pending requests and leaves the job's status unchanged. The follow-up remains available for explicit recovery or manual completion; stopping does not imply withdrawal or successful submission.
- Before withdrawing a job with active agent work, require that work to stop and settle through existing controls. Do not race a withdrawal or manual-submission record against a possible browser submission. If an attempt is uncertain, show Verify submission instead and require the outcome to be resolved first.
- Recheck the current job, application context, packet approval and exported bytes when starting or continuing either submission path. A changed packet needs fresh review/approval; old attachments remain historical and cannot silently become the new submission payload.
- Prevent repeated clicks, reopening a request or snapshot refreshes from queuing duplicate preparation tasks. Link Continue application to the saved task/conversation and reuse the matching valid export.
- Preserve existing failed/interrupted queue recovery. Show the saved failure and explicit Retry or recovery controls; do not automatically repeat interrupted browser submissions. A runtime restart does not establish whether the employer received an application.
- When an employer application link is missing or unusable, explain the blocker and let the user provide or correct the link through existing job/conversation flows. Do not fabricate a destination or launch an agent against an unrelated page.

## Browser-style viewer controls

Use browser PDF viewers as the reference for inspection controls, adapted to each file type. The viewer remains read-only.

### Shared viewer behavior

- Keep a persistent toolbar with filename, Previous / Next attachment, Find where supported, zoom controls where applicable, Download, Expand / Restore and Close. Group secondary controls in an accessible overflow menu on narrow screens.
- Zoom controls include minus, plus, a visible percentage, selectable presets and reset to 100%. Paginated documents offer Fit width and Fit page; images offer Fit image. Zoom changes only the attachment view, not the application shell.
- Find searches the entire current file, including offscreen pages, with a match count, active-match position, Previous / Next match, case-sensitive and whole-word options, and an explicit no-results state. Scroll the active match into view and highlight it in the displayed document. Search highlights are temporary viewing aids and do not change file bytes.
- Cmd/Ctrl+F focuses file search while the viewer is active. Enter / Shift+Enter advances through matches while the search field is focused. Escape closes Find first, then closes the viewer on a subsequent press. Zoom shortcuts should be scoped to the viewer without intercepting text-entry shortcuts.
- Retain each attachment's position, zoom and view mode while moving between attachments within the open request. Search results belong to the current file and must never display stale matches from another attachment.

### PDF

- Previous / Next page, an editable page number and actual total page count.
- A collapsible page-thumbnail sidebar; show an outline only if the PDF supplies one.
- Zoom, fit modes, view-only rotation in 90-degree steps, text selection and copying, and Find with highlights on the actual PDF pages.
- Use continuous vertical scrolling with the page indicator tracking the visible page. Keep page navigation visually distinct from attachment navigation.
- Search and selection must use text from the frozen PDF bytes, not the packet's Markdown source. If a PDF has no extractable text, explain that search is unavailable; do not report zero matches as if the image had been searched. OCR is outside this redesign.

### DOCX

- Zoom in / out, percentage presets, reset, Fit width, and Find with highlighted matches in the rendered DOCX text.
- Text selection and copying, plus the existing complete-source-text view with its own search.
- Retain the browser-versus-Word layout notice. Do not present estimated Word pagination as exact navigation; PDF-only page controls must not appear as unsupported DOCX controls.

### Markdown and plain text

- Find with match navigation, text selection, Copy selection / Copy all and text-size controls.
- Markdown has a persistent, keyboard-accessible Rendered / Source segmented toggle in the attachment toolbar. Default to Rendered, showing formatted headings, lists, links and code through the shared Markdown presentation. Source shows the exact frozen Markdown as read-only text without stripping or rewriting its syntax.
- Remember the selected mode for each attachment while reviewing the request. Preserve each mode's scroll position when switching so inspecting syntax does not lose the reading location.
- Find searches the active mode and labels that scope clearly. Keep the query when toggling modes, but recompute matches and their count against the newly visible content; never carry stale match positions between modes.
- Copy selection copies the selected visible text. A separately labelled Copy Markdown action copies the exact source in either mode. Plain text and Markdown Source views offer line-wrap controls.

### Images and browser screenshots

- Zoom in / out, percentage presets, Actual size, Fit image, view-only rotation and panning when zoomed.
- Screenshot text remains searchable through its separate captured-page-text attachment. Do not offer image-text search without OCR or imply that captured page text precisely identifies text locations in the screenshot.

### File actions

- Download saves only the currently displayed attachment, using its original filename, MIME type and frozen contents. Zoom, rotation, search highlights and Rendered / Source mode do not change downloaded contents; Markdown downloads as the original `.md` file in either mode.
- Preserve existing post-export availability for packet downloads. Before export, keep Download visible but disabled with a visible explanation that the user must approve the packet and choose a submission method in the request reading view to export it. Approval alone does not enable Download. Keep approval and submission-method decisions outside the viewer.
- Browser evidence attachments can be downloaded through an explicit user action as the captured screenshot or captured text, without approving or executing the browser action. This does not authorize an agent to export evidence.
- Label the button accessibly with the current filename, show download failures, and update its target when navigating between attachments so a stale file cannot be downloaded accidentally.
- This change does not add annotation, signing, document editing or printing. Packet downloads retain the existing approval/export path.

### Browser references and renderer implications

- [Firefox PDF viewer documentation](https://support.mozilla.org/en-US/kb/view-pdf-files-firefox-or-choose-another-viewer) describes thumbnails, outlines, page jumps, zoom controls and viewer shortcuts.
- [Chrome PDF viewer documentation](https://support.google.com/chrome/answer/16215622?hl=en&co=GENIE.Platform%3DDesktop) describes zoom, fit modes, rotation and searchable/selectable text.
- Before this redesign, the Pitchcrew PDF preview rendered every page once to an image at a fixed scale. Browser-style Find and text selection require a text layer from the frozen PDF; sharp zoom requires rendering at the requested scale rather than enlarging those fixed images. Bound rendering and search resources and preserve cancellation/local-resource restrictions.
- The DOCX viewer retains a sandboxed iframe with scripts disabled. Host-controlled search and zoom use the same-origin rendered document without granting document scripts or navigation permissions.

## Implementation guidance

- Retain Pitchcrew's paper workspace, clay controls, typography and light/dark themes while adopting email-style information hierarchy.
- Use a request header with subject, sender, job context, timestamp and status; follow it with the request explanation, exact action details where relevant, attachment tiles and persistent decision actions.
- Keep the reading view selected when its request leaves Needs action, so snapshot refreshes do not replace the visible outcome with another request. Next request should explicitly advance to another matching actionable request; show an empty state when none remain.
- Restore the list's search, filters, scroll position and selected-row focus when returning from a request. On narrow screens, retain the same list-to-reading-view flow and give attachment dialogs the available viewport.
- Use shared focus-managed dialogs. Keep the filename, attachment position, Close and Previous / Next controls visible. Disable Previous / Next at the ends; do not wrap. Cancel unfinished document rendering and release preview resources when changing files or closing.
- PDF controls should support page navigation, zoom, fit width and fit page. DOCX must retain the browser-versus-Word layout notice; do not imply that estimated Word page counts are authoritative. Text viewers should support copying; Markdown should offer rendered and literal source views. Screenshot viewers should support zoom, fit and panning.
- Keep document-verification summaries visible in the reading view, associate warnings with affected attachment tiles, and show detailed findings in the viewer. Preview failures need visible errors without making other attachments inaccessible.
- Preserve frozen bytes and existing export/download gates. Viewing or copying text does not grant export approval. Failed or unavailable generated documents must not look like available export attachments.
- Packet-export requests do not currently retain a requesting agent ID and are recorded as user-requested. Use truthful sender attribution (such as Pitchcrew for these requests) rather than inferring Writer from the document type; browser requests retain their actual agent identity.
- Persist read state across reloads using the existing device-local preference convention. Keep it independent of request resolution and notification-bell read state. Search the full request collection before applying any display limit.
- Apply the new evidence presentation within Inbox; the existing pinned browser approval panel remains a separate presentation of the same exact-action approval.

## Implementation and verification

The Inbox redesign is implemented in the shared browser/Electron renderer. Packet and browser approvals share email rows, a separate reading view and file-specific dialogs. Read state remains device-local, and list filters and reading selection survive snapshot updates.

Submission choices use protected user-session routes. Event version 26 persists the chosen method and the application conversation/request links; versions 1–25 remain readable. Agent preparation uses the existing durable conversation queue, runtime setup checks, browser supervision, exact final-action approval and saved submission receipts. The agent's report never confirms the outcome by itself.

Exports use one stable directory per approval. A failed write can resume the already-consumed approval after rechecking the current reviewed packet and export gates. A completed directory is reused only when its complete file set and exact bytes match; modified or missing exports require a fresh approval. This recovery does not authorize an additional export or submission.

PDF inspection uses local-only PDF.js text layers from frozen bytes and visible-page canvas rendering at the requested scale. Canvas allocation is bounded and interrupted renders are cancelled. Find searches all rendered text layers, including offscreen pages. Image-only PDFs explain that search is unavailable. DOCX search and zoom are controlled by the host with document scripts, remote resources and navigation disabled. Markdown uses the shared static renderer with remote-image placeholders and an exact-source mode.

Automated coverage includes protected handoff routes, concurrent-start deduplication, interrupted export recovery, stale packet rejection and durable handoff replay. Headless browser coverage uses fictional jobs and frozen documents to exercise email navigation/read state, PDF search/highlights/sharp zoom, Markdown mode retention, searchable sandboxed DOCX, manual export/download, mobile layout, withdrawal, agent handoff and same-conversation receipt verification. No live provider or employer submission is part of verification.
