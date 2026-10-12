# Aggregate analytics endpoints

Four native PostHog endpoints expose accepted action counts, observed request health, observed terminal run health and imported CI attempt health. They reuse the reviewed [SQL library](sql.md) and [resource definitions](../../posthog/endpoints/resources.json). These are noncanonical observations, with the same coverage caveats as the source queries. Native identities and verification evidence are in [activation.json](../../posthog/endpoints/activation.json). No private key, public client integration or data export is added to Pitchcrew.

Endpoints are intended for a future trusted admin consumer; dashboards use native insights directly. They return daily aggregate columns, never raw identifiers, prompts, tool payloads, error messages or log bodies. Day buckets use Asia/Jerusalem; the window is trailing elapsed days rather than complete local calendar days. Empty results mean unknown coverage. Responses may be cached for 24 hours. Materialization is off initially.

## Prepare and verify

```sh
node scripts/posthog/endpoints.mjs list
node scripts/posthog/endpoints.mjs variable-plan
node scripts/posthog/endpoints.mjs run-plan request_health --days 7 --limit 100
node scripts/posthog/endpoints.mjs plan request_health /private/path/endpoint-snapshot.json
node --test scripts/posthog/endpoints.test.mjs
```

The CLI is offline and emits reviewed MCP tool inputs. It has no apply mode, HTTP client, key lookup or arbitrary SQL input. Runtime parameters are whole numbers: days 1–30 (default 7), rows 1–200 (default 100); all other parameters are rejected. Native Number variables bind literals. An independent 30-day timestamp filter and hard 200-row SQL limit remain in every saved query even if a direct caller bypasses the local validator.

The coordinator must confirm PitchCrew EU project 295060, consult the complete governed catalog and inspect current source coverage. An approved, non-drifted exact match takes precedence; do not create these proposed definitions over it. The referenced proposed models are semantic references only; endpoint queries run the reviewed events aggregation directly and do not assume a model exists.

Read the reusable SQL variable inventory through verified schema discovery. Reuse exactly one matching native Number variable named `Pitchcrew lookback days`, code name `pitchcrew_lookback_days`, default 7, or execute the `sql-variables-create` plan after the complete inventory proves no collision. Do not invent its UUID. The native returned variable record is required by the planner.

The private snapshot contract is `{ "project_id": 295060, "complete": true, "results": [...], "catalog": "no_match" | "proposed", "variable": { "id": "<native UUID>", "name": "Pitchcrew lookback days", "code_name": "pitchcrew_lookback_days", "type": "Number", "default_value": 7 } }`. Populate `results` from an unfiltered, fully paginated `endpoints-get-all` plus `endpoint-get` for matches; `complete` attests pagination finished. The planner emits create for missing names, noop for exact active matches and blocks duplicates or query/settings drift. Resolve drift by reviewing `endpoint-get`/versions and explicit native `endpoint-update`, never by deleting/recreating or silently cutting a new version.

Execute each reviewed native create plan only when integration is ready. Then get the native configuration, test `endpoint-run` with days 1 and 7 and verify the returned columns, variable binding and endpoint version. The connector query field is untyped; verify the reference map through a native Number-variable constant query before creating an endpoint. Fetch the endpoint OpenAPI spec for any real consumer. The result validator rejects changed columns/version, more than 200 rows and unexpected raw/object cells. Consumers must pin a tested endpoint version with `?version=N`; the current MCP `endpoint-run` tool has no version parameter, so its returned version must be checked instead.

## Current native status

On October 12, 2026, the complete native inventory was empty before activation. Exact variable name/code-name lookup also returned no rows. The `metric-list` scope remained blocked, but schema-discovered SQL access to `system.information_schema.metrics` succeeded and returned an empty catalog. This permits the authoritative empty-catalog noncanonical fallback; it does not claim the missing OAuth scope was granted.

One native Number variable and all four endpoints were created sequentially, read back and verified at version 1. Native runs with 7-day and 1-day values compiled the actual different numeric literals; exact columns and returned version passed the local result validator. Complete final inventory contains four endpoints, and the deployment planner returns noop for all native readbacks. Native null optional query fields, resolved default 7 and sorted tags are normalized without ignoring substantive drift.

The 7-day action endpoint returned one aggregate day; its 1-day result was empty. Request, run and CI endpoints returned no observations in both windows: their source events are absent from current taxonomy and await release or opt-in import. Those empty results mean unknown coverage. No production events were generated. Query compilation and native activation are distinct from data collection.

Authoritative guidance: [variables](https://posthog.com/docs/endpoints/guide-variables), [Endpoints API](https://posthog.com/docs/api/endpoints), and [SQL variables](https://posthog.com/docs/sql/variables), plus the connected PostHog creating-an-endpoint and consuming-endpoints-from-client-code skills. Private endpoint credentials belong only in an external trusted admin environment; the ingestion project token cannot authenticate reads.
