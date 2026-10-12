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
