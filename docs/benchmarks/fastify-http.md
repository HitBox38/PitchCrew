# Express → Fastify: local daemon benchmarks

Measured on October 4, 2026 (Asia/Jerusalem; raw UTC timestamp is in the JSON). Compare Express commit `6d37419292a1f33e2085c1bebc2e94d690af7a7e` with Fastify commit `6d512cd98589f0ff92a6a444c1273629e5ece7f2`. The later benchmark commit adds the harness and results only; it does not change the daemon.

Fastify improves small-response HTTP throughput substantially. Full workspace snapshots improve more modestly. This migration does **not** make the daemon smaller: warmed RSS and the installed production dependency closure increase. Median startup also increases, with overlapping observed ranges.

## Method

- Apple M4 Pro, 12 logical CPUs, 24 GiB RAM, macOS/Darwin 25.6.0, arm64, Node **22.23.2**, Autocannon **8.0.0**.
- Five paired rounds, alternating framework order and reversing endpoint order every other round. One daemon runs at a time; load generator and daemon are separate Node processes on the same host.
- Real production `createDaemon`, HTTP sockets, Host/session checks, SQLite reads, profile reads, JSON serialization and native CLI health detection. Starter-skill network seeding is disabled; no inference, user accounts or real user data are used. UI assets are identical for both revisions; no Vite or Electron process participates in timed requests.
- A single seeded SQLite/profile workspace is cloned before every trial: **100 fictional cards, 200 saved messages, two profile notes, three roles, no routines or active runs**. Every measured snapshot body is **233,782 bytes** in both variants.
- HTTP throughput uses **one-second warmup + five-second measured load** per endpoint/concurrency, at **1 and 16 connections**, HTTP/1.1 keep-alive, pipelining **1**, without rate limiting. All 60 measured load runs have **zero errors, timeouts and non-2xx responses**. Values below are medians of the five trial statistics, not pooled percentiles.
- Quiet request latency is separately measured with high-resolution `performance.now()`: **300 serial full-response reads** per endpoint/round, after ten connection warmups, using one keep-alive connection and no concurrent load. Autocannon's coarse small-response latency buckets are not presented as zero-millisecond request times.
- SSE uses **100 sequential fresh connections** per round, timed to the complete first saved-state event. This measures connection/initial-state delivery, not model generation or the unchanged 40 ms token-coalescing delay.
- Startup measures child process spawn → listening/ready IPC, on warmed OS/transpiler caches. It includes native CLI health detection and role-file initialization; it excludes pnpm/Electron launcher overhead, fixture creation, starter-skill downloads, and renderer startup.
- Memory is daemon-only `process.memoryUsage()`, median of five readings 100 ms apart. Warmed readings follow 20 validated snapshots; post-load readings follow all workloads and SSE. GC is not forced. RSS includes V8/native allocations; post-load RSS is **not peak RSS** or a long-term retention test.
- Dependency footprint sums logical file lengths in the unique installed third-party production dependency closure, including installed optional dependencies. Workspace sources, dev-only dependencies, nested `node_modules`, symlinks and Electron are excluded. This is **not** pnpm store disk usage, a minified bundle, or a packaged desktop-app size. Express remains a transitive MCP SDK dependency.

## HTTP throughput

Higher is better; requests/second.

| Route           | Connections |  Express |  Fastify |  Change |
| --------------- | ----------: | -------: | -------: | ------: |
| `/api/health`   |           1 | 15,629.6 | 28,753.6 |  +84.0% |
| `/api/health`   |          16 | 22,395.2 | 92,025.6 | +310.9% |
| `/api/routines` |           1 | 12,802.4 | 20,683.2 |  +61.6% |
| `/api/routines` |          16 | 17,419.2 | 49,833.6 | +186.1% |
| `/api/snapshot` |           1 |    798.4 |    870.2 |   +9.0% |
| `/api/snapshot` |          16 |    979.6 |  1,017.6 |   +3.9% |

At 16 connections the health route improves **4.11×**, the routine-list route **2.86×**, and full snapshot throughput **3.9%**. Snapshot work still includes the same database/profile reads and large response; the snapshot throughput ranges overlap. These measurements do not establish that the UI or provider runs become several times faster.

## Quiet request latency

Lower is better; median of per-round p50/p99 full-response latencies.

