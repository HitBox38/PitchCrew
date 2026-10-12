# MCP analytics

Pitchcrew manually emits PostHog's native `$mcp_tool_call` event after a reviewed tool action reaches the scoped daemon gateway. The wrapper measures elapsed milliseconds and whether the original handler resolved or rejected. Original tool results, errors, capability checks and approvals remain unchanged. These are observed gateway calls, not every MCP protocol request or every tool inside a provider CLI.

The event contains only the registered tool name, error boolean, bounded duration, fixed server name `pitchcrew`, coverage marker `mcp_observation_level=scoped_gateway`, and a fresh UUID session. A WeakMap ties that UUID to the local run-capability object for its lifetime; it contains no board/run/card/role ID. Replacing a capability creates a new session. The same UUID supplies native `$mcp_session_id` and `$session_id`, so MCP sessions reflect a run capability rather than an unrelated browser session. These MCP sessions are intentionally separate from anonymous browser replay sessions and AI runtime traces.

The shared `sanitizeMcpToolCall` function rebuilds properties for both the daemon buffer and renderer diagnostic allowlist. It rejects unknown tool names, malformed IDs, nonboolean outcomes and invalid durations; it drops parameters, responses, error text, descriptions, intent, model/client metadata, paths, URLs and all custom entity identifiers. No native MCP SDK is installed, so its automatic input/output, intent and exception capture cannot bypass this boundary. Tools introduced later require explicit reviewed mapping and registration-test updates.

The backend only writes content-free observations to the shared bounded, ephemeral buffer. It does not contact PostHog. The consent-mediated renderer relay forwards these native events using the existing anonymous SDK identity, with master usage consent, diagnostic consent and origin-wide leadership. Integration must register `sanitizeMcpToolCall` for `$mcp_tool_call` in both the backend sanitizer and renderer registry and mount the shared relay. The included renderer change prevents generic SDK metadata from overwriting a sanitizer-owned native session ID.

Coverage limits:

- Capability bootstrap actions are omitted. `connector_access` is also omitted because startup discovery and `pitchcrew_list_connectors` share that action; counting it would invent user tool invocations.
- Unknown tool names, missing capability tokens and MCP schema rejection before the HTTP gateway are not collected. Known tools rejected by gateway permissions, validation or approval checks count as errors. Expected domain rejections are therefore included in the failure denominator; it is not an infrastructure error rate.
- A resolved handler is success even when its domain result describes a pending approval, an empty search, or a partially unsuccessful scan. Results are never inspected for telemetry.
- Input size, response size, intent clusters, model/harness attribution, parameter analysis, discovery conversion and missing-capability reports remain unavailable. No missing values are estimated.
- No renderer means no upload. Re-enabling collection skips old buffer entries; capacity, expiry, network failure, separate origins and closed clients limit completeness. Observed call counts are not billing or audit totals.
- A failed or absent sample is never a healthy zero. Durations beyond the 30-minute execution boundary are dropped rather than fabricated.

`posthog/mcp-analytics/resources.json` prepares five native trend insights and one SQL tool-quality matrix for the final AI/MCP dashboard. The matrix has a 20-call floor and reports volumes alongside noncanonical derived rates. On October 12, 2026, read-only discovery confirmed no recent native MCP events; the catalog tool still lacked `data_catalog:read`. No chart was activated, no production event was fabricated, and no SQL aggregate was presented as live evidence. Inspect the proposed governed definition and validate deployed event properties before creating the final dashboard.

References: [native event contract](https://posthog.com/docs/mcp-analytics/events), [MCP privacy](https://posthog.com/docs/mcp-analytics/privacy), [MCP analytics](https://eu.posthog.com/project/295060/mcp-analytics/dashboard).
