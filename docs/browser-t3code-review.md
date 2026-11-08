# In-app browser review against T3 Code (2026-11)

This review compared Pitchcrew's in-app browser with T3 Code's (source at `D:\CodeStuff\t3code`, `apps/desktop/src/preview` and `apps/web/src/browser`) and with Pitchcrew's own production desktop app driven against real websites and a real Codex runtime. It complements the earlier [benchmark](browser-benchmark.md), which recorded the architecture Pitchcrew had already adopted from T3.

## Verdict

The earlier migration copied T3's architecture (permanent DOM guests, a synthetic CDP relay, capture queues, paint/focus leases) but was verified only against fixture websites. Against the real web, the desktop browser did not work at all, and the parts that did work were slower and noisier to use than T3's.

| Area                   | Before this review                                                                                                                                                               | T3 Code                                                    |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Loading a real website | Hung forever once the agent driver attached; raw "The operation timed out." banner after 15 s and a silently lost control lease                                                  | Loads                                                      |
| Agent clicks           | A successful click that navigated was reported as a failure; legitimate sites in 192.0.0.0/16 (iana.org) were blocked as "private network"                                       | Works                                                      |
| Moving the panel       | Expand parked the page off-screen for about a second; the narrow-window sheet showed a blank page; returning to the split pane left the page at the old viewport, scaled to 0.55 | Slot leases, same-frame handoff                            |
| Browsing by hand       | Every control (back, reload, address, tabs, find, even clicking the page) disabled until Take control, even with the agent idle                                                  | Browse directly; the agent's actions are drawn as a cursor |
| Chrome                 | Four stacked rows including a saturated blue "You're controlling" band and two "Private" pills                                                                                   | Tab row and a compact toolbar                              |
| Page settings          | A wall of full-width outlined buttons and glazed blue zoom buttons                                                                                                               | A quiet menu                                               |
| Failures               | "This page didn't load" with no host; the failed tab titled "about:blank"                                                                                                        | Host in bold, error code in plain words                    |
| Agent visibility       | Nothing on the page shows where the agent acts                                                                                                                                   | Ghost cursor with a click ping                             |

Why tests missed the worst of it: the desktop E2E site is an intercepted IP literal (`https://8.8.8.8`) served by `protocol.handle`, which skips both DNS checks and the real network path used by request interception. Every functional browser test passed while real browsing was broken.

## Fixed in this change

### Functional and technical

- **Request interception deadlock.** The daemon's Playwright driver installs `context.route('**/*')`, so every native request pauses at the CDP Fetch stage. The relay routed `Fetch.continueRequest` through the same focus/paint hold as other commands, which first awaits `Emulation.setFocusEmulationEnabled`. Chromium cannot answer renderer-side emulation while a cross-process navigation is paused, so the navigation waited for `continueRequest`, which waited for focus emulation, which waited for the navigation. Commands that unblock the page (`Fetch.*` continuations and JavaScript dialog decisions) now bypass those holds (`unblocksPage` in `packages/desktop/src/browser/automation.ts`).
- **Public address range.** `publicAddress` treated all of 192.0.0.0/16 as private. Only 192.0.0.0/24 and 192.0.2.0/24 are special-use, so ordinary public sites such as iana.org (192.0.43.8) were blocked.
- **Performed actions stay performed.** After an approved action runs, a failed follow-up capture (common while a click's cross-site navigation swaps renderers) no longer marks the action failed. The manager retries the inspection once and otherwise returns the consumed action with an instruction to inspect again, so the agent no longer tells the user a successful click was blocked.
- **Navigation resolves on commit.** Manual address navigation returns when the main frame commits instead of after every subresource loads; slow sites keep loading with their own progress and failure state rather than timing out the request.
- **Slot leases.** One native page can be claimed by the split pane, the modal sheet and the expanded dialog, which live in different React subtrees. Following T3's `browserSurfaceStore`, the newest claimant presents the page, a slot that lost ownership can neither move nor hide it, and releasing the top lease hands presentation back (`surface-leases.ts`). Page-slot refs use React 19 ref cleanups so a late unmount cannot leave the viewport unobserved. Expand no longer parks the page, the narrow sheet shows it, and the viewport follows the panel again.
- **Plain failure messages.** Chromium failures map to sentences (address not found, offline, refused, timed out, interrupted, redirect loop, blocked by Pitchcrew, untrusted certificate) with the raw code kept under Technical details.

### UI and UX

- **Idle browsing.** While no agent run uses the browser, the toolbar, tabs, address field, history, find and page tools work directly. The first action (or a press on the page) takes control implicitly. An implicit lease is handed back automatically when an agent run starts using the browser; explicit Take control keeps its return-it-yourself contract. While an agent works, a quiet line says so, and a press on the page flashes it as a nudge toward Take control.
- **Agent cursor.** Automation pointer moves and presses are reported from the relay (`agentPointer` on the desktop view) and drawn as a plum pointer that glides between moves, pings on a press, outlives the navigation a click starts and then fades. It is presentation only, hidden during private control and never approval evidence.
- **Quieter chrome.** The "You're controlling" band is a 26px soft-primary line without a second Private pill, and the page outline is a hairline. While browsing implicitly it reads "You're browsing. {Agent} gets the page back when it starts working."
- **Page settings menu.** Tools as an icon row, zoom as one row of ghost buttons, then grouped icon rows (hard reload with its shortcut, clear cache, mute, open in system browser, developer tools), appearance and profiles separated by hairlines.
- **Address bar.** A lock marks HTTPS; Go appears only while typing; an Open in system browser action appears on hover or focus; the placeholder reads "Search or enter an address".
- **Tabs.** Titles fall back from the page title to the host being loaded (a failed tab is named by its host with a rose warning icon, never "about:blank"); middle-click closes; inactive tabs show their close button on hover or focus.
- **Failure page.** "Can't reach {host}" with the plain reason, then Technical details and Retry.
- **Approval tray.** Form controls are named by their inspected label; selectors generated from the agent's inspection are left out of the compact tray (the agent's reason names the element) and remain exact in Details and Decisions.

## Still behind T3

- **Element pick and annotate into the composer.** T3's best browser feature: select an element, region or drawing and attach it with a cropped screenshot. Pitchcrew only annotates whole screenshots.
- **In-app floating player.** T3 floats the page over the chat and auto-shows it when an agent opens a browser; Pitchcrew's float is a separate OS window.
- **Tab management.** No drag-reorder, tab context menu (close others/right), or reopen-closed shortcut feedback in the strip.
- **Chrome height.** Still four rows (header, tabs, toolbar, control line) versus T3's two.
- **Request round trips.** Every native request is checked twice: once by the main-process `webRequest` DNS check and again by the daemon's Playwright route over the relay. T3 does neither for desktop tabs. Heavy pages pay a WebSocket round trip and a DNS lookup per subresource.
- **Web streaming.** Base64 JPEG over HTTP versus T3's binary WebSocket frames with client acknowledgements, half-resolution motion mode and a settle still.
- **Sign-in portability.** T3 imports cookies from installed Chrome, Firefox and Safari; Pitchcrew accepts only reviewed JSON/Netscape exports. No passkey bridge.
- **Test realism.** The E2E fixture should add one real-network path (or an intercepted hostname that resolves through DNS) so request interception and public-address checks are exercised.
