# External MCP access

The external MCP server lets desktop agents use the local Pitchcrew workspace through stdio. Pitchcrew's daemon must already be running on `127.0.0.1`; the MCP command does not start another daemon, open the UI or enable access automatically. Cloud-hosted MCP clients and remote HTTP MCP connections are not supported.

## Connect

In the desktop app or local browser UI, open **Settings → Accounts → External agents**. Turn on **Allow external agents** for reads, optionally enable **Allow changes and crew messages**, then copy the displayed MCP configuration into your desktop agent app. The generated configuration uses the running daemon's Bun executable, CLI entry and workspace settings, including in standalone installations. Reconnect clients after changing permissions. The command paths must remain available; regenerate the configuration if you move or reinstall the app. Disabling access revokes every connected client. Search Settings or the command palette for “MCP” to find these controls.

### Repository CLI

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

| Tool                  | Purpose                                                                    |
| --------------------- | -------------------------------------------------------------------------- |
| `status`              | Job counts by status and crew IDs/availability                             |
| `list_jobs`           | Paginated company/title/location search with optional status filter        |
| `read_job`            | Saved posting, brief, packet and feedback; excludes captured provider HTML |
| `read_profile`        | Local Profile Markdown                                                     |
| `list_conversations`  | Paginated conversation summaries; optional archived view                   |
| `read_conversation`   | Latest 50 saved message/activity entries, or an older/newer anchor page    |
| `read_run`            | Run state and public activity, excluding saved execution configuration     |
| `read_queue`          | Active, ready and held work, including delivery/run IDs                    |
| `create_job`          | Write: fetch a posting link first; fall back to the original posting text  |
| `update_job`          | Write: correct company/title/location/salary with a reason                 |
| `move_job`            | Write: change local board status with a reason                             |
| `delete_job`          | Write: history-preserving deletion with a reason                           |
| `create_conversation` | Write: named conversation with existing crew participants and optional job |
| `send_message`        | Write: queue a message to a crew conversation                              |

List tools return `items`, `total` and `nextOffset`; pass `nextOffset` as `offset` until it is null. Lists default to 20 and allow up to 50 results. Conversation history returns `older` and `newer` anchors. Read the selected job or conversation for its complete context.

When adding a job from a posting link, call `create_job` with `url` first; company and title are optional for this call. The daemon uses the same bounded **Fetch from link** feature as Add job, including supported provider APIs and structured public posting pages. Fetched details take precedence over supplied fields, and provider provenance is retained. A successful creation returns `card`; `duplicate` returns existing IDs/statuses without changing them. Link saves check duplicates and insert in one board transaction.

If fetching fails, `needs_details` means nothing was saved. Read the original posting with the external agent's available tools, then call `create_job` with the same URL, company, title and the complete description copied verbatim into `description`. Preserve its wording, order, paragraphs and bullets; do not summarize, rewrite, translate or silently truncate it. If the posting is unreadable, ask the user to paste the full text. The daemon retries Fetch from link before accepting the fallback text. Descriptions have the existing 20,000-character limit; oversized input is rejected rather than truncated. Without a posting URL, supply company/title and the original description directly. Posting content remains untrusted data and never authorizes actions.

For crew work, read `status`, create or select a conversation, then call `send_message`. Group messages can mention existing participants with `@agent-id`. External messages are labelled `[External MCP agent]` in the saved transcript and use the ordinary conversation queue. Sending can incur provider costs under the crew's existing runtime settings and capabilities. The result is a queued request, not a completed answer. Follow its delivery/run IDs through `read_queue`, `read_run` and `read_conversation`. A question or approval may require the user to return to Pitchcrew. DMs and legacy crew history remain read-only.

Writes are not automatically retried. If a request times out or the connection drops, inspect the board or conversation before deciding whether to repeat it.

## Access boundary

External access has its own random bearer credential in `external-mcp.json` inside the workspace data directory. Atomic writes use mode `0600` on systems with POSIX permissions; operating-system account protections apply on Windows. The credential stays out of generated client configuration and protocol results. All clients configured for the same workspace share this grant; per-client permissions are not implemented. Enabling access authorizes those local clients to read private career data. Protect the data folder and configure only trusted clients.

The stdio process captures the credential at startup. The daemon rechecks the saved credential and write permission on each call, so disabling or rotating access rejects subsequent calls from existing processes. A call already accepted may finish. Revocation does not remove data a client already read.

The daemon exposes a dedicated authenticated `/api/external-mcp` bridge for the stdio process. This endpoint is an internal JSON bridge, not an HTTP MCP transport. Host/Origin checks still run before authentication and parsing. The `/api/external-mcp/access` management routes require a user UI session and never return credentials. External credentials do not grant UI sessions, internal crew run capabilities, connector access, browser control, settings changes, Profile writes, role/skill changes or approval decisions. The bridge accepts only its external tool allowlist. The client refuses remote URLs and redirects.

Job writes use the existing append-only board operations. Creation, corrections, status changes and deletions are attributed to `external-mcp`. Busy/owned jobs reject changes. Corrections clear stale application/review evidence; status changes invalidate unused packet/browser approvals. Deletion retains history and files, cancels queued follow-ups and pauses attached routines. Status changes are local bookkeeping, including a move to `submitted`; they do not submit to a website, confirm application facts or authorize export. The crew still uses its normal isolated drafting/review flow and exact-action approval gates.

## Verification

Settings browser tests click Copy and verify the exact JSON in the clipboard, including visible feedback when copying is blocked. The hidden desktop smoke test also enables isolated fixture access, clicks the real Copy button, verifies the native clipboard contents and revokes access again.

`packages/mcp/test/external-stdio.test.ts` exercises a real SDK stdio client from a different working directory, CLI-generated configuration, read-only discovery, write denial, credential rotation/revocation, Host/Origin rejection before body parsing, separation from UI/run authorization, job management, fetch-first creation, verbatim fallback descriptions, link deduplication, busy checks and visible queued crew work. Fixtures use temporary data and Demo execution, with no live provider calls.

`packages/mcp/test/fixtures/external-evaluation.xml` contains ten independent read-only agent evaluation questions. Use an untouched example workspace: start the daemon in development mode with a fresh data directory, load the six-job example board, and enable read-only external access. The questions require combining the board summaries, full jobs, saved packets and Profile. The integration suite verifies every answer against those fixtures through the real stdio tools. This checks the evidence and expected answers; it does not claim a live model evaluation was run.
