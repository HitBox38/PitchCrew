# Watched profile maintenance

Profile maintenance supplies the tools for a future Documenter seat. It does not create a role, turn on account access, or change live user data during installation.

On Profile, enable watching for an imported GitHub or Drive folder. To watch a project's code changes without importing project documentation as personal facts, use the GitHub source form, choose the repository and optional branch/tag and folder, and select **Watch project changes**. Leave the folder empty to permit investigation throughout that repository. Adding a project watch records its current commit as the baseline; it imports no profile notes. There are at most 20 source connections, including project watches.

An agent needs the opt-in `maintainProfile` capability and the source's `github` or `drive` capability, as well as a connected account. The dedicated maintenance tools only use user-enabled source watches. Pausing watching, removing a source or disconnecting its account prevents further reads; an in-flight read rechecks the current watch, role/run authorization and account before returning data or storing a proposal. Removing a source keeps its local notes. Ordinary GitHub connector tools retain their separately configured repository access.

## Agent tools

- `pitchcrew_list_watched_profile_sources` lists accessible watch IDs and saved revisions, without exposing other source configurations.
- `pitchcrew_detect_profile_changes` scans one saved source. Imported folders produce exact proposed documents with their current local contents, source revisions/URLs and conflicts. Removed upstream files are reported and kept locally, including when the folder becomes empty. An existing pending proposal is returned instead of duplicating it.
- GitHub project watches compare repository commits, independently of Markdown content. A changed commit creates a durable observation containing the previous and current commit. It may reflect changes outside the selected folder; the watch's folder bounds subsequent evidence reads. Pinned refs only change when that ref resolves to a new commit.
- `pitchcrew_read_project_watch_file` reads a UTF-8 file within the watch folder at the observed commit, up to 50,000 characters. Paths outside the folder, traversal, binary text and directory listings are rejected. Source text remains untrusted reference material.
- `pitchcrew_propose_profile_note` appends an exact proposed Markdown note and 1–5 pinned evidence-file snapshots to a pending project observation. Later authorized turns can investigate an earlier observation. Each observation permits at most three notes, each up to 50,000 characters; each run may create at most three observations/refresh proposals. Personal contribution, adoption and impact are not established by code alone.

Imported-folder scanning retains the existing source bounds: at most 100 documents, 30 folders, 50,000 characters per document and 1 million characters total. GitHub profile imports inspect Markdown/plain text; project investigation can read supported UTF-8 code files. Drive profile scanning covers Google Docs, Markdown and plain text through the existing reader; project watches currently support GitHub only. Network/permission failures leave existing notes and watch baselines unchanged.

Use an existing routine to request scans at the desired interval. The daemon must be open; no new OS service or autonomous background provider loop is added. Routines launch isolated turns with current role permissions. Maintenance tools never approve changes or write profile notes.

## Review and recovery

Profile displays pending proposals with selectable exact before/after documents, source links, pinned project evidence and upstream removals. Conflicting local notes start unselected. Review contradictions and verify personal facts explicitly before applying selected documents as resume evidence. The application cannot automatically establish personal authorship or semantically verify every claim. A project observation can be acknowledged without adding any notes.

The user decision includes only the proposal ID, snapshot digest, selection and fact confirmation. A changed proposal invalidates an earlier review. Approval never fetches source content again. It checks current source configuration, connected account, all profile-note hashes and the selected files. Another local edit or source change requires a fresh proposal. Removing a remote document never deletes a local note automatically.

All agent runs must finish before applying notes. The board records the exact approved selection as `applying` before filesystem writes. File replacements and the manifest commit use atomic rename, with rollback on ordinary write errors. A process interruption retains the proposal and approved selection across restart; **Retry approved update** accepts only that same snapshot and selection and recognizes files already written by the interrupted attempt. Until the retry finishes, chat/workflow starts, scheduled occurrences and other profile-note writes are blocked so agents cannot consume an incomplete batch. A stale or externally edited interrupted batch requires the user to restore the reviewed file contents/source configuration before retrying; it is not automatically overwritten.

Version 9 `profile_proposal` events persist proposals, exact documents, evidence and decisions in the existing append-only board. Versions 1–8 remain replayable. Imported-source configuration stays in `profile-sources.json`; account credentials remain in the connector credential store and never enter proposal events. Data remains outside the repository.
