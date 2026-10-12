# Public landing heatmaps and frustration signals

The public homepage has native PostHog click/mouse movement geometry, rage-click and dead-click heuristics, and pageleave scroll measurements. Private browser/Electron workspace content is excluded. Recording is a separate feature and permission; heatmaps never start a recorder.

The implementation uses the installed `posthog-js` 1.435.8 `capture_heatmaps` configuration. Its native `$$heatmap` batches call the ordinary `capture` method and therefore pass through the landing `before_send` privacy boundary. The sanitizer replaces every batch URL key and native pageview/pageleave `$current_url` with the constant `https://pitch-crew.tomer-norman.dev/`. Actual pathname/query/hash/referrer, link destinations, DOM text/chains/attributes, clipboard/form values and release-SHA metadata are excluded. Only fixed signal types, finite bounded coordinates/viewport/scroll measurements and existing anonymous session/pageview links survive. Invalid geometry and batches without viewport dimensions are dropped; at most 2,000 points are inspected per batch.

`autocapture` remains disabled. Rage-click detection uses three nearby clicks with less than one second between successive clicks. The detector is configured at SDK initialization while heatmap listeners stay off until analytics is enabled. Dead-click detection is imported from the installed SDK's local `dist/dead-clicks-autocapture` bundle; `no-external` alone does not contain this lazy extension. Its heatmap callback emits geometry only. Standalone `$dead_click`/`$rageclick` events and element identity remain excluded. No remote scripts are allowed.

Production configuration, Do Not Track and the existing website analytics preference gate every send. The same consent/storage events synchronize other tabs. Opt-out immediately disables heatmap listeners, cancels native dead-click observers and discards buffered coordinates before any later opt-in. Events disabled before readiness are never queued. In-flight requests cannot be recalled. Native SDK scroll reach is delivered on pageleave and is best effort.

## Dashboard preparation

[`posthog/heatmaps/resources.json`](../../posthog/heatmaps/resources.json) describes one dashboard with five tiles: individual native interaction volume, desktop/mobile click hotspots, possible frustration hotspots and observed scroll reach. These read the native `heatmaps` table, never the number of `$$heatmap` batches. Its live column schema was checked read-only in project 295060. Query templates remain prepared until the coordinator validates them during integration and deploys actual instrumentation; no fabricated production events are sent.

Geometry provides positions rather than named elements; compare the public page visually. Rage and dead clicks indicate possible friction, not confirmed bugs or user sentiment. Keep desktop and mobile layouts separate. Scroll delivery and opt-outs limit coverage, so an empty chart never demonstrates zero friction. Native heatmap retention is 90 days; tiles use the last 30 days. These are proposed operational definitions, not approved governed metrics.

## Native activation checklist

1. Finish the integrated checks and deploy the public landing build. In local/headless verification, route all ingestion to fixtures; never use the production token for test events.
2. In [project heatmap settings](https://eu.posthog.com/project/295060/settings/environment-heatmaps), enable native heatmap ingestion (`heatmaps_opt_in`). Set capture URLs to **Only listed URLs**, with exactly `https://pitch-crew.tomer-norman.dev/`. Do not enable arbitrary URL or private daemon capture.
3. Create the prepared dashboard/insights after validating the query templates against the live schema. These are SQL-backed because individual heatmap points live in a native table separate from event batches.
4. Inspect the first genuine opted-in visits read-only: URL is the canonical constant, viewport dimensions are present, native click/rage/dead/scroll rows appear and no raw URL/DOM metadata is present. Collection starts with deployed visits; historical pageviews cannot recover missing interactions.
5. Create the prepared saved homepage heatmap at 390px and 1280px widths using the native saved-heatmap tool. Wait for its asynchronous render before claiming it is viewable. No session-replay consent is implied by this step.
6. Verify the footer opt-out and Do Not Track stop collection, including cross-tab storage changes. Keep native private-app heatmaps and arbitrary autocapture off.

References: [PostHog heatmaps](https://posthog.com/docs/toolbar/heatmaps), [JavaScript configuration](https://posthog.com/docs/libraries/js/config), [SDK configuration types](https://posthog.com/docs/references/posthog-js/types/PostHogConfig). Native table schema was retrieved from the connected PostHog `querying-posthog-data/references/models-heatmaps.md` skill and verified with read-only information-schema SQL.
