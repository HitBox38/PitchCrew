# Usage analytics

Pitchcrew supports PostHog product analytics in its shared browser and Electron renderer. Production installations use the bundled PitchCrew EU project and enable anonymous usage by default. Users can turn **Share anonymous usage** off in **Settings > General > Usage analytics**. The choice is saved separately for each browser or desktop origin and synchronized between open tabs on that origin.

Opted-out users and installations with `PITCHCREW_POSTHOG_DISABLED=1` send no analytics requests and do not load the SDK. Development capture is disabled unless explicitly enabled. Analytics failures do not affect app actions; disabled events are not queued for later upload.

## Override installation configuration

No configuration is needed for ordinary installations. The bundled public token and host live in `packages/orchestrator/src/http/analytics-project.ts`. To use another PostHog project, copy its **public project token** (`phc_…`) from project settings and override the daemon's environment. Do not use a personal API key:

```powershell
$env:PITCHCREW_POSTHOG_TOKEN = 'phc_your_public_project_token'
$env:PITCHCREW_POSTHOG_HOST = 'https://eu.i.posthog.com'
pnpm build
pnpm start
```

EU Cloud is the default. US Cloud uses `https://us.i.posthog.com`. Self-hosted instances must use an HTTPS origin without a path, query, fragment or credentials. Set `PITCHCREW_POSTHOG_DISABLED=1` (or an explicitly empty token) to disable telemetry for an entire installation. Configuration changes require a daemon restart, without rebuilding the UI. The session-protected `/api/analytics/config` endpoint exposes only this public configuration. Production CSP permits connections to exactly that origin and keeps scripts restricted to bundled assets.

For intentional development testing, set `$env:PITCHCREW_POSTHOG_DEV = '1'` before `pnpm dev`. Omit it during ordinary development. The daemon does not load `.env` files automatically.

Background service definitions do not copy these variables. Configure them in the service process's inherited environment, or launch the daemon with them directly. Terminal variables do not reconfigure a running service.

## Consent and diagnostics

The master usage switch gates every app telemetry feature. **Share anonymous diagnostics** starts enabled under that master switch and separately gates sanitized errors, request/run measurements and operational logs. **Share masked session replay** starts disabled and requires a separate explicit choice. Disabling a preference takes effect across same-origin tabs; native diagnostic transports abort in-flight requests and keep no retry queue.

The daemon never uploads diagnostics itself. Configured daemons keep a bounded, short-lived memory buffer containing reviewed fixed fields. An opted-in renderer reads it through the session-protected `/api/telemetry/observations` route and uploads fresh observations. Renderer leadership uses an origin-wide Web Lock so multiple tabs do not duplicate shared run/tool observations. A new observer skips existing history; closing all renderers, late connection and unavailable leadership can lose observations. User API measurements remain per renderer.

## Events and data boundaries

Only successful UI API mutations emit action events. Polling, failed actions, previews, and independent agent or routine actions do not emit events. `workflow_started` and `chat_sent` count accepted launches, not completed agent runs.

| Event                                                              | Allowed feature properties                              |
| ------------------------------------------------------------------ | ------------------------------------------------------- |
| `$pageview`                                                        | Fixed `page`, canonical `$pathname`                     |
| `job_created`, `application_registered`, `applications_imported`   | None                                                    |
| `application_status_changed`                                       | Known card `state`                                      |
| `workflow_started`, `chat_sent`                                    | None                                                    |
| `conversation_created`, `chat_continued`                           | None                                                    |
| `user_question_answered`, `user_question_cancelled`                | None                                                    |
| `browser_session_changed`                                          | `action` (open/close/take/release)                      |
| `pipeline_followup_saved`                                          | None                                                    |
| `app_update_download_requested`, `app_update_install_requested`    | None                                                    |
| `agent_created`, `agent_saved`, `agent_retired`, `agent_restored`  | None                                                    |
| `skill_saved`, `skill_deleted`, `routine_saved`, `routine_deleted` | None                                                    |
| `profile_saved`, `job_sources_scanned`                             | None                                                    |
| `packet_export_requested`, `packet_exported`                       | None                                                    |
| `approval_decided`                                                 | `kind` (packet/computer/role/skill), boolean `approved` |
| `workspace_setup_observed`                                         | Boolean `profile_ready`, `crew_ready`, `job_ready`      |
| `onboarding_updated`                                               | Known onboarding `status`, `step` (0/1)                 |

Every chat thread becomes `/chat`; query strings and filters are excluded. Repeated renders, search changes and switching chat threads do not duplicate the same page view.

`chat_sent` covers the current conversation message route and the legacy role-chat route. It counts accepted user messages, including queued turns, rather than responses. `chat_continued` counts a user's explicit continuation request. Question events count successful answer/cancel decisions without choices or answer text. `pipeline_followup_saved` counts a saved review follow-up, not a completed pipeline assessment.

