# Reviewed aggregate SQL

`posthog/sql/resources.json` contains seven noncanonical HogQL definitions. `scripts/posthog/sql-library.ts` builds exact `execute-sql` inputs; `scripts/posthog/sql.ts` is an offline administrator planner. It makes no network requests, loads no credentials and does not execute arbitrary SQL. It is separate from the shipped app and cannot grant crew agents analytics access.

```sh
bun --no-env-file scripts/posthog/sql.ts list
bun --no-env-file scripts/posthog/sql.ts plan request_health --days 7 --timezone Asia/Jerusalem --limit 100
bun --no-env-file scripts/posthog/sql.ts plan ci_attempt_health --days 30 --timezone UTC --catalog no_match
node --test scripts/posthog/sql.test.ts
```

After confirming the connected project is **PitchCrew EU, 295060**, consult the complete metric catalog. Use the native catalog runner for an approved, non-drifted match. These definitions stay noncanonical even if their SQL compiles or a proposed metric references them. The planner's `--catalog` value records the administrator's discovery outcome; it does not perform or verify the discovery. Current `data_catalog:read` is unavailable, so approval status is unknown.

Recheck each definition's `sources` through `read-data-schema`, then pass only the resulting plan's `tool_input` to the connected `execute-sql` tool. The project ID is a review guard in the plan; the tool's schema does not accept a project ID and runs against its connected project. A plan is not permission to send it to another project. There is no raw HTTP or API-key fallback.

| Key                 | Calculation and scope                                                                                            |
| ------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `action_mix`        | Accepted chat sends, accepted workflow launches and completed user-requested source scans in one daily aggregate |
| `setup_readiness`   | Boolean workspace readiness observations; no installation-level activation claim                                 |
| `request_health`    | Deliberate request outcomes, failure percentage excluding aborted requests, successful request latency p50/p95   |
| `run_health`        | Observed terminal run outcomes and valid measured duration p50/p95 by fixed workflow/chat mode                   |
| `sanitized_errors`  | Fixed global, React and deliberate API exception source totals; no text or stack inspection                      |
| `ci_attempt_health` | Deduplicated imported completed CI attempts, success share, repeats and completed-job span p50/p95               |
| `pr_delivery`       | Deduplicated imported merged PR throughput and open-to-merge timing by dev/main target                           |

The default scan is seven trailing elapsed days, ending at query execution. Windows are integer 1–30 days and result limits 1–200 rows. UTC and Asia/Jerusalem are the only bucket timezones. Jerusalem day buckets follow timezone rules across DST, but the scan remains elapsed time: this is not seven complete calendar days or a subscription scheduling implementation. Small row limits can truncate chronological daily series; inspect the plan and choose a suitable bound. Dashboard date overrides do not rewrite inline SQL: regenerate plans with the chosen report window or use native typed query nodes for supported charts.

Every events scan, including internal deduplication subqueries, has lower and upper timestamp predicates. Dimensions are fixed enums/booleans, not free-text event properties. Event UUIDs appear only inside engineering deduplication and never leave the aggregate. No user/person/device identifiers, raw property objects, URLs, prompts, results, log bodies, trace IDs or heatmap coordinate samples are selected. The library does not calculate people counts, native funnels, retention or bounce rates. Use the native typed tools for those standard definitions. Native logs/metrics and AI content tables are deliberately excluded until their independent activation/schema contracts are verified.

No observations means unknown coverage. Empty result sets and null percentages/percentiles must not be rendered as zero failures or healthy operation. Opt-outs, inactive renderers, bounded observers and local transports limit coverage; these aggregates cannot measure all daemon activity. Repository events require the explicit opt-in importer and are custom engineering observations, separate from native Engineering Analytics.

## Validation

On 2026-10-12 the connected information schema confirmed `events` columns. Live event/property discovery confirmed existing accepted usage events; the new readiness, request/run, sanitized exception and repository schemas were checked against the reviewed producer source. They are **prepared, not observed collection**. All seven templates compiled through connected `execute-sql` with a zero-width timestamp window. The response returned column headers and expected missing-taxonomy warnings for unshipped sources; it proves syntax resolution only. No synthetic production events or live provider calls were made. Revalidate collection after a real release/import.

The planner reuses documented [HogQL SQL syntax](https://posthog.com/docs/data-warehouse/sql), [aggregate functions](https://posthog.com/docs/sql/aggregations) and [property expressions](https://posthog.com/docs/sql/expressions). Saved models, proposed catalog metrics, endpoints and notebooks can import `buildSqlPlan` to share these exact definitions; they must retain source coverage notes and human approval state.
