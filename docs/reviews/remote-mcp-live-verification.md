# Grok Bot remote MCP: real-client verification

Verified on Windows on 2026-11-10 using the installed Grok Bot desktop app, a real Cloudflare Quick Tunnel, and Pitchcrew's built production UI. The isolated workspace was under `%TEMP%/pitchcrew-remote-review-20261110`; `dev: false` kept Demo unavailable. Its eight crew roles stayed paused. No production workspace or private Profile was connected, and no crew run was started.

## Observed results

1. **Manual connector setup:** added a custom Remote HTTPS connector in Grok Bot with no HTTP headers or client ID. Grok discovered OAuth, opened Pitchcrew's public waiting page, and showed the connector as connected after local consent. The independent verification codes matched on both screens. Grok registered itself as `Cursor` with a `www.cursor.com` callback, so the self-declared name alone was not used as identity evidence.
2. **Real read:** asked Grok to call only `pitchcrew_status`. It reported the expected **0 jobs** and eight disabled/unavailable crew roles. Pitchcrew independently changed the app row from **Authorized, no requests yet** to **Last successful request**. Grok exposed nine read-only tools.
3. **Compatibility issue found and fixed:** Grok selects only the first advertised OAuth scope. Advertising separate read/write scopes therefore made its connection permanently read-only. The final protocol advertises `pitchcrew:access`; the local approval decision still controls read-only versus job/crew changes, including tool discovery and per-call enforcement. Refresh cannot change that decision.
4. **Normal copy-message setup:** sent the generated “Add the MCP server … and connect it” message in Grok Bot. Grok created the connector and offered Connect. After the matching-code check, the local write checkbox was explicitly selected. Grok reported **15 tools ready**.
5. **Real write and readback:** asked Grok to create exactly one fictional job, then list jobs. It created `3beaa088-bb9b-46c0-8677-06d53980918a`: **Remote MCP Control Check** at **Pitchcrew Verification**, location **Test only**, no posting URL, status `lead`. Grok's readback reported exactly one job. The Pitchcrew Board independently displayed the same company, title and location; the app row showed a successful request at 15:53 Israel time. The separate normal-user audit opened the saved job and confirmed that its full description exactly matches the supplied fictional text.
6. **Revocation:** stopped the owned test daemon/tunnel after verification. The private authorization file then contained **0 registrations and 0 grants**. The native OAuth tabs and owned Pitchcrew preview tab were closed. The user's pre-existing job-scout draft `9` was preserved. The two agent-created verification connector entries remain in Grok Bot, pointing to stopped temporary addresses; neither retains working access.

## Issues addressed during review

- Pending approvals moved above setup instructions, with an ochre waiting count and an app-wide Needs you notification linking to the matching request.
- Setup became four ordered steps. Copy, read/write approval labels, temporary lifetime, maximum grant expiry and the distinction between consent and a successful call are explicit.
- Stop confirms before disconnecting authorized apps or cancelling pending requests. Dark-mode checkbox contrast and keyboard focus after decisions received targeted checks.
- The public waiting page supports dark mode, displays expiry, and uses the same styled shell for expired links.
- The tunnel-exit watcher handles both normal exit and private-folder cleanup rejection. OAuth rate limits use a shared bucket instead of trusting forwarded IP headers, removing the warning observed through the real tunnel.

## Reviews and checks

| Round | Codex source                     | Claude Opus 5.5 design            |
| ----- | -------------------------------- | --------------------------------- |
| 1     | [9.1/10](remote-mcp-codex-v1.md) | [8.2/10](remote-mcp-claude-v1.md) |
| 2     | [9.1/10](remote-mcp-codex-v2.md) | [9.0/10](remote-mcp-claude-v2.md) |
| 3     | [9.1/10](remote-mcp-codex-v3.md) | [9.2/10](remote-mcp-claude-v3.md) |

The final focused checks passed: 39 backend/notification unit tests, five browser tests, root lint, root typecheck (including the landing package), formatting and whitespace checks. The browser suites built the production UI. These are focused checks, not the complete repository suite or an installer run.

The separate [Codex normal-user audit](remote-mcp-normal-user-audit.md) completed the visible notification/search → matching-code consent → successful read → disconnect journey. It used keyboard read-only approval, cancelled Stop's confirmation, checked a 390px view, and verified that the revoked client's next call returned **401**. Its clipboard read could not be verified through the browser tool; automated clipboard tests passed separately. The auditor accidentally stopped an empty connection before creating its client, restored it through the normal Start action, and recorded that as an audit action error.

The final design review still records non-blocking issues: the notification link can land with Approve below the fold, approval feedback can stay stale after the app connects, the Board's empty decision copy is too broad, and reading a notice clears its unread count before the request is decided. The full findings remain in the linked review rather than being hidden by the score.

## Practical limits

This implements temporary remote connectivity. `cloudflared` must be installed, Pitchcrew and the computer must stay running, and the URL changes after restarting the connection. Remote apps then need the new address. There is no automatic startup or permanent hosted endpoint. Cloudflare and the authorized app handle data the user permits it to read.

External clients retain the existing allowlist. They cannot approve applications, use browsers/connectors directly, or change Profile, roles, skills or account settings. Job and crew writes require explicit local consent; sending crew messages can spend runtime credits.

An ambiguous failed mutation deliberately requires **Check status** before another change. This also applies to some definite rejections because the route contract does not guarantee that an HTTP error proves nothing committed. The conservative behavior is retained.

The live proof covers actual Grok read/write tool calls, not paid crew execution, application submission, a packaged installer, or long-running availability. Automated tests use fixtures; they are separate evidence from the real-client check above.
