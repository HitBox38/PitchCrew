# Weekly PostHog reports

The user approved weekly chart-only email to their authenticated PostHog account at **Sunday 06:00 UTC**. This is 09:00 in Jerusalem before the October 25, 2026 DST change and 08:00 afterward. The earlier request for fixed 09:00 Asia/Jerusalem is recorded separately in the manifest as historical context; fixed UTC is the current approved delivery schedule. AI summaries and test emails stay disabled. The account's verified address was resolved using `user-get` with `@me`; it is intentionally absent from repository artifacts.

`posthog/scheduled-reports/reports.json` defines five snapshot reports: product/adoption/workflow, public landing/web, diagnostics/reliability, AI/MCP, and engineering. All five were activated and read back on October 12, 2026. The [activation audit](../../posthog/scheduled-reports/activation.json) records safe resource IDs, source-query reviews, recipient verification and empty immediate-delivery histories. Backend acceptance establishes capacity for these five, not an unlimited plan. Existing paused subscriptions still count toward capacity; do not delete unrelated reports to make space.

| Report                         | Subscription | Dashboard                                                              | Selected charts |
| ------------------------------ | ------------ | ---------------------------------------------------------------------- | --------------- |
| Product, adoption and workflow | 51668        | [Adoption](https://eu.posthog.com/project/295060/dashboard/999571)     | 8               |
| Website                        | 51669        | [Website](https://eu.posthog.com/project/295060/dashboard/1018299)     | 9               |
| Diagnostics and reliability    | 51670        | [Diagnostics](https://eu.posthog.com/project/295060/dashboard/999694)  | 9               |
| AI and MCP                     | 51671        | [AI/MCP](https://eu.posthog.com/project/295060/dashboard/1018318)      | 8               |
| Engineering                    | 51672        | [Engineering](https://eu.posthog.com/project/295060/dashboard/1018325) | 8               |

Each is enabled, charts-only, weekly on Sunday, with its first saved delivery at **2026-10-18 06:00 UTC**. No immediate/test email was queued. This verifies configuration, not eventual receipt. New app/landing instrumentation must still ship before those observations can arrive; empty charts do not establish healthy behavior. Engineering charts already describe genuine, manually imported public GitHub metadata.

The administrator-only planner is executable with the pinned Bun version and has no network capability:

```sh
bun --no-env-file scripts/posthog/scheduled-reports.ts /tmp/private-report-bindings.json /tmp/private-report-plan.json
node --test scripts/posthog/scheduled-reports.test.ts
```

The optional output is created exclusively with mode `0600`, because create payloads contain the verified account email. Standard output redacts the recipient. Keep bindings and payload files outside the repository and do not store personal API keys in either file. No administration code or credentials ship in the application renderer or daemon.

## Bindings and review

Supply a private JSON object with these fields after every feature is integrated:

- `projectId: 295060`, `featuresReady: true`.
- `user`: the `email` and `is_email_verified` fields from authenticated `user-get @me`.
- `schedule`: explicit `confirmed: true`, `weekday: "sunday"`, `timeZone: "UTC"`, and `startDate: "2026-10-18T06:00:00Z"` for the approved first occurrence. `recurrenceVerified: true` now means the user-approved fixed UTC schedule; it must not imply Jerusalem DST preservation. For future setup, use an anchor more than 16 minutes in the future.
- `existingSubscriptionsComplete: true`, `existingSubscriptions`: the complete paginated subscription list, including paused subscriptions.
- `subscriptionLimit`: the verified numeric limit, or a conservative documented baseline when actual plan capacity is unavailable; use `null` only when unlimited has been verified. For this activation, billing details were unavailable without `billing:read`, so planning used five and backend acceptance confirmed at least five slots.
- `reports`: one entry per manifest key. Each entry needs `dashboardId`, `periodDays: 7`, `filterTestAccounts: true`, `coverageReviewed: true`, and `tiles` selected from the final live dashboard.
- Engineering is a separate public repository population: it may use `filterTestAccounts: false`, `population: "public-repository"`, and `repositoryFiltersReviewed: true` after reviewing exact source/schema/repository constraints and genuine GitHub import provenance. The app-user cohort does not represent CI or pull-request records. This exception applies only to engineering, never app or landing reports.
- Each selected tile needs its numeric `insightId`, `onDashboard: true`, `reviewed: true`, and `status` of `ready`, `no-data`, or `not-collected`. A `no-data` tile also needs `emptyLabel: "No captured data"`; deleted tiles cannot be selected.

Review each saved insight's real query before asserting its period/filter fields. Snapshot subscriptions use the saved query filters; they do not accept a subscription-specific date range or internal-user filter. Use a trailing seven-day period, internal/test exclusions, and the intended app or landing population. Prefer dedicated report insights if the exploratory dashboard's filters differ. HogQL insights over app-user events must implement equivalent exclusions in SQL. Engineering uses its reviewed repository-population exception above. Coverage booleans record that review; the planner cannot independently execute a query or establish instrumentation readiness.

Uninstrumented metrics are **Not collected**, never zero. Those tiles are omitted from export. A report without instrumented tiles stays pending. Instrumented charts with no events are **No captured data**, which does not imply zero failures, successful delivery, or full population coverage. Do not report CLI duration as provider-call latency or infer tokens/costs.

## Apply after integration

1. Confirm current PostHog access to `subscription:read` and `subscription:write` and rediscover the current `subscriptions-create` schema. Both scopes were absent during initial discovery and became accessible after reconnection, before activation. Future permission-blocked discovery is not evidence of tool availability.
2. Resolve final dashboard and insight IDs and verify query filters and coverage. The user has explicitly approved Sunday 06:00 UTC, which avoids reliance on undocumented subscription DST behavior. Native schemas expose `start_date` and `byweekday`; do not invent a timezone payload field. Use the fixed UTC anchor and verify each saved `next_delivery_date` is 06:00 UTC. This must never be described as fixed 09:00 Jerusalem.
3. Read all subscriptions and project quota immediately before planning. The planner reuses equivalent active subscriptions; conflicting/paused subscriptions require review. Do not automatically update recipients, selected tiles, or resume a subscription, because those operations can send immediate messages.
4. Generate the private plan. For each `create`, call `subscriptions-create` using the schema-checked payload. Keep `send_test_now: false` and `summary_enabled: false`; no AI summaries or immediate messages were requested. Apply sequentially.
5. After each create, retrieve the saved subscription and verify its dashboard, selected insights, destination, enabled state, cadence, and `next_delivery_date`. If a call times out, list again and reconcile before retrying; creation is not idempotent. Re-plan before each later run.
6. Check scheduled delivery history after the first occurrence. Accepted configuration does not establish delivery. Even a completed delivery does not prove every recipient received it. Do not send a manual test.

Dashboard subscriptions store selected insight IDs. When replacing/removing dashboard tiles, review affected subscriptions; replacements are not selected automatically. Free snapshots avoid the credit/approval requirements of AI summaries.

## Authoritative references

Discovery used the connected instance's `posthog:managing-subscriptions` skill and its destination, operation and subscription-type references. The [Subscriptions API](https://posthog.com/docs/api/subscriptions) supplies the payload fields; the [subscription guide](https://posthog.com/docs/product-analytics/subscriptions) describes the dashboard/email surface. No schema fields were inferred from an unavailable tool.

## Historical scheduling investigation after reconnection

Read-only discovery on October 12, 2026 confirmed that subscription tools are now accessible. The active PitchCrew project has `timezone: UTC`. The authenticated user's profile exposes no subscription timezone setting. The current `subscriptions-create` and `subscriptions-partial-update` schemas contain an offset-bearing `start_date`, `byweekday`, `count` and `until_date`, but no IANA timezone field. The current create tool allows up to 20 selected insights; this planner deliberately retains its conservative ten-tile report limit.

The native subscription operations skill and focused documentation searches do not establish whether an offset anchor is retained, normalized to UTC, or interpreted through a named timezone for later occurrences. An empty email/dashboard subscription list supplies no persisted recurrence evidence. Changing the project timezone is not a verified remedy for subscription delivery and would change unrelated analytics bucketing. The [scheduled changes API](https://posthog.com/docs/api/scheduled-changes) supports `FeatureFlag` records only; it cannot queue subscription offset changes. Timezone-aware scouts and marketing broadcasts are distinct products and do not establish dashboard snapshot behavior.

Consequently, **automatic Sunday 09:00 Asia/Jerusalem delivery remained unverified**. Reconnected permissions resolved the earlier scope blocker; they did not establish Jerusalem DST behavior. No subscription or test delivery was created during that investigation. The user subsequently approved fixed Sunday 06:00 UTC, resolving activation without pretending to preserve local Jerusalem time.

The native supported fallback is an administrator-managed **schedule-only PATCH** of each existing subscription's `start_date`. The operations skill states schedule-only updates do not send an immediate delivery by default. Keep the resource, recipients, tile selection, AI settings and enabled state unchanged. Do not resume paused subscriptions as part of an offset adjustment. Read the subscription before each update and verify the saved next occurrence afterward. This procedure is maintenance, not automatic DST preservation.

Node 24's IANA timezone conversion gives these explicit anchors:

| First relevant Sunday | Requested Jerusalem time | UTC instant            |
| --------------------- | ------------------------ | ---------------------- |
| October 18, 2026      | 09:00, UTC+03:00         | `2026-10-18T06:00:00Z` |
| October 25, 2026      | 09:00, UTC+02:00         | `2026-10-25T07:00:00Z` |
| March 28, 2027        | 09:00, UTC+03:00         | `2027-03-28T06:00:00Z` |

For an established fixed-UTC recurrence, patch the autumn anchor after the October 18 delivery and before October 25; patch the spring anchor after the last winter Sunday and before March 28. Recompute future transitions from current IANA data. An `until_date` before a transition or finite `count` can bound a schedule to avoid wrong-time sends, but causes reports to stop unless an administrator extends the schedule; it does not fulfill indefinite weekly delivery. Do not mark the automatic recurrence verified merely because this fallback is available.
