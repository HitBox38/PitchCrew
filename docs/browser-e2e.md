# Desktop browser end-to-end tests

Run `bun run test:e2e` with the pinned Bun and a supported Node version. It builds the application and drives the production Electron entry with Playwright, a real Bun daemon, the built React UI, the sandboxed preload, actual isolated webviews and the production browser driver. `bun run test:desktop` runs this suite before the existing desktop smoke and native browser integration checks. The desktop CI job runs it on macOS and Windows.

The deterministic provider connects to the real scoped MCP stdio server for inspection, action requests and execution. The app UI decides approvals through the real HTTP routes. Browser launch, native IPC, the browser driver, session protection and approval gates are not mocked. Only the provider and external website are fixtures; no live model, employer website or user workspace is used.

## Journeys

The twelve cases verify observable results:

- Open the browser from Chat and navigate its actual native guest through the address bar.
- Type into the website with trusted pointer and keyboard input after takeover.
- Open the real page-settings popover, observe changing compositor pixels beneath it and change actual page zoom.
- Keep that same live guest beneath the app context menu, reset confirmation dialog and notification sheet.
- Expand and restore the Base UI browser surface while human input continues to reach the same guest.
- Navigate to Settings and back while preserving the page, its human field draft and manual-control lease.
- Create, navigate, select and close a real second tab, use Back/Forward and retain the first tab's draft.
- Capture the real native page, annotate it and attach its PNG to the existing composer draft without sending a message.
- Start an agent from Chat, inspect through real MCP, review current evidence, approve the exact action and observe its actual field value. Read-only viewing also blocks a human click without takeover.
- Reject another agent action in the UI and verify its native click never happens.
- Crash the actual guest renderer and recover through the UI's Retry action with a new guest generation.
- Close through the app controls, assert that owned guests are destroyed and require normal Electron and daemon process exit.

The website's changing color marker uses a CSS animation. It proves live native composition without changing the DOM that exact-action approval fingerprints bind. A viewport change invalidates stale approval normally; the deterministic agent follows the tool's instruction to inspect and request fresh evidence. The test waits for the displayed approval to match the real viewport before deciding it.

## Isolation and evidence

Every run creates `pitchcrew-browser-e2e-*` under the OS temporary directory. `PITCHCREW_E2E_FILE` selects isolated Electron data and hidden, nonfocusable startup without starting the older smoke interaction script. The harness watches window show/focus events throughout the journeys. Captures use Electron `capturePage` with `stayHidden` and `stayAwake`.

The printed evidence directory contains a Playwright trace (`trace.zip`), native captures beneath the actual overlays (`live-page-*.png`), a final desktop capture (`desktop.png`), renderer HTML, renderer errors and daemon logs. CI retains these artifacts. `bun x --no-install playwright show-trace <path-to-trace.zip>` from `packages/ui` opens a trace for manual investigation.

Normal Playwright close releases its test-owned Node inspector and uses Electron's ordinary quit path. Parent-observed process exit has a separate ten-second deadline. Forced cleanup of a failed child and its owned helpers always fails the suite. The existing independent Electron shutdown limitation remains documented in [desktop shutdown performance](desktop-shutdown-performance.md).

These E2E journeys complement the broader [native functional matrix](browser-benchmark.md). Exact reviewed packet uploads/submission receipts, OS chooser seams, expired-control leases, multi-viewer streaming and other lower-level combinations retain their native integration/API tests. The separately mocked UI suites remain useful, but are not counted as these full application E2E cases. Live provider runs and real employer submissions remain outside automated verification.
