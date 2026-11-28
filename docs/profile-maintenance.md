# Profile editing and watched maintenance

Documenter defaults include direct profile editing, watched maintenance and routine management. Production defaults start paused. Startup turns on `editProfile` for a seeded Documenter when saving was never on, including a stored off that a settings save filled in; an off after saving was on stays off. A custom role that reused the id is left alone, and instructions are not rewritten. Startup adds no watches or schedules and changes no profile notes. The same tools remain available to any user-configured role.

## Direct user requests

A direct user request authorizes an agent with `editProfile` to create, edit or remove Profile notes through `pitchcrew_update_profile`. The gateway requires an active ordinary user-origin chat delivery owned by that role and run. Scheduled checks, crew handoffs, workflow runs and summary turns keep using proposals. Instructions must keep changes within the user's request and treat source content as untrusted reference material.

`pitchcrew_list_profile_edit_sources` provides note baselines and attached import mappings. Every save or deletion names the current local SHA-256 `baseline`; creation uses `null`. A stale baseline rejects the operation. Deletion retains the local note in Profile trash for 30 days. Writes use the shared serialized profile queue, permit only the calling run to remain active, and preserve interrupted-approved-update recovery checks.

GitHub-backed notes also synchronize the requested change to their connected profile source. The `editProfile` grant permits this source-bound sync with a connected account and a writable branch; the general GitHub capability is independent and can stay disabled. Existing notes retain their imported repository and path; a new note selects a source and path, with the sole imported GitHub source available as the default. Paths stay inside that imported source folder. Project watches and unrelated repositories are excluded. Watching is needed for autonomous detection, not for a direct requested edit.

The dedicated GitHub writer checks the expected remote blob SHA before committing the exact note contents or deletion. The active direct user chat and `editProfile` grant authorize this bounded profile commit without a second approval prompt. Ordinary connector tools retain read-only access. Remote conflicts, missing permissions and failed or uncertain writes are reported as unsynced; local edits remain saved, and remote mutations are never automatically retried. Google Drive remains an import source without write-back.

## Watched sources

For watched maintenance, connect the relevant account, enable GitHub or Drive for the role, and choose watched sources in Profile. Account access stays disabled by default.

On Profile, enable watching for an imported GitHub or Drive folder. To watch a project's code changes without importing project documentation as personal facts, choose **Add source** → **GitHub** → **Watch a project**, enter the repository and optional branch/tag and folder, and select **Watch project**. Leave the folder empty to permit investigation throughout that repository. Adding a project watch records its current commit as the baseline; it imports no profile notes. There are at most 20 source connections, including project watches.

An agent needs the opt-in `maintainProfile` capability and the source's `github` or `drive` capability, as well as a connected account. The dedicated maintenance tools only use user-enabled source watches. Pausing watching, removing a source or disconnecting its account prevents further reads; an in-flight read rechecks the current watch, role/run authorization and account before returning data or storing a proposal. Removing a source keeps its local notes. Ordinary GitHub connector tools retain their separately configured repository access.

Profile sources opens as a source-first dialog with an **Add source** action,
provider choices in the empty state and separate focused setup for note imports
and project watches. Source rows expose a Watching switch, manual **Review
updates** for imports and source removal in a menu. Watching permits authorized
agent checks; routines determine when scheduled checks run. Fetches and writes
show an action-specific loader. Pending proposals open from their source's
review indicator into a focused review inside the same dialog, including
interrupted-update retry. Imports and applied proposals return to the source
list with a success message and an explicit **Open note** action. The existing
import-document review drawer and account connection dialogs remain in use.
See [Profile sources dialog](profile-sources-dialog.md).

## Agent tools

- `pitchcrew_list_watched_profile_sources` lists accessible watch IDs and saved revisions, without exposing other source configurations.
- `pitchcrew_detect_profile_changes` scans one saved source. Imported folders produce exact proposed documents with their current local contents, source revisions/URLs and conflicts. Removed upstream files are reported and kept locally, including when the folder becomes empty. An existing pending proposal is returned instead of duplicating it.
- GitHub project watches compare repository commits, independently of Markdown content. A changed commit creates a durable observation containing the previous and current commit. It may reflect changes outside the selected folder; the watch's folder bounds subsequent evidence reads. Pinned refs only change when that ref resolves to a new commit.
- `pitchcrew_read_project_watch_file` reads a UTF-8 file within the watch folder at the observed commit, up to 50,000 characters. Paths outside the folder, traversal, binary text and directory listings are rejected. Source text remains untrusted reference material.
- `pitchcrew_propose_profile_note` appends an exact proposed Markdown note and 1–5 pinned evidence-file snapshots to a pending project observation. Later authorized turns can investigate an earlier observation. Each observation permits at most three notes, each up to 50,000 characters; each run may create at most three observations/refresh proposals. Personal contribution, adoption and impact are not established by code alone.