| Route           | Express p50 | Fastify p50 | Express p99 | Fastify p99 |
| --------------- | ----------: | ----------: | ----------: | ----------: |
| `/api/health`   |    0.082 ms |    0.063 ms |    0.207 ms |    0.150 ms |
| `/api/routines` |    0.097 ms |    0.069 ms |    0.210 ms |    0.135 ms |
| `/api/snapshot` |    1.257 ms |    1.121 ms |    2.031 ms |    1.985 ms |

SSE initial saved-state delivery: **0.435 → 0.402 ms p50**, **3.124 → 2.846 ms p99**. This is a small local difference, not evidence of faster generated replies. Under 16-connection snapshot load, both frameworks have **20 ms p99** (median of per-run Autocannon p99).

## Startup, memory and dependency footprint

Lower is better. Startup and RSS results vary with native CLI health checks, cache state and V8 GC; do not treat small differences as guaranteed regressions or improvements.

| Metric                                  |    Express |    Fastify | Change |
| --------------------------------------- | ---------: | ---------: | -----: |
| Process spawn to listening              |   800.1 ms |   861.9 ms |  +7.7% |
| Warmed daemon RSS                       |  197.2 MiB |  207.5 MiB |  +5.2% |
| Warmed daemon JS heap used              |   84.3 MiB |   85.7 MiB |  +1.6% |
| Daemon RSS after load                   |  443.3 MiB |  373.9 MiB | -15.7% |
| Third-party production dependency files | 119.77 MiB | 133.09 MiB | +11.1% |
| Unique third-party production packages  |        128 |        186 |    +58 |

Observed startup ranges: **784–1,006 ms Express**, **832–1,434 ms Fastify**. Warmed RSS increases by **10.3 MiB**; the installed third-party production dependency closure increases by **13.32 MiB**. Lower RSS after the stress workload does not negate the higher warmed RSS or establish lower memory use in all workloads.

## Throughput variation

Minimum–maximum of the five runs, requests/second. These are observed ranges, not confidence intervals. The machine was not dedicated or CPU-pinned; absolute numbers and tail latency can change with host activity.

| Route           | Connections |     Express range |     Fastify range |
| --------------- | ----------: | ----------------: | ----------------: |
| `/api/health`   |           1 | 15,447.2–16,328.0 | 26,622.4–30,606.4 |
| `/api/health`   |          16 | 22,139.2–22,472.0 | 81,657.6–94,265.6 |
| `/api/routines` |           1 | 12,372.0–13,199.2 | 20,622.4–23,604.8 |
| `/api/routines` |          16 | 15,807.2–17,892.8 | 48,867.2–50,345.6 |
| `/api/snapshot` |           1 |       730.8–861.2 |       840.2–893.2 |
| `/api/snapshot` |          16 |     898.6–1,007.6 |     995.8–1,032.0 |

## Reproduce

Use the same supported Node version for both revisions. The load generator is installed in a temporary tools directory rather than added to the app's dependencies. The runner creates, validates and removes its own fictional data directory outside both checkouts.

```sh
benchmark_dir=$(mktemp -d "${TMPDIR:-/tmp}/pitchcrew-benchmark-XXXXXX")
git worktree add --detach "$benchmark_dir/express" 6d37419292a1f33e2085c1bebc2e94d690af7a7e
pnpm --dir "$benchmark_dir/express" install --frozen-lockfile
mkdir -p "$benchmark_dir/tools"
pnpm --dir "$benchmark_dir/tools" add --save-exact autocannon@8.0.0
pnpm build
cp -R packages/ui/dist "$benchmark_dir/express/packages/ui/dist"
node scripts/benchmarks/http.mjs \
  "$benchmark_dir/express" "$PWD" \
  "$benchmark_dir/tools/node_modules/autocannon" \
  "$benchmark_dir/results.json" 5 5
git worktree remove --force "$benchmark_dir/express"
```

Port **14621** must be free. The final arguments select rounds and measured seconds per workload; the recorded report uses `5 5`. To compare the exact recorded candidate, use a separate checkout of `6d512cd98589f0ff92a6a444c1273629e5ece7f2` as the second argument. The harness itself can run from the newer PR revision.

[Raw trial results and environment](fastify-http.json) · [Benchmark entry point](../../scripts/benchmarks/http.mjs)
