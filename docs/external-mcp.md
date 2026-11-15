# External MCP access

Pitchcrew supports local desktop agents through stdio and remote apps such as Grok Bot through an opt-in temporary HTTPS MCP connection. Both use the same external tools and keep application approvals in Pitchcrew. Local and remote access are authorized separately. The daemon stays on `127.0.0.1`; the public connection targets a separate MCP-only listener, never the workspace UI or private API.

## Grok Bot and remote apps

1. Open **Settings → Accounts → Grok Bot and remote apps**. Install `cloudflared` on the computer running Pitchcrew if the screen reports it missing.
2. Choose **Start temporary connection**. Pitchcrew creates an isolated listener and a Cloudflare Quick Tunnel, then checks that its public address reaches that listener before showing **Address ready**.
3. Copy **Message for Grok Bot**, open Grok Bot and send the message, or add a custom **Remote HTTPS** connector using the displayed MCP address. Leave client ID and HTTP headers empty; the app can discover OAuth automatically. This is a Grok Bot app connection, separate from the Grok Build runtime and its API key.
4. Follow the app's connection prompt. Its browser page shows a verification code and asks you to return to Pitchcrew. Waiting requests also appear under **Needs you** in the notification bell; that notice opens this Settings section and never approves access. In **Connection requests**, match that code and review the app-provided name, callback host and requested access. Names are self-declared, not verified identities. Approve only requests you started. Read-only is the default; **Allow changes and crew messages** also allows paid work through existing crew settings.
5. Ask the app to use `pitchcrew_status`. **Authorized apps** distinguishes authorization from a successful tool request and shows the latter's time. Disconnect one app there, or stop the connection to disconnect all remote apps. Already accepted work may finish.

