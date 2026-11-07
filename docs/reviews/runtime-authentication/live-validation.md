# Live Codex and Claude validation, and Windows test fixes

2026-11-07, follow-up to the [runtime authentication review](../runtime-authentication-review.md). Both priorities completed: the Windows PostHog test launchers are fixed, and existing signed-in Codex and Claude accounts completed real Pitchcrew conversations.

## Windows test launchers

The two tests passed `URL.pathname` directly to Node. On Windows that produced a doubled drive path and failed before the target CLI started. They now use `fileURLToPath()` in [readiness.test.ts](../../../scripts/posthog/readiness.test.ts) and [scheduled-reports.test.ts](../../../scripts/posthog/scheduled-reports.test.ts).

Genuine Node 24.20.0 verification: **20/20 focused tests passed**, followed by **54/54 PostHog tests passed**. This removes the previously reported root test command's PostHog startup blocker. The entire repository Vitest suite was not rerun in this follow-up, so a completely green root test command is not claimed.

## Actual live provider results

| Runtime     | Installed version | Selected model               | Native catalog | First turn | Continued turn                   |
| ----------- | ----------------- | ---------------------------- | -------------- | ---------- | -------------------------------- |
| Codex       | 0.167.0           | `gpt-6.1-sol`, low reasoning | 8 models       | Completed  | Completed, native session reused |
| Claude Code | 2.1.318           | `sonnet`, low effort         | 13 models      | Completed  | Completed, native session reused |

The [manual smoke entry](../../../packages/orchestrator/test/runtime-live.smoke.ts) starts the real Bun production-mode daemon in a new temporary workspace, with analytics/update checks off and no Demo runtime. It uses the normal user-session HTTP endpoints to configure temporary agents and create conversations. All optional agent capabilities are disabled; the inputs contain a fictional profile, not the user's career data or job board.

Each first turn passed through normal queue admission, authentication guard, the installed runtime adapter, the real scoped stdio MCP server and capability-protected HTTP gateway. A wrapper observes successful `profile` gateway completion without replacing its behavior or logging tokens/payloads. Both agents called the real profile tool and returned the expected marker/checkpoint in a saved structured reply. Profile content also appears in the regular chat prompt; the gateway observation, rather than the marker alone, proves tool use.

Each second turn received a request that did not restate its checkpoint. Both returned the earlier checkpoint while preserving the native session ID and session directory and advancing the saved message checkpoint. Four distinct runs completed. The daemon closed normally and no job cards were created.

Safe evidence: [result JSON](live-runtime-result.json). The temporary Pitchcrew workspace is retained for local investigation. [Independent Codex review](live-validation-codex.md): **9.2/10, approved, no P0–P2 findings**.

## Reproduce deliberately

This check spends four real provider turns and requires existing signed-in accounts. It is excluded from the automated `*.test.ts` glob and exits before daemon imports unless `--live` is supplied.

```powershell
bunx bun@1.4.4 --no-env-file --no-install packages/orchestrator/test/runtime-live.smoke.ts --live
```

It uses a five-minute cooperative attempt deadline and 120-second turn waits, followed by normal daemon cancellation/shutdown; this is not an independent hard process-kill watchdog. Native CLIs retain their ordinary session/cache behavior and may refresh their existing account credentials in their normal user directories. Pitchcrew data is isolated; native account homes are not copied or relocated.

No login/logout/account-switch flow was invoked. Fresh OAuth, forced token expiration/refresh recovery, revoked accounts, other runtimes and real application workflows remain unverified by this smoke check. This proves existing-account chat, scoped MCP and continuation through Pitchcrew's production service path; it does not claim the browser UI was driven or every authentication lifecycle was exercised.