Browser events count successful UI open/close and take/release control requests. Query parameters are stripped before matching routes; thread IDs never become properties. Manual browser inputs, navigation, sites, screenshots, streams, viewport changes and periodic control renewals are excluded. These events do not count agent-triggered browser use.

Desktop update events observe the main process entering `downloading` or `installing` after a user request, so installation is counted only after native confirmation. Initial state loading and repeated progress notifications do not count. These are best-effort request counts, not proof of a completed download or installation; renderer shutdown can lose a capture.

Every event also includes `app_version` from the root package version shipped with the renderer, `renderer` (`browser` or `electron`), and `analytics_schema: 2`. The version accepts only a bounded numeric semantic version; no commit, runtime/model, operating-system fingerprint or custom identifier is included. Schema 2 distinguishes the expanded tracking from older builds even when their package versions match.

The SDK generates an anonymous device identifier, session/window IDs and event metadata. It never identifies a person or creates person profiles. A `before_send` allowlist rebuilds every event's properties, keeping only these IDs, the public ingestion token, SDK name/version, release context and the feature properties above. It removes URLs, referrers, attribution, screen/device metadata and person-property updates. GeoIP enrichment is disabled. The ingestion service still receives the source IP at the HTTPS network layer.

Names, emails, profile notes, messages, job/company details, tags, prompts, packets, account tokens, local paths, card IDs, custom role IDs and error text are excluded. App autocapture, automatic pageleave/performance/exception capture, surveys and feature-flag requests remain disabled. Reviewed manual `$exception` events contain fixed error categories and fingerprints, without source messages or stacks. Request outcomes and observed run durations use bounded numbers and fixed vocabularies; they do not establish complete daemon coverage. The SDK's `no-external` entry point loads no remote scripts. See [PostHog SDK configuration](https://posthog.com/docs/libraries/js/config) and [data collection controls](https://posthog.com/docs/privacy/data-collection).

Automated verification uses fictional public tokens and mocked boundaries; it makes no calls to a live PostHog project.

## Dashboard coverage

The connected PitchCrew project is EU project 295060. Its [Usage Overview](https://eu.posthog.com/project/295060/dashboard/999570), [Crew & Feature Adoption](https://eu.posthog.com/project/295060/dashboard/999571), and [Application Workflow](https://eu.posthog.com/project/295060/dashboard/999572) dashboards describe anonymous device activity and accepted user actions. Device IDs are not identified people, and ordered device funnels cannot establish conversion of individual job cards. Website and application identities are not linked, so download clicks cannot establish installation conversion.

The former Health & Reliability dashboard is [Diagnostics Coverage](https://eu.posthog.com/project/295060/dashboard/999694). Its eight saved diagnostic queries remain as explicitly labeled **Not collected** placeholders: errors, run outcomes/duration, API results/latency, Web Vitals and ratings. These signals are not emitted by current builds; empty values must never be presented as zero errors or healthy performance. New feature events and release context begin only with updated builds, with no historical backfill.

## Feature implementation and activation

| Feature               | Implementation and limits                                                                                                                                                                                                                     |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Product analytics     | Successful action counts and a three-boolean setup proxy; anonymous devices are not people. [Details](analytics/product-analytics.md).                                                                                                        |
| Web analytics         | Public landing native page/session events, pageleave and numeric Web Vitals; no private app browsing or attribution URLs. [Details](analytics/web-analytics.md).                                                                              |
| Error tracking        | Reviewed manual native exceptions for renderer errors and unexpected API action failures. [Details](analytics/error-tracking.md).                                                                                                             |
| Application metrics   | Observed request/run events and bounded native OTLP metrics; native product enablement is separate. [Details](analytics/application-metrics.md).                                                                                              |
| Logs                  | Native OTLP fixed operational codes through renderer consent; no console stream or raw error messages. [Details](analytics/logs.md).                                                                                                          |
| Scheduled reports     | Weekly charts only, Sunday 09:00 Asia/Jerusalem, to the verified connected PostHog account. Planner defers activation until integration, quota, resource bindings and DST recurrence are verified. [Details](analytics/scheduled-reports.md). |
| Engineering analytics | Manual opt-in GitHub collector and custom event queries; native engineering sources remain separate. [Details](analytics/engineering-analytics.md).                                                                                           |

Resource manifests under `posthog/` are reviewable deployment inputs. Their presence does not mean a resource has been created or telemetry deployed. Saved chart descriptions must distinguish **Not collected**, **No captured data**, and measured results. New event coverage begins with updated builds and has no historical backfill. Automated validation remains offline and never invents production events.
