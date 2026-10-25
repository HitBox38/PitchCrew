# Operational Logs

Pitchcrew emits fixed-code operational records to **native PostHog Logs** through OTLP HTTP JSON. These are not product events or console output. PostHog's native endpoint accepts an `ExportLogsServiceRequest` at `/i/v1/logs`, authenticated with the public project token in an `Authorization: Bearer` header. See [native Logs](https://posthog.com/docs/logs), [OTLP installation](https://posthog.com/docs/logs/installation/nodejs) and the [documented JSON ingest schema](https://github.com/PostHog/posthog/blob/master/rust/capture-logs/README.md).

## Record vocabulary

| Fixed body              | Service             | Severity | Trigger                                                               |
| ----------------------- | ------------------- | -------- | --------------------------------------------------------------------- |
| `runtime_run_failed`    | `pitchcrew-runtime` | ERROR    | Existing chat/workflow catch, unless waiting for user input           |
| `runtime_run_cancelled` | `pitchcrew-runtime` | INFO     | Same catch when its cancellation signal is aborted                    |
| `http_request_failed`   | `pitchcrew-http`    | WARN     | Existing daemon HTTP error handler, before its unchanged 400 response |
| `daemon_run_recovered`  | `pitchcrew-daemon`  | WARN     | Startup recovers a previously running board run                       |
| `daemon_ready`          | `pitchcrew-daemon`  | INFO     | Daemon plugins become ready                                           |
| `daemon_start_failed`   | `pitchcrew-daemon`  | ERROR    | Daemon startup catch                                                  |

The body is exactly the code. Resource attributes are fixed `service.name` and the shipped `service.version`. Log attributes contain code, fixed area (`chat`, `workflow`, `http`, `daemon`), fixed renderer, analytics schema and the **existing initialized SDK anonymous ID** under PostHog’s documented `posthogDistinctId` attribute. See [log identity linking](https://posthog.com/docs/logs/link-person). No new identity or person profile is created. Timestamps represent renderer observation/send time, because the local diagnostic buffer does not expose an event timestamp.

HTTP request failures include expected user validation errors: the daemon's existing handler returns 400 for them. They are not a 5xx rate. Runtime failures may come from setup, provider execution or result validation; these log codes do not infer provider-specific root causes.

## Privacy and transport

`sanitizeOperationalLog` reconstructs codes/areas from a closed vocabulary at both the backend buffer and renderer transport. It discards all extra properties. Raw errors, stacks, paths, request URLs, board IDs, role IDs, runtime/model selection, prompts, messages, tool arguments and results never reach native log records. Logging does not change application error responses, stored history, runtime cancellation or approval gates.

Backend recorder hooks only write into the bounded in-memory observation buffer. They make no network requests. The renderer sends only when master analytics, diagnostics and production analytics configuration are enabled and the initialized PostHog SDK ID is available. Records before initialization are dropped. The installer listens synchronously to preference/config changes; opt-out aborts pending sends. Each request times out after five seconds, omits credentials/referrers, rejects redirects and sends at most 8 KiB. At most two requests are active. There is no queue, retry, persistence, unload flush, response-body collection or general console interception. Failures never generate another log.

Only an open, opted-in renderer can relay records. The buffer is short-lived, and relay baselining can skip earlier startup records. Shutdown clears the buffer; daemon startup failures generally cannot be observed remotely because no renderer can connect. Do not use missing logs as an availability signal or claim startup failure monitoring is comprehensive.

## Integration and project resources

1. Compose `sanitizeLogObservation` from `orchestrator/src/telemetry/logs.ts` in the central backend sanitizer for `operational_log`.
2. Install `installOperationalLogs({ getDistinctId: analytics.getDistinctId })` once in the mounted shell. Its `capture(event, properties)` owns native transport and `dispose()` removes subscriptions and aborts requests.
3. Route `operational_log` observations directly to that `capture`; **do not register them in product event capture**. The shell's existing consent-mediated observation relay remains responsible for polling/deduplication.
4. Use [resources.json](../../posthog/logs/resources.json) for native LogQL view definitions and a Diagnostics dashboard text tile. These definitions are human/tool setup descriptors, not undocumented saved-view API payloads.
5. After real integrated traffic arrives, verify the native Logs services/bodies and create saved views through a current schema/tool or the UI. Do not fabricate production log records to validate setup.

The [native LogQL API](https://posthog.com/docs/logs/logql-api) uses `logs:read` for queries. No native saved-view creation tool was available in this connection during implementation. Project resource activation is deferred to the coordinator after integration.

## Verification

Unit checks assert closed vocabularies, no raw content, no-op disabled buffers, recorder failure isolation, exact OTLP encoding/authentication, missing SDK identity rejection, concurrent-request bounds, request timeout, no retry and opt-out abort. Installer tests cover same-device and synchronized cross-tab preference changes plus disposal. Integration checks cover actual existing chat/workflow catches and HTTP errors without changing error behavior.

Audit repair adds optional closed `failure_category` values (`aborted`, `timeout`, `validation`, `process_exit`, `executable_missing`, `other`) and a 400–599 `http_status` for HTTP failures. Known CLI exits and deadline errors are tagged at their source so private stderr is never needed for classification. Explicit valid framework HTTP statuses are preserved; existing untyped application errors retain their 400 contract. An `other` category is uncertainty, not a root-cause diagnosis.

Runtime `process_exit` records also retain an optional bounded integer `runtime_exit_code` (0–4,294,967,295) and a fixed OS-name `runtime_exit_signal`, including premature ACP exits. Null codes and unknown signals are omitted. The shared sanitizer checks these attributes again before OTLP encoding; neither field is accepted on HTTP or daemon records. Structured workflow result validation is tagged at its source instead of falling back to `other`. Original exceptions, stderr and result content remain local.
