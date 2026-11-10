# External agents — Codex review, version 3

Reviewed the current shared source on 2026-11-10, concentrating on the two remaining material findings from the Claude v2 review and their connected callers.

**Source correctness verdict: 9.2/10. No unresolved actionable issue found in this reviewed scope.** This is not a rendered-design score or a rating of the whole app.

- **Copy labels now agree.** `SourceBlock` supplies `aria-label={copyLabel ?? \`Copy ${label}\`}`. The two labelled setup buttons therefore have accessible names matching their visible “Copy configuration” and “Copy prompt” text. `CodeBlockCopyButton`keeps that action text stable after copying; its checkmark,`data-copied` state and separate polite “Copied” announcement still provide confirmation. The passed label overrides the primitive's default name through its existing props order.
- **Other copy callers retain their behavior.** Unlabelled `SourceBlock` callers keep their descriptive accessible names and default size. The direct Markdown copy caller passes no new label and is unaffected. The existing value key still clears stale copied/error feedback when the configuration format changes.
- **Saved confirmation follows the controls.** The `saved` output is now directly after `ExternalAccess` inside the “Choose access” list item. It remains present when access is switched off because the disabled grant is still a loaded `info` object. An ambiguous failed save still clears stale controls and requires a fresh read.
- **Selectors follow the change.** The Settings clipboard tests and both desktop smoke selectors now target “Copy configuration.” A source search found no obsolete “Copy Pitchcrew MCP configuration” or “Copy Connection check prompt” selectors in `packages`. The existing tests retain checks of exact clipboard content, format changes, copied-state reset and clipboard recovery.

The earlier grant-slot race and UUID receipt fixes are unchanged from the v2 review. No new transport, permission or runtime execution authority is introduced by v3.

Validation in this review: connected-source inspection and `git diff --check` passed. The primary agent owns the pending focused browser/test run and the requested independent normal-user audit. I did not rerun broad suites, inspect the rendered page, start paid runtimes or execute Demo.
