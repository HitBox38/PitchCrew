# External agents — Codex review, version 1

Reviewed the uncommitted local external-agent setup and receipt changes on 2026-11-10. Scope: connected UI, bridge, credential rotation, tool schemas and existing chat-submission helpers. This is an implementation review, not a visual design score for the whole app.

**Score: 8/10. One reproducible issue needs fixing.** The patch improves the actual weak point: users can distinguish an enabled grant from evidence that a request reached Pitchcrew, and external sends can reuse the existing durable acceptance path. It correctly avoids claiming that local stdio supports cloud Grok Bot.

## Finding

**P2 — A late request from a revoked grant can erase the new grant's successful verification.**

`packages/orchestrator/src/http/routes/external-mcp.ts:29` unconditionally replaces the single `lastRequest` when a tool completes; the completion is recorded at line 62 using the credential accepted before the tool ran. Consider a slow accepted request under grant A, followed by a rotation to grant B and a successful status request under B. When the old A request finally finishes, it overwrites B's evidence. `externalMcpInfo` correctly filters out A, but now returns `lastRequest: null`, making the working new connection appear unverified.

Reproduced with the real Fastify route plugin, a temporary access file and a deferred service response. No daemon, provider execution or Demo runtime was used. The reproduction returned:

```json
{ "verifiedBeforeOldCallCompleted": true, "verifiedAfterOldCallCompleted": false }
```

Only record completion if its credential is still the current grant. Preserve the existing behavior that already accepted work may finish. Add a deterministic regression that starts A, rotates, completes B, then completes A and asserts that B's successful evidence remains.

## Assessment

- The receipt tool uses `chatSubmissionIdentity`, which returns only request, conversation and submission identity. It does not expose the stored digest or message payload.
- `send_message` passes the optional UUID to the shared `sendConversation` path rather than implementing another deduplication store. Attribution is included in the hashed payload; changed payloads retain the existing conflict behavior.
- Read-only receipt access follows the existing read-tool advertisement and server-side write gate. No approval, browser, credential or settings capability was added.
- A failed permission save now removes stale controls until a read reconciles access. The visible recovery explanation accurately admits that access may already have changed.
- The new request evidence is bounded to one in-memory record and excludes request contents. The UI says that it is historical success, not an active connection.

T3 still has materially stronger functionality: public HTTP MCP with OAuth, app-specific handoff and individually revocable clients. Those capabilities are absent here; this patch is an honest local-only improvement, not parity. T3's own wizard also offers Done before observing a successful client request, so copying it blindly would preserve a misleading completion state.

Validation was source review plus the deterministic rotation-race reproduction. I did not run the full suites, a visual browser audit, or any real provider turns. The concurrent receipt and bridge tests were still being completed by their implementation owner during this review.
