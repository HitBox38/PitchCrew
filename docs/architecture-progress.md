# Architecture map and refactoring ledger

## Baseline

The starting point is release 0.25.0 at `f4926ebe`. The product runs provider CLIs against a local board. Its persistent contracts include earlier event versions, approvals bound to exact actions, user-owned files, scoped tool names, HTTP routes, Electron IPC and the source layout shipped with the installer.

The table records direct workspace dependencies found in production TypeScript at the baseline, including literal lazy imports. A Bun transpiler import scan covered 2,542 tracked TS and TSX files under package source directories, excluding tests and declarations. It resolved relative files, directory indexes, UI aliases and workspace exports. The 6,202 distinct eager edges contained one strongly connected component of 21 files in orchestration. The package graph itself was acyclic. CSS imports, type-only edges, computed paths, subprocess launches and IPC require separate inspection.

| Package       | Owns                                                                                                              | Direct workspace imports           |
| ------------- | ----------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| core          | Wire schemas, event decoding, workflow and lifecycle tables, runtime interfaces, browser-safe domain calculations | None                               |
| board         | SQLite event append, projection, replay, transactional decisions and indexed entity reads                         | core                               |
| packet        | Packet files, claim checks, document rendering and verification                                                   | core                               |
| adapters      | CLI detection, launch, model discovery and normalized progress                                                    | core, packet                       |
| mcp           | Run-scoped tools, connector clients, external access, browser action approval and execution                       | core, board, packet                |
| orchestrator  | Daemon composition, local sessions, scheduling, HTTP, SSE and run recovery                                        | adapters, board, core, mcp, packet |
| design-system | Reusable primitives, tokens and shared interaction styling                                                        | None                               |
| ui            | Workspace projection and stream overlays, routes, local drafts and application presentation                       | core, design-system                |
| desktop       | Sandboxed preload, native guest lifetime, IPC and installer updates                                               | core, mcp, orchestrator            |
| landing       | Public Next.js site, downloads and site analytics consent                                                         | design-system, ui                  |

## State and change ownership

| Change                              | Authoritative implementation and verification                                                                                                                                                                                                                                                                                                         |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Business rules and wire data        | Core schemas validate ingress. Core state tables describe legal moves. Board and orchestration apply them inside the owning operation. Old events replay through the decoder. See [lifecycles](lifecycles.md) and [event log](event-log.md).                                                                                                          |
| Durable, cached and transient state | Board events and projections own job and run records. Files own source documents and exported artifacts. Snapshot and SSE project those records. WorkspaceStore owns synchronization, the router owns navigation and feature hooks own drafts. See [synchronization](workspace-synchronization.md) and [SQLite indexes](sqlite-query-performance.md). |
| Settings and host configuration     | Daemon startup resolves workspace location and port. Runtime connection settings and private credentials have separate stores. CLI adapters apply resolved settings. See [background service](background-service.md) and [runtime authentication](runtime-authentication.md).                                                                         |
| Failures, retries and permissions   | Adapters normalize CLI failures. Queue and chat owners recover jobs and uncertain deliveries. MCP consumes exact approvals and the loopback server validates sessions. Submission uncertainty needs a user decision. See [queue](board-action-queue.md), [chat receipts](orchestrator-comparison.md) and [computer use](computer-use.md).             |
| Observability                       | Core defines public diagnostic fields. Daemon and renderer apply their own consent and transport checks. Device-local preferences and private credentials stay outside telemetry. See [analytics](analytics.md) and [logs](analytics/logs.md).                                                                                                        |
| UI and design                       | App routes own product language, actions and local state. Shared primitives own keyboard interaction, material and tokens. The public site has an independent build. See [code organization](code-organization.md) and [design system](../packages/design-system/README.md).                                                                          |
| Tooling and distribution            | Bun runs the daemon and MCP. Node runs Vitest and heap-limited workers. Electron bundles main and preloads. CI exercises Bun, Node, browsers, platform smoke tests and release installers. See [testing](testing.md) and [packaging](ci-and-packaging.md).                                                                                            |

