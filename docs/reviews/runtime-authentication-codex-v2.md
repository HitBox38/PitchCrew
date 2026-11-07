# Runtime authentication — independent Codex review, pass 2

Reviewed the uncommitted implementation on 2026-11-07. This was a source review; no real login, logout, credential change or provider inference was performed. The review covered the private connection store, routes and recovery, asynchronous environment scope, shared native/ACP authentication, real PTY ownership and filtering, Grok credential refresh transport, and settings lifecycle. Root was independently verifying the real Windows PTY-to-browser integration while this review ran.

**Score: 8.4 / 10. Changes requested.** The shared contracts, runtime reservations, private write-only storage, conditional Grok refresh writeback and truthful unverified state are strong. Two credential-redaction gaps remain before approval.

## P1 — Runtime failure diagnostics can persist private credentials

`packages/adapters/src/process/launch.ts` retains native stderr and constructs its exit error from the raw tail. `packages/adapters/src/acp.ts` similarly retains raw stderr and accepts a native protocol `error.message`. Neither failure boundary calls the new scoped credential redactor.

A runtime subprocess that prints its configured `CODEX_API_KEY` (or another supported secret) to stderr and exits unsuccessfully makes that value the thrown error message. `packages/orchestrator/src/crew/workflow.ts` records `error.message` in the run and its event; `packages/orchestrator/src/crew/chat.ts` also writes it to the system transcript. This defeats the new private credential storage boundary even though the connection GET and snapshots of the configuration itself are safe.

Redact known scoped secrets before runtime failures leave the adapter, covering both stream and ACP stderr/protocol errors, and preserve exit/cancellation metadata. Add a fictional subprocess regression that emits a saved secret and an inherited secret across stderr chunks, then fails. Verify the resulting error contains neither value. Also consider reply/activity previews and returned text where native output can include a known configured secret.

## P2 — Short configured secrets are not redacted from sign-in terminals

`packages/adapters/src/process/sign-in-terminal-redaction.ts` only adds values with at least four characters. Authentication values accept shorter nonempty strings, including tokens used with a local compatible endpoint. A configured three-character secret echoed by an auth-only subprocess is therefore relayed to the browser unredacted.

Use the explicit allowlisted secret-name set for values of any nonzero length. Retain the length threshold for heuristic authentication-related environment names, so non-secret cloud switches such as `1` do not corrupt the terminal. Extend the existing incremental redaction regression with a short allowlisted secret split across chunks and VT sequences.

## Other observations

- Exact flow and interaction identifiers guard stale responses; browser consent, terminal input and credentials stay in memory and are absent from agent tools.
- Method discovery and authentication reserve the runtime before asynchronous work. Credential changes invalidate saved native sessions before committing a replacement.
- ACP advertises no host filesystem or terminal capabilities, denies additional requests and never sends a prompt.
- Grok copies only its workspace-managed authentication file into private operation homes, serializes refresh-token work and conditionally writes back a changed credential file. Provider keys remain independent of managed OAuth.
- The current code distinguishes CLI completion from verified authentication, and the logout operation now has truthful completion text. The current terminal offset counts the redacted stream end, matching the renderer's delta logic.
- The runtime setup hook now separates mutation cancellation from status reads and rearms polling. The temporary debug traces were removed during this review.

The two findings above require fixes and a fresh independent recheck. No every-provider live-auth or physical-phone verification is implied by this source review.
