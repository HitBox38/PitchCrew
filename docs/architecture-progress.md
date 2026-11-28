# Architecture map and refactoring ledger

## Baseline

The starting point is release 0.25.0 at `f4926ebe`. The product runs provider CLIs against a local board. Its persistent contracts include earlier event versions, approvals bound to exact actions, user-owned files, scoped tool names, HTTP routes, Electron IPC and the source layout shipped with the installer.

The table records direct workspace dependencies found in production TypeScript at the baseline, including literal lazy imports. A Bun transpiler import scan covered 2,542 tracked TS and TSX files under package source directories, excluding tests and declarations. It resolved relative files, directory indexes, UI aliases and workspace exports. The 6,202 distinct eager edges contained one strongly connected component of 21 files in orchestration. The package graph itself was acyclic. CSS imports, type-only edges, computed paths, subprocess launches and IPC require separate inspection.

| Package | Owns | Direct workspace imports |
| --- | --- | --- |
| core | Wire schemas, event decoding, workflow and lifecycle tables, runtime interfaces, browser-safe domain calculations | None |
| board | SQLite event append, projection, replay, transactional decisions and indexed entity reads | core |
| packet | Packet files, claim checks, document rendering and verification | core |
| adapters | CLI detection, launch, model discovery and normalized progress | core, packet |
| mcp | Run-scoped tools, connector clients, external access, browser action approval and execution | core, board, packet |
| orchestrator | Daemon composition, local sessions, scheduling, HTTP, SSE and run recovery | adapters, board, core, mcp, packet |
| design-system | Reusable primitives, tokens and shared interaction styling | None |
| ui | Workspace projection and stream overlays, routes, local drafts and application presentation | core, design-system |
| desktop | Sandboxed preload, native guest lifetime, IPC and installer updates | core, mcp, orchestrator |
| landing | Public Next.js site, downloads and site analytics consent | design-system, ui |

## State and change ownership

| Change | Authoritative implementation and verification |
| --- | --- |
| Business rules and wire data | Core schemas validate ingress. Core state tables describe legal moves. Board and orchestration apply them inside the owning operation. Old events replay through the decoder. See [lifecycles](lifecycles.md) and [event log](event-log.md). |
| Durable, cached and transient state | Board events and projections own job and run records. Files own source documents and exported artifacts. Snapshot and SSE project those records. WorkspaceStore owns synchronization, the router owns navigation and feature hooks own drafts. See [synchronization](workspace-synchronization.md) and [SQLite indexes](sqlite-query-performance.md). |
| Settings and host configuration | Daemon startup resolves workspace location and port. Runtime connection settings and private credentials have separate stores. CLI adapters apply resolved settings. See [background service](background-service.md) and [runtime authentication](runtime-authentication.md). |
| Failures, retries and permissions | Adapters normalize CLI failures. Queue and chat owners recover jobs and uncertain deliveries. MCP consumes exact approvals and the loopback server validates sessions. Submission uncertainty needs a user decision. See [queue](board-action-queue.md), [chat receipts](orchestrator-comparison.md) and [computer use](computer-use.md). |
| Observability | Core defines public diagnostic fields. Daemon and renderer apply their own consent and transport checks. Device-local preferences and private credentials stay outside telemetry. See [analytics](analytics.md) and [logs](analytics/logs.md). |
| UI and design | App routes own product language, actions and local state. Shared primitives own keyboard interaction, material and tokens. The public site has an independent build. See [code organization](code-organization.md) and [design system](../packages/design-system/README.md). |
| Tooling and distribution | Bun runs the daemon and MCP. Node runs Vitest and heap-limited workers. Electron bundles main and preloads. CI exercises Bun, Node, browsers, platform smoke tests and release installers. See [testing](testing.md) and [packaging](ci-and-packaging.md). |

The existing [decision records](adr/) explain the distinctions between captured postings and confirmed drafting context, per-job scheduling and agent identity, native browser pages and presentation, delegation and slot ownership, assigned skills and their delivery, and Home attention and Pipeline state. These distinctions constrain changes to apparently similar implementations.

## Optimization pool

| Priority | Evidence and closure condition |
| --- | --- |
| 1 | Break the eager crew cycle across queue, deep review and user input. Preserve dispatch timing and verify recovery through existing integration tests. |
| 1 | Replace private core and host-module imports with declared interfaces. Confirm the Electron bundle can resolve its imports in the isolated installer layout. |
| 1 | Remove the landing site's dependency on private app replay code. Exercise both consent paths and the shared wireframe sanitizer. |
| 2 | Inspect workflow predicates and adapter normalization for exact duplicates. Compare actual consumers, failure states and provider formats before consolidation. |
| 2 | Replace copied UI application-import and packet-rule limits with browser-safe values used by the server. Preserve server validation, error messages and root exports. |
| 2 | Compare profile filename checks across editing, importing, listing and source updates. Preserve each caller's accepted names and historical read behavior. |
| 3 | Check release tooling against the repository Bun pin. Keep package-manager metadata usable by independent consumers. |

Custom cron evaluation and the renderer's preset preview have different input contracts. The daemon computes arbitrary cron and subsequent dispatches. The UI previews a draft, including invalid and incomplete input. Their existing parity cases remain important. Native Electron and headless browser implementations also serve distinct hosts and share the action-approval contract.
