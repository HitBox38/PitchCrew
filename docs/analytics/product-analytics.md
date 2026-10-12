# Product analytics and diagnostic consent

The existing device-local Usage analytics switch remains the master consent gate. Diagnostics is a separate device preference, enabled by default only when the master gate permits capture. Masked session replay has a separate preference and starts off. All three preferences synchronize on same-origin storage events without writing consent changes back to the other tab. Disabling either diagnostic consent or master consent also drops in-flight diagnostic events at the SDK's `before_send` boundary.

The client exposes `analytics.captureDiagnostic(event, properties)` for reviewed feature integrations. `packages/ui/src/Analytics/diagnostics.ts` is a static sanitizer registry. Initially empty, it drops every unregistered diagnostic event, including automatic exception or performance payloads. The coordinator adds feature sanitizer imports and event mappings. Each sanitizer must rebuild properties from fixed enums, bounded numbers and explicitly approved native product fields; it must reject malformed required fields. Registering an event does not authorize raw data, prompts, private content, URLs or local paths.

Existing `analytics.capture` usage events retain their behavior and successful-action semantics. All accepted events retain shipped version and renderer metadata. SDK autocapture, exception capture and generic performance collection remain disabled. A replay implementation must additionally check master consent and its separate preference; storing the preference alone does not load recording code.

Integration contract:

- `createAnalytics(loadSdk, masterConsent?, diagnosticsConsent?)`: diagnostics consent defaults on for isolated test clients; the production singleton reads live device preferences.
- `analytics.captureDiagnostic(event: string, properties: Record<string, unknown>)`: drop unless enabled, configured, master-consented, diagnostics-consented and statically registered.
- `sanitizeEvent(event, diagnosticsAllowed?)`: preserves the usage allowlist; passes diagnostic events through the static feature sanitizer and the common metadata allowlist.
- `useDevicePreferences`: `diagnostics`, `replay`, `setDiagnostics`, `setReplay`; master `analytics` remains independent so disabling/re-enabling usage preserves explicitly chosen diagnostic/replay settings.
- `synchronizeTelemetryPreferences(storageEvent)`: syncs all three preferences immediately; storage clear resets master/diagnostics on and replay off.

No backend transport or live production events are created by this foundation.

## Activation and adoption

`workspace_setup_observed` records only `profile_ready`, `crew_ready` and `job_ready` booleans. It reuses the app's onboarding checklist: a nonblank saved profile, enabled/available agents in all three workflow seats and a non-demo job. The client deduplicates identical readiness observations within each enabled session, including repeated snapshot refreshes. A new session observes the current saved state; it does not manufacture profile-save, onboarding-complete or workflow events. Opt-out drops observations immediately.

`posthog/product-analytics/resources.json` prepares eight native insights for the existing Adoption dashboard (999571): core actions, crew/conversation adoption, browser/pipeline use, observed readiness, job-to-export funnel, explicit onboarding completion funnel, weekly workflow retention and onboarding decisions. All eight queries were accepted by the connected project's native read-only query runners on October 12, 2026. No live dashboard or insight writes were made.

The proposed activation proxy follows job creation → workflow start → packet export, in order within 30 days. Events may concern different jobs because no job IDs are collected. The onboarding proxy follows an app visit → explicit completion within seven days, and does not measure installation activation. Readiness charts count devices observed meeting a prerequisite during the interval; they are not current-workspace inventories or first-time conversion counts. All unique-user series must be labeled anonymous devices, not people or accounts. Native [PostHog identity documentation](https://posthog.com/docs/product-analytics/identity-resolution) explains the identity limitations.

The connection lacks `data_catalog:read`, so approved metric definitions could not be checked. Activation proxies remain proposed and noncanonical; reconcile the complete governed catalog before publishing. Empty new series reflect incomplete coverage until an updated build ships. Existing workspaces default to deferred onboarding. Anonymous IDs are device-local, can reset and are not linked across the app and landing page.
