# Remote MCP (Grok Bot): Claude design/UX review v2

Reviewed 2026-11-10. Scope: Settings > Accounts > "Grok Bot and remote apps" (`packages/ui/src/RemoteMcpSettings/`) and the public waiting page (`packages/mcp/src/remote/waiting-page.ts`), re-checked against [v1](remote-mcp-claude-v1.md). No implementation code changed.

**Design/UX score: 9.0/10.** All four v1 material issues are fixed and hold up in the live UI. What is left is polish plus two small truth gaps: just after approval, and on the waiting page.

## Evidence

- Live built UI at `http://127.0.0.1:14582/settings?section=accounts` (isolated fictional workspace), in dark mode at 1280×800 and at iPhone 12 Pro 390×844. I used my own preview tabs and closed them afterwards.
- I created a fixture through the public endpoints: dynamic registration of `Opus design fixture` (`pitchcrew:access`, `https://example.test/callback`), then `/authorize` with S256 PKCE. The request card rendered with code `BEDB-15B0`, and the waiting page showed the same code. I approved it read-only, exchanged the code, made one `tools/list` and one read-only `tools/call pitchcrew_status`, then disconnected the fixture. I did not touch a separate `Cursor` request that appeared during the review, the parent's tunnel or any other client.
- I opened the Stop dialog and dismissed it with **Keep connection** only. I never confirmed it. The address stayed ready.

## v1 fixes verified

1. **Request prominence:** fixed. When a request is waiting, "Connection requests (1)" renders first in the section, directly under the description: card at y≈200 on desktop, card at y≈275 and Approve at y≈603 on the phone, so all of it is on the first screen. An ochre "1 request waiting" chip sits beside the title. Step 3 switches to "The request or your decision is shown above." Requests are listed oldest first, so the one expiring soonest is on top.
2. **Stop confirmation:** fixed. It shows only when apps or requests exist. Focus opens on **Keep connection**, and cancelling returns focus to the Stop trigger. The copy counts the waiting requests and says the next address will differ and Grok Bot needs a new message.
3. **Expiry truth:** fixed. Client rows read "Until the connection stops, at most until <date>." "Authorized, no requests yet" turned into "Last successful request …" only after a real tool call. `tools/list` alone did not count, because `touch()` runs only after a successful tool call (`http.ts:106`). That is the right evidence.
4. **Sequence:** fixed. It is a 4-step list matching the local section, the read-scope sentence lives only on the request card, and the Cloudflare/lifetime facts are one paragraph under step 1.

Also confirmed: write access is opt-in on the card and off by default. The Approve label follows the choice ("Approve read-only" / "Approve with changes"). A single `pitchcrew:access` request offers the write option, because the server expands it to read+write. Failed starts read "Start a new address". The link is honestly labelled "Grok Bot website". There is no horizontal overflow at 390px. Under a coarse pointer the CSS raises buttons to 44px, and the 18px checkbox sits inside a 60px clickable label. Disconnect moves focus to the clients heading and announces "App disconnected…".

## Findings (actionable, none blocking)

1. **Gap between "authorized" and "No remote apps authorized" (minor, truth).** After Approve, the request feedback says "Connection authorized. The app can finish connecting." Until the app exchanges its code, step 4 still says "No remote apps authorized." If the app never finishes, the two messages contradict each other. Fix: while a decision feedback is showing and no matching client exists yet, have step 4 say "Waiting for <name> to finish connecting…". Alternatively, reword the feedback to "Approved. Waiting for the app to finish connecting; it will appear below."
2. **No cue outside this panel (moderate, carried from v1's follow-up).** The bell read "Notifications, 0 unread" while a request was waiting, and the list polls only while the panel is mounted. A user who leaves Settings while Grok shows the waiting page has no prompt to come back before the 10-minute expiry. Fix: add a Needs you entry and a Decisions-style ochre count for waiting remote requests that links to `/settings?section=accounts#remote-mcp-heading`. It must never decide anything from the notification.
3. **Write checkbox nearly invisible in dark mode (minor, visual).** The shared checkbox is a borderless inset (border `rgba(236,234,228,.09)`, transparent fill) inside the sunken request card. That stacks two recessed levels, and the unchecked box barely separates from the tray. Fix: scope a hairline border or raised fill for `.remote-mcp-request [role=checkbox]`, or render the request card as a raised `.ui-card` rather than a sunken tray, so the control keeps contrast.
4. **Step 4 heading misnames its content (minor).** "Check successful requests" heads the authorized-apps list, including its empty state "No remote apps authorized". Fix: "Authorized apps" with the existing "check Last successful request" hint as a quiet line, or "Check the app's last request" when apps exist.
5. **Stop dialog with zero apps (minor copy).** With only pending requests, the title says "Stop and cancel pending connections?" but the confirm button still says "Stop and disconnect", and the body says "send Grok Bot a new message to reconnect" although nothing was connected. Fix: the button should read "Stop and cancel" when `apps === 0`, and the body should say "…send Grok Bot a new message to try again".
6. **Any failed change is treated as uncertain and pauses polling (minor).** `change()` marks every error as unconfirmed and sets `blocked`, which stops the 2.5-second refresh until Check status. A definite rejection, such as a request that expired before Approve, therefore freezes the list. A new Grok request will not appear until the user presses Check status. The copy does say to check status, so it is safe, but it is stricter than needed. Fix: only network/5xx/ambiguous failures should be uncertain. Show definite 4xx reasons, as the chat question flow does, and keep polling.
7. **Waiting page polish (minor).**
   - It is light-only. The bright flash after dark Grok/Pitchcrew screens is jarring; add `prefers-color-scheme: dark` colours.
   - It never states the expiry time that the Pitchcrew card shows. Add "Expires at <time>" or "in about 10 minutes".
   - Opening an expired ticket returns unstyled `text/plain` 410. Reuse the page shell for it.
   - The client-side 600-try cap only approximates 10 minutes, but the server's `expired` status is authoritative, so this is cosmetic.
8. **Verbose checkbox name (minor a11y).** The accessibility tree reads "Allow changes and crew messages for Opus design fixture Allow changes and crew messages Can change jobs…", because the explicit `aria-label` and the wrapping label are concatenated. Keep the label text and move the explanation to `aria-describedby`.
9. **Possible focus loss after Approve (unconfirmed).** Once, after approving with a second request still listed, `document.activeElement` ended up on `body` rather than `#remote-request-heading`. Disconnect restored focus correctly in the same tab. The tab was a background preview, where `requestAnimationFrame` may be throttled, so treat this as a lead to check with a focused keyboard test, not a confirmed bug.

## Limits

- I did not reproduce finding 9 in a foreground, keyboard-only session, or test with screen readers.
- I did not view the write-approved client row ("Job changes and crew messages"), a `failed` tunnel, a missing `cloudflared`, or an expired request live. Those are assessed from source.
- I did not confirm Stop, restart the tunnel, or act on the Cursor or Grok requests. Nothing here proves that Grok Bot itself connected or wrote anything; that is the parent's live test.
- The fixture briefly appeared as an authorized client (about one minute, read-only) and is now disconnected. The fixture's OAuth client registration itself remains in the server's client store until the connection stops.
