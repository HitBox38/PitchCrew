# Error tracking

The private browser/Electron renderer sends manually constructed PostHog `$exception` events when usage analytics and diagnostics are enabled and a production analytics configuration has initialized. Generic PostHog exception autocapture remains disabled. Tests and unconfigured development remain offline.

## Coverage

- Browser `error` and `unhandledrejection` listeners.
- React 19 root callbacks for errors caught by boundaries, uncaught root errors and recoverable root errors. The original error continues to local console/browser reporting; telemetry never changes boundary rendering or prevents default error handling.
- Unexpected failures of actions already recognized by `actionEvent`: network rejection, HTTP 5xx and malformed JSON on a successful response. Their original rejection/message still reaches the caller. Expected HTTP 4xx, aborted requests, polling, browser input/streams and control renewals are excluded.
- Crew agents report Pitchcrew bugs and missing MCP capabilities that block authorized work or cause avoidable manual effort with `pitchcrew_report_technical_problem` before asking for help or ending a turn. The tool is available to active chat, workflow, isolated application, managed-review and review-subagent runs. Tools-free source extraction remains excluded. Shared runtime instructions distinguish bugs and capability gaps from approval waits, missing answers, deliberately disabled permissions and candidate/application limitations. Agents report observed product behavior without investigating or asking questions solely to complete a report, then continue useful authorized work when possible. Areas are limited to `mcp`, `browser`, `runtime`, `documents`, `sources`, `workspace` or `other`.

This slice does not capture daemon-only crashes, provider CLI internals, landing-page errors or boot errors before the analytics client is ready. It does not enable source-map upload or collect stack traces.

## Outbound data

`error_source` is one of `window_error`, `unhandled_rejection`, `react_boundary`, `react_uncaught`, `react_recoverable`, `api_action` or `agent_report`. `error_category` is a fixed native error class category, `request_network`, `request_server`, `request_response` or agent-only `technical_problem`; arbitrary error names are ignored. API failures include a fixed `error_action` domain, never a route or entity identifier. Agent reports include a fixed `error_area`, `error_kind` (`bug` or `missing_capability`), a product summary, expected and actual behavior, and optional reproduction steps, workaround and related public MCP tool name. Daemon and renderer reconstruct only these reviewed fields; the SDK boundary repeats that reconstruction.

The sanitizer constructs `$exception_list` with a fixed category as `type` and a handled/synthetic mechanism. For detailed agent reports, `value` contains a readable bug report with Expected, Actual and any Steps, Workaround and Tool; `$issue_name` uses the sanitized summary and kind. The fingerprint combines area with a stable hash of kind, tool and normalized summary so distinct problems in the same area can be investigated separately. Other errors retain repository-owned descriptions and fixed source/category/action grouping. It reconstructs these fields again in SDK `before_send`, discarding any injected nested payload. The common analytics boundary adds shipped package version, renderer, schema, anonymous SDK/session identifiers and privacy flags.

Automatic exception reports still exclude source messages, stacks, causes, component names/stacks and application content. Agent reports are a narrow exception to the fixed-text policy: agents author generic product descriptions, never copy raw errors, tool input/output, messages, profile notes, job/company details or documents. The shared sanitizer strips terminal formatting and control characters and redacts recognizable URLs, emails, common local paths, credential patterns and UUIDs at both boundaries. Pattern redaction is defense in depth, not a guarantee of anonymization: names and arbitrary private prose cannot reliably be detected. The tool and runtime prompts require their omission, and Settings explains the report contents.

## Lifecycle and limits

The reporter checks initialization and current usage/diagnostics consent before classifying or retaining an error. The SDK boundary checks both again immediately before sending. Disabling either preference drops new and pending outbound diagnostic events without queuing them for later consent.

An error object is reported once per renderer lifetime, preventing React/browser double reports. Different errors with the same fixed fingerprint produce at most one report per minute; all fingerprints together produce at most 20 reports per minute. Only bounded fingerprints/counts and weak error references remain in memory. Global listeners have cleanup and Vite HMR disposal. Telemetry failures never replace application errors.

Agent reports use the existing nonpersistent backend diagnostic buffer (256 entries, 60-second lifetime), with exact sanitized-report deduplication and at most eight distinct reports per run capability. Different bugs or gaps within one area can both be reported; a limit response includes `limited: true`. Summary is limited to 160 characters, expected/actual to 600 each, steps to 1,000 and workaround to 400; these fields alone have larger buffer limits than ordinary diagnostics. Incomplete detailed input, unknown fields, excessive lengths and invalid tool names are rejected. Legacy area-only calls remain supported for resumed clients. The elected, configured renderer relays them only while both usage analytics and diagnostics are enabled. Disabled periods and renderer reconnections do not upload historical reports. A successful tool response acknowledges local handling, never confirmed PostHog delivery. There is no direct agent ingestion, arbitrary payload, automatic retry, notification, capability change or workflow change. Reports retain the existing usage and diagnostics consent and do not introduce a per-report approval dialog. Reporting remains best effort; shared prompts require the agent to explain the original blocker if the reporter itself fails. If the runtime or MCP connection is unusable, an agent cannot call this tool; runtime failure observations retain their existing separate coverage.

