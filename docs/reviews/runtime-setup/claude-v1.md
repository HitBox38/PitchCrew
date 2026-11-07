# Claude Opus 5.5 runtime setup review 1

Read-only independent review, 2026-11-07. This records the reviewed iteration; later fixes are described in the [review record](../runtime-setup-review.md).

# Runtime setup review (Codex and Claude): design score 7.6/10, not ready to ship

**Recommendation:** don't ship this as the finished setup experience yet. The engineering underneath is solid. Credentials stay with the CLI, executable paths are carried through to checks, models and runs, and managed installs are locked, version-checked and cancellable. The main gaps are in how the dialog communicates: three findings below would each block a 9. I also couldn't confirm the two native sign-in commands (`codex app-server` and `claude auth login --claudeai`) against real accounts.

## What works

- Credentials never enter Pitchcrew. Auth links only open on a short list of known provider hosts, the pasted code is never saved, and sign-in output is size-limited. Saved conversation sessions are invalidated after sign-in, after a path change and after an install.
- Managed install is cautious: it only installs when no runtime is found, checks the npm version first and confirms it after install. It locks, can be cancelled, stays inside the data folder and fails safely if saving to disk breaks. The text says what it changes and what it leaves alone.
- Model preferences can't break saved agent or conversation choices: removing a custom model that an agent uses is blocked, and edits are checked against the saved version. The model list loads 50 rows at a time and starts over when the filter changes.
- Keep-mounted tabs, the unsaved-changes guard (which covers the path draft and the custom-model form), labelled icon buttons, `aria-pressed` on the star, polite live regions for progress, and focus put back on "Add custom model".

## Defects, in priority order

**Blocking a 9**

1. **Sign-in failures all show the same message.** In `orchestrator/src/runtime-setup/auth.ts:144`, `catch {}` throws away the actual reason. Expiry after 5 minutes ("Start again to get a new link"), "Codex sign-in did not complete", a missing executable and the output limit all display as "Native sign-in could not be verified". The `expiresAt` value is never shown either.
   - Fix: pass through a fixed set of known safe messages, and show a "Link expires in m:ss" line while waiting.

2. **The sign-in step is cluttered and partly contradicts itself** (`v1-native-signin-waiting.png`, `v1-phone-dark-signin.png`).
   - Two filled primary buttons sit on one surface: "Start native sign-in" and the footer's "View models". That breaks the one-glaze-action rule.
   - The most important action while waiting, "Open sign-in page", is a plain text link. Codex `app-server` only returns `authUrl` and doesn't open a browser, yet the text says "Your CLI may open it automatically".
   - While waiting, the dialog also says "No account check has completed yet. Recheck after configuring native authentication", shows a disabled "Recheck sign-in", and adds "An unverified result permits an attempt…". That's three statements that don't fit the state, plus jargon ("native", "model request", "entitlement").
   - Fix:
     - Make "Open sign-in page" the primary button, and on desktop open it automatically.
     - Hide the recheck block while sign-in is in progress.
     - Make the footer a quiet "Skip to models" until sign-in succeeds.
     - Label the Codex flow "Sign in with ChatGPT" and say that API-key setup is manual.

3. **The steps don't show their status, and the dialog always opens on Installation.** The row decides "Set up" from `missingAuth || !available`, but a runtime that only needs sign-in still opens on step 1. The tabs show no done or needs-attention state.
   - Fix: open on the first step that needs attention, and add done/waiting status markers to the three tabs.

**Should fix**

4. **Close and Escape silently do nothing while a request is in flight** (`dismiss` returns early when `working`). Disable the close button visibly, or say why closing is blocked.
5. **The executable path form can be confusing.**
   - "Use automatic detection" only clears the field; you still have to press Save. Rename it "Clear path", or make it save.
   - A path that doesn't exist shows the raw Node error (ENOENT, including the path) from `stat()`. Convert it to "No file at this path".
6. **Text points to a missing control.** `installDetail` says "Use its update action", but there's no update control inside the dialog.
7. **A model-preference conflict gets stuck.** The error says "Reload them before saving", but there's no Reload button, and later toggles keep failing against the old version.
   - Fix: reload the preferences automatically after a conflict.
8. **Star, Show and reorder save immediately with no "Saved" confirmation**, unlike the rest of Settings, which confirms on the control that changed.
9. **The Agent defaults section is seven equal outline buttons** ("Configure Scout"…) and doesn't show each agent's current model. That's the useful fact, especially when that model is hidden or a custom one. Use rows showing the current model, with a quiet Configure action.
10. **A long install has no progress indicator.** The timeout is 10 minutes and progress is text only. A disabled "Recheck installation" stays on screen during the install as noise.
11. **Small issues:**
    - After discarding an edit to an existing custom model, focus goes to "Add custom model" instead of that row's edit button.
    - The reasoning options include both "None" and "Off" with no explanation.
    - Preference changes reach model pickers only in the same window (via a `CustomEvent`); other tabs and windows stay stale.
    - "Credentials stay with your native CLI" repeats in the footer and the body on every step, which costs about 100px on a phone.
    - If `runtime-model-preferences.json` is corrupt, model catalogs fail for every runtime and the app offers no way to reset the file.

## Risks I couldn't rule out

- **Codex `--ignore-user-config`** (`adapters/src/runtime-auth/codex.ts`): this may skip the user's `config.toml` settings for where credentials are stored or which login is allowed. Sign-in could then save credentials where the user's normal `codex` doesn't look, or bypass an organisation's login restriction. Check this against real Codex before release.
- **Claude `auth login --claudeai`**: the command and the "Paste code here" text match are only tested against fixtures. Confirm both with the installed version.

## Evidence gaps

- No screenshots at all of Claude, the code-entry form, verifying, failed or cancelled sign-in, failed or interrupted installs, installer output, or the new manual "Recheck" button (the latest capture may be older than that fix).
- No keyboard-focus evidence, no light-mode phone, and no capture of a huge catalog with "Show more".
- The combined 13-test browser run is still pending.
- I didn't compare against the T3 source.

## Expected score after fixes

Fixing 1–3, plus 4 and 7, should bring this to about 8.8–9.0. Getting above 9 also needs screenshots of the failure and code-entry states, plus one real sign-in each for Codex and Claude.
