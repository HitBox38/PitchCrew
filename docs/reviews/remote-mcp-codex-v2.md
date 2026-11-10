# Remote MCP: Codex source review v2

Reviewed 2026-11-10. Scope: the single OAuth scope compatibility change, the local permission boundary, HTTP transport, OAuth/storage lifecycle, tunnel manager and local management routes. I also read the revised remote settings components. This is a source review; the parent owns live Grok Bot and rendered design verification.

**Source score: 9.1/10. No unresolved actionable finding in the reviewed production source.** The single connection scope solves the reported Grok client behavior without granting writes automatically.

## Finding resolved during review

The orchestrator manager test's registration fixture still supplied `pitchcrew:read pitchcrew:write`. The revised provider correctly rejects those as protocol scopes, so the unexpected-exit tests would fail before exercising teardown. I reported this to the parent and verified that `packages/orchestrator/test/remote-mcp.test.ts` now registers `pitchcrew:access`. Test execution remains the parent's responsibility.

## Checks and conclusions

- Discovery advertises only `pitchcrew:access`. Registration, authorization, refresh, token responses, bearer authentication and verified `AuthInfo.scopes` consistently use that scope. Unknown scopes, including the old read/write names, cannot be used to expand access.
- The public protocol scope is independent of the local permission decision. Pending requests expose the read/write choices to the local UI; the checkbox starts false. Only the session-protected decision route selects the saved grant's internal read-only or read/write permissions. Remote OAuth requests and refresh cannot change that choice.
- `verifyAccessToken` derives `extra.write` from the current saved grant. Tool discovery uses that verified value, and each actual tool call verifies the token again and checks `extra.write` before reaching the existing external gateway. A token with the connection scope alone does not acquire write tools. There is no approval, browser, connector, settings, role or skill action in the external allowlist.
- The focused HTTP assertions now simulate a client selecting only the first advertised scope for registration and authorization. They cover both local decisions: nine read tools with write rejection, or the existing fifteen-tool allowlist after explicit write consent. Provider assertions preserve read-only permission across refresh and preserve an approved write grant without letting refresh select internal permissions.
- OAuth code/client/callback/resource binding, S256 PKCE, serialized single-use code consumption, rotating refresh tokens and hash-only private atomic storage remain intact. The installed SDK checks PKCE before calling the provider without a verifier. Failed durable writes preserve prior grants and reusable unconsumed codes.
- The fixed OAuth rate-limit key intentionally aggregates requests for this temporary connection. Forwarded IP headers do not become trusted identity, change the configured issuer/resource or create fresh rate buckets. Default SDK limits remain enabled. The new registration regression rotates forwarded addresses and asserts the same bucket reaches 429 without the previous proxy-validation error.
- The public listener remains separate from the workspace UI and private API. Host checks run before routing; MCP authentication runs before its JSON parser. Each POST receives a fresh SDK JSON transport/server. Body size, concurrent request, connection, header and timeout limits remain bounded.
- Start/Stop serialization and generation checks retain resource ownership. Unexpected tunnel-exit cleanup is tracked and awaited before restart, including rejection from private-folder cleanup. The v1 watcher fix still handles both fulfillment and rejection. Shutdown closes network resources even if grant persistence fails; a subsequent start still requires fresh consent.
- Local management routes remain under the normal Host, Origin, UI session and client-header checks before body parsing. The public waiting page exposes only its independent match code and registered callback flow, never a local decision action. Grant IDs shown in Settings are not bearer credentials.
- The revised UI puts waiting requests ahead of setup steps, labels approval with the chosen access, confirms Stop when apps/requests exist and qualifies maximum grant lifetime with the temporary connection's lifetime. These are source observations, not a substitute for the separate visual review.

## Limits

I did not change implementation code, run broad checks, start a tunnel, approve a connection, use Demo, make a paid runtime call or perform browser/computer actions. I inspected the regression assertions but did not execute them. Real Grok write compatibility and the final browser/design assessment remain integration evidence to be supplied by the parent. This remains a temporary Cloudflare connection with a changing address, not a durable hosted connection.