The existing [decision records](adr/) explain the distinctions between captured postings and confirmed drafting context, per-job scheduling and agent identity, native browser pages and presentation, delegation and slot ownership, assigned skills and their delivery, and Home attention and Pipeline state. These distinctions constrain changes to apparently similar implementations.

## Current architecture

Core owns portable business decisions and versioned data contracts. The board applies durable changes inside SQLite transactions. The daemon composes these operations with the runtime adapters, MCP tools and bounded packet workers. Host applications depend on declared package exports. Browser clients consume the small core entry points they need. The renderer and landing site share visual primitives and privacy-preserving replay code. Each client decides whether it may record and where it may send events.

The latest source scan covered 2,554 production files and 6,266 distinct eager import edges with zero eager cycles. The package graph now contains eleven workspaces. All baseline package edges in the table above still apply except the landing-to-UI edge. Landing and UI now both import session-replay, which has no workspace imports. The [boundary checks](adr/0008-check-dependencies-at-the-workspace-and-module-levels.md) run in CI. Subprocess entry points and preload isolation also have runtime checks.

## Optimization pool

| Priority | Disposition | Scope and evidence                                                                                                                                                                                      |
| -------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1        | Verified    | The 21-file crew component is acyclic. Desktop uses public host and browser contracts. Replay has one owner with two independent clients.                                                               |
| 2        | Verified    | Job eligibility, interactive model readers, input limits, packet document definitions, Markdown filename syntax and packet worker entry points have shared owners. See the migration records below.     |
| 2        | Verified    | The workspace UI and daemon share the form requirement comparison. A change in option count, truncation, constraints, button type or group now marks a confirmed brief as needing confirmation in both. |
| 3        | Verified    | Installer preparation and CI use the repository Bun pin. Workspace release versions, deployment commands and package-manager metadata have a consistency test.                                          |

### Deliberate implementation differences

- The server evaluates arbitrary cron and subsequent dispatches. The renderer previews routine presets and can receive incomplete form input. Their existing parity cases cover the common inputs.
- Native Electron and headless browsers implement the same action-approval contract in different hosts. The packaged daemon's MCP CLI launch also requires a physical file in the staged source tree.
- A repeated-block scan over production source found matching blocks in Copilot/Cursor tool details and bundled starter-skill licenses. The adapters decode different provider event fields and share tool formatting and sanitization. Each distributed skill carries its licensed attribution.
- The PDF viewer has a lazy document component and imports PDF.js from both its task loader and text-layer renderer. The build reports the redundant split point. Changes to viewer loading should be evaluated with a measured first-open cost.

## Verified migrations

**Desktop and browser contracts.** All consumers of the native browser, browser profile and desktop bridge types now use core exports. Desktop imports host policies through declared workspace dependencies. The six-suite baseline passed 93 tests. After migration, 32 desktop, MCP, app-update and renderer suites passed 280 tests with two platform skips. Independent review traced the exported files, test mocks and built main/preload imports. See [the desktop export decision](adr/0007-expose-workspace-contracts-to-the-desktop-build.md).

**Model discovery.** Three interactive CLI readers now delegate framing, shutdown, cancellation and output limits to the adapter process module. Each provider retains its own handshake, protocol fallback and pagination. The migration passed 39 catalog tests, including split UTF-8 messages and the providers' different stderr policies. See [model discovery](model-discovery.md).

**Session replay.** The app and landing site now consume the browser-only `@pitchcrew/session-replay` workspace. It owns the recorder and wireframe sanitizer. Each client owns its consent and transport. The migration passed 154 analytics tests including recording and playback. See [session replay](analytics/session-replay.md).

**Deep resume review.** Queue projection, dispatch, chat selection, managed launch and the job-details control all consume the job lifecycle's deep-reviewable group. Ordinary packet review still needs an existing packet. All 7,252 before/after queue projections agreed across job states, packet presence and request sequences up to three actions. See [the generated state tables](state-machines.md).

**Crew scheduling.** Nine existing operations moved to their owning modules. A named conversation-queue drain on the crew context closes the runtime feedback loop. This removed the baseline eager import component while preserving launch, interruption and recovery ordering. The expanded behavior run passed 210 tests in 28 suites. Independent review checked side-effect order against the parent commit. See [queue delivery](orchestrator-comparison.md).

