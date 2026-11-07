# Runtime authentication — independent design and functionality review (Claude, v1)

Date: 2026-11-07
Scope: the uncommitted shared runtime authentication/credential work. I read `AGENTS.md`, `docs/runtime-authentication.md`, every file under `packages/ui/src/RuntimeSetup` and `packages/ui/src/RuntimeConnectionSettings`, and `packages/ui/src/styles/runtime-setup.css`. To check product claims I also read parts of `packages/orchestrator/src/runtime-connections/index.ts`, `packages/orchestrator/src/runtime-setup/auth.ts`, `packages/adapters/src/process/runtime-connection-fields.ts`, `packages/core/src/runtime-auth.ts`, `packages/core/src/desktop-links.ts`, `packages/desktop/src/external-navigation.ts` and `packages/ui/test/runtime-connections.test.ts`. I opened and looked at all 15 screenshots in `%TEMP%/pitchcrew-runtime-auth-review-20261107`. Earlier settings/setup phases are out of scope.

## Score: 6/10

The safety model and the wording about truth are strong. Secrets are write-only and are never echoed. Before starting sign-in, the copy says whether the account is native or belongs to this workspace. A completed sign-in whose account check did not pass stays **Needs check** and is not shown as signed in. Recovery is confirmed and explains its effects, and the terminal runs only the fixed sign-in command. Below 7, I found five problems a real user can hit:

- Clearing the secret field silently turns it into **Disable**.
- Server validation messages are thrown away.
- Damaged credentials make the app say **Install first**.
- On desktop, the browser-consent sign-in needs a second click and also shows a false "blocked link" toast.
- In the sign-in terminal, sign-in links and device codes are hard to use, and Ctrl+C can stop the CLI.

None of these break an invariant. They do break the "plain, truthful, usable" bar this phase set itself.

## What works (verified)

- **Four plain source labels.** `ConnectionField.tsx:5-10` maps saved/inherited/disabled/unset to "Saved for this runtime" / "Inherited from the daemon" / "Disabled for this runtime" / "Not configured". The screenshots `credentials-desktop-saved*` show Saved and `credentials-phone-dark-draft-part2/3` and `authentication-settings-recovered*` show Inherited. The server-side derivation (`runtime-connections/index.ts:109-117`) matches the documentation table.
- **Write-only secrets.** The input starts empty, and the placeholder says "Configured value is hidden. Enter a replacement." The reveal button reads "Show typed value", which correctly means only the new value can be revealed. In the phone screenshot the draft stays masked. The pending-change hint ("This replacement will apply after you save.") is plain.
- **Draft guards.** A credential draft disables native sign-in, and the copy says so ("Save or discard your credential changes before starting sign-in.", visible in `credentials-phone-dark-draft.png`). The dialog close path includes `connectionDirty` in `useUnsavedChanges`. A 409 reload keeps the draft and explains why. `AccordionSection` uses `keepMounted`, so collapsing the section keeps the draft.
- **Scope before acting.** `AuthStart.tsx:37-41` shows "Signing in can change the account used by this CLI outside Pitchcrew." for native accounts and "This sign-in belongs to this Pitchcrew workspace." for workspace accounts. The sign-out confirmation (`AuthLogout.tsx:45-48`) uses the same split, keeps history, focuses Cancel ("Keep account") first and cannot be dismissed while working.
- **Completed but not verified.** The server sets `stage: 'completed'` with "Account readiness remains unverified…" (`auth.ts:345-349`). The step tab stays ochre **Needs check** and the heading stays "Connect your account" (`authentication-completed-unverified.png`, phone dark). Nothing claims a signed-in result.
- **Cancel, restart and timeout.** Cancel is always present while waiting. Cancelled and failed attempts become **Retry sign-in**. When the five-minute local limit expires, the link and terminal are hidden and Cancel stays, with an honest "Waiting for the CLI to stop" message. "Closing this panel keeps sign-in waiting" appears in both the terminal hint and the footer note.
- **Recovery scope.** The confirmation says "for all runtimes" and says the backup contains secrets. It also says native CLI accounts, managed sign-ins and saved agent/conversation selections are kept. Cancel ("Keep settings") is focused first. The test confirms the exact backup bytes and that the Grok `auth.json` is kept.
- **Terminal works in both themes and on phone.** The real PTY screenshot shows `[redacted]` replacing an inherited secret. On both the desktop and the 390px dark screenshots, the terminal is a usable 260px sunken surface whose cursor is visible. The terminal uses `screenReaderMode` and Tab leaves it.

