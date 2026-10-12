# Weekly PostHog reports

The user requested weekly email to their authenticated PostHog account, **Sunday at 09:00 in Asia/Jerusalem**. The account's verified address was resolved using `user-get` with `@me`; it is intentionally absent from repository artifacts. No report has been activated and no test email was sent.

`posthog/scheduled-reports/reports.json` defines five snapshot reports: product/adoption/workflow, public landing/web, diagnostics/reliability, AI/MCP, and engineering. This consolidation stays within the five-subscription free-plan ceiling when there are no existing subscriptions. Existing paused subscriptions still count toward the limit. Confirm the current project quota before applying; do not delete unrelated reports to make space.

The administrator-only planner is executable with Node 24 and has no network capability:

```sh
node scripts/posthog/scheduled-reports.mjs /tmp/private-report-bindings.json /tmp/private-report-plan.json
node --test scripts/posthog/scheduled-reports.test.mjs
```

The optional output is created exclusively with mode `0600`, because create payloads contain the verified account email. Standard output redacts the recipient. Keep bindings and payload files outside the repository and do not store personal API keys in either file. No administration code or credentials ship in the application renderer or daemon.

## Bindings and review

Supply a private JSON object with these fields after every feature is integrated:

- `projectId: 295060`, `featuresReady: true`.
- `user`: the `email` and `is_email_verified` fields from authenticated `user-get @me`.
- `schedule`: explicit `confirmed: true`, `weekday: "sunday"`, `timeZone: "Asia/Jerusalem"`, and `startDate` with an explicit UTC offset for 09:00 local time. Set `recurrenceVerified: true` only after verifying that the native scheduler preserves the requested timezone across daylight-saving changes. Use an anchor more than 16 minutes in the future.
- `existingSubscriptionsComplete: true`, `existingSubscriptions`: the complete paginated subscription list, including paused subscriptions.
- `subscriptionLimit`: the verified numeric limit, or `null` only when unlimited has been verified.
- `reports`: one entry per manifest key. Each entry needs `dashboardId`, `periodDays: 7`, `filterTestAccounts: true`, `coverageReviewed: true`, and `tiles` selected from the final live dashboard.
- Each selected tile needs its numeric `insightId`, `onDashboard: true`, `reviewed: true`, and `status` of `ready`, `no-data`, or `not-collected`. A `no-data` tile also needs `emptyLabel: "No captured data"`; deleted tiles cannot be selected.

Review each saved insight's real query before asserting its period/filter fields. Snapshot subscriptions use the saved query filters; they do not accept a subscription-specific date range or internal-user filter. Use a trailing seven-day period, internal/test exclusions, and the intended app or landing population. Prefer dedicated report insights if the exploratory dashboard's filters differ. HogQL insights must implement equivalent exclusions in SQL. Coverage booleans record that review; the planner cannot independently execute a query or establish instrumentation readiness.

Uninstrumented metrics are **Not collected**, never zero. Those tiles are omitted from export. A report without instrumented tiles stays pending. Instrumented charts with no events are **No captured data**, which does not imply zero failures, successful delivery, or full population coverage. Do not report CLI duration as provider-call latency or infer tokens/costs.

## Apply after integration

1. Reauthorize the PostHog connection with `subscription:read` and `subscription:write`. Both scopes were absent during discovery on October 12, 2026. Then rediscover `subscriptions-create` and its current schema; permission-blocked schema discovery is not evidence of tool availability.
2. Resolve final dashboard and insight IDs and verify query filters and coverage. The requested Sunday 09:00 Asia/Jerusalem schedule is already confirmed. The public API and loaded skill expose `start_date` and `byweekday`, but no writable timezone field. Do not invent one. **Native activation is blocked until server/user timezone behavior is verified.** A fixed UTC weekly recurrence derived from the initial offset does not preserve Jerusalem local time across DST; its offset changes October 25, 2026. A single correct `next_delivery_date` does not prove correct recurrence. Verify the server's timezone binding or a supported administrator-managed adjustment mechanism before asserting `recurrenceVerified` or claiming the requested local schedule is enabled.
3. Read all subscriptions and project quota immediately before planning. The planner reuses equivalent active subscriptions; conflicting/paused subscriptions require review. Do not automatically update recipients, selected tiles, or resume a subscription, because those operations can send immediate messages.
4. Generate the private plan. For each `create`, call `subscriptions-create` using the schema-checked payload. Keep `send_test_now: false` and `summary_enabled: false`; no AI summaries or immediate messages were requested. Apply sequentially.
5. After each create, retrieve the saved subscription and verify its dashboard, selected insights, destination, enabled state, cadence, and `next_delivery_date`. If a call times out, list again and reconcile before retrying; creation is not idempotent. Re-plan before each later run.
6. Check scheduled delivery history after the first occurrence. Accepted configuration does not establish delivery. Even a completed delivery does not prove every recipient received it. Do not send a manual test.

Dashboard subscriptions store selected insight IDs. When replacing/removing dashboard tiles, review affected subscriptions; replacements are not selected automatically. Free snapshots avoid the credit/approval requirements of AI summaries.

## Authoritative references

Discovery used the connected instance's `posthog:managing-subscriptions` skill and its destination, operation and subscription-type references. The [Subscriptions API](https://posthog.com/docs/api/subscriptions) supplies the payload fields; the [subscription guide](https://posthog.com/docs/product-analytics/subscriptions) describes the dashboard/email surface. No schema fields were inferred from an unavailable tool.
