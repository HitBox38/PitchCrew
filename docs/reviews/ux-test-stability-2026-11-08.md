# Integration fixture stability — 2026-11-08

The full `bun run check` log at `C:/Users/spide/.pitchcrew-ux-audit-20261108/final-check.log` recorded 15-second timeouts in the external MCP example-workspace evidence case and the production chat activity recovery case. Their later Windows `EBUSY` cleanup errors occurred after those test bodies had timed out. This change isolates unrelated native runtime metadata work in those two test files; it changes no production behavior or assertions.

## Cause and scope

`crew/lifecycle.ts` awaits `context.detect()` during every daemon initialization. `crew/models.ts` calls each adapter's `detect()`, and native CLI health detection invokes version subprocesses with a five-second per-process deadline (`adapters/src/process/health.ts`). On the first production initialization, `seedRecommendedRoles()` also awaits native model discovery for every available installed runtime. The recovery test initializes production twice. Neither fixture tests which provider CLIs or accounts happen to be installed on its host.

Both files now stub only native adapters' `detect()` to return unavailable before each test, following the repository's existing adapter-spy pattern. Development Demo remains untouched and supplies the real example packets and crew reply. Production initialization still runs with `dev: false`, seeds its ordinary paused roles, restores checkpoints, records recovery events, and rebuilds projections. Its 15-second timeout is unchanged. Direct daemon construction already leaves account and release checks disabled, so no readiness mock was necessary.

The example-workspace evidence case has a local 30-second timeout because it exports actual packet documents, runs the real CLI configuration child, starts the real MCP stdio child, and reads every example card and profile. Its ten XML-backed answers and all assertions remain intact. Other case timeouts and the global timeout are unchanged. No cleanup retries or swallowed filesystem errors were added; successful focused teardown closed clients/daemons and removed the fixture directories through their existing checked temporary paths.

## Verification

- `bun x --no-install vitest run packages/mcp/test/external-stdio.test.ts packages/orchestrator/test/chat-submissions-http.test.ts --maxWorkers 1 --reporter verbose` — 2 files, 10 tests passed in 22.06 seconds. The example evidence case took 1.463 seconds; production checkpoint initialization/replay took 144 milliseconds. Cleanup produced no errors.
- `bun x --no-install tsc --noEmit` — passed for the root TypeScript project, including both changed test files.
- `bun x --no-install oxlint --deny-warnings packages/mcp/test/external-stdio.test.ts packages/orchestrator/test/chat-submissions-http.test.ts` — passed.
- Oxfmt check over the two test files and this note — passed.

These are focused results. The earlier full check failed overall; this work does not establish a green full suite or validate live provider runs, UI behavior, or the other full-check failures.
