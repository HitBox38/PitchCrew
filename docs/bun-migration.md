# Bun migration

Pitchcrew uses pinned Bun 1.4.4 for package management, application scripts, the daemon and its MCP processes. Electron keeps its embedded runtime. Node remains available for the existing Vitest/build tools (including Electron Builder) and for V8 workers that enforce document/database heap limits; this is an intentional compatibility boundary, not a claim that Node was removed.

`bun.lock` replaces the pnpm lockfile. Workspace dependencies keep their locked versions. Explicit trusted dependencies preserve the previous build-script choices. Runtime launches disable automatic `.env` loading and package installation, and generated subprocess commands pin the app-owned Bun config so a client working directory cannot inject preloads. Packaged apps include Bun and a Node 24 helper, retain scoped process cleanup for old Node installations, and preserve background-service reuse and update handoff.

## Local measurements

Measured on macOS ARM64 / Apple M4 Pro with Node 24.22.0, pnpm 11.22.0 and Bun 1.4.4. Values are medians; the complete samples and methodology are in [the raw results](benchmarks/bun-migration.json).

| Measurement                                  | Node / pnpm |       Bun | Reduction |
| -------------------------------------------- | ----------: | --------: | --------: |
| Daemon HTTP ready                            |   303.87 ms | 156.42 ms |    48.52% |
| First authenticated compact snapshot         |   318.21 ms | 164.51 ms |    48.30% |
| Daemon RSS after that snapshot               |  144.95 MiB | 76.99 MiB |    46.89% |
| Fresh dependency install, warm package cache |     5.118 s |   1.899 s |    62.89% |

Runtime measurements use seven alternating fresh processes and empty temporary workspaces per runtime. They include module imports, disable optional UI/skill loading and replace installed-agent detection with deterministic unavailable fixtures. Filesystem caches remain warm. Memory is a point sample, not peak or sustained memory, and excludes Electron, Chromium and document helpers.

Install measurements use three alternating fresh manifest-only workspace installs per manager after one warmup. They use frozen locks and normal trusted lifecycle scripts, reuse global package/Electron caches, and never reuse `node_modules`. Baseline manifests come from `e3f7ed03d0f374e739f12a56180c952faa2462c8`. The package-version audit found no added or omitted versions; core explicitly declares its existing `tsx` dependency for the Node helper.

These results establish local daemon and install improvements. They do not establish faster GitHub Actions, browser rendering, document parsing or provider inference. Existing tests still run under Node, and CI retains both Node-version shards. Keeping the Node helper also adds a Bun binary to the installed runtime; smaller desktop downloads are not an established benefit. Electron Builder stays on Node because its threaded-WASM icon converter hung when it inherited Bun during verification.

## Verification

The migration retains existing lint, formatting, types, unit/HTTP/MCP/browser tests, Node 22/24 CI shards, native desktop checks and the four-platform installer matrix. A required Bun integration job additionally checks real HTTP session/Host/Origin gates, conditional snapshots, SSE flush/disconnect, persisted SQLite data, Node-bounded attachment/database/document work, MCP stdio and unapproved export rejection.

The bounded-worker integration tests exercise actual Node and Bun processes, binary IPC, worker errors, heap exhaustion, cancellation, owner crashes, missing/invalid helpers, source PATH lookup, packaged sibling lookup and materialized workspace packages. Unsupported or missing genuine Node helpers fail closed.

Cross-platform CI and installer verification must pass before this migration is considered ready. Live provider runs remain outside automated verification, as before. No test suite can establish a literal zero-percent defect rate.

The local landing build also reported existing Next.js 16.4.0 dependency advisories. A retry passed its agent upgrade reminder; this does not remediate those advisories. Dependency security upgrades remain separate from the runtime migration and its unchanged-version benchmark.

## Reproduce

Use the pinned Bun and a supported Node installation. The benchmark needs pnpm 11.22.0 for the historical install comparison; it does not change the repository's active package manager or use the real workspace data folder.

```sh
bun install --frozen-lockfile
bun run check
bun run format:check
bun run test:bun
bun run test:desktop
bun run desktop:package
bun run test:packaged
PITCHCREW_BENCHMARK_NODE=/absolute/path/to/node \
PITCHCREW_BENCHMARK_BUN=/absolute/path/to/bun \
PITCHCREW_BENCHMARK_PNPM=/absolute/path/to/pnpm \
  bun --no-env-file --no-install scripts/performance/bun-migration.ts \
  --baseline=e3f7ed03d0f374e739f12a56180c952faa2462c8 \
  --output=/tmp/pitchcrew-bun-migration/performance.json
```