## Agent report example

```json
{
  "area": "mcp",
  "kind": "missing_capability",
  "summary": "No batch tag update capability",
  "expected": "Update tags on several selected jobs in one call.",
  "actual": "The available tools only support individual job updates.",
  "steps": "Select several jobs, inspect available tools, then try updating their tags.",
  "workaround": "Updated each job individually, requiring repeated calls."
}
```

PostHog receives `error_summary`, `error_expected`, `error_actual`, `error_steps`, `error_workaround`, `error_kind`, and (when provided) `error_tool`, alongside the existing source/category/area fields. Those fields survive both the backend buffer and SDK `before_send`; the expected/actual report also appears in the native exception description. Delivery is verified offline through the actual gateway, buffer, renderer relay and SDK mock; live production ingestion requires a released build and consented activity.

## PostHog resources

[Resource descriptors](../../posthog/error-tracking/resources.json) include five validated native Trends queries. Reuse Diagnostics Coverage dashboard `999694` and its existing sanitized-errors insight `6355551` (`79UVPFXi`), replacing only that insight's Not collected label after integration is ready. Keep unsupported charts labeled honestly and update the dashboard introduction to distinguish implemented and absent coverage.

The native [Error Tracking screen](https://eu.posthog.com/project/295060/error_tracking) groups the emitted exceptions automatically. Source, category, action and package-version trends describe captured reports, with explicit collection limits. Anonymous device IDs are not verified people or installations. Empty charts do not imply zero exceptions; report volume is not a crash-free or failure-rate measure.

All five descriptor queries were accepted through connected PostHog `query-trends` on October 12, 2026. No production exception property taxonomy or records existed at that verification stage; it performed no live writes or test-event capture.

### Live chart activation

After the integrated implementation passed its checks, four additional charts were created on Diagnostics Coverage on October 12, 2026. [Activation evidence](../../posthog/error-tracking/activation.json) records their complete saved queries, IDs and verification. All use a seven-day range and descriptions explicitly marked awaiting an updated build and noncanonical. The complete saved-insight inventory contained 51 entries and no matching chart names before creation; no duplicate insight was reused or overwritten.

| Chart                                                                                                 | Insight | Tile    |
| ----------------------------------------------------------------------------------------------------- | ------- | ------- |
| [Reported exceptions and anonymous devices](https://eu.posthog.com/project/295060/insights/EINj5HDY)  | 6518666 | 7390508 |
| [Unexpected action failures by feature](https://eu.posthog.com/project/295060/insights/7cdbVwA2)      | 6518667 | 7390509 |
| [Sanitized error reports by category](https://eu.posthog.com/project/295060/insights/hrGU5rTa)        | 6518686 | 7390544 |
| [Sanitized error reports by shipped version](https://eu.posthog.com/project/295060/insights/lw3Nqj66) | 6518687 | 7390545 |

Each exact query passed `query-trends` before creation, then `insight-get` readback confirmed its saved definition and Diagnostics attachment and `insight-query` ran successfully. All results were empty or zero report series, as expected before new builds ship; these are not healthy-app assertions. The coordinator verified an empty complete metrics catalog through SQL, so the charts remain noncanonical; no metric approval or catalog write was performed.

The existing source chart `6355551` (`79UVPFXi`) was read-verified with its implemented source filter and seven-day range, and left untouched. Only the four new insights and their dashboard attachments were created. Existing source/banner/tile layouts and project settings were not edited. No fake exception events, production deployment or source-map upload were performed; the coordinator owns the final dashboard layout.

## Integration and verification

Feature exports: `sanitizeException`, `createErrorReporter`, `reportErrorDiagnostic`, `installErrorTracking`, `apiErrorAction` and `reactErrorHandlers`. Common-file edits register `$exception` in `Analytics/diagnostics.ts`, expose `analytics.diagnosticsEnabled()`, add root lifecycle wiring in `main.tsx`, and instrument recognized action failures in `api.ts`. Reconcile `api.ts` with the application-metrics slice so both reporters retain the original outcome and error.

Privacy/lifecycle tests exercise malicious messages/stacks/causes, hostile getters/proxies, SDK payload reconstruction, both consent switches, initialization, report limits, error-object deduplication, listener cleanup, React reporting and API behavior. No external ingestion is used.

References: [Manual exception schema](https://posthog.com/docs/error-tracking/installation/manual), [Exception capture](https://posthog.com/docs/error-tracking/capture), [Grouping issues](https://posthog.com/docs/error-tracking/grouping-issues).