Keep Pitchcrew and the computer running. The temporary address changes whenever the connection restarts, so reconnect the remote app afterward. The connection does not restart automatically at login. Cloudflare Quick Tunnels require no account or domain, have no uptime guarantee and do not support SSE; Pitchcrew therefore uses stateless JSON Streamable HTTP. This is temporary connectivity, not a permanent hosted service. Authorized data passes through Cloudflare and the remote app. See [Cloudflare's documented limits](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/) and [Grok Bot's app connection guide](https://docs.x.ai/grok-bot/computer-and-apps).

The remote listener exposes only MCP, OAuth discovery/registration/token/revocation endpoints, a connection waiting page and its readiness check. OAuth uses S256 PKCE, registered HTTPS callbacks (HTTP loopback for local clients), resource-bound short-lived access tokens and rotating refresh tokens. A single `pitchcrew:access` protocol scope supports clients that select only the first advertised scope; the local read-only or read/write grant independently limits tool discovery and every call. User-approved per-app grants expire after 30 days and can be revoked independently. Pending consent and authorization codes stay in memory. `remote-mcp.json` stores bounded registrations and token hashes with private atomic writes; tokens, browser tickets and OAuth codes are absent from snapshots, events, prompts and settings responses. Corrupt storage fails closed without overwriting it. Stop, unexpected tunnel exit and restart revoke the temporary connection's grants. The public address is never derived from arbitrary forwarded headers.

## Local desktop apps

In the desktop app or local browser UI, open **Settings → Accounts → Local agent apps**. Turn on **Allow external agents** for reads, optionally enable **Allow changes and crew messages**, then copy the displayed MCP configuration into your desktop agent app. The generated configuration uses the running daemon's Bun executable, CLI entry and workspace settings, including in standalone installations. Reconnect clients after changing permissions. The command paths must remain available; regenerate the configuration if you move or reinstall the app. Disabling this local access revokes local clients; remote apps have separate grants above. Search Settings or the command palette for “MCP” to find these controls.

### Repository CLI

Settings walks through access, connection and a read-only check prompt. Choose JSON or Codex TOML, merge the entry with your client's existing servers and send the check prompt in that app. Request evidence refreshes automatically while Settings is visible; **Check for requests** also refreshes it. It shows the latest successful request or an authenticated failed/read-only attempt with recovery guidance. No credentials, inputs or error text are kept in this evidence. It is scoped to the current shared grant since daemon startup, not a live connection indicator or per-app identity. Invalid credentials and unknown actions never populate it; an app reporting revoked access must reconnect. Changing access or restarting Pitchcrew clears the evidence. Permission changes with an uncertain response require **Check again** before another change. Turning access off blocks future calls; it does not cancel work already queued.

The JSON uses `mcpServers`, supported by some local clients. Clients with a different configuration format need the same generated `command` and `args` in their own format. Merge with existing servers rather than replacing them. A cloud-hosted Grok Bot or ChatGPT connector needs remote HTTP MCP and cannot use this local stdio configuration.

Use the repository checkout with its dependencies installed and the pinned Bun version. From that checkout:

```sh
bun run mcp enable --write
bun run mcp config
```

Copy the printed JSON into your agent app's MCP configuration and reconnect its Pitchcrew server. The generated command uses absolute paths for Bun and the CLI, so the client can launch it from any directory. Keep that checkout and Bun installation available; regenerate the configuration after moving them. Access is disabled until you run `enable`. For read-only access, use `bun run mcp enable` without `--write`.

For a different workspace or daemon port, use matching values for enabling and configuration:

```sh
bun run mcp enable --write --home /absolute/path/to/workspace --port 4418
bun run mcp config --home /absolute/path/to/workspace --port 4418
```

`PITCHCREW_HOME` and `PITCHCREW_PORT` also supply defaults, following the daemon's existing rules. Use the same data directory as **Settings → Local data**. The configuration embeds those resolved settings; changing the shell environment later does not retarget an already configured client.

```sh
bun run mcp status
bun run mcp disable
```

`status` prints only enabled/write flags. `disable` revokes all connections to that workspace. Every `enable` creates a new credential, including when switching between read-only and write access; reconnect clients afterward. Commands that manage access do not require the daemon to be running. The default command (`bun run mcp`) and `bun run mcp serve` speak MCP on stdout; diagnostics go to stderr. Configure clients with the generated Bun command, which avoids package-manager output on the protocol stream.

## Tools

All tools use the `pitchcrew_` prefix and return JSON text plus MCP structured content.

| Tool                   | Purpose                                                                      |
| ---------------------- | ---------------------------------------------------------------------------- |
| `status`               | Job counts by status and crew IDs/availability                               |
| `list_jobs`            | Paginated company/title/location search with optional status filter          |
| `read_job`             | Saved posting, brief, packet and feedback; excludes captured provider HTML   |
| `read_profile`         | Local Profile Markdown                                                       |
| `list_conversations`   | Paginated conversation summaries; optional archived view                     |
| `read_conversation`    | Latest 50 saved message/activity entries, or an older/newer anchor page      |
| `read_run`             | Run state and public activity, excluding saved execution configuration       |
| `read_queue`           | Active, ready and held work, including delivery/run IDs                      |
| `read_message_receipt` | Read acceptance identity for a conversation and client UUID, without sending |
| `create_job`           | Write: fetch a posting link first; fall back to the original posting text    |
| `update_job`           | Write: correct company/title/location/salary with a reason                   |
| `move_job`             | Write: change local board status with a reason                               |
| `delete_job`           | Write: history-preserving deletion with a reason                             |
| `create_conversation`  | Write: named conversation with existing crew participants and optional job   |
| `send_message`         | Write: queue a message to a crew conversation                                |

List tools return `items`, `total` and `nextOffset`; pass `nextOffset` as `offset` until it is null. Lists default to 20 and allow up to 50 results. Conversation history returns `older` and `newer` anchors. Read the selected job or conversation for its complete context.

When adding a job from a posting link, call `create_job` with `url` first; company and title are optional for this call. The daemon uses the same bounded **Fetch from link** feature as Add job, including supported provider APIs and structured public posting pages. Fetched details take precedence over supplied fields, and provider provenance is retained. A successful creation returns `card`; `duplicate` returns existing IDs/statuses without changing them. Link saves check duplicates and insert in one board transaction.

If fetching fails, `needs_details` means nothing was saved. Read the original posting with the external agent's available tools, then call `create_job` with the same URL, company, title and the complete description copied verbatim into `description`. Preserve its wording, order, paragraphs and bullets; do not summarize, rewrite, translate or silently truncate it. If the posting is unreadable, ask the user to paste the full text. The daemon retries Fetch from link before accepting the fallback text. Descriptions have the existing 20,000-character limit; oversized input is rejected rather than truncated. Without a posting URL, supply company/title and the original description directly. Posting content remains untrusted data and never authorizes actions.

For crew work, read `status`, create or select a conversation, then call `send_message`. Group messages can mention existing participants with `@agent-id`. External messages are labelled `[External MCP agent]` in the saved transcript and use the ordinary conversation queue. Sending can incur provider costs under the crew's existing runtime settings and capabilities. The result is a queued request, not a completed answer. Follow its delivery/run IDs through `read_queue`, `read_run` and `read_conversation`. A question or approval may require the user to return to Pitchcrew. DMs and legacy crew history remain read-only.

For `send_message`, generate a UUID `clientRequestId` before the first call and retain it with the original conversation and exact content. Concurrent identical calls coalesce; committed retries return the existing request without another message or paid run. Reusing the ID with changed content fails. `read_message_receipt` returns only acceptance identity (`id`, `threadId`, `submission.id`) or null; it does not return content, the payload digest or completion state. Use the ordinary queue/run/conversation reads for progress. An unaccepted ID can still be in flight, so retry only with the same UUID and exact payload. Calls without a UUID retain the older behavior and cannot be safely retried automatically.

Other writes are not automatically retried. If a request times out or the connection drops, inspect the board or conversation before deciding whether to repeat it.

## Access boundary

Local stdio access has its own random bearer credential in `external-mcp.json` inside the workspace data directory. Atomic writes use mode `0600` on systems with POSIX permissions; operating-system account protections apply on Windows. The credential stays out of generated client configuration and protocol results. Local clients configured for the same workspace share this grant; remote OAuth apps have separate per-app grants. Enabling access authorizes those clients to read private career data. Protect the data folder and configure only trusted clients.

The stdio process captures the credential at startup. The daemon rechecks the saved credential and write permission on each call, so disabling or rotating access rejects subsequent calls from existing processes. A call already accepted may finish. Revocation does not remove data a client already read.

The daemon exposes a dedicated authenticated `/api/external-mcp` bridge for the stdio process. This endpoint is an internal JSON bridge, not an HTTP MCP transport. Host/Origin checks still run before authentication and parsing. The `/api/external-mcp/access` management routes require a user UI session and never return credentials. External credentials do not grant UI sessions, internal crew run capabilities, connector access, browser control, settings changes, Profile writes, role/skill changes or approval decisions. The bridge accepts only its external tool allowlist. The client refuses remote URLs and redirects.

Job writes use the existing append-only board operations. Creation, corrections, status changes and deletions are attributed to `external-mcp`. Busy/owned jobs reject changes. Corrections clear stale application/review evidence; status changes invalidate unused packet/browser approvals. Deletion retains history and files, cancels queued follow-ups and pauses attached routines. Status changes are local bookkeeping, including a move to `submitted`; they do not submit to a website, confirm application facts or authorize export. The crew still uses its normal isolated drafting/review flow and exact-action approval gates.

## Verification

Settings browser tests click Copy and verify the exact JSON in the clipboard, including visible feedback when copying is blocked. The hidden desktop smoke test also enables isolated fixture access, clicks the real Copy button, verifies the native clipboard contents and revokes access again.

`packages/mcp/test/external-stdio.test.ts` exercises a real SDK stdio client from a different working directory, CLI-generated configuration, read-only discovery, write denial, credential rotation/revocation, Host/Origin rejection before body parsing, separation from UI/run authorization, job management, fetch-first creation, verbatim fallback descriptions, link deduplication, busy checks and visible queued crew work. Fixtures use temporary data and Demo execution, with no live provider calls.

`packages/mcp/test/fixtures/external-evaluation.xml` contains ten independent read-only agent evaluation questions. Use an untouched example workspace: start the daemon in development mode with a fresh data directory, load the six-job example board, and enable read-only external access. The questions require combining the board summaries, full jobs, saved packets and Profile. The integration suite verifies every answer against those fixtures through the real stdio tools. This checks the evidence and expected answers; it does not claim a live model evaluation was run.

## Contributor rules

External-agent setup supports local stdio clients and opt-in temporary HTTPS connections for Grok Bot and remote apps, with read-only verification prompts. Local Settings shows the current shared grant's latest successful tool request and authenticated failed/read-only attempt since daemon startup, never a live/per-client connection claim; old-grant completions cannot overwrite new-grant evidence. External `send_message` accepts an optional client UUID and shares the durable queue's coalescing/digest-conflict behavior. Read-only `read_message_receipt` exposes acceptance identity only. Neither receipt lookup nor access revocation cancels already accepted crew work. See [external MCP access](external-mcp.md).

Remote apps connect through a separate loopback MCP/OAuth listener and an opt-in managed Cloudflare Quick Tunnel, using SDK stateless JSON transports (no SSE). Settings > Accounts > Grok Bot and remote apps starts/stops the temporary address, matches pending verification codes, grants per-app read-only or job/crew changes and revokes individual apps. Only local session-protected routes approve requests; public routes never serve the workspace UI, private API or approval actions. S256 PKCE, registered redirects, resource-bound access tokens, rotating refresh tokens, bounded private hash-only grant storage and per-call rechecks enforce access. Stop/restart/unexpected exit revoke grants; queued work can finish. Temporary URLs change on restart and never auto-start. Neither remote access nor local stdio access grants connector/browser/settings or approval authority. See [external MCP access](external-mcp.md).

Remote OAuth advertises only `pitchcrew:access` for client compatibility. Read/write authority remains in the locally approved grant, not the requested protocol scope; verified grant permissions gate tool discovery and every call, and refresh never changes them. Forwarded client addresses are untrusted; SDK OAuth endpoints retain separate default rate limits using one shared connection bucket per endpoint.

Pending remote requests appear first in Settings and in the app-wide Needs you notification group through one visible-only reader. Notices link to Accounts without deciding access, expire locally during read failures, and keep request details in memory. Remote reads and public waiting-page polls have 10-second deadlines; 30-second mutation deadlines enter uncertain-result recovery without retrying the action. Foreground keyboard decisions retain focus, and stopping an address confirms disconnection or pending-request cancellation when needed.

External desktop agents connect through an opt-in local stdio server with a separate revocable workspace credential. Settings > Accounts > Local agent apps provides read/write switches and a copyable configuration for installed and development apps; management routes retain user-session protection. `bun run mcp enable` grants reads; `mcp enable --write` also grants job management and queued crew conversation tools. `mcp config` prints an absolute-path client configuration without credentials, and `mcp disable` revokes subsequent calls from every local stdio client. The dedicated `/api/external-mcp` JSON bridge retains Host/Origin checks, authenticates before parsing and enforces the external allowlist/write grant independently of UI sessions and internal run capabilities. External agents cannot approve, confirm application facts, use connectors/browsers directly or change roles, skills, Profile or settings. External `create_job` calls with a URL first use the same bounded Fetch from link service as Add job, accept URL-only input, retain provider provenance and atomically skip duplicate links. Failed fetches require company/title and the full original description copied verbatim, with no summarizing, rewriting, translation or silent truncation; missing details return `needs_details` without saving. Job events are attributed to `external-mcp`; crew messages carry a visible external-agent label. See [docs/external-mcp.md](external-mcp.md).
