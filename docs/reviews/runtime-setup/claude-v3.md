# Claude Opus 5.5 runtime setup review 3

Read-only independent review, 2026-11-07. This records the reviewed iteration; later fixes are described in the [review record](../runtime-setup-review.md).

**Score: 8.6/10.** I'd ship once one small fix lands: if the saved model-preferences file is unreadable, every agent's model picker breaks, not just this dialog. Everything else below is polish.

This was read-only. I looked at all the screenshots you listed (the desktop/phone custom-editor and conflict screenshots only in part) plus the RuntimeSetup, RuntimeModels and ModelField code and the orchestrator's runtime-setup and model-preferences routes. I didn't run any tests.

## What holds up

- All the V2 fixes you listed show up correctly in the screenshots and code:
  - A finished install attempt folds into "Previous installation attempt" once the runtime is ready.
  - "Cancel installation" only appears while an install is running.
  - The countdown, masked code with Show code, and Cancel sign-in all appear together.
  - Expired sign-in shows a single Retry sign-in with no claim that a link is still valid.
  - Checking shows no countdown.
  - "Models · Saved" sits inline.
  - The conflict message keeps the draft.
  - The reset dialog keeps the reset result and offers Close / Retry loading.
- Closing the dialog asks before discarding an unsaved executable path or custom model (`RuntimeSetup/index.tsx:31`). While a custom model is being edited, the list, Refresh and Add are disabled, and focus goes back to the right row afterwards.
- The copy is honest throughout: "Pitchcrew does not save the code", "Signing in can change the account used by this CLI outside Pitchcrew", "None and Off are different CLI values", and custom models are labelled unverified.
- Phone dark and light layouts hold up at 390px: the three-step grid fits, nothing scrolls sideways, and the footer stays pinned.

## Product defects

1. **Should fix before merge: an unreadable preferences file breaks every model picker.** `ModelField/api.ts` loads the catalog and preferences with `Promise.all`. The preferences request fails when the file can't be read (`store.ts:37`), so the whole load fails. Every role and conversation model picker then falls back to the initial catalog and says "Could not refresh models. Showing the last loaded choices." That message is wrong and points nowhere near the fix. The fix is to load the two separately and fall back to default preferences while keeping the native catalog.
2. **The unreadable-preferences state in the dialog is confusing** (`desktop-models-unreadable.png`):
   - The note says "Use Refresh models to try again." (`RuntimeModelsPanel.tsx:48`), but refreshing the catalog can't fix a broken preferences file. Recover model choices is the real fix.
   - The native model list disappears even though the catalog itself loads fine.
   - Three similar actions compete: Reload model choices, Recover model choices and Refresh models.
   - The Reload and Recover buttons touch, because `RuntimeModelsFeedback` wraps them in a plain `<div>` with no gap. They are also different sizes (`sm` against the default).
   - Whether to show Recover is decided by checking if the error text contains `runtime-model-preferences.json`. Any change to that wording silently removes the recovery path.
3. **The Models step says "3 listed" while the list shows 4 rows** (three native models plus one custom, in `desktop-models-configured.png`). It should either count custom models too or say "3 native".
4. **Status beads don't always match their meaning:**
   - While the install is running, Sign-in shows an ochre "Needs check" bead (ochre means waiting on you), but you can't do anything about it until the install finishes. It should be an empty, idle bead.
   - Expired sign-in pairs a rose bead with the label "Needs check"; it should say "Expired" or "Failed".
   - The models conflict message is styled rose, like a failure. It's a "review and save again" moment, so ochre fits better.
5. **Copy:**
   - "Attempt time limit in 5:00" reads awkwardly; something like "Time left: 5:00" is clearer.
   - On the phone sign-in screen, "Sign in with ChatGPT." appears as a sentence right above a button with the same words.
   - "Recheck sign-in" sits below the collapsed "Other sign-in options" section, so it looks orphaned.
   - Open sign-in page and Cancel sign-in are stacked vertically on desktop.
   - The models step opens with four paragraphs of explanation before the list.
6. **Two primary-styled buttons in one view:** "Save model" and "Done" both use the primary style while the custom-model editor is open. Done could be secondary while editing.
7. **Touch targets are narrow:** the star, arrow, edit and delete icon buttons are 32px wide by 44px tall on coarse pointers (`size-8` plus the dialog rule that forces a 44px minimum height). That misses the 44px rule in width.

## Validation limits (not product defects)

- `v2-installation-failed.png` has no Install runtime button because the test setup marks installation as unavailable. Its copy says "retry", but the screenshot can't show the retry path. In real use the button shows when `canInstall` is true (`runtime-setup/index.ts:85`). One extra screenshot with installation available after a failure would cover this.
- `phone-dark-models-custom-editor-part3.png` shows Save model disabled with High ticked. The screenshot doesn't say why, and I didn't confirm it.
- No real sign-in, managed install, screen reader or physical phone was tested. The 2 PostHog test failures on the full root run predate this work and are unrelated.

## Ship recommendation

Fix #1, and ideally #2 since it's the same failure. After that it's ready to merge. Items 3 to 7 can follow afterwards.
