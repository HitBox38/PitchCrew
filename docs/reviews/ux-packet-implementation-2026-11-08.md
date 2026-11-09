# Packet, export and history UX fixes: implementation notes (2026-11-08)

Scope: UX-06, UX-08, UX-09, UX-10 and UX-11 from [ux-journey-2026-11-08.md](ux-journey-2026-11-08.md). The shared audit document is unchanged. Files listed under "Do not edit" (`next-action.ts`, `useCardDetails.ts`, `JobActions.tsx`, ClayInterface, ChatView headers, Onboarding) were not touched.

## UX-06: packet documents read as raw Markdown

- New `CardDetails/components/PacketDocumentView.tsx`. It is used by `JobPacket.tsx` in place of the monospace `SourceBlock`.
- **Readable** is the default. It renders through the shared `MarkdownContent` with `noRemoteImages`, the same safe path as the FileViewer's `ViewerBody`, so Streamdown link confirmation and desktop URL validation still apply and remote images never load. Headings use plain elements so the sheet's document scale applies. This matches the chat packet panel.
- **Copy text** copies the exact saved Markdown through `lib/clipboard.ts`.
- **Source** shows the existing `SourceBlock` with its own copy action.
- Nothing is edited or rewritten. Empty documents say so. The chosen view stays the same when switching documents.
- Styles: `.job-packet-*` in `styles/job-details.css`. The paper sheet is capped at 32rem with internal scrolling and has phone padding.

## UX-08: export defaults and busy copy

- New pure helper `CardDetails/export-format.ts` (`suggestedExportFormat`, `exportFormats`, labels). It looks at the confirmed, inspected form's visible, enabled file fields whose labels match resume or cover letter. It reuses `acceptsFile` and `sourceFor`; `sourceFor` is now exported from `InboxView/handoff.ts`.
  - Every matched upload accepts PDF → PDF.
  - Every matched upload accepts Word but not PDF → Word.
  - Uploads split between PDF and Word → PDF and Word.
  - No matched upload accepts either → Markdown only, naming each field and its `accept` value.
  - Uploads that accept neither are named in a caveat whichever format is suggested.
  - No inspection, or no resume/cover upload → PDF as a suggestion only. The copy says Pitchcrew hasn't checked which files the form accepts.
- `ExportRequest.tsx`:
  - The menu is labelled **Files to export**, with the options PDF / Word (.docx) / PDF and Word / Markdown only. The suggested option is marked "(suggested)" and selected by default.
  - A caption gives the reason, says Markdown copies are always included, and explains that Pitchcrew generates and checks the files, then the user approves the exact files in Decisions, and nothing is sent.
  - The request body is the same as before (`formats` + `layout`). The layout menu is unchanged.
- `WorkspaceStore/job-actions.ts`: `POST /cards/:id/approval` now shows **Preparing and checking documents…** instead of Saving job…. Other labels are unchanged.

## UX-09: post-export handoff

- New `InboxView/components/ExportHandoff.tsx`. It renders at the top of `PacketDetails` (Decisions and History) whenever `approval.exportDirectory` exists:
  - a moss check with **Files saved on this computer**
  - a next-step line (`exportHandoffNext` in `handoff.ts`)
  - the full folder path, wrapping
  - **Copy folder path**, using `copyText`
- Manual export: "Open or download each file under Files, apply on {company}'s form, then choose I've submitted. Nothing has been sent." Agent preparation and past approvals get their own truthful lines.
- File access stays on the existing approved attachment tiles and FileViewer downloads directly below.
- No reveal or open-folder action was added. `revealArtifact` and its allowlist are unchanged, and there is no new shell or file access.
- The duplicate "Saved to …" caption was removed from `PacketExport`. Its CSS was replaced by `.packet-export-handoff` / `.packet-export-folder` in `styles/decisions.css`.

## UX-10: "Submit myself" labels an export

- The button is renamed to **Export to apply myself** in `PacketDecisionActions` and `SubmissionChooser`.
- `PacketThen`:
  - The option reads "Saves the files here. Nothing is sent; you apply on the posting".
  - The chosen state reads "You chose to apply yourself. The files are saved on this computer; apply on the posting, then record it here."
