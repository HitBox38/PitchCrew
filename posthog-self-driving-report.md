# PostHog Self-driving setup report

## Summary

PostHog Self-driving was configured on October 17, 2026 for PitchCrew, EU project 295060, using `@posthog/wizard@2.84.1` under Node 24.22.0. Session Replay, Error Tracking, and Support are enabled on the server; health, error, and support responders, seven scouts and two Replay Vision monitors are active. Findings appear in the [Self-driving inbox](https://eu.posthog.com/project/295060/inbox) when sufficient evidence arrives; the wizard estimates configuration pickup within about 30 minutes, which does not guarantee a finding.

The repository already targets the selected PostHog project. The wizard removed `disable_session_recording: true` and `capture_exceptions: false` from both analytics clients; review restored those controls before completion. Pitchcrew retains its explicit replay opt-in, masked local recorder, sanitized manual exceptions, diagnostics preference and event allowlist. No production application code changed, and no deployment was performed.

## AI data processing

Approved.

## GitHub

The wizard reported GitHub was connected before this run. This setup did not change repository access or enable GitHub Issues ingestion; a warehouse issue source is distinct from the repository integration used for coding tasks.

## Products enabled

| Product                 | Result          | Repository check                                                                                                                                                           |
| ----------------------- | --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Session Replay          | Already enabled | Existing recordings were detected. Automatic SDK recording remains disabled; new Pitchcrew recordings require separate explicit consent and use the masked local recorder. |
| Error Tracking          | Enabled         | Automatic exception capture remains disabled; the application sends only reviewed manual exceptions when diagnostics consent permits.                                      |
| Support (Conversations) | Enabled         | The responder is enabled; tickets arrive once an inbound email, inbox, or Slack channel is connected in PostHog.                                                           |

## Signal sources

| Signal source                          | Action                           | Notes                                                                                         |
| -------------------------------------- | -------------------------------- | --------------------------------------------------------------------------------------------- |
| `health_checks` / `health_issue`       | Enabled                          | Detects setup and telemetry health problems.                                                  |
| `error_tracking` / `issue_created`     | Enabled                          | New error issues enter Self-driving.                                                          |
| `error_tracking` / `issue_reopened`    | Enabled                          | Regressed error issues enter Self-driving.                                                    |
| `error_tracking` / `issue_spiking`     | Enabled                          | Rapidly increasing error issues enter Self-driving.                                           |
| `conversations` / `ticket`             | Enabled                          | Ready for an inbound Support channel.                                                         |
| `signals_scout` / `cross_source_issue` | On by default                    | No opt-out config exists, so scout findings can reach the inbox.                              |
| `logs` / `alert_state_change`          | Skipped                          | Active PostHog Logs usage was not confirmed.                                                  |
| `endpoints` / endpoint failure sources | Skipped                          | Endpoint usage could not be verified because the active MCP connection lacks `endpoint:read`. |
| Replay Vision                          | Enabled by scanner configuration | Each scanner below has `emits_signals: true`; no separate source row is needed.               |

## Connected tools

No external tool was selected. No data warehouse sources were connected, and no dormant external responders were created.

## Scout troop

### Active troop

| Scout                                    | What it watches                                                                               |
| ---------------------------------------- | --------------------------------------------------------------------------------------------- |
| General                                  | Cross-product patterns and gaps not owned by a specialist.                                    |
| Product analytics                        | Core user-flow and engagement regressions.                                                    |
| Web analytics                            | Traffic, acquisition, and landing-page health.                                                |
| Surveys                                  | Survey response, completion, and score changes.                                               |
| AI observability                         | AI runtime reliability and performance changes.                                               |
| Application workflow completion (custom) | Drops in the job-to-packet workflow completion rate while new workflow activity holds steady. |
| Workspace onboarding readiness (custom)  | Setup abandonment and a persistent blocker among profile, crew, or first-job readiness.       |

`Inbox validation` remains enabled as the operational scout. It runs follow-up checks on resolved Self-driving reports and sits outside the troop ceiling.

### Disabled built-in scouts

- Anomaly detection — disabled because the selected product-analytics scout provides the project’s primary metrics coverage.
- APM — disabled because distributed tracing usage was not confirmed.
- Conversations — disabled because no inbound Support channel is connected yet.
- CSP violations — disabled because CSP violation reporting is not configured.
- Customer analytics — disabled because account/group analytics usage was not confirmed.
- Data pipelines and data warehouse — disabled because no pipeline or warehouse source is connected.
- Error tracking — disabled because the native error responders above own that surface.
- Experiments and feature flags — disabled because active use was not confirmed.
- Insight alerts, logs, revenue analytics, and workflows — disabled because active usage was not confirmed.
- MCP tool calls, skills store, tasks, unused features, web vitals, and PR follow-up — disabled because they are not among the project’s most-used confirmed surfaces.
- Replay Vision — disabled because the two monitors below push individual findings directly; the aggregate scout can be enabled later after observations accumulate.
- Session replay — disabled because Replay Vision monitors own replay findings for this setup.

### Capacity and budget

- **Run budget:** 100 runs/day; 0 used today; 100 remaining.
- **Enabled-scout cap:** 250. At troop configuration, 249 non-operational slots were free; the final seven-scout troop stays below the quality ceiling of ten.
- **Announcement:** “Scouts are in early access. Each project gets up to 100 scout runs a day. Contact team-self-driving@posthog.com if you need more.”

## Custom scouts

| Scout                           | Discriminator                                                                                                                                  | Why it is custom                                                                                                                                                  |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Application workflow completion | A sustained material fall in workflow starts reaching approval or packet export while start volume is stable or rising.                        | The built-in product-analytics scout covers generic flows; this scout distinguishes the application workflow’s job entry, crew work, approval, and export stages. |
| Workspace onboarding readiness  | A sustained material fall in fully-ready workspaces, or one readiness prerequisite becoming the consistent blocker while setup activity holds. | This product’s readiness combines profile, crew, and first-job state, which is not a generic built-in surface.                                                    |

Considered but not added: error bursts (covered by native Error Tracking), session playback friction (covered by the two Replay Vision monitors), revenue, external support, and warehouse health (not confirmed as active surfaces).

If a custom scout proves noisy, set `emit: false` on its configuration in PostHog to move it to dry-run without disabling scheduled learning.

## Replay Vision scanners

A scanner is an LLM that watches individual session recordings on a schedule and pushes high-confidence visible issues to the inbox. It is the only part of this setup that consumes Replay Vision quota. Findings enter at half weight and need independent corroboration before promotion to a Self-driving report.

| Scanner                         | Status  | Scope                                                                                                                                                                            | Sampling |                                                   Preflight estimate |
| ------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------: | -------------------------------------------------------------------: |
| Application board breakage      | Created | Sessions with `$pathname` equal to `/`. This matches both the public landing page and application board; the wizard did not add a renderer filter.                               |      50% |     8 observations/month; 40 credits/month from the four-day sample. |
| Job-search workflow frustration | Created | Sessions containing `$rageclick`, without a URL or renderer filter. Native app rage-click capture remains disabled, so this does not establish application frustration coverage. |     100% | 0 observations/month; no rage-click sessions in the four-day sample. |

The preflight Replay Vision budget check returned 7,500 credits available and 0 used. Estimates reflect the four-day sample and can increase with recording volume; they are not spending caps. Scanner findings depend on available consented recordings, and masked wireframes limit what the model can see. No synthetic traffic or recordings were generated. Rate the first observations in PostHog to assess their usefulness before expanding scope or sampling.

## Repository changes and verification

| File                             | Change                                                                                                             |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Both analytics clients           | Wizard edits were reviewed and reverted to preserve the existing consent and sanitization controls; no final diff. |
| `posthog-self-driving-report.md` | Created this setup record.                                                                                         |

Verification: the wizard exited successfully (code 0) and ran `pnpm typecheck` successfully after the client controls were restored. The custom scout roster was read back by the wizard. This is setup verification, not evidence of production findings, fix quality or complete telemetry coverage. Temporary downloaded wizard skills were removed from the working tree.

## Follow-ups

- [ ] Set a monthly PR limit in the inbox before relying on automated coding. The wizard quotes $15 per shipped PR; other PostHog usage follows the project plan. No PR was requested or created during setup.
- [ ] Review the two Replay Vision scanner scopes: distinguish landing from application with renderer filters before treating them as application-only monitors. The rage-click scanner cannot observe app rage clicks under the current capture policy.
- [ ] Validate custom scout findings as anonymous-device observations. No job IDs are captured, so device-level job-to-export sequences do not prove a single job completed; readiness is observed telemetry, not a current workspace inventory.

- [ ] Connect an inbound Support channel (email, inbox, or Slack) in PostHog so the enabled Support responder can receive tickets.
- [ ] If this project uses PostHog Endpoints, reauthorize the MCP connection with `endpoint:read`, then enable the endpoint failure and breakdown responders.
- [ ] Enable the Logs responder and Logs scout if native PostHog Logs becomes active.

## What happens next

The scout coordinator picks up fresh configurations within about 30 minutes. Scout runs draw from the verified daily budget; findings are clustered into reports in the [Self-driving inbox](https://eu.posthog.com/project/295060/inbox), where immediately actionable reports can begin coding tasks.

Documentation: [Set up Self-driving](https://posthog.com/docs/self-driving/setup) · [Signal sources](https://posthog.com/docs/self-driving/inbox/sources) · [Replay Vision scanners](https://posthog.com/docs/replay-vision/creating-scanners)