## Must fix

### 1. Clearing a typed replacement silently becomes "Disable for this runtime"

`ConnectionValue.tsx:32` → `useRuntimeConnection.ts:47-56`. The input's `onChange` stores the raw string, so deleting every character stores `''`, and `''` is the documented **Disable** value. If a user starts typing a new key and then backspaces to cancel, the save count stays at 1. The only hint is a line that changes to "After saving, this variable will be disabled, including an inherited value." If they then press Save, an inherited key they never meant to touch is suppressed and the runtime loses authentication. Disable already has its own explicit button, so an empty _typed_ value should remove the draft entry, not mean Disable. A per-field "Undo change" would also help, because the only revert today is **Discard changes**, which discards every field.

### 2. Server validation messages are discarded; choice fields are free text

`useRuntimeConnection.ts:81-89`. Every error except 409 becomes "Authentication settings could not be saved. Your draft is kept." The server's specific messages never reach the user:

- "Use an HTTP or HTTPS endpoint without credentials, query parameters or a fragment."
- "Choose one of the supported values shown for this authentication setting."

They come from `runtime-connection-fields.ts:120-150`. The second message also refers to values "shown", but nothing shows them. `GOOSE_PROVIDER` and `HERMES_INFERENCE_PROVIDER` have no description listing their allowed values, and all six choice fields (`CLAUDE_CODE_USE_*`, `GOOGLE_GENAI_USE_VERTEXAI`, Goose, Hermes) render as a free-text `Input`. Fix this by showing the API's 400 message (it carries no secrets) and by rendering declared choices with the shared `FormSelect`. That means exposing `choices` on `RuntimeConnectionField`.

### 3. Unreadable credentials tell the user to install the runtime

When the credentials file is damaged, `withEnvironment` throws inside detection, so `runtime.available` becomes false. The test asserts this (`runtime-connections.test.ts:676`). `authentication-settings-unreadable.png` shows the result:

- Installation **Needs setup**, Sign-in **Install first**, Models **Install first**.
- The background row's action changes from Manage to **Set up**.
- The panel shows "Finish installing a compatible runtime before signing in." underneath two separate ochre credential alerts.

Because `index.tsx:25-27` opens on **Installation** whenever `!runtime.available`, a real user lands on the wrong tab. The recovery action is hidden two clicks away under Sign-in → Credentials, and the test only reaches it because it clicks the Sign-in tab directly (`test.ts:58`). The cause of the problem is misreported. Fix: carry a typed "credentials unreadable" readiness state separate from installation; open the dialog on Sign-in with recovery expanded; replace "Install first" and "Finish installing…" with one recovery message; and merge the two duplicate alerts.

### 4. Desktop browser consent: false "blocked link" toast and a second click

`AuthOpenLink.tsx:26-36` calls `window.open('', '_blank')` before the consent request. In Electron, `external-navigation.ts:6-11` receives `about:blank`, and `externalUrlBlockReason` reports it as `unsupported-protocol`. That sends the renderer's blocked-link feedback toast and denies the popup. After consent succeeds, `popup` is null, so nothing opens. The button then renders again as an `<a>` with the same label "Open sign-in page", and the user must click a second time with no explanation. The `NativeSignIn` auto-open effect explicitly skips consent interactions (`NativeSignIn.tsx:45`). So on desktop, the consent path for Grok ACP browser sign-in shows a false error and silently needs two clicks. Fix: in Electron (`window.pitchcrewBrowser`), skip the placeholder window and open the URL after the consent response is acknowledged, using the same path as the auto-open. In the web build, say "Your browser blocked the window — open the sign-in page" when `popup` is null. _This finding comes from reading the source; no screenshot covers a consent interaction._

### 5. Terminal links and device codes are hard to use, and copying can stop sign-in

`useAuthTerminalSurface.ts:35` sets `linkHandler: { activate: () => {} }` and loads no web-links add-on. The server strips OSC 8 links, and terminal interactions carry no `url` (`core/runtime-auth.ts:13`). As a result, for the documented device-style terminal flows (`copilot login`, Grok device PTY), the verification URL is not clickable and the device code has no copy button. Copying with the keyboard is risky: xterm passes Ctrl+C to the PTY as `\x03` unless `attachCustomKeyEventHandler` handles copy-with-selection, so a user copying the code with Ctrl+C can stop the CLI's sign-in. Phone width makes this worse: at 390px the terminal fits about 36 columns, so a long URL wraps across lines and is hard to select by touch. Fix: either extract allowlisted `https` URLs and device codes on the server into the existing `device` interaction shape (which `AuthOpenLink` and `AuthInteraction` already render with select-all), or add a guarded link handler that opens allowlisted hosts. Also map Ctrl/Cmd+C-with-selection to copy. _The fixture screenshots contain no URL or code output, so this is not visually verified._

