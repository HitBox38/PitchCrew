# Remote MCP: Codex source review v3

Reviewed 2026-11-10. Scope: the final remote connection notifications, waiting-page changes, Settings copy/accessibility and request recovery, plus the connected permission boundary from [v2](remote-mcp-codex-v2.md). This is an independent source review, not a rendered design score. No implementation code changed during this review.

**Source score: 9.1/10. No unresolved actionable production finding in the reviewed source.**

## Reliability findings resolved during this pass

The notification reader initially had no request deadline. A stalled GET could leave its `reading` flag set indefinitely, preventing later approval requests from appearing. The final hook combines its unmount signal with a 10-second deadline, checks the combined signal before applying results, and releases `reading` in `finally`.

The same stall pattern affected the public waiting page: one stalled status fetch could stop polling until a locally approved, short-lived authorization code had expired. The page now gives each status fetch a 10-second deadline and retries through its existing catch/scheduling path. Settings polling also has a 10-second deadline. Remote Start/Stop/Approve/Disconnect mutations now have a 30-second deadline, so a stalled response reaches the existing uncertain-result recovery instead of leaving every control busy forever. A timeout never retries a mutation or implies that it was rejected.

## Final checks and conclusions

- The notification reader is mounted once by the existing workspace notification center, rather than once per bell or panel. It permits one read at a time, starts network reads only while the document is visible, refreshes on visibility changes, aborts on unmount, ignores aborted completions and clears its temporary store on cleanup. Known requests are pruned at expiry even after a read failure.
- Remote notifications contain an escaped, self-declared app name and a fixed instruction to review a connection the user started. They carry no OAuth ticket, authorization code, token or decision action. The request list is memory-only; only ordinary read-notification IDs enter the existing local read history.
- The existing attention presentation places requests in Needs you and the bell count. The dedicated Settings link selects Accounts and `#remote-mcp-heading`; it does not fall through to runtime settings or approve anything. An already visible request suppresses a duplicate toast. Resolution is reflected by the next bounded poll, not a claim of instantaneous cross-panel synchronization.
- The public page's only new connection field is the server-generated expiry timestamp. Its HTML interpolation remains limited to generated verification codes and ISO timestamps. Untrusted client names, callbacks and request parameters are not interpolated into HTML or JavaScript. The nonce CSP, no-referrer/no-store headers, registered redirect flow and local-only consent boundary remain intact. Expired links receive the same styled shell with HTTP 410 and no polling script.
- The request checkbox still starts unchecked. Its visible label and description now have separate IDs; the scoped border preserves contrast without replacing the shared checkbox. Approval, rejection and disconnection retain guarded focus recovery. The foreground keyboard regression covers approval while a second request remains; I did not reproduce the earlier background-tab focus observation myself.
- Approval feedback now distinguishes the local decision from the app finishing authorization, and the empty apps list no longer contradicts that intermediate state. Stop with only pending requests says cancel; Stop with issued grants says disconnect. The maximum grant lifetime remains qualified by the temporary connection's actual lifetime.
- The protocol still advertises only `pitchcrew:access`. Local read/write authority remains in the saved grant and verified `extra.write`, gates tool discovery and is checked again before every tool call. These UI and notification changes add no approval, browser, connector, settings, role or skill authority. Local stdio access remains independently authorized.

## Limits

I inspected connected source and focused regression assertions. I did not execute tests, start a server/tunnel, approve a request, use Demo, run a paid provider, or perform browser/computer actions. The parent owns final checks, Opus's rendered design review and the real Grok Bot read/write evidence.

Settings deliberately treats every failed mutation as potentially uncertain and asks for Check status before another change. The current API error contract does not prove whether a write committed; retaining that conservative behavior is appropriate. Temporary addresses still change on restart and require `cloudflared`; this is not a durable hosted connection.
