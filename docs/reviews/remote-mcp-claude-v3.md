# Remote MCP (Grok Bot): Claude design/UX review v3

Reviewed 2026-11-10. Scope: the full remote connection journey as a user meets it. That covers the app-wide notification for a waiting request (toast, bell, Needs you), the deep link into Settings > Accounts > "Grok Bot and remote apps" (`packages/ui/src/RemoteMcpSettings/`), approval, the app row, the Stop dialog, disconnecting, and the public waiting and expired pages (`packages/mcp/src/remote/waiting-page.ts`). I re-checked everything against [v1](remote-mcp-claude-v1.md) and [v2](remote-mcp-claude-v2.md). No implementation code changed.

**Design/UX score: 9.2/10.** The v2 notification gap, the checkbox contrast, the step-4 naming, the Stop-dialog wording and the waiting-page polish are all fixed and hold up in the rendered UI. What is left: one layout issue in the new deep link, one stale message after approval, and small consistency points. Nothing here blocks release.

## Evidence

- Built UI at `http://127.0.0.1:14582` (`dev: false`, no Demo, one fictional Grok-created job on Board). I checked it at 1280×800 in light and dark, and at iPhone 12 Pro 390×844 in dark. I used two of my own preview tabs, both closed afterwards.
- **Fixture:** I registered `Opus design fixture v3` through the public `/register` endpoint (`pitchcrew:access`, `https://example.test/callback`, public client), then called `/authorize` with S256 PKCE and the `/mcp` resource. The server returned a 302 to `/connect/<ticket>`.
- **Journey from outside Settings:** with Board open, the toast "Opus design fixture v3 wants to connect" appeared bottom-right, with the body "App-provided name. Review only a connection you started and match its code in Settings." and a **Review connection** link. The bell read "Notifications, 1 unread". The popover listed the request under **Needs you 1**, linking to `/settings?section=accounts#remote-mcp-heading`. Clicking it opened Accounts, focused `#remote-mcp-heading` ("Grok Bot and remote apps · 1 request waiting") and marked the notice read. The phone showed the same toast and link.
- **Matching code:** Settings showed `C9E9-B110` and the waiting page showed `C9E9-B110`, with an expiry on both.
- **Approval:** with focus on **Approve read-only**, I pressed Enter. Focus moved to `#remote-request-heading`, and the feedback read "Approved. Waiting for the app to finish connecting; it will appear below." Step 4 read "Apps appear here after they finish connecting.", so the v2 contradiction is gone. The waiting page redirected to the registered callback with `state` and `code`.
- **Exchange and calls:** the token exchange returned `scope: pitchcrew:access`. `tools/list` exposed exactly 9 read-only tools (status, list/read job, profile, conversations, run, receipt, queue). `tools/call pitchcrew_status` returned 1 job (lead) and the paused crew. The app row then read "Read-only · Authorized … / Last successful request … / Until the connection stops, at most until Dec 10, 2026."
- **Stop dialog:** I opened it and saw the title "Stop and disconnect 1 app?" and the confirm button "Stop and disconnect", with initial focus on **Keep connection**. Escape dismissed it, focus returned to "Stop remote connection", and the address stayed ready. I never confirmed it.
- **Expired page:** `/connect/invalid-ticket-for-design-review` returned a styled 410 page, "Connection request expired", in dark mode, with no polling.
- **Disconnect:** pressing Enter on "Disconnect Opus design fixture v3" moved focus to `#remote-clients-heading` and announced "App disconnected. New requests are blocked; queued work may continue." The list returned to its empty state.
- **Other checks:** no horizontal overflow at 390px (`scrollWidth` 390). Under coarse pointers, buttons are 44px and the 18px checkbox sits in a 316×60 label. The checkbox's accessible name is now just "Allow changes and crew messages", with the credit warning as its description. In dark mode the checkbox border is clearly visible against the sunken request card.

## v2 findings, re-checked

