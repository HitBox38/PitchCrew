# Runtime authentication — independent Codex review, pass 5

2026-11-07. Fresh review of the polish after [Codex pass 4](codex-v4.md) and [Claude pass 3](claude-v3.md). I inspected the current browser-consent composition, recovery action, shared dialog extension, sign-out confirmation, terminal feedback and responsive terminal sizing. This pass changes only this report.

**Score: 9.3/10. Approve. No outstanding P0–P2 findings in the reviewed polish.** This is a scoped engineering judgment, not a replacement for the pending fresh visual review or live-provider testing.

## Rechecked corrections

- `WaitingSignIn` now renders the acknowledged browser-request status above the action row. Its stored interaction ID is compared with the current interaction; the keyed `AuthOpenLink` retains its own accepted state only for that interaction. The row contains the reopen link and Cancel, rather than a long status sentence. Consent still waits for the exact API acknowledgement before requesting the validated URL, and desktop still avoids the empty placeholder window.
- Credential recovery uses the shared primary button, preserving disabled/busy behavior and the existing confirmed reset path.
- `DialogContent.forceRenderBackdrop` is optional, defaults to false, is consumed before spreading popup props, and passes only to the shared backdrop. The installed Base UI declaration explicitly supports forcing a backdrop for nested dialogs. Existing callers retain their prior behavior. `AuthLogout` opts in and uses `DialogHeader` spacing; Cancel focus, working-state dismissal prevention and request failure handling remain intact.
- Terminal copy feedback expires after four seconds. Its retained timer is cleared on unmount and clipboard callbacks check the active lifecycle and request generation before updating feedback. The accepted callback also clears a retained timer before installing its own. The keyboard hint is hidden on phone/coarse-pointer layouts, where the explicit copy controls remain. The reduced terminal height still uses the existing fit/resize path and bounded server dimensions; it does not introduce a separate viewport protocol.
- The changes do not alter credential storage, secret redaction, flow/interaction validation, native command selection, authentication scope or execution gates.

## Additional check during review

I identified a nonblocking overlapping-clipboard-result race and sent it to the parent while this review was running. The parent added a `copyRequest` generation and clears the old timer inside accepted feedback. I read that final source correction: an older clipboard completion can no longer replace the newest notice or install a competing timer. This final small change was source-checked after the lint/typecheck run below. No outstanding finding remains from this pass.

## Verification

- Root lint and component/disclosure checks passed: **1,107 production TSX files**.
- Root and landing typecheck passed.
- `git diff --check` passed.

The parent is separately rerunning browser regressions and settled captures for this polish. I did not rerun that browser suite or inspect new screenshots in this engineering pass. No actual OAuth, account mutation, provider inference, Demo runtime, personal credential access or native system-browser launch was performed. Real Electron launching, provider-specific output formats, physical phones and human screen-reader behavior remain outside this pass's observed evidence.