Imported-folder scanning retains the existing source bounds: at most 100 documents, 30 folders and 1 million characters total. Documents over the 50,000-character note limit are left out of detection rather than failing it or counting as removed. GitHub profile imports inspect Markdown/plain text; project investigation can read supported UTF-8 code files. Drive profile scanning covers Google Docs, Markdown and plain text through the existing reader; project watches currently support GitHub only. Network/permission failures leave existing notes and watch baselines unchanged.

Use an existing routine to request scans at the desired interval. The daemon must be open; no new OS service or autonomous background provider loop is added. Routines launch isolated turns with current role permissions. Watched maintenance tools never approve changes or write profile notes.

## Review and recovery

The **Review profile documents** sheet for manual source imports and refreshes lists only added, changed and locally conflicting documents, followed by documents removed from the source. Unchanged documents are hidden. Search matches filenames and folder paths without changing the selection; bulk selection includes all added and changed documents and excludes local conflicts. Conflicts start unselected and appear first. Removed-source rows are informational: local copies are kept, including when every upstream document has been removed.

Compact shared accordion rows expand to show the saved local text compared with the incoming snapshot, using the same paragraph and word highlights as agent instruction updates. **Full document** shows and copies the exact incoming text. Both sides are captured when the server stages the review; a subsequent local edit invalidates import. The comparison text is transient and is not stored in source manifests. Search, selection totals and import actions stay visible while the document list scrolls.

Profile displays pending proposals with selectable exact before/after documents, source links, pinned project evidence and upstream removals. Conflicting local notes start unselected. Review contradictions and verify personal facts explicitly before applying selected documents as resume evidence. The application cannot automatically establish personal authorship or semantically verify every claim. A project observation can be acknowledged without adding any notes.

The user decision includes only the proposal ID, snapshot digest, selection and fact confirmation. A changed proposal invalidates an earlier review. Approval never fetches source content again. It checks current source configuration, connected account, all profile-note hashes and the selected files. Another local edit or source change requires a fresh proposal. Removing a remote document never deletes a local note automatically.

All agent runs must finish before applying a maintenance proposal. The board records the exact approved selection as `applying` before filesystem writes. File replacements and the manifest commit use atomic rename, with rollback on ordinary write errors. A process interruption retains the proposal and approved selection across restart; **Retry approved update** accepts only that same snapshot and selection and recognizes files already written by the interrupted attempt. Until the retry finishes, chat/workflow starts, scheduled occurrences and other profile-note writes are blocked so agents cannot consume an incomplete batch. A stale or externally edited interrupted batch requires the user to restore the reviewed file contents/source configuration before retrying; it is not automatically overwritten.

`profile_proposal` events, added in version 9, persist proposals, exact documents, evidence and decisions in the existing append-only board. New events use the current version (`currentEventVersion` in `packages/core/src/events.ts`); every earlier version remains replayable. Imported-source configuration stays in `profile-sources.json`; account credentials remain in the connector credential store and never enter proposal events. Data remains outside the repository.

## Contributor rules

**Profile editing and maintenance.** `editProfile` permits baseline-checked note saves/deletions only in the owning direct user chat. Documenter defaults enable it, and startup turns it on for a seeded Documenter when saving was never on, including a settings-filled off; an off after saving was on stays off. GitHub-backed changes sync only within imported source folders through the dedicated optimistic writer, with a connected GitHub account; general GitHub access remains separate. Local edits survive remote failure and report unsynced status. Scheduled and crew-triggered maintenance still uses `maintainProfile`, enabled watches, pinned evidence and exact user-reviewed proposals applied while runs are idle. Interrupted approved updates block new writes and launches until recovered. See [docs/profile-maintenance.md](profile-maintenance.md).
