# Remote MCP: Codex source review v1

Reviewed 2026-11-10. Scope: the new Grok Bot/remote MCP transport, OAuth provider and storage, tunnel manager, local management routes and remote connection UI. The earlier local-stdio changes were background, not re-reviewed in full. No implementation code changed during this review.

**Current source score: 9.1/10. No unresolved actionable finding in the reviewed source.** This is a correctness/reliability assessment, not confirmation that a real Grok Bot account has connected or a visual design score.

## Finding identified and fixed during review

**P2 — A failed tunnel-folder cleanup could skip disconnection handling and create an unhandled rejection.** `packages/orchestrator/src/remote-mcp/tunnel.ts` rejects `closed` when deleting its private temporary configuration fails. The initial ready-state watcher in `remote-mcp/index.ts` used `void tunnel.closed.then(...)` without a rejection handler. A post-ready cleanup error therefore skipped the watcher’s revocation/server cleanup/state transition and rejected the derived promise without a consumer. The helper’s catch on the original promise did not consume that derived rejection. A Windows file-lock/EPERM error was a concrete trigger; a deterministic fixture can reject the tunnel’s `closed` promise after reaching ready.

**Resolved in the current source:** `remote-mcp/index.ts` now passes the same `disconnected` callback as both fulfillment and rejection handlers. The callback clears the address, aborts further handling, revokes/releases resources and moves only its own controller generation to failed. `packages/orchestrator/test/remote-mcp.test.ts` now includes the cleanup-rejection variant alongside the normal unexpected-exit case. I verified the source fix and regression assertions; the parent owns test execution.

## Boundaries and lifecycle checked

- The public listener serves MCP, OAuth, the connection waiting page and a bounded readiness check. It does not mount the workspace UI, `/api/snapshot` or the private external JSON bridge. Its issuer/resource comes from the validated tunnel origin, not forwarded request headers. Host checks and cookie-free bearer authorization remain separate from the local UI session.
- MCP authentication runs before JSON parsing. A fresh SDK transport/server is created per POST with JSON responses and no stream session; read-only grants advertise only read tools, and every actual tool call rechecks the grant before invoking the existing external allowlist. No approval, browser, connector or settings tool was added.
- SDK authorization/token routers perform S256 PKCE. The provider also binds codes to registered client, exact selected callback, current resource, expiry and locally selected scopes. Single-use consumption occurs only after the serialized durable mutation succeeds, before the next queued mutation. Refresh rotates both tokens and cannot widen approved scopes.
- Pending consent is memory-only and reachable publicly only through a random ticket. Local management exposes a separate verification code and bounded self-declared app identity/callback information, never a ticket or token. Only the session-protected local decision route can approve it. The waiting page returns denial through the registered OAuth callback and uses a nonce-based CSP.
- Stored access/refresh tokens are hashes. Strict bounded reads, bounded records, atomic private-file replacement and serialized mutations preserve the prior valid state on failed writes. Revocation is per grant; Stop/restart clears pending requests and all grants/registrations for the temporary address.
- Start/Stop are serialized. Cancellation prevents an abandoned startup from owning the next listener; unexpected-exit cleanup is tracked separately and awaited before restart. Controller identity also prevents an old completion from replacing a newer state. The existing deferred manager regression checks that an old cleanup cannot finish after a new listener has taken ownership.
- The tunnel helper accepts only a plain HTTP loopback target, runs a fixed command without a shell, strips inherited tunnel configuration variables, uses its own validated temporary configuration directory and bounds startup/output. Shutdown escalates termination and cleans its own files. Readiness requires the public address to return this instance’s nonce, not merely a URL printed by the CLI.
- The UI distinguishes a temporary address, authorization and a successful tool request. It defaults consent to read-only, states the career-data/cost boundary and retains acknowledged state after a later read failure. An ambiguous mutation blocks another write until a read reconciles state; stale poll generations cannot replace a mutation’s result.

## Limits

I read the connected source, installed SDK middleware and focused regression assertions. I did not run broad checks, a public tunnel, a browser pass, Demo or a paid runtime. The parent owns those runs. Real Grok Bot compatibility, public reachability on this network and rendered accessibility remain integration/visual verification tasks; a temporary Cloudflare address is not a durable hosted connection.