## Should fix

6. **Terminal colors in light mode.** The theme overrides only background, foreground, cursor and green. xterm's default `white`/`brightWhite`/`yellow` are nearly invisible on the light `--surface`, and CLI choosers often use dim, white or yellow text. Set `minimumContrastRatio: 4.5`, map the remaining ANSI colors to tokens, and re-theme on light/dark changes. Today the theme is read once at mount (`useAuthTerminalSurface.ts:18-34`). The desktop screenshot also shows a visible seam: the xterm background (`--surface`) sits inside a `--sunken-fill` frame and leaves a different-colored scrollbar gutter on the right.
7. **Recovery gives no confirmation and does not mention inherited values.** After **Reset authentication settings** succeeds, the dialog closes and the editor just reappears. `authentication-settings-recovered.png` shows no notice. The user's Codex key, which was previously **Saved**, now silently shows **Inherited from the daemon**, so a different key applies without warning. The dialog should say "Daemon environment values will apply again." After the reset, show a notice naming the backup (the response already returns `backup`) and prompting **Recheck sign-in**.
8. **The single-field selector hides state and pending changes.** Only one variable is visible at a time, and the select options carry no source. For Claude Code (6 variables), Gemini (5) or Hermes, users cannot see what is Saved, Disabled or Inherited without opening each option. "Save authentication settings (2)" counts changes on fields that are not visible. Combined with #1, that means saving a Disable the user cannot see. Show the source in each option (for example "Anthropic API key · Saved"), or show a compact summary list of all variables and pending changes above the Save action.
9. **"Use daemon value" is misleading for inherited or unset fields.** For those sources, pressing it only deletes the draft (`useRuntimeConnection.ts:52-53`); it works as "undo". Hide it when it does nothing, or relabel it.
10. **After "completed / unverified", the primary button is still the sign-in method.** `authentication-completed-unverified.png` shows "Fixture device login" as the filled primary button and **Recheck sign-in** as the secondary one, even though the message tells the user to recheck. When `stage === 'completed'`, swap the emphasis so Recheck is primary.
11. **Accessibility details.**
    - The value input's label is only "New secret value" or "Value". The variable name and source are not linked through `aria-describedby`, so a screen reader announces neither.
    - The recovery button can be disabled (`blocked`) with no reason shown. The editor's "Wait for the current runtime operation…" line is skipped on the recovery branch (`ConnectionEditor.tsx:40-49`).
    - The sign-out dialog title does not name the runtime.
    - The Grok workspace sign-out copy omits the consequence the docs state: a configured `XAI_API_KEY` then applies.
12. **Minor polish.**
    - `AuthCode.tsx:58-70` puts Show code and Continue in a bare `<div>` with no gap or row class.
    - `AuthCredentials` fields have no description or reveal toggle.
    - On phone, "Use daemon value" and "Disable for this runtime" sit directly above the form-level Save and Discard buttons with the same alignment, so field-level and form-level actions read as one group (`credentials-phone-dark-draft-part3.png`).

## Verification limits

- I reviewed the code by reading it and inspected the provided PNGs. I did not run the app, any tests, a browser preview, an actual login, logout or inference, and I did not touch real credentials. The Demo runtime was not used.
- All screenshots use fictional fixtures hosted under the Codex/OpenCode rows. Labels such as "Fixture browser login" and the unverified detail text come from fixtures, not from shipped server copy. I checked the shipped copy separately in `auth.ts`.
- No screenshot covers browser consent (#4), terminal output containing a URL or device code (#5), the sign-out confirmation, timeout expiry, or a cancelled or failed retry. Those findings come from reading the source. #4 depends on how Electron reports `window.open('')` (`about:blank`) to `setWindowOpenHandler`; I inferred that from `externalUrlBlockReason` and did not observe it.
- I did not verify the Windows PTY path, the real Copilot or Grok output format, or how a screen reader handles xterm's accessibility tree. No physical phone was tested; the "phone" screenshots are a 390px emulated viewport.
- A fresh 11-case browser run was still going during this review, so newer screenshots may differ from the ones I inspected.
