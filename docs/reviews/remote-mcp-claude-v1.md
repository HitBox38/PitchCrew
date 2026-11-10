# Remote MCP (Grok Bot): Claude design/UX review v1

Reviewed 2026-11-10. Scope: the remote connection flow only — Settings > Accounts > "Grok Bot and remote apps" (`packages/ui/src/RemoteMcpSettings/`) and the public waiting page (`packages/mcp/src/remote/waiting-page.ts`). OAuth/PKCE/token mechanics, the tunnel manager and the local stdio section were out of scope except where they surface as UX truth. No implementation code changed.

**Design/UX score: 8.2/10.** Copy is truthful and careful about scope, cost and the difference between authorization and use; the main gap is that the one time-critical step — approving the matching request — is the hardest thing on the page to find.

## Evidence

- Live UI at `http://127.0.0.1:14582/settings?section=accounts` (built UI, isolated fictional workspace), state "Address ready" with the parent's temporary `trycloudflare.com` address, no pending requests, no authorized apps. Desktop 1280×800 light; iPhone 12 Pro 390×844 dark.
- Measured: no horizontal overflow at 390px; every control in the section is 44px tall on the phone; dark mode renders the code blocks and buttons with correct clay materials and contrast.
- Position of "Connection requests" heading: y≈775 at 1280×800 with the section already scrolled to the top of the viewport (i.e. at the fold), and ≈930px below the section heading on the phone (more than a full screen of scrolling).
- Source: request card, client rows, mutation/uncertainty handling, waiting page, orchestrator error strings, settings search entry. Grep shows no notification, bell, badge or Decisions entry for a pending remote request; the list polls only while this panel is mounted.

## What works

- Scope truth: the request card states what read access includes (jobs, private Profile notes, saved conversations), that approvals/settings stay in Pitchcrew, and that the write option starts crew work that spends runtime credits. Write is off by default and only offered when the app asked for it; otherwise "requested read-only access".
- Identity truth: "App-provided name, not verified" plus the callback host, a matching code on both sides and "Approve only a connection you started".
- Authorization vs use: client rows say "Authorized, no requests yet" until a real request succeeds, then "Last successful request …". The approval toast says "The app can finish connecting", not "connected". The empty state says "Starting an address does not grant access."
- Lifetime/cost honesty: temporary address, changes on restart, no uptime guarantee, data passes through Cloudflare, keep the computer running; Stop disconnects every app while queued work continues.
- Failure/recovery: unconfirmed mutations block further writes and move focus to Check status; unexpected tunnel exit reads "The temporary connection stopped. Start again and reconnect your apps."; missing `cloudflared` gets an install link with "No Cloudflare account or domain is needed".
- Local vs remote separation is stated in both sections, and Find a setting reaches the section with "grok", "remote", "tunnel" etc.
- Waiting page: large code, `role="status"`, explicit path in Pitchcrew, approve/deny both return through the callback, expiry and denial have plain messages.

## Material fixes needed for 9+

1. **Pending requests are below the setup copy and invisible elsewhere (major).** After Grok Bot opens the waiting page, the user comes back to a section whose request list sits under two paragraphs, two code blocks, Open Grok Bot, two more paragraphs, Stop and its note — at the fold on desktop and a screen below on phones — with a 10-minute expiry and no app-wide cue. Fix: when `info.requests.length > 0`, render `ConnectionRequests` first inside the section (above `RemoteConnection`), and add the count to the scope chip in ochre ("Address ready · 1 request waiting"). Smallest acceptable form is the reorder plus chip; an entry in the bell's Needs you group is the better follow-up.
2. **Stop has no confirmation although it revokes every app and forces Grok to be reconfigured (moderate).** One click on a destructive button invalidates the address the user just pasted into Grok Bot. Fix: when `info.clients.length > 0` (or a request is waiting), confirm with the existing dialog pattern: "Stop and disconnect N apps? The address will change; you'll need to send Grok Bot a new message." No confirmation needed when nothing is authorized.
3. **Client expiry overstates lifetime (moderate, truth).** "Access expires <date 30 days out>" reads as a month of access, but Stop, an unexpected tunnel exit or restart revokes it, and the address itself is temporary. Fix the row copy to "Until you stop the connection, at most until <date>."
4. **Repetition hides the sequence (moderate).** The approval/read-scope sentence appears in the section description, the intro paragraph and again on the request card, while the actual order of steps is spread across unstructured paragraphs. The local section directly above already uses a step list (Choose access / Connect your app / Verify a request). Fix: reuse that list pattern here — 1 Start a temporary address, 2 Send Grok Bot the message (copy + Open Grok Bot), 3 Approve the matching request, 4 Check "Last successful request" — keep the scope sentence on the request card only and fold the Cloudflare/lifetime facts into one paragraph under step 1.

## Smaller improvements (not required for 9)

- Approve label could state the access chosen ("Approve read-only" / "Approve with changes"), matching the app's verb-specific approval buttons; the checkbox is far enough above that the choice is easy to miss.
- In the ready state there is no glaze action; "Copy message" is the one thing to do next and could carry it.
- After `failed`, the button still reads "Start temporary connection"; "Start a new address" sets the expectation that Grok must be re-sent the message.
- Waiting page: say what is being requested is decided in Pitchcrew (read-only by default) and what happens on approval ("You'll be returned to your app"). It is light-only, which is acceptable for a one-off page.
- `https://x.ai/bot` for "Open Grok Bot" is unverified by me; if Grok Bot is used as a desktop app, confirm the link opens something useful or rename to "Grok Bot website".

## Limits

- I did not create a fixture OAuth client or pending request: doing so goes through the parent's live public address and would put a second request beside Grok Bot's during the parent's test, risking a wrong approval. The request card, write checkbox, client rows, approve/reject/disconnect feedback and the waiting page were therefore assessed from source, not rendered. Visual checks covered only the ready-with-no-requests state.
- I did not Stop, restart or revoke anything, and did not test keyboard focus restoration live.
- Nothing here confirms that Grok Bot actually connected or made a successful request; that proof belongs to the parent's live test. An OAuth grant appearing in Authorized apps is not that proof, and the UI correctly does not claim it is.
