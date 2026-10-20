# Masked session replay

App recordings are separately opt-in in Settings > Privacy, off by default, and depend only on the master usage-analytics switch (not the diagnostics preference). Website recordings stay off: the landing page offers no replay opt-in, only the analytics opt-out. Website analytics alone never enables recording. Do Not Track, installation configuration and the website analytics opt-out override website replay. Stored choices synchronize across same-origin tabs.

## Implementation and privacy boundary

The existing `posthog-js/no-external` client remains in place. A separately lazy-loaded `posthog-js/rrweb` module contains the recorder shipped in the pinned SDK package. No remote extension, recorder script, project configuration fetch or CSP relaxation is required. The built-in PostHog recorder remains disabled to avoid duplicate or project-triggered recording.

This is a wireframe recording, not a pixel-perfect recording. The app's static workspace navigation and its placement, clicks, scrolls and viewport changes are useful for navigation/friction investigation. The public website records its masked layout and interactions. App main content, crew identities, conversations/recent jobs, dialogs, account editors, menus, tooltips, notifications, attachments and embedded browsers are replaced by placeholders. Inputs (including hidden/file inputs), editable content, images, canvas, media, iframe/plugin content and scripts/styles are blocked. No console or network recording plugin is installed. Source DOM nodes and application behavior are never modified.

Both the local recorder and outbound sanitizer mask all text and attributes. The sanitizer rebuilds snapshots and mutations from a closed schema; source IDs, classes, URLs, hrefs, titles, ARIA labels, values, CSS and arbitrary data attributes never survive. Geometry uses bounded numeric dimensions and a generated fixed wireframe style; only a fixed vocabulary of `data-replay-surface` markers survives. The synthetic replay metadata URL is `https://pitchcrew.invalid/`, never the local URL or a conversation ID. Inputs, stylesheet changes, canvas, media, custom/plugin events and unknown incremental sources are discarded.

Sanitized rrweb events are buffered for five seconds (at most 500 KB/1,000 events) and sent as native `$snapshot` batches to the configured `/s/` ingestion endpoint with existing SDK anonymous session/window IDs. Snapshot properties pass the closed `before_send` boundary again. An oversized snapshot stops recording rather than shipping partial data. There is no retry queue. Opt-out immediately stops observers and drops buffered data; callbacks and pending recorder imports recheck consent. Already transmitted recordings cannot be recalled by local opt-out.

## Native PostHog activation

Local implementation is ready independently of the native project recording switch. At integration readiness, review PostHog project 295060 > Session replay settings and recording retention, then verify the next **real opted-in** app/website session appears in the native replay view. Native recording availability is not claimed before that verification. No fabricated production snapshots are used for testing.

Use renderer/app-version filters through the associated `$pageview` event when investigating recordings. A dashboard text tile links to the native replay view and explains the wireframe limitation, separate consent and retention. Do not build an ordinary event count chart for `$snapshot`: recordings use PostHog's dedicated replay ingestion pipeline.

## Validation

Unit tests cover outbound snapshot/mutation/metadata reconstruction, discarded event classes, master consent, separate website opt-in/DNT, pending-import cancellation, buffer deletion and native `/s/` routing/session IDs. A headless Chromium test uses the **actual bundled recorder**, realistic private sentinel text and attributes, dynamic insertion/mutations and embedded/private surfaces. It checks serialized outbound bodies, preserved original DOM behavior, geometry/pointer capture and opt-out. The actual rrweb replayer consumes the sanitized event schema and renders a navigation wireframe with its measured dimensions. Tests send only to an ephemeral local server.

SDK source references: [bundling options](https://posthog.com/docs/libraries/js), [replay privacy](https://posthog.com/docs/session-replay/privacy), and the installed `posthog-js/rrweb` and `SessionRecordingOptions` declarations. The tested SDK version is 1.435.8.

The coordinator enabled and read back native project replay ingestion. Client recording remains separately opt-in and off by default. Real native session playback still awaits deployment and a consenting session; see `posthog/activation.json`.