**Import and packet rules.** Core owns import bounds, raw legacy cell limits, packet document names and rule settings in browser-safe modules. The UI, SQLite converter, writer prompts, packet checker and daemon schemas use those values. The bounded rule worker now imports its default settings and labels directly. It keeps its existing two-second deadline. Tests exercise upload boundaries, clipping, formatting, rule validation and the renderer read at 256 KiB and one byte above. All 18 daemon rule tests passed after removing the worker's eager dependency on the core root.

**Profile filenames.** Eight validation sites now use the shared Markdown filename pattern. Listing previously stored files, editing a new name and validating imported paths retain their respective length and consecutive-dot policies. The nine affected suites passed 92 tests, including error-message compatibility.

**Packet worker entry points.** The packet package exports the attachment reader and rule evaluator. Both worker launchers resolve them through those exports. Independent review ran both under Node 24 and Bun 1.4.4 and traced installer staging to the same files. The Node helper retains its loader, heap limits and deadlines.

**External submission registration.** The board and renderer use the lifecycle's existing seven-state preparation group. Across all 14 states it agrees with the previous lists. The board still checks for active work and repeat registration inside its operation.

**Regression prevention.** Oxlint reads workspace manifests and checks eager module cycles, private source imports and undeclared dependencies. Node tests independently check the declared graph, including desktop build dependencies, and release metadata. Independent negative probes exercised a sibling source directory, the renderer alias and a package cycle through desktop. The workspace tests ran on both supported Node lines on Windows and at the minimum versions on Linux.

**Raw tag and word limits.** SQLite reads at most one tag beyond the accepted source-row limit to report clipping. The parser uses the same bound. The normalized card retains its own ten-tag limit. The packet defaults, reset dialog, new word rule and completion suggestion now read their word limits from core.

**Pipeline stages and outcomes.** The board lanes, stage track, Home attention, Decisions history and import planner reuse the lifecycle groups. Importing a withdrawal still distinguishes evidence of a previous submission from a job closed before applying. Before and after results matched for 520 UI comparisons and 544 import combinations. All 138 focused tests passed.

**Inspected form requirements.** Core compares the confirmed form with the latest inspection. The renderer uses the browser-safe entry point and the daemon validates the projected fields before comparison. The board shortcuts, stage indicators and deep-review setup use the same result. The regression covers changes in control evidence, historical records with missing evidence, and answer-only updates. All 164 focused tests passed, including the headless application-form, job-menu and deep-review journeys.

**Portable adapter fixtures.** The Windows run exposed four relative-path assertions with Unix-only setup paths. The tests now construct native paths and assert their displayed relative forms. The affected parser and activity suites passed all 112 tests on Windows.

**Subprocess cancellation fixtures.** Each live cancellation test waits for a capture written by its child before aborting. If readiness fails, it still aborts and awaits the child's rejection before cleanup. Independent review exercised all ten adapters.

## Integrated verification

- The production UI and desktop host built successfully. All 16 Electron journeys passed. The hidden shell and native-browser smoke checks verified guest recovery, exact approvals, renderer isolation and cleanup.
- The native Bun 1.4.4 smoke passed SQLite persistence, HTTP sessions, SSE, bounded Node helpers, stdio MCP, export approval rejection and development UI startup.
- The first full Vitest run overlapped ongoing edits. Five suites reported failures. Rerunning those five on the combined branch passed all 236 tests serially.
- The subsequent full `bun run check` passed lint, formatting, strict typechecking, all 56 Node tests, 4,512 Vitest tests and production builds for the app, desktop and landing site. Vitest reported eight skips across the full run.
- The Windows x64 installer built successfully. The unpacked app launched its bundled Chromium, rendered through its own daemon and stopped that daemon on quit. Both packet worker entry points processed fictional inputs using the packaged Bun, Node helper and materialized workspace directories. The NSIS process-handling fixture passed its short-path, owned-process and exclusion checks.