- The pre-choice consequence now adds "Nothing is sent yet".
- Manual tracking is unchanged: I've submitted is still a separate action.
- Updated the matching references in `packages/ui/test/inbox.test.ts`, `docs/inbox-redesign.md`, `docs/packet-exports.md` and `AGENTS.md` (two label occurrences only; that file also holds unrelated concurrent edits from other tasks).

## UX-11: history leads with bookkeeping

- `hooks/useJobHistory.ts`: snapshot run events now carry `runStatus` taken from `event.data`. Saved card history still returns no data.
- New pure helper `CardDetails/history.ts`. A row counts as technical **only** if:
  - its message exactly matches a known bookkeeping message (Released application, Released deep-review application, Claimed application for deep review, Saved turn activity, Consumed approval for local export, Recorded memory sources), or
  - it is a card event ending "claimed this application", or
  - it is a run event saved while that run was still `running` (progress lines and starts).
- Anything containing failure, error, interruption, cancellation, "stopped", "could not" or retry wording always stays in the main history, as do unknown messages, finished or failed runs and run events without a status.
- `JobHistory.tsx`:
  - Meaningful rows come first and use `activitySentence` for product wording (for example "Moved to agreed" → "Moved to Reviewed").
  - A shared `AccordionSection` labelled **Technical steps (N)**, collapsed by default, lists every remaining event with its exact stored message.
  - Every event appears exactly once. Nothing is deleted or rewritten in storage.
  - The actor `user` now reads "You".

## Checks run (Bun 1.4.4 via npx)

- New `CardDetails/__tests__/packet-handoff.test.ts` (3 tests) covers:
  - the history split (failures, interrupted runs and unknown wording stay visible; no event is lost)
  - format suggestions (unchecked, PDF/Word mix, Word-only, unsupported `.txt`, non-resume uploads ignored)
  - the busy label
  - the handoff next step
- `vitest run` on CardDetails, InboxView, ActivityPage and JobWorkStatus: 12 files, 51 tests passed.
- Browser suites:
  - `packages/ui/test/inbox.test.ts`: 7 of 7 passed. It uses the renamed button and still checks exact downloads.
  - `packages/ui/test/job-details.test.ts`: passed.
  - `packages/ui/test/application-form.test.ts`: **1 failure, not from this group.** "Inspect the application form, or choose to check it yourself, before confirming." now appears twice, from the concurrent `ApplicationBriefReview` and `next-action` changes owned by the other active task.
- `oxfmt` on all changed files, `oxlint --deny-warnings`, `scripts/check-components.ts` and `tsc -p packages/ui`: clean.
- No native or visual verification. The parent owns live UI review.

## Open points for parent review

Fresh native check: the new fictional job defaults to **PDF (suggested)** with an explicit unchecked-form limitation. Requesting approval shows **Preparing and checking documents…**. Decisions contains the expected two PDFs and four Markdown documents; the new resume PDF renders, and downloads stay disabled before approval/export. After Approve packet, **Export to apply myself** exports locally and the saved-files box says to apply on the employer form, then choose **I've submitted**, with **Nothing has been sent** visible. Manual tracking remains a separate action. UX-08/09/10 pass this native check. Parent found a separate navigational footer issue during the run (UX-16 in the main audit) that needs one more iteration.

Parent review: native Electron confirms Readable opens with styled headings/bullets and Source retains the saved Markdown. The exported-files box is at the top of Decisions History, the long path wraps, Copy folder path reports success, and the approved resume PDF opens and renders. Parent caught and fixed two small source-review findings: unfamiliar running-run messages must remain in the main history (only known progress/start templates move to Technical steps), and the Word suggestion must not claim every field rejects PDF when some also accept it. Native history also exposed repeated “Recorded run Profile version” entries; these now join the known bookkeeping list. Failed/interrupted/cancelled run states always remain visible. Added regression cases; packet helper tests pass 3/3. The cross-group application-form browser failure was resolved by scoping the repeated hint and testing the persistent footer confirmation; it now passes. Fresh export-choice/manual-handoff verification remains before final review.

- No folder-reveal action, by design. Copy folder path is the only supported web and desktop handoff. A desktop "Show in folder" would need a separately validated main-process allowlist for export directories.
- The no-inspection default is PDF and is labelled as a suggestion. If you prefer no preselection, the helper's fallback is a one-line change.
- Run-start events ("Started Writer on demo") count as technical only when the snapshot shows them as running. Card-history copies without data stay visible.
