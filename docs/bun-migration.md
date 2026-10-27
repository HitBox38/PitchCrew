# Bun migration

Pitchcrew uses pinned Bun 1.4.4 for package management, application scripts, the daemon and its MCP processes. Electron keeps its embedded runtime. Node remains available for the existing Vitest/build tools (including Electron Builder) and for V8 workers that enforce document/database heap limits; this is an intentional compatibility boundary, not a claim that Node was removed.

`bun.lock` replaces the pnpm lockfile. The runtime migration preserves locked package versions; a separate Next.js 16.4.3 patch clears the landing build advisory. Explicit trusted dependencies preserve the previous build-script choices. Runtime launches disable automatic `.env` loading and package installation, and generated subprocess commands pin the app-owned Bun config so a client working directory cannot inject preloads. Packaged apps include Bun and a Node 24 helper, retain scoped process cleanup for old Node installations, and preserve background-service reuse and update handoff.

## Local measurements

Measured on macOS ARM64 / Apple M4 Pro with Node 24.22.0, pnpm 11.22.0 and Bun 1.4.4. Values are medians; the complete samples and methodology are in [the raw results](benchmarks/bun-migration.json).

| Measurement                                  | Node / pnpm |        Bun | Reduction |
| -------------------------------------------- | ----------: | ---------: | --------: |
| Daemon HTTP ready                            |   359.44 ms |  179.30 ms |    50.12% |
| First authenticated compact snapshot         |   375.36 ms |  188.35 ms |    49.82% |
| Daemon RSS after that snapshot               |  152.30 MiB | 102.13 MiB |    32.94% |
| Fresh dependency install, warm package cache |     9.747 s |    2.390 s |    75.48% |

An [initial batch](benchmarks/bun-migration-initial.json) and [second batch](benchmarks/bun-migration-repeat.json) also measured roughly half the startup time. Fresh-install speedups ranged from 2.7× to 4.1× across the three batches. Those earlier reports used runtime-reported RSS; the current table samples both processes with the same OS `ps` command. This revises the memory improvement to about 33%. Install timings vary with host/cache conditions and do not establish CI savings.

Runtime measurements use seven alternating fresh processes and empty temporary workspaces per runtime. They include module imports, disable optional UI/skill loading and replace installed-agent detection with deterministic unavailable fixtures. Filesystem caches remain warm. The parent samples memory with `ps -o rss` after the first snapshot while the fixture remains open briefly; that wait follows both startup timestamps. Memory is a point sample, not peak or sustained memory, and excludes Electron, Chromium and document helpers.

Install measurements use three alternating fresh manifest-only workspace installs per manager after one warmup. They use frozen locks and normal trusted lifecycle scripts, reuse global package/Electron caches, and never reuse `node_modules`. Baseline manifests come from `e3f7ed03d0f374e739f12a56180c952faa2462c8`. The package-version audit found no added or omitted versions; core explicitly declares its existing `tsx` dependency for the Node helper.

These results establish local daemon and install improvements. They do not establish faster GitHub Actions, browser rendering, document parsing or provider inference. Existing tests still run under Node, and CI retains both Node-version shards. Keeping the Node helper also adds a Bun binary to the installed runtime; smaller desktop downloads are not an established benefit. Electron Builder stays on Node because its threaded-WASM icon converter hung when it inherited Bun during verification.

## Observed CI measurements

A single comparison of a [prior full-installer pnpm run](https://github.com/HitBox38/PitchCrew/actions/runs/40571998154) with the [Bun manual run](https://github.com/HitBox38/PitchCrew/actions/runs/40598096132) **did not show an end-to-end pipeline improvement**. Complete job/step durations, commit identities and definitions are in [the CI observations](benchmarks/bun-ci-observed.json).

| Measurement                                           |       Prior pnpm run |              Bun run |
| ----------------------------------------------------- | -------------------: | -------------------: |
| Whole workflow, including initial queue time          |               10m12s |               12m06s |
| Package-install steps, common jobs                    |   436 runner-seconds |    42 runner-seconds |
| Runtime/package setup, cache and install, common jobs |   717 runner-seconds |   471 runner-seconds |
| Aggregate job time, including the added Bun job       | 2,707 runner-seconds | 2,692 runner-seconds |

Common dependency preparation saved 246 aggregate runner-seconds in this pair, but those parallel savings did not shorten the workflow. The Bun integration job added 20 runner-seconds; Intel Mac packaging took longer, and cache transfer/save work remained material. Cache warmth is unknown, timestamps have one-second precision, source commits differ, and runner scheduling and packaging vary. These observations establish faster install steps in this pair, not a controlled Bun speedup or measured overall CI savings.

## Verification

Vitest defaults to the same two-worker budget used by CI after an unrestricted local run timed out while heavy checks overlapped; tests and deadlines remain intact. The migration retains existing lint, formatting, types, unit/HTTP/MCP/browser tests, Node 22/24 CI shards, native desktop checks and the four-platform installer matrix. A required Bun integration job additionally checks real HTTP session/Host/Origin gates, conditional snapshots, SSE flush/disconnect, persisted SQLite data, Node-bounded attachment/database/document work, MCP stdio, unapproved export rejection and development HTML/JavaScript assets through Vite.

The bounded-worker integration tests exercise actual Node and Bun processes, binary IPC, worker errors, heap exhaustion, cancellation, owner crashes, missing/invalid helpers, source PATH lookup, packaged sibling lookup and materialized workspace packages. Unsupported or missing genuine Node helpers fail closed.

The full manual CI run at `9380af06` passed all 13 jobs, including every installer platform. Cross-platform CI and installer verification must also pass for the final head before this migration is considered ready. Live provider runs remain outside automated verification, as before. No test suite can establish a literal zero-percent defect rate.

A late local UI rerun hit the existing 10-second cold Vite setup deadline. The unchanged pnpm baseline at `e3f7ed03` failed the same isolated Profile import test on the same host and Node version. A diagnostic run with extra setup time loaded the migrated page successfully; all diagnostic changes were removed, and the original test and deadline remain intact. The final local Bun smoke also hit the existing five-second database-helper deadline before reaching development checks. These local reruns are recorded as failures, not passing validation; final-head CI on clean runners remains required.

The landing framework was separately patched from Next.js 16.4.0 to 16.4.3 after its build reported known advisories. The official [16.4.1 release](https://github.com/vercel/next.js/releases/tag/v16.4.1) identifies the security fixes included in the later patch. Other pre-existing dependency advisories are outside this change; this is not a repository-wide security assessment. The install benchmark uses the earlier Bun manifest commit to hold package versions constant across tools.

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
  --candidate-manifests=aa5401e323ddfd302322a66090ea2871dd643eb2 \
  --output=/tmp/pitchcrew-bun-migration/performance.json
```
