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

An independent design review scored the first pass 5/10: the control vocabulary contradicted itself, the chrome took 178px against T3's ~76px and the approval tray reserved 108px of filler. The second pass rebuilt the chrome around one answer to "who has this page":

- **One state chip.** The header shows the agent and one bead-coloured chip: Idle (empty socket), You're browsing or You have control (primary), Working (plum), Needs your OK or Paused (ochre). It opens task details, which now hold the permission mode (Supervised or Autonomous preparation) and the privacy note. The old Private and mode chips, the "You're controlling" strip and the "agent is using this page" hint row are gone; a press on a page the agent is using flashes the chip ochre.
- **Idle browsing.** While no agent run uses the browser, the toolbar, tabs, address field, history, find and page tools work directly; the first action (or a press on the page) takes control implicitly, and an implicit lease is handed back automatically when an agent run starts — including when the panel mounts mid-run or the lease is still being acquired, and through lease renewal when no panel is mounted. The header offers Take control only while an agent works, Return to agent only after an explicit takeover and Recover control when it lapsed; explicit control for the remaining cases sits under Browser options.
- **Two rows of chrome.** Row one holds the agent, the chip, the page's tabs inline (a lone tab shows no pill; overflowing tabs fade at the edge) and the panel actions; row two holds navigation, the address, find, history and Page settings, on the same paper with one hairline. The resize handle is an invisible hit area instead of a 6px band.
- **Agent cursor.** Automation pointer moves and presses are reported from the relay and drawn as a plum pointer with the agent's name that glides between moves, pings on a press, outlives the navigation a click starts, rests visible while the run lasts and fades after it. Presentation only, hidden during private control, never approval evidence.
- **Approval tray.** One line in a 56px reservation (autonomous preparation keeps its taller step list): an ochre bead (a lock for submissions), what will happen ("Open example.com", "Type into Email"), the agent's reason, Details, then a verb-specific approval first ("Approve opening", "Approve click", "Approve typing", "Approve submission") and Reject. Deciding shows Running…; a tray decision raises no toast over the next request. While idle the tray is one muted line.
- **Find.** A floating pill under the Find button over the page's top-right corner, with a match count from Chromium; it never pushes the page down.
- **Page settings.** Tools as an icon row, zoom as one row of ghost buttons, grouped icon rows (hard reload with its shortcut, clear cache, mute, developer tools), appearance and a Profile row, separated by hairlines. Open in system browser lives on the address bar.
- **Address bar.** The lock appears only for a committed HTTPS page without an error; Go appears only while typing; Open in system browser appears on hover or focus.
- **Tabs.** A real tab list; titles fall back from the page title to the host being loaded (a failed tab is named by its host with a rose warning icon); middle-click closes; inactive tabs show close on hover or focus with a 32px target; right-click offers Close, Close other tabs, Close tabs to the right, Mute and Copy page address.
- **States.** "Can't reach {host}" with a plain reason, round failure orbs, an Opening chip while the browser starts, address-first focus in the narrow sheet so a stray Space cannot pause the agent, labels that collapse by panel width, toolbar tooltips with shortcuts, and a Browser button dot that is plum only while an agent run uses the browser.
- **Approval tray names.** Form controls are named by their inspected label; selectors generated from the agent's inspection stay out of the compact tray and remain exact in Details and Decisions.

### Third pass

A second design review scored 6.5/10 and found the tray's text clipped by leaking legacy layout rules, generic "Click a page element" summaries, a New tab button lost inside the fading tab strip, a chip that read as a tab, a cursor left on unrelated links after navigation, no close button in a narrow sheet that had been expanded, focus pulled into the address on expand, and five stylesheets overriding each other. The third pass:

