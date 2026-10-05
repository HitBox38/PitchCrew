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

## Events and data boundaries

Only successful UI API mutations emit action events. Polling, failed actions, previews, and independent agent or routine actions do not emit events. `workflow_started` and `chat_sent` count accepted launches, not completed agent runs.

| Event                                                              | Allowed feature properties                              |
| ------------------------------------------------------------------ | ------------------------------------------------------- |
| `$pageview`                                                        | Fixed `page`, canonical `$pathname`                     |
| `job_created`, `application_registered`, `applications_imported`   | None                                                    |
| `application_status_changed`                                       | Known card `state`                                      |
| `workflow_started`, `chat_sent`                                    | None                                                    |
| `agent_created`, `agent_saved`, `agent_retired`                    | None                                                    |
| `skill_saved`, `skill_deleted`, `routine_saved`, `routine_deleted` | None                                                    |
| `profile_saved`, `job_sources_scanned`                             | None                                                    |
| `packet_export_requested`, `packet_exported`                       | None                                                    |
| `approval_decided`                                                 | `kind` (packet/computer/role/skill), boolean `approved` |
| `onboarding_updated`                                               | Known onboarding `status`, `step` (0/1)                 |

Every chat thread becomes `/chat`; query strings and filters are excluded. Repeated renders, search changes and switching chat threads do not duplicate the same page view.

The SDK generates an anonymous device identifier, session/window IDs and event metadata. It never identifies a person or creates person profiles. A `before_send` allowlist rebuilds every event's properties, keeping only these IDs, the public ingestion token, SDK name/version and the feature properties above. It removes URLs, referrers, attribution, screen/device metadata and person-property updates. GeoIP enrichment is disabled. The ingestion service still receives the source IP at the HTTPS network layer.

Names, emails, profile notes, messages, job/company details, tags, prompts, packets, account tokens, local paths, card IDs, custom role IDs and error text are excluded. Autocapture, pageleave capture, session replay, surveys, feature-flag requests, performance and exception capture are disabled. The SDK's `no-external` entry point loads no remote scripts. See [PostHog SDK configuration](https://posthog.com/docs/libraries/js/config) and [data collection controls](https://posthog.com/docs/privacy/data-collection).

Automated verification uses fictional public tokens and mocked boundaries; it makes no calls to a live PostHog project.
