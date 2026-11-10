# External agents — Codex review, version 2

Reviewed the shared uncommitted implementation on 2026-11-10 after the first review's grant-rotation fix and the second setup iteration. This is a source and correctness review of the external-agent change, not a design score for the whole app.

**Final source verdict: 9.2/10. No unresolved actionable correctness issue found in the reviewed scope.** The initial pass identified one small copy-feedback issue; the primary agent fixed it during this review.

## Finding

**P3 — Changing configuration format briefly preserves a false Copied state.**

`packages/design-system/src/components/code-block/components/CodeBlockCopyButton.tsx:15` stores `copied` independently of `value`; the effect at line 18 only clears it after two seconds. `packages/ui/src/ExternalMcpSettings/components/ConnectApp.tsx:34` changes the existing button's value when JSON/Codex is selected without remounting it. Copy JSON and immediately choose Codex: the TOML block still shows the checkmark and “Copied” while the clipboard contains JSON. This is a direct consequence of the state/prop path; I did not independently run a browser reproduction.

**Resolved in the current source:** `SourceBlock` now keys `CodeBlockCopyButton` by `value`, so a format change remounts its confirmation state. The existing configuration/clipboard browser case now checks that switching from copied Codex TOML to JSON clears `data-copied` before the next copy. I verified that source fix and assertion; the primary agent owns the pending serialized browser-test run.

## Recheck of version 1

The old-grant completion overwrite is fixed. `packages/orchestrator/src/http/routes/external-mcp.ts:41` captures the grant's activity object before awaiting the tool. When a new grant begins, its separate slot becomes current; an old completion writes only into its detached object. `externalMcpInfo` additionally matches evidence to the credential currently on disk. The deterministic deferred regression in `packages/orchestrator/test/external-message-receipts.test.ts` covers old A → rotate → successful B → complete A, and checks that B's evidence survives.

## Other conclusions

- `lastAttempt` records only authenticated, recognized actions and a bounded outcome enum. Rejected credentials and unknown actions cannot manufacture evidence. Inputs, results, error details and tokens do not enter the UI response.
- Write denial is recorded before returning 403; thrown calls retain the existing error and latest successful evidence while separately reporting the failed attempt. Accepted old work may still finish, as documented.
- External UUID sends still use the shared transaction-backed acceptance path. Receipt reads use `chatSubmissionIdentity`, expose no content/digest and remain available to read-only clients. No approval, browser, connector or settings authority was added.
- The polling hook invalidates earlier reads when a permission mutation begins, aborts prior effect generations on refresh and blocks polling during a save. Failed ambiguous saves remove stale controls and require a new read. Polling stops making requests while the document is hidden or access is off.
- Codex output uses a TOML table and JSON-escaped string/array values, which are compatible with the generated command/argument strings, including Windows paths. The helper's focused test covers escaping. Generic JSON remains explicitly separate, with merge and path-lifetime guidance.
- The SourceBlock additions are optional, preserving existing callers' default appearance. Clipboard failure retains manual-copy recovery.

## Limits

I reviewed the connected source, the focused regression tests and their assertions; I did not rerun broad checks already being run by the primary agent. No Demo or real provider turn ran during this review. I did not grade rendered visual design, perform the normal-user computer-use audit, verify every third-party client, or claim remote HTTP MCP support. The remaining transport/per-client authorization gaps documented in the comparison are still real.
