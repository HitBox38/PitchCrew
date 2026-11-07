# Runtime authentication: independent design and functionality review (Claude, v4)

Date: 2026-11-07
Scope: the current runtime authentication revision, checked against my previous review [claude-v3.md](claude-v3.md) (8.8, approve) and [codex-v5.md](codex-v5.md) (9.3, approve).

What I read:

- `AGENTS.md` and `docs/runtime-authentication.md`.
- [electron-link-verification.md](electron-link-verification.md) and [electron-link-result.json](electron-link-result.json).
- Source, to confirm one finding: `RuntimeConnectionSettings/components/ConnectionField.tsx`, `adapters/src/process/runtime-connection-fields.ts` and `orchestrator/src/runtime-connections/index.ts`.

Images: I used only the 27 PNGs and `manifest.json` in `%TEMP%/pitchcrew-runtime-auth-review-20261107/final-v4/`. I did not open the parent folder or `final-v3`. Before reviewing, I recomputed every SHA-256 hash, and all 27 match the manifest. The `manifest.json` file itself hashes to `97dc1105…4e2b5f`.

I opened these captures:

- Both browser-consent captures (before and after consent).
- The unreadable and recovered captures.
- Both sign-out confirmations.
- The desktop and phone terminal captures.
- Both redraw parts and both real-PTY parts.
- Both incomplete-endpoint parts and both invalid-inherited parts.
- The first phone credentials capture.

I changed nothing except this file. I did not run the app, tests, a browser preview, OAuth, authentication, inference, the Demo runtime or any agents.

## Score: 9.2/10. Approve, with no must-fix findings

I raised the score from 8.8 for two reasons:

- The captures confirm every v3 polish item.
- The two largest evidence gaps in v3 are now closed. The asynchronous Electron popup path was tested in real Electron. The two credential-field states that v3 could only check in source now have screenshots.

What remains is one visible copy error and some cosmetic details. Live providers are still unverified.

## v3 findings: status

| v3                                         | Status                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1: action row wraps after consent         | Fixed. In `native-signin-browser-consent-acknowledged.png`, "Sign-in page requested. Complete sign-in in your browser, then return here." is on its own line. Below it, **Open sign-in page again** and **Cancel sign-in** stay right-aligned. The row matches its position before consent; the only change is that the primary glaze button becomes a raised reopen button, which is the right step down after the page has been requested. |
| P2: recovery has no primary action         | Fixed. In `authentication-settings-unreadable.png`, **Recover authentication settings** is the glaze button inside the ochre note. The footer has only **Close** and the status "Authentication settings need recovery". This screen has one glaze action.                                                                                                                                                                                   |
| P3: sign-out confirmation reads as popover | Fixed. Both `native-signout-*` captures dim the setup dialog behind the confirmation, so it no longer looks interactive. The title and description now have a header gap. **Keep account** and **Sign out** in rose are still close in weight, which is acceptable for a destructive confirmation.                                                                                                                                           |
| P4: "Copied." never clears                 | Fixed in source, according to codex-v5: the notice expires after four seconds, the component owns its timers, and a clipboard request counter stops an older copy result from replacing a newer one. `native-signin-terminal-redraw-desktop-part2.png` shows the notice while it is still current. A still image cannot show the expiry, so that part rests on source and tests.                                                             |
| P5: keyboard hint on phone                 | Fixed. The phone terminal captures show no Tab or Ctrl/Cmd+C guidance; touch users get copy buttons instead. The desktop captures still show the one-line hint.                                                                                                                                                                                                                                                                              |
| P6: empty terminal area                    | Fixed. The terminal is about 200px tall on desktop and about 180px on phone. The actions and the closing note now fit above the footer on desktop.                                                                                                                                                                                                                                                                                           |

## Former evidence gaps, now visually verified

**Incomplete non-secret field** (`credentials-incomplete-endpoint-desktop*.png`):

- The blanked field stays empty and is labelled "Saved · Pending change".
- A fixed hint says "Enter a value, undo this change, or choose Disable…".
- **Use daemon value**, **Disable for this runtime** and **Undo this change** are offered.
- "Changes to save" lists "Incomplete value", and **Save authentication settings (2)** is disabled.
- Native sign-in is disabled until the user saves or discards: "Save or discard your credential changes before starting sign-in."

**Invalid inherited endpoint** (`credentials-invalid-inherited-desktop*.png`):

