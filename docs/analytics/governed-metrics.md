# Models and governed metrics

PitchCrew prepares seven virtual daily aggregate views and eleven metric candidates using the [shared SQL library](../../posthog/sql/resources.json). One source contract controls event filters, failure denominators, duration validity and engineering-import deduplication. The generator does not copy or reinterpret those definitions.

```sh
node scripts/posthog/governed-metrics.mjs
node scripts/posthog/governed-metrics.mjs --days 7 --timezone Asia/Jerusalem
node --test scripts/posthog/governed-metrics.test.mjs
```

The command is network-free and prints a concrete proposal plan. Each model contains a native `view-create` input; each metric contains a candidate definition, unit, daily grain, owner assignment requirement, version and SHA-256 definition hash. It accepts no credentials or apply flag. These administrator artifacts are not part of the renderer or daemon.

The seven models cover accepted action mix, setup readiness snapshots, deliberate API outcomes, observed terminal runs, sanitized exceptions, imported CI attempts and imported merged PRs. Eleven single-unit metrics project counts, percentages and p95 durations from those models' shared SQL definitions. They are daily series over a trailing seven elapsed-day window by default, with bounded 1–30 day alternatives. They are not a full calendar-week summary. Views use a fixed trailing 30-day range, at most 200 aggregate rows and timezone-qualified versioned names; they remain virtual with no materialization schedule. Day boundaries use `Asia/Jerusalem`, optionally UTC.

Anonymous usage observations are not people or accounts. Setup-ready observations are not a retention-validated activation metric; repeated snapshots count separately. Accepted sends/launches are not completed agent work. API failures exclude aborted requests from the denominator. Run failures include cancelled terminal observations in the denominator, with missing durations excluded from percentile measurements. Repository imports are custom events, distinct from native Engineering Analytics sources. No logs body, raw AI input/output, event IDs or person profiles appear in output.

## Deployment preflight

Pass a private inventory snapshot with `--inventory /absolute/path/inventory.json` after checking current tools. The snapshot must be from EU project 295060 and include:

- `catalog_complete: true`, only after reading every page of the native metric catalog.
- `views_complete: true`, only after reading the complete native view inventory.
- `metrics`: rows with `name`, `unit`, `definition`, `status`, `is_drifted`.
- `views`: rows with `name` and the current `query` definition.
- `source_coverage`: each shared query key mapped to `verified` after source/schema checks using real release or import data.
- `metric_create_schema_verified: true` and `owner_assignment_verified: true`, only after inspecting the current native metric-create schema and resolving the accountable human owner.

These flags are operator attestations, not remote verification by this command. Missing checks block proposal readiness. Different existing definitions block collisions instead of triggering `view-create`'s upsert behavior. Equal views are reused. Exactly matching approved, non-drifted metrics are routed to the native catalog runner; existing proposed or drifted entries require review. Neither local hashes nor a successful SQL compile confer approval or certification.

At activation, inspect `info data-catalog-metric-create`, validate the candidate fields against its current schema and add the resolved human owner. Do not pass local metadata as native tool inputs. Create proposed metrics only and read them back. Native human promotion uses PostHog's separate confirmed-action flow; this planner never approves metrics, certifies sources, proposes joins, deletes entities or refreshes drift automatically. If an existing dashboard insight already represents a definition exactly, prefer a native `source_insight_short_id` snapshot for drift detection after checking its complete query.

## Current validation and limits

On 2026-10-12, all eleven projected metric queries compiled against EU project 295060 using an empty timestamp range. The seven underlying shared SQL templates separately passed the same compiler check. New source names triggered taxonomy warnings because the integrated release and repository imports have not populated those sources yet. This validates syntax, not event coverage or numerical correctness.

The connection still lacks `data_catalog:read` and `data_catalog:write`; the metric-create schema and full existing catalog cannot be inspected. Owner identity/assignment is pending. Native `view-create` is available and its input schema was read, but no live models or metrics were written. Proposals remain noncanonical. No source has been certified. PostHog native Logs/Metrics are separate data planes and are not silently modeled as ordinary events. AI/MCP governed measures can be added after their reviewed shared query contracts and real source coverage exist.

References: [PostHog metrics](https://posthog.com/docs/semantic-layer/metrics), [governance](https://posthog.com/docs/semantic-layer/governance), [native views](https://posthog.com/docs/data-warehouse/views).
