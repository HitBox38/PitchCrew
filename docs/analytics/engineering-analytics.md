# Repository engineering analytics

Pitchcrew has an executable, content-free GitHub metadata collector and a separate manual GitHub Actions workflow. **Neither ingestion nor native PostHog Engineering Analytics has been activated.** The new workflow is independent of required CI and Release; it does not change release gates or their permissions.

The source is the public `HitBox38/PitchCrew` repository. Collection refuses a private repository. It reads workflow/job/step metadata and closed PR metadata through GitHub's authenticated read API, then constructs a strict event allowlist. No installed Pitchcrew daemon or renderer sends engineering events. Repository maintainer opt-in is separate from users' device analytics preferences; this tooling never reads local app data.

## Run and activate

Use Node 24 and an authenticated `gh` CLI with read access to repository Actions and pull requests:

```sh
node scripts/engineering-analytics/index.ts
```

This is a read-only dry run. It prints event counts only, makes no PostHog requests, and stores no raw metadata. `PITCHCREW_ENGINEERING_LOOKBACK_DAYS` selects a 1–30 day window (default seven).

After the integration is ready and merged, the coordinator can set repository variables `PITCHCREW_ENGINEERING_ANALYTICS=1` and `PITCHCREW_ENGINEERING_POSTHOG_TOKEN` to the EU project's **public `phc_` capture token**, then manually dispatch **Engineering analytics** with `send=true`. The default dispatch remains a dry run. The workflow uses GitHub's ephemeral token with `contents:read`, `actions:read`, and `pull-requests:read`; no personal PostHog key or new broad GitHub token is required. It checks out the trusted default branch, never the selected dispatch branch or a PR/fork head, so both workflow and tooling must reach the default branch before activation. Installation CI and release workflows stay unchanged.

For an explicit local send, supply the same environment variables and append `--send`. There is no cron subscription yet: refresh the collector manually before the weekly PostHog email, or add a maintainer-approved bounded schedule after the first verified import. Turning off the repository opt-in prevents sending. Missing/invalid public tokens, HTTP failures, redirects and incomplete bounded pagination fail visibly. HTTP error bodies and GitHub CLI stderr are never included in telemetry or collector error messages.

## Measurements

| Event                         | Definition                                                                                                                                                                               |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pitchcrew_ci_run_completed`  | One observed completed `CI` attempt. `job_span_seconds` is earliest completed job start through latest completed job finish, including dependency gaps but excluding initial queue time. |
| `pitchcrew_ci_job_completed`  | One completed job with valid start/end timestamps, fixed job class, fixed conclusion, and `duration_seconds`.                                                                            |
| `pitchcrew_ci_step_completed` | One completed allowlisted check/build/test step, fixed step/job classes, conclusion, and `duration_seconds`. Commands and arbitrary step names are excluded.                             |
| `pitchcrew_pr_merged`         | One non-bot, non-draft PR merged into `dev` or `main`. `open_to_merge_seconds` includes any earlier draft and review time; it is not review time or cycle time.                          |

No actor identities, PR titles/bodies, log bodies, SHAs, branches other than the fixed `dev`/`main` target enum, URLs, run/PR numbers or runner names become properties. Unknown job/conclusion/trigger classifications use `other`. Person profiles are disabled and sender IP enrichment is suppressed. A single fixed repository distinct ID is used, so **unique users are meaningless for engineering events**; every prepared query selects only engineering events.

Stable UUIDs derive from repository/run attempt/job/step or merged PR identity, and timestamps preserve the source action time. Repeat backfills preserve both; prepared SQL additionally groups by UUID before aggregating. Retries use distinct attempt UUIDs. Event capture uses the fixed EU `/batch/` endpoint, at most 100 events per request, a deadline, and no redirects. Partial batch failures can be safely rerun.

Collection is bounded to 1,000 rows per paginated endpoint, ten attempts per run, and 500 GitHub read requests per invocation. Hitting a bound fails instead of silently reporting complete coverage. PR pagination stops when updates precede the collection window. CI discovery is by **run creation** within the lookback: a rerun of an older run is omitted; use a wider window where possible. Running attempts are omitted until a later successful import. A run with no valid completed-job timestamps is omitted; job/step timing charts contain only valid timings. Windows with missed manual imports or expired GitHub metadata are incomplete. The workflow does not ingest the Release workflow or create developer productivity rankings.

## Prepared dashboard

`posthog/engineering-analytics/resources.json` prepares **Engineering delivery (repository metadata)** with attempt outcomes, success rate, job/step timings, PR throughput/open-to-merge time and repeat-attempt share. These are **custom event-based, noncanonical definitions** until incorporated into the governed metric catalog. Query windows are fixed to 30 days in SQL, so dashboard date overrides do not apply. Empty charts mean no imported observations, never healthy CI. The coordinator must validate and create resources only when integration is ready; this worktree performs no live resource writes.

The success-rate denominator includes all observed completed attempts, including cancellations/skips. Repeat-attempt share counts attempts numbered greater than one; it is **not a flaky-test rate**. Build timings use matching completed steps and exclude skipped steps; cancelled/failed build step durations remain observable. Separate target-branch PR trends prevent release PRs from being silently mixed with feature PRs.

## Native Engineering Analytics prerequisites

The connected PostHog source tool `engineering-analytics-sources` is disabled, and searching for alternatives found no enabled source-discovery tool. The public GitHub API is readable, but that does not prove PostHog has a synchronized GitHub source. Do not claim native setup or native warehouse tables exist.

To activate native Engineering Analytics, reconnect with `engineering_analytics:read` and the appropriate source-management access; confirm availability of the product for project 295060, connect only `HitBox38/PitchCrew`, and discover the actual source ID and warehouse table prefix. Follow the native GitHub source setup rather than embedding credentials here. Run read-only source discovery and inspect synchronization before creating native insights. Use the native `engineering_analytics_job_costs`, `engineering_analytics_ci_job_history`, and `engineering_analytics_ci_failures` views for their supplied semantics; do not invent source prefixes, price models or additional native views.

Current GitHub CI publishes Vitest JUnit artifacts for seven days. **This collector does not download test artifacts or logs**, instrument CI spans, compute native flaky-test rankings, or assert individual tests are flaky. Native test-failure/flake features require the product's supported test/trace ingestion; API-visible job failures and reruns are insufficient. Native failure views documented by the current skill are pytest/failure-only and cannot substitute for this repository's Vitest results. Timing and PR metrics work independently of those unavailable native features.

References: [PostHog Engineering API and scopes](https://posthog.com/docs/api/engineering-analytics-3), [capture API](https://posthog.com/docs/api/capture), [event deduplication](https://posthog.com/docs/data/events#event-deduplication).