- The selector reads "Inherited · Needs correction".
- The value is blank, with the placeholder "Invalid daemon value is hidden. Enter a replacement."
- No credential-bearing URL is visible.
- Only **Disable for this runtime** is offered, which is correct because there is no override to remove.
- Save and Discard are disabled because there are no changes.

**Asynchronous Electron opening**: [electron-link-verification.md](electron-link-verification.md) tests the exact v3 concern. In real Electron 44.5.1:

- The test awaits 150 ms, so the renderer has no user activation (`userActivation.isActive === false`), then calls `window.open(url, '_blank', 'noopener,noreferrer')`.
- The unchanged production `installExternalNavigation` handler sends the validated HTTPS URL to the intercepted OS-opening boundary exactly once.
- The old `about:blank` placeholder gets `unsupported-protocol` feedback and is never sent to the OS.
- The run creates one BrowserWindow, which is never shown or focused, opens no dialogs, makes no external requests and exits normally.

That settles the question v3 left open. I read the report and the JSON; I did not rerun the test.

## Remaining findings

None of these is a must-fix, and none is a security, data-loss or approval problem.

**F1. Low: a doubled period in the invalid-inherited explanation.**
The capture reads "This does not add a custom provider definition.. The daemon value is not valid…". The cause is in `ConnectionField.tsx:38-39`, which adds `. ${…}` in front of both the description and the invalid-value message. The adapter description in `runtime-connection-fields.ts:43` already ends with a period, so the text shows "..".

The source label ("Inherited from the daemon") has no ending punctuation, so description text with a full stop could show the same problem anywhere it is joined this way.

Fix: join the parts as sentences, adding a period only when the previous part does not already end with one. Alternatively, render the source label, description and invalid-value message as separate `<span>`s. Add one text assertion to the existing invalid-inherited browser test.

**F2. Cosmetic: the recovery confirmation is plain body text.**
In `authentication-settings-recovered.png`, the message "Authentication settings reset. Backup kept as credentials.invalid-….json. Daemon environment values apply again. Recheck sign-in before starting work." looks like an ordinary paragraph between the section description and the field. It is the only confirmation that the reset happened and where the backup went.

Consider a quiet clay note or status style, so the change from the ochre recovery note reads as a resolved state. The long UUID filename is acceptable because it is the exact file name.

**F3. Cosmetic: the incomplete-field warning appears twice.**
In `credentials-incomplete-endpoint-desktop-part2.png`, the field hint ("Enter a value, undo this change, or choose Disable…") and the summary line ("Enter a value for each incomplete field, undo its change, or explicitly disable it…") are about 150px apart and say nearly the same thing.

The duplication is harmless, and the summary helps when the incomplete field is not the one currently selected. If anything changes, shorten the summary to name the field.

**F4. Cosmetic: the phone action order puts Cancel above the terminal.**
In `native-signin-terminal-phone-dark.png`, **Cancel sign-in** comes before the terminal, while the open-link and copy buttons come after it. The order is logical (flow control first, terminal tools second) and matches desktop, so I report it only to note that I checked it. It needs no action.

## Verification limits

- **Tests were reported to me, not rerun.** These include:
  - 76/76 browser tests across seven files, including the 45-test runtime subset.
  - 9/9 private API tests and 2/2 extra endpoint-capture cases.
  - Full typecheck and lint.
  - The earlier broad backend run (452 passed, 2 skipped) and the latest 30 focused tests.
- **The Electron result is a real run with an intercepted boundary.** Electron, the BrowserWindow, IPC and the production handler were real. `shell.openExternal` and `dialog.showMessageBox` were replaced, so the system browser, provider pages, OAuth completion and installed-app packaging were not exercised.
- **Provider output was not tested live.** All terminal output and all sign-in states in the captures are fixtures. Real Codex, Claude Code, Cursor, OpenCode, Copilot and Grok output formats and their link hosts were not checked against the extraction patterns.
- **Behavior over time comes from source and tests only.** The four-second copy-notice expiry, the clipboard request counter and interaction-keyed reset cannot be shown by still images.
- **Captures were taken at different times.** The 23 main captures and the 4 endpoint captures were taken about five minutes apart, reportedly from the same production revision. I cannot confirm from the images that the revision was the same.
- **No accessibility or device check.** I did not check with a screen reader, a physical phone or coarse-pointer hardware. The phone captures are emulated.
- **Server checks rest on codex reviews.** For server-side scope, redaction and recovery logic I relied on the docs and on codex-v4/v5, apart from the one source trace for F1.