- Gives the tray one source: the legacy tray, hint and mode-chip rules were deleted, and a waiting request is two lines on an ochre tint. Approval requests carry the inspected element's redacted visible name (an existing optional snapshot field, outside the action digest), so the tray says "Click “Learn more”"; without a name the agent's reason leads.
- Moves New tab outside the tab list, shows a lone tab as its plain title, separates the chip from tabs with a hairline and fills the chip only for states that need attention or show control.
- Fades the cursor 350ms after a main-frame navigation and within 600ms after the run ends, rests it at 35% during the run, flips its name inside the page near edges and drops the ping under reduced motion.
- Shows × whenever the panel is narrow, focuses Back to chat on expand and lets Escape in an unedited address reach Back to chat.
- Replaces the idle "Return to agent" (control taken by browsing hands back on its own) with "Keep control until I return it", which marks the existing lease explicit without another takeover.
- Puts the page flush under the toolbar in the split view, polishes Find ("3 of 12", "No matches", disabled arrows), history rows and a confirmed clear, makes website appearance a segment, and gives the chat header's Browser button a pressed state and an ochre dot for waiting approvals.

### Fourth pass

The third design review scored 7/10. Its blockers were approvals that hid the typed value and gave no target on the page, a cursor that never faded for reduced-motion users, a header that shifted tabs on every control change, a page that reflowed 73px at every run start and end, an ochre tint that was invalid CSS, and a takeover that chat counted as a failed step. A Codex code review (7/10) separately found a stale target name, a renewal that could release a newer explicit takeover, a handback that never retried and an Escape that left an emptied address. The fourth pass:

- Writes the tray title in Pitchcrew's words with the exact value ("Type “jane@…” into “Email”", "Choose “Israel” in “Country”", "Upload resume.pdf to “Resume”"), falls back to "Click an element on host" instead of the agent's reason, and reads the element's name at request time with fresh credential redaction.
- Rings the target on the live page: a still dashed ochre box whose bounds stay in daemon memory (never in the approval event or digest) and are served to the user only.
- Times the cursor in script (full, resting, fading, hidden) so it settles under reduced motion, clips it to the page and clears it when automation lets go.
- Moves Take control, Return to agent and Recover control to the end of the tray line and keeps the chip a fixed-width pill, so control changes never move the header; the selected tab scrolls into view, and narrow panels keep the avatar without the name.
- Reserves the tray for the whole open session, keeps the agent's latest run readable in the expanded column after it ends, narrows that column before any run and makes the expanded page flush.
- Records a browser call stopped by a takeover as "Paused while you had control" (an existing interrupted status), shown as "paused for you" rather than a failure.
- Adds element picking under Page settings: Chromium's inspect highlight follows the pointer, a click returns the element as a padded crop with its tag and visible name, and the user reviews it in the screenshot dialog before attaching it to the draft. Picking needs held control and never presses the element.
- Adds tab reordering by drag, Control+Shift+Page Up/Down and the tab menu, keeps a recovered crashed tab in place, and fixes smaller copy: "New tab" and "Browser not open" placeholders, "In another chat", "Edit address" first for addresses that can't be found, a role's real name in Details and numeric hours.

## Still behind T3

- **Region and drawing picks.** Pitchcrew now picks single elements into the composer (DevTools-style highlight, padded crop, tag and visible name, reviewed before attaching), but T3 also picks free regions and drawings in one step.
- **In-app floating player.** T3 floats the page over the chat and auto-shows it when an agent opens a browser; Pitchcrew's float is a separate OS window.
- **Request round trips.** Every native request is checked twice: once by the main-process `webRequest` DNS check and again by the daemon's Playwright route over the relay. T3 does neither for desktop tabs. Heavy pages pay a WebSocket round trip and a DNS lookup per subresource.
- **Web streaming.** Base64 JPEG over HTTP versus T3's binary WebSocket frames with client acknowledgements, half-resolution motion mode and a settle still.
- **Sign-in portability.** T3 imports cookies from installed Chrome, Firefox and Safari; Pitchcrew accepts only reviewed JSON/Netscape exports. No passkey bridge.
- **Test realism.** The E2E fixture should add one real-network path (or an intercepted hostname that resolves through DNS) so request interception and public-address checks are exercised.
