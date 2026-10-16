# Profile sources dialog redesign

Status: implemented.

## Scope

Improve the Profile sources dialog on the Profile page. Keep the surrounding
Profile workspace and account-connection experience outside this facelift.
Use the existing source, import, watching and proposal capabilities.

The agreed domain distinction between **Profile note import** and **Project
watch** is recorded in [CONTEXT.md](../CONTEXT.md). Existing maintenance behavior
and review requirements are described in [profile-maintenance.md](profile-maintenance.md).

## Source list

The main view prioritizes existing sources, with one **Add source** action.
Use a quiet list in a slightly wider dialog, retaining the app's paper and clay
materials. Show clear source names, muted locations, compact status badges and
subtle row separators. Keep the dialog responsive, with internal scrolling for
longer content.

Each source shows its provider, location, source type and relevant metadata.
Imported sources show document information; project watches show their tracked
revision rather than presenting zero imported documents as their main status.

Keep these controls visible:

- A **Watching** switch with explicit On/Off status.
- **Review updates** for imported notes.
- An **Updates to review** badge and **Review** action when an agent proposal exists.
- A three-dot menu containing **Remove source**, with an explanation that local
  notes are kept.

Watching makes a source available to authorized agents. It does not itself
schedule checks or automatically apply notes; concise supporting copy should
preserve this distinction.

With no sources, show a welcoming empty state with GitHub and Google Drive
choices. Do not show this empty state while the initial list is loading or when
loading has failed.

## Adding a source

**Add source** switches the dialog body to a focused setup view. A **Back** action
returns to the source list. Do not expand the setup form underneath that list.

Choose a provider, then tailor setup to that provider. Before showing GitHub
details, ask the user to choose their intent:

- **Import profile notes**: bring personal documents into Profile, with optional
  watching for future updates.
- **Watch a project**: let an authorized agent investigate project changes and
  propose notes for review.

Use that intent to tailor the fields, explanation and primary button. Google
Drive continues to support profile note imports. Preserve existing account
connection and permission requirements.

Reuse the existing imported-document review and its selection rules; redesigning
its separate review drawer is outside this dialog-only facelift.

## Agent proposal reviews

Replace the fully expanded proposal forms beneath the source list with compact
source-level review indicators. **Review** switches to a focused view inside the
same dialog; **Back** returns to the source list.

Retain document comparisons, pinned evidence, selections, personal-fact
verification, rejection and interrupted-update recovery controls. Pending or
interrupted proposals must remain reachable even if their source is no longer
in the current source list.

## Loading, errors and completion

Show a visible spinner with action-specific status text while data is being
fetched, including initial source loading, document reading and project-watch
creation. Example labels include **Loading sources…**, **Reading GitHub
documents…** and **Checking project…**. Do not show invented percentage progress.

Distinguish fetching documents from saving an import or applying an update.
Prevent duplicate submissions and associate progress with the affected action.
Expose status changes accessibly and respect reduced motion.

Errors stay with the affected view, preserve entered values and allow retry.
An unsuccessful refresh must not clear an already loaded source list.

After importing notes or applying an update, return to the source list with a
success message and an **Open note** action when a note was saved. Importing no
longer closes the sources dialog or automatically opens a note. Choosing
**Open note** explicitly opens the note in the Profile workspace. Successfully
adding a project watch also returns to the updated source list.

## Existing safeguards

Retain the current reviewed-snapshot import, conflict selection, removed-file
preservation, proposal approval and recovery rules. Imports grant no additional
agent permissions. Watching and source removal retain their current semantics.
Keep Profile's unsaved-note protection when an action would affect those notes.

## Verification

- Verify empty, loading, failed-load and populated source-list states.
- Exercise GitHub note imports, GitHub project watches and Drive note imports.
- Verify source switches, update reviews and source removal retain their semantics.
- Exercise proposal review, rejection and interrupted-update recovery.
- Confirm imports and applied updates return to the list; **Open note** is explicit.
- Verify keyboard navigation, focus restoration, announced status changes, reduced
  motion and narrow-window scrolling.
- Keep the existing source API contracts and run the relevant UI/workflow checks.

Browser regression coverage lives in `packages/ui/test/profile-sources.test.ts`.
It uses an isolated daemon and fictional connector data to exercise the source
APIs, reviewed imports, project watches, decisions and recovery without provider
calls. The existing profile-source and maintenance suites cover server-side
snapshot validation, conflicts and recovery contracts.