| v2                                        | Status                                                                                                  |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| 1 Approved vs "No remote apps authorized" | Fixed: "it will appear below" plus a neutral empty state. A new stale-state variant is finding 2 below. |
| 2 No cue outside Settings                 | Fixed: toast, bell count, Needs you entry and a deep link. None of them decide anything.                |
| 3 Dark checkbox contrast                  | Fixed: a scoped hairline border.                                                                        |
| 4 Step 4 heading                          | Fixed: "Authorized apps" with a quiet hint.                                                             |
| 5 Stop wording with zero apps             | Fixed in source ("Stop and cancel", "…to try again"). I saw only the one-app variant live.              |
| 6 Any failure blocks polling              | Kept on purpose, with the reason documented (the API cannot prove nothing committed). I accept this.    |
| 7 Waiting page dark/expiry/410            | Fixed.                                                                                                  |
| 8 Verbose checkbox name                   | Fixed.                                                                                                  |
| 9 Focus after Approve                     | Not reproduced: a foreground keyboard approval kept focus on the requests heading.                      |

## Findings (actionable, none blocking)

1. **The deep link lands with Approve below the fold (moderate, layout).** `useSettingFocus` scrolls the target with `scrollIntoView({ block: 'center' })` (`packages/ui/src/SettingsPage/hooks/useSettingFocus.ts:39`). For `#remote-mcp-heading`, that centres the section heading, so the request card starts low:
   - At 1280×800 the heading sat at y≈430. Approve was at y≈780 in a 784px work area, so it was cut off.
   - On the phone the heading sat at y≈458. Approve was at y≈952 in an 844px viewport, so it was off screen, and the top half of the screen showed the unrelated Local agent apps steps.

   The user arrives from "Review connection" and has to scroll to find the decision. Fix: when the remote heading is the target (or whenever requests are waiting), use `block: 'start'`. The container had 855px of scroll room left, so this is possible. Alternatively, target the first `.remote-mcp-request` itself.

2. **The "Approved. Waiting for the app to finish connecting" message stays after the app has connected (minor, truth).** After the fixture exchanged its code and made a successful call, the requests block still sat at the top of the section with that message, plus "Requests appear here after an app starts connecting". Step 3 still said "The request or your decision is shown above." On the phone the app row reading "Last successful request" was about 900px below. The feedback is only cleared by the next change. Fix: once a client with the approved request's client ID appears, swap the message for "<name> connected" (or clear it), and drop the requests block back into step 3. One more poll-driven condition in `RemoteSetup` would do this.
3. **The Board says "Nothing needs your decision" while a connection request waits (minor, consistency).** In the same screen the bell showed a Needs you item. The deck is scoped to job decisions, which is reasonable. But the phrase is absolute, and the remote request is the one item with a 10-minute deadline. Fix: either change the empty wording to something job-scoped ("No job decisions waiting"), or show one quiet ochre row in the deck ("Opus design fixture v3 wants to connect · Review in Settings") that links the same way and decides nothing.
4. **The bell count drops while the request is still pending (minor).** Opening the notice marks it read, and from then on the bell and phone overflow say "0 unread". Only the ochre chip in Settings still shows a waiting request. This is consistent with how other notices behave, so treat it as low priority. Options: keep `remote_connection` items counted until they are resolved or expire, or give the Settings rail/Accounts item an ochre count while requests wait, the way Decisions does.
5. **Small polish.**
   - The notification reuses the runtime `Settings2` icon (`Notifications/constants.ts`). A link or plug icon would set it apart from runtime updates in the bell.
   - Expiry is formatted differently on the two screens the user compares side by side: "Nov 10, 2026, 4:24 PM" in Settings and "11/10/2026, 4:24:47 PM" on the waiting page. Use the same `{dateStyle:'medium', timeStyle:'short'}` options on the page.
   - The waiting page says "Settings → Accounts → Grok Bot and remote apps" but does not mention that the request also appears in Pitchcrew's notifications. A short "or open the notification in Pitchcrew" would match the new path.
   - The expired page repeats itself: the heading says "Connection request expired" and the body opens with "This connection request expired." The body could start at "Connect again from your app…".
   - The client rows are unnamed `article`s. Add `aria-labelledby` to their `h5`, as the request cards already do.

## Limits

- I saw the zero-app "Stop and cancel" dialog, the write-approved row ("Job changes and crew messages"), `starting`/`failed` tunnel states and a missing `cloudflared` only in source, not live.
- I did not check the light-mode waiting page again (v2 covered it, and the source is unchanged apart from dark mode), and I did not use a screen reader.
- I did not confirm Stop, restart the tunnel, launch crew work, or touch other clients or the native Grok Bot app. Nothing here re-proves the real Grok read/write; that evidence is in [live verification](remote-mcp-live-verification.md).
- My fixture's grant is disconnected in the UI. I did not re-run a call to show the old access token is refused. The fixture's OAuth client registration stays in the server's store until the connection stops.
