# Models and governed metrics

PitchCrew prepares seven virtual daily aggregate views and eleven metric candidates using the [shared SQL library](../../posthog/sql/resources.json). One source contract controls event filters, failure denominators, duration validity and engineering-import deduplication. The generator does not copy or reinterpret those definitions.

```sh
node scripts/posthog/governed-metrics.mjs
node scripts/posthog/governed-metrics.mjs --days 7 --timezone Asia/Jerusalem
node --test scripts/posthog/governed-metrics.test.mjs
```

The command is network-free and prints a concrete proposal plan. Each model contains a native `view-create` input; each metric contains a candidate definition, unit, daily grain, owner assignment requirement, version and SHA-256 definition hash. It accepts no credentials or apply flag. These administrator artifacts are not part of the renderer or daemon.

The seven models cover accepted action mix, setup readiness snapshots, deliberate API outcomes, observed terminal runs, sanitized exceptions, imported CI attempts and imported merged PRs. Eleven single-unit metrics project counts, percentages and p95 durations from those models' shared SQL definitions. They are daily series over a trailing seven elapsed-day window by default, with bounded 1–30 day alternatives. They are not a full calendar-week summary. Views use a fixed trailing 30-day range and timezone-qualified versioned names; their reusable aggregate relations retain every group in that window, with row limits applied by consumers rather than inside the view. Metric projections similarly preserve the full inner aggregate relation and cap only final results at 200 rows. A 200-row result requires a completeness check before treating the returned series as a whole-window total. Views remain virtual with no materialization schedule. Day boundaries use `Asia/Jerusalem`, optionally UTC.

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

On 2026-10-12, all seven full reusable view relations and all eleven projected metric queries compiled against EU project 295060 using empty source timestamp ranges after removing inner consumer caps. The shared SQL library retains its standalone output limits. New source names triggered taxonomy warnings because the integrated release and repository imports have not populated those sources yet. This validates syntax, not event coverage or numerical correctness.

The dedicated catalog tools still lack `data_catalog:read` and `data_catalog:write`. SQL metadata access now works: a complete ordered `system.information_schema.metrics` list plus count returned zero metrics, so there is no existing approved definition to reuse. The native metric-create schema remains inaccessible, and owner assignment is pending. Eleven metric proposals remain local and noncanonical. No source has been certified. PostHog native Logs/Metrics are separate data planes and are not silently modeled as ordinary events. AI/MCP governed measures can be added after their reviewed shared query contracts and real source coverage exist.

References: [PostHog metrics](https://posthog.com/docs/semantic-layer/metrics), [governance](https://posthog.com/docs/semantic-layer/governance), [native views](https://posthog.com/docs/data-warehouse/views).

## Draft virtual models created

After integration checks passed, seven draft virtual views were created in EU project 295060 and read back individually. The complete initial view inventory and count were zero; each name received an immediate collision check before creation. Final inventory confirms seven views. All exact query definitions matched, every inferred column was schema-valid, `is_materialized` was false, `sync_frequency` was null and `latest_error` was null. Fresh empty-source-window queries validated syntax before each creation batch. Native descriptions explicitly identify the definitions as proposed, noncanonical and source-unverified; PostHog saved views do not have a native governed approval status.

The [activation record](../../posthog/governed-metrics/activation.json) contains native view IDs, links, exact queries, definition hashes, readback schemas and eleven local metric candidates with matching model lineage references. Account names, email and identifiers from creator metadata were omitted. Model source coverage remains unknown until actual release/import observations arrive; an empty relation is not evidence of healthy behavior. No model was materialized or scheduled, and no catalog metric was created or approved. `ready_for_metric_approval` remains false. Draft view creation was explicitly authorized despite source coverage pending; that does not satisfy the planner's stricter preflight for governed proposals and approval.

Metric activation still requires reconnecting with `data_catalog:write`, inspecting the current native input schema, assigning the authenticated account through the verified native owner field and validating real coverage. The record's `candidate` objects are not yet validated native tool inputs. No owner ID or approval schema was inferred.
