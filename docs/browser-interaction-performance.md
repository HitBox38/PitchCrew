# Smoother browser viewing and manual takeover

Status: implemented on 2026-10-27 after a self-review against the code and existing decisions. Shared Playwright screencast capture now feeds the authenticated HTTP stream, with bounded viewer queues, independent agent inspection and screenshot fallback. The questions below record the design reasoning; fixture results and remaining limits are recorded under Validation.

## Problem and scope

The conversation started by comparing Pitchcrew's application browser with T3 Code's in-app browser. It did not identify a reproducible browser failure. The working interpretation is to improve visible responsiveness and manual takeover in both the Electron and browser renderers while preserving the documented application workflow. Sign-in compatibility, CAPTCHA success, native text selection and unrestricted browser automation are separate outcomes; faster frame delivery does not establish them.

Use [the glossary](../CONTEXT.md) to distinguish an agent browser session, shared saved sign-ins, manual takeover and supervised mode. See [computer use](computer-use.md) for implemented behavior and [ADR 0002](adr/0002-schedule-work-by-job.md) for independent job sessions sharing agent identities.

## Questions resolved against the code

### Is the current delay real, or only an inference?

Before this change, the stream route took a screenshot, wrote it as base64 JSON, waited 350 ms, then captured again. That established a fixed delay between capture cycles, with screenshot capture adding to the cycle. The fixture baseline and subsequent measurements below distinguish this scheduling limit from measured input-to-display latency.

Evidence: [browser stream route](../packages/orchestrator/src/http/routes/browser.ts), [driver](../packages/mcp/src/computer/driver.ts), and [frame reader](../packages/ui/src/AgentBrowser/api.ts).

### Is frame delivery the only source of lag?

No. Manual input is serialized through one HTTP request per input. Wheel events and ordinary typed characters can each add an entry to that queue. The driver also serializes viewer screenshots, agent inspection and resizing through its rendering queue. Increasing screenshot frequency could add contention without fixing input latency. Measure the display and input paths separately.

Evidence: [manual control hook](../packages/ui/src/AgentBrowser/hooks/useBrowserControl.ts), [input hook](../packages/ui/src/AgentBrowser/hooks/useBrowserInput.ts), and [driver](../packages/mcp/src/computer/driver.ts).

### Should the desktop adopt T3's embedded browser architecture?

Keep the daemon-owned Chromium as the first approach. It already owns saved sign-ins, job-scoped pages, request filtering, form inspection and submission gates, and serves both renderers. A desktop-native surface would introduce a second integration path or require moving those responsibilities across processes. An arbitrary posting iframe would not provide an equivalent browser session or the existing enforcement boundary. Consider a native surface later only if measured requirements include capabilities that streaming cannot deliver acceptably.

