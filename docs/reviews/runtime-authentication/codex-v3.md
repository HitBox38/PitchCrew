# Runtime authentication — independent Codex review, pass 3

2026-11-07. Source review of the current uncommitted runtime-authentication and credential-settings implementation, with focused isolated regressions. This is a fresh review following [Codex pass 2](../runtime-authentication-codex-v2.md) and the [first Claude design review](claude-v1.md).

**Score: 9.2/10. Approve. No outstanding P0–P2 findings in the reviewed change.** The earlier credential-redaction findings are corrected, and the recovery, credential editing and browser-consent changes address the concrete functional problems from the design review. This score is a reviewer judgment, not a claim of universal provider compatibility.

## Rechecked fixes

- Native stream and ACP stderr pass through incremental known-secret filtering before diagnostic-tail truncation. ACP protocol failures and startup errors also redact scoped secrets. Exit codes and cancellation classifications are retained. Real subprocess regressions cover split secret output, inserted VT sequences, a secret longer than the retained diagnostic tail, short credentials and a protocol failure.
- The terminal redactor uses the explicit secret-name allowlist for every nonempty credential. The length threshold applies only to heuristic environment names, so short non-secret authentication switches remain readable.
- Empty typed credential input now removes that field's draft; suppression of an inherited variable requires the explicit Disable action. Per-field Undo, source labels in the selector and a pending-change summary make multi-field saves reviewable. Declared finite choices use the shared select. Only the server's fixed validation messages are admitted into the editor.
- Damaged credential storage produces a typed configuration error distinct from installation health. The installation-only metadata path retains the normal reservation and executable override while omitting connection loading. It is used for executable detection, not authentication, model discovery or agent execution. The runtime remains unavailable to existing execution gates, and Manage opens recovery directly on Sign-in.
- Desktop ACP browser consent no longer opens an empty placeholder window. The actual validated URL opens only after the exact interaction response is acknowledged. Web popup failure has an explicit link fallback. Interaction keys prevent acceptance state from carrying into a later prompt.
- Terminal browser actions accept only HTTPS URLs on the selected runtime's declared hosts, reject credentials and nondefault ports, and require an explicit click. Conservative device-code extraction and Copy terminal text supplement the VT surface. Ctrl/Cmd+C with a terminal selection copies instead of sending an interrupt; without a selection the native interrupt remains available.
- Terminal colors cover the ANSI palette with minimum contrast and update when the application theme changes. Completed-but-unverified sign-in gives Recheck the primary action. Sign-out names the runtime and explains native versus workspace scope. Recovery states daemon inheritance and reports its private backup without exposing backup contents.
- Automatic setup reads now clear only read errors. Mutation failures and acknowledged-action refresh warnings survive background polling; explicit retry or a later action clears them.

## Other boundaries reviewed

The connection store still returns write-only secret state with opaque revisions; performs bounded, validated atomic writes; and refuses unsafe recovery paths. Credential edits reserve the runtime and invalidate durable native sessions before adopting new values. Recovery reserves all production runtimes and retains native accounts and the managed Grok auth file.

Native sign-in remains auth-only, bounded and cancellable. ACP authentication has exact flow/interaction checks, explicit browser consent, no prompt and no additional filesystem, terminal or tool capabilities. Grok credential homes remain private and minimal, refresh operations serialize through an abortable lease, and refreshed credentials only replace the original saved credential version. No new route or provider configuration path grants agent access to credential management.

## Verification

I ran the focused `unit-and-api` suites for runtime failure diagnostics, the genuine Node sign-in terminal, runtime connection scope/redaction and terminal-link parsing: **24 passed, 2 platform-specific skips, 4 files**. `git diff --check` also passed. The subprocess and PTY tests use fictional secrets in isolated temporary directories; they do not contact a provider.

I did not run the complete browser matrix, live authentication, logout, installation, inference, a screen reader or a physical phone. The parent is independently running the expanded browser regressions and obtaining fresh design review evidence. Arbitrary provider instances and every-runtime OAuth remain explicitly outside this implementation's support matrix.
