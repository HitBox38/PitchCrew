# Claude Opus 5.5 runtime setup review 2

Read-only independent review, 2026-11-07. This records the reviewed iteration; later fixes are described in the [review record](../runtime-setup-review.md).

Opus 5.5 V2 review of the runtime setup feature (read-only; I didn't run any tests or builds).

## Rating: 8.4 / 10 for design and interaction

The V1 problems are fixed at the source:

- **Sign-in screen:** the auth failures are distinct and readable, with a countdown. It has one primary action per state: Sign in with ChatGPT/Claude, then Open sign-in page, then Retry. Skip to models is a ghost button.
- **Code entry:** the field is masked, takes focus, and the code is only forwarded to the live sign-in flow.
- **Step beads:** they show real install and sign-in states. The dialog opens on the first step that needs attention.
- **Closing:** Close is visibly disabled during a short request, with a saving message.
- **Models:** a stale save gets a 409 that keeps the draft. "Saved" feedback appears, and focus returns to the edited row.
- **Unreadable preferences:** recovery is confirmed by the user and keeps a backup.

The two P2s from Codex V3 are also fixed:

- **Focus reload:** in `useRuntimeModels.ts`, a reload triggered by window focus or visibility is dropped if a save started or finished while it was in flight. A load cannot start during a save, so it can no longer overwrite a newer save.
- **Old sign-in success:** `NativeSignIn.tsx` only shows "connected" when the current account check passes. Otherwise it shows "The previous sign-in finished. Recheck…", and `v3-historical-signin-outdated.png` matches that.

The backend sign-in sequence also looks right. Old sessions are invalidated before the CLI child starts, and storage failure stops the sign-in. Cached readiness is cleared after cancel or failure. There is a five-minute process deadline.

## Ship recommendation

Ship to `dev` once the pending 24+ browser run and the final lint/typecheck pass. Fix defect 1 first if it's cheap; it's small. Nothing I found is a security or approval-gate problem.

## Remaining product defects (from the code, plus screenshots where noted)

1. **A failed install message never goes away (P2-lite).** In `orchestrator/src/runtime-setup/index.ts:114`, the result of the last install attempt is always returned, and nothing ever clears it. `InstallProgress` then always renders it. If a managed install fails and the user later installs by hand and rechecks, the step shows a ready bead and "Compatible installation found". Directly below it says "The runtime installer failed… retry", but no install button exists any more. `v2-installation-failed.png` shows exactly that mix. Possible fixes: hide finished install results once the runtime is ready, add a dismiss, or clear the result on a successful recheck.
2. **A failed focus reload leaves a stuck error (P3).** In `useRuntimeModels`, `load()` sets an error when a read fails, but a later successful read never clears it. One failed reload on window focus leaves the red alert and Reload button up even after the data is fresh.
3. **A successful change can look like a failure (P3).** In `useRuntimeSetup.request`, an action is reported as failed if only the refresh after it fails. Example: the executable path is saved, then the refresh errors. The user sees an error and the draft isn't cleared, though the change was saved. Re-saving the same value is harmless, but the message misleads.
4. **The expiry countdown can contradict the buttons (P3).**
   - The countdown runs from the server's `expiresAt`, but the actual five-minute timeout starts slightly later, when the CLI process launches.
   - For about a second, the screen says "Retry sign-in to get a new one" while only Cancel is shown. The Open sign-in page link also stays the primary button after expiry.
   - "Link expires" is really Pitchcrew's own time limit, not the provider's link expiry.
5. **Step and bead polish (P3, from screenshots):**
   - The status text in the step tabs wraps ("Waiting on / you", "Manage / choices") on both desktop and phone.
   - "Not signed in" shows an empty bead labelled "Needs check" instead of ochre, which the bead rule uses for "waits on you".
   - The Models bead never changes state, so it carries no information.
   - In dark mode, the empty bead is barely visible.
6. **Models step layout (P3):**
   - It has a small "Models" label where the other steps have a heading.
   - The always-present notice line leaves a gap under the toolbar.
   - After a conflict, "Reload model choices" is redundant because the 409 already reloaded (`desktop-models-conflict-draft.png`).
7. **Small UX gaps:**
   - "Clear custom path" only clears the field; the user still has to press Save.
   - The code field is masked with no way to reveal it, which makes pasted codes hard to check.
   - The reset-choices dialog closes on success but sends a failed reload's error to the panel behind it.

## What wasn't validated

These are stated limits, not defects:

- No live OAuth callback, account switch, real managed npm install or inference was run. Sign-in, install and the UI were exercised only against fictional fixtures.
- The newest 24+ browser run (covering the last two Codex fixes) is still pending, and lint/typecheck hasn't been re-run after the last small fix.
- No screen-reader or physical-phone audit was done.
- Remote multi-instance setups and the ACP registry are out of scope.