Electron also currently recommends alternatives to its `webview` tag; copying that tag is not a sufficient design rationale. See [Electron's documentation](https://www.electronjs.org/docs/latest/api/webview-tag).

### Do we need to build raw CDP capture?

Start with the public Playwright API. The lockfile resolves Playwright 1.63.0, whose versioned types include `page.screencast.start({ onFrame, quality, size })`. It delivers JPEG frames and their viewport dimensions without requiring a recording path. Evaluate it behind the browser-driver interface before considering raw `Page.startScreencast` commands. Verify actual lifecycle and capture behavior with the pinned Chromium; API availability alone is not proof of suitability.

References: [package dependency](../packages/mcp/package.json), [Playwright 1.63.0 types](https://github.com/microsoft/playwright/blob/v1.63.0/packages/playwright-core/types/types.d.ts), and [Screencast API](https://playwright.dev/docs/api/class-screencast#screencast-start). Current online documentation can include options absent from 1.63.0; use the pinned version's contract.

### Does a smoother view need a new WebSocket protocol immediately?

No. First push screencast frames through the existing authenticated HTTP response, replacing the timer-driven capture loop. Keep manual input on its protected routes for the first comparison. This isolates capture scheduling from transport changes. Measure base64 serialization, network buffering, image decode and React updates. Adopt binary WebSocket transport only if those costs remain material, with equivalent authentication and lifecycle coverage. Streaming over HTTP alone is not inherently the fixed-delay problem.

### Can streamed frames replace agent inspection or approval evidence?

No. The live view is transient information for authenticated UI viewers. Agent inspection returns credential-redacted evidence and a page fingerprint used by the exact-action gate. Keep independent, fresh inspection for approvals and execution checks; never let a cached viewer frame authorize an interaction. During manual takeover the agent must continue to receive neither page inspection nor live frames, including through an in-flight request. Existing authorized UI viewers are a different boundary from the agent.

Evidence: [computer manager](../packages/mcp/src/computer/manager.ts), [driver snapshots](../packages/mcp/src/computer/driver.ts), and [computer-use policy](computer-use.md).

### What prevents a fast stream from showing the wrong page or consuming unbounded resources?

Own capture once per browser session/current page and share it across authorized viewers. Keep only bounded pending frame state, favor the newest frame for slow viewers, and bound frame size. Avoid awaiting a slow viewer inside the capture callback. Ensure transport buffers and client decode work are bounded too; a single latest-frame variable does not bound every buffer.

Start capture for visible viewers; stop it when no viewer needs it without closing the browser, resuming the agent or clearing manual pause. Reattach on popup/page replacement. Use session/page generations to reject late frames after navigation, resize, return from manual takeover, browser reset or agent/session switching. Recheck viewer authorization before delivery and terminate on revocation or disconnect. Deliver URL, title, dialog and warning updates independently of image changes, since a static page may not produce new frames.

Keep encoded image size separate from the page viewport used for click coordinates. Screencasts may scale images. Prevent stale clicks across a viewport change; the current dimension check remains necessary. Do not claim that the image timestamp proves a moving DOM target is unchanged.

### Can we improve input by merging every event?

No. First determine whether the ordered HTTP queue is significant. If it is, trial bounded coalescing of compatible adjacent wheel events, preserving direction changes, totals and existing delta bounds. Never move input across click, key, focus, navigation, resize or control-handoff boundaries. Keep text, IME, paste and submission keys ordered and unmodified in the initial change; batching text can change website behavior. Drain authorized pending input before returning control, and reject stale input after lease expiry or session replacement.

Do not automatically replay an input after an ambiguous transport failure: a click or Enter may already have submitted the form. A frame-stream reconnect only restores viewing. It must not imply a renewed control lease or retry side effects.

## Implementation sequence

1. Establish the baseline with intercepted fictional forms and a deterministic scrolling/typing fixture. Record input-to-visible-change latency, delivered frame age, active frame cadence, CPU, bytes and retained memory. Include a warmed browser and report startup separately. Use monotonic timing in the test driver rather than subtracting unrelated browser/client clocks. Collect only fixture data and numeric timings; keep private input and frames out of application telemetry.
2. Add optional frame subscriptions behind `BrowserDriver`, backed by Playwright's public screencast API. Centralize session capture and listener cleanup. Keep bounded, low-rate screenshot fallback for unsupported or failed capture; freeze/label stale views rather than displaying them as live. Preserve existing `snapshot()` for agent evidence. Test first-frame behavior and transitions before changing the UI protocol.
3. Replace the route's 350 ms capture loop with subscriptions over authenticated HTTP. Preserve Host/Origin, user-session, UI-header and conversation/capability checks, cancellation and backpressure. Keep metadata updates independent. In the UI, decode and present the latest frame with bounded work, retaining the shared panel in Electron and web.
4. Re-measure. Address input queueing with narrowly bounded wheel coalescing only if the baseline justifies it. Consider binary transport only if serialization/delivery remains a meaningful bottleneck. Do not broaden agent browser tools or permission modes as part of either change.
5. Verify the full application flow and cross-platform browser lifecycle before enabling the new capture by default. Retain a reversible fallback during rollout and update implemented-behavior documentation only after verification.

## Scenarios that must hold

- The user signs in during takeover: private entry stays out of agent tools, chat, board history and diagnostics. An agent inspection begun before takeover cannot return private evidence afterward.
- The user approves an exact action while viewing a fast-changing page: execution still rechecks its fingerprint and rejects stale evidence. Viewing does not change the approval or resize policy.
- Two jobs use the same agent: sign-ins are shared, but frames, leases, approvals and action ordering remain session-scoped. A slow second viewer does not create a second capture loop or block another viewer.
- The browser opens a popup, changes viewport, shows a dialog or closes its selected page: the live view follows the owned current page with correct geometry and status, and late frames cannot overwrite the new page.
- A viewer is hidden, disconnects or loses authorization: capture subscriptions clean up; manual pause and lease rules remain authoritative. Reconnection requires current authorization and never replays input.
- An approved submission has an uncertain result: neither manual input, stream recovery nor fallback capture permits another attempt. Existing verification is required.

## Evaluation and decision points

Provisional usability targets for an agreed local reference machine are p95 input-to-visible-change below 150 ms for fixture typing, below 200 ms for scrolling, and at least 15 distinct displayed frames per second during sustained fixture scrolling. These are proposed evaluation thresholds, not measured results or product guarantees. Static pages need no minimum frame rate. Report frame freshness and input latency together so a high cadence cannot hide stale buffered frames.

Compare one viewer, two viewers of one session, and viewers across five independent sessions. Memory and pending work must remain bounded under a deliberately slow consumer; idle capture should stop with no visible viewers. Report CPU and bandwidth against the baseline before choosing a final quality setting or capacity budget. Run headless fixtures and the existing hidden Electron smoke path; no real provider or employer submission is needed for automated verification.

Native text selection, rich pointer dragging, native context menus, site compatibility and accessibility of the remote page require separate evaluation. The faster image stream retains the limitations of an image-based remote view. If those become the actual acceptance criteria, reconsider the architecture with that evidence rather than expanding this performance change silently.

No ADR is added: this implementation is a reversible capture change, and the native-versus-streaming decision remains contingent on measured needs. Input event batching and a binary transport are deferred because the measured local HTTP path meets the provisional typing-latency target.

## Validation

Local fixture measurements on 2026-10-27 used macOS arm64, Node 24.22.0 and the lockfile's Playwright 1.63.0 Chromium. These are small, warmed-browser samples on one machine, not cross-platform guarantees or measurements of employer sites.

The standalone fixture sends 12 text inputs with varied spacing, then sustained scrolling. The viewer decodes each received JPEG and reads a colored marker from its pixels; receipt of a frame alone does not count as displaying the changed input. `poll` reproduces the former capture-plus-350-ms-wait loop; `stream` uses the new subscription. Both paths use the same driver input, fictional document and image-decoding viewer. This comparison excludes the app's HTTP transport and React rendering.

| Fixture metric                                             | Former polling loop | Screencast subscription |
| ---------------------------------------------------------- | ------------------: | ----------------------: |
| Median input-to-decoded-pixel latency                      |              274 ms |                   16 ms |
| p95 input-to-decoded-pixel latency (maximum of 12 samples) |              333 ms |                   24 ms |
| Displayed frames/second during scrolling                   |                 2.7 |                    29.5 |
| Delivered base64 image characters over the whole run       |             232,136 |                 912,684 |
| Whole-run duration                                         |            6,827 ms |                3,858 ms |

Higher cadence costs more image bandwidth; those totals span different run durations. Node CPU time and final RSS are emitted by the benchmark, but do not include Chromium's CPU/memory and do not establish retained-memory behavior. The implementation bounds pending frame and decode work structurally; no long-duration memory or whole-browser CPU claim is made.

A separate full-app headless test sends keyboard events through the actual shared renderer, protected HTTP input route, Chromium, authenticated frame stream and image presentation. It reads changed pixels from the panel image. Its 12-sample run measured a 34 ms median and 57 ms p95, meeting the provisional local typing target. It also checks private input is absent from board events and that panel hide/reopen releases capture without changing manual pause. Static title/dialog updates, five independent page sessions, two viewers sharing capture, stale geometry, page replacement, fallback and disconnect behavior have regression coverage. A backpressure fixture floods a paused HTTP writer and verifies it forwards only the newest pending frame after draining.

Reproduce the capture comparison from the repository root with a supported Node LTS and installed dependencies/Chromium:

```sh
node --import tsx packages/mcp/test/browser-view.bench.ts poll
node --import tsx packages/mcp/test/browser-view.bench.ts stream
pnpm exec vitest run packages/ui/test/browser-live-view.test.ts
```

The UI test writes its numeric fixture result to `/tmp/pitchcrew-browser-ui-benchmark.json`. It does not record page images or private inputs as diagnostic data. Broader operating-system performance, prolonged load, rich pointer interactions and real login/CAPTCHA variants still require separate verification. The local tests justify retaining the existing HTTP input and frame transport for this change; neither wheel coalescing nor WebSockets were needed to meet the measured typing target.
