# Runtime authentication — independent Codex review, pass 4

2026-11-07. Fresh source recheck of the runtime authentication and settings changes since [Codex pass 3](codex-v3.md), including the issues raised by [Claude pass 2](claude-v2.md). I reviewed the current credential editor, private status mapping, recovery disclosure, shared select, browser consent, terminal buffer/copy/link handling, setup lifecycle and model-refresh call chain. No implementation files were changed by this review.

**Score: 9.3/10. Approve. No outstanding P0–P2 findings in the reviewed revision.** This is a scoped engineering judgment, not a claim that every provider login or device has been tested.

## Rechecked corrections

- Empty secret replacements undo that field's draft. Empty non-secret edits stay visibly empty and dirty, with an explicit incomplete marker. Both the Save control and the save function refuse incomplete edits; the pending summary identifies them as incomplete rather than Disable. Entering a replacement, Undo and the explicit Disable action each clear that marker appropriately. Other fields' drafts remain intact.
- Inherited non-secret settings pass the same bounded setting validation before their values can be returned. An invalid endpoint, including one containing embedded credentials or a query, returns only configured/source metadata and fixed `invalid_environment` guidance. Its value is omitted from the response and from the field. Saved values continue to be validated by the private store.
- Busy-save errors are converted to fixed, useful copy without echoing arbitrary run diagnostics. Conflict reloads preserve drafts. Acknowledged saves still remain successful when a later snapshot read fails.
- The credentials disclosure uses the shared controlled Accordion and opens when a later recovery state arrives, while keeping previously visited editor content mounted. Unset fields do not offer a no-op Disable action. Field controls use generated IDs; text and choice controls both receive their field/source description.
- Browser consent opens no placeholder on desktop, waits for the exact interaction response, then requests the validated URL. Accepted consent has visible status and a secondary reopen link. Web popup rejection keeps a direct-link fallback. Flow/interaction keys prevent acceptance state from carrying into a later interaction.
- Terminal copy and action extraction now consume xterm's rendered buffer. Cursor movement, erasure and redraws are interpreted before text is copied or scanned for links/codes; soft-wrapped lines are joined. The buffer update occurs in the write completion callback and after resize. The surface is disposed and callback results are ignored after replacement. Link actions retain per-runtime HTTPS hosts and explicit clicks, and selected Ctrl/Cmd+C stays separate from CLI input.
- An interaction without the optional output offset is treated as a full snapshot, so a changed snapshot with the same character count is still rendered. Real PTY interactions retain cumulative end offsets and incremental append behavior. I checked this final source correction after the focused test run; its browser regression is part of the parent's ongoing verification.
- The model refresh is already called through `runtimeMaintenance.metadata(id, ...)`, so its detect and discovery operations inherit the selected runtime's connection scope. The refreshed health now clears an old `configurationError`. The exceptional installation-only check remains reserved and executable-aware; it does not permit authentication, model discovery or runs to bypass unreadable credentials. Documentation now accurately states that this version check retains the daemon's inherited environment.

The earlier incremental stream/ACP diagnostic redaction, short allowlisted-secret filtering, private credential storage, native session invalidation and auth-only process boundaries remain intact in the reviewed paths.

## Verification

I ran isolated runtime-connection manager/scope, runtime failure-diagnostic and terminal-action unit suites: **29 passed, 2 platform-specific skips, 5 files**. `git diff --check` passed. These checks use fictional secrets and local subprocess fixtures.

The parent is separately running the expanded browser/API regressions and obtaining settled design evidence. I read those new tests but did not rerun the complete browser matrix or inspect the latest screenshots in this engineering pass. I did not perform real OAuth, login/logout, installation or provider inference, use Demo, or access real credentials. Real Electron browser launching, every provider's native output, screen readers and physical phones remain outside this review's observed evidence.
