# Aggregate analytics endpoints

Four prepared PostHog endpoints expose accepted action counts, observed request health, observed terminal run health and imported CI attempt health. They reuse the reviewed [SQL library](sql.md) and proposed [resource definitions](../../posthog/endpoints/resources.json). These are noncanonical observations, with the same coverage caveats as the source queries. No deployment, private key, public client integration or data export is added to Pitchcrew.

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

Execute each reviewed native create plan only when integration is ready. Then get the native configuration, test `endpoint-run` with days 1 and 30 and verify the returned columns, variable binding and endpoint version. The connector query field is untyped; the reusable variable reference map still needs native runtime verification before activation can be claimed. Fetch the endpoint OpenAPI spec for any real consumer. The result validator rejects changed columns/version, more than 200 rows and unexpected raw/object cells. Consumers must pin a tested endpoint version with `?version=N`; the current MCP `endpoint-run` tool has no version parameter, so its returned version must be checked instead.

## Current native status

On October 12, 2026, endpoint create/update/run/get/list tools were callable and the complete list returned zero endpoints for PitchCrew. No endpoint was created or production data generated. Catalog access remains unavailable; native variable creation and endpoint runtime verification are pending. Query compilation is distinct from data availability, and new telemetry/imports are not yet deployed or collected.

Authoritative guidance: [variables](https://posthog.com/docs/endpoints/guide-variables), [Endpoints API](https://posthog.com/docs/api/endpoints), and [SQL variables](https://posthog.com/docs/sql/variables), plus the connected PostHog creating-an-endpoint and consuming-endpoints-from-client-code skills. Private endpoint credentials belong only in an external trusted admin environment; the ingestion project token cannot authenticate reads.
