# SQLite query performance

The board keeps events append-only and projects current entities into `entities`. Listing entities orders by their SQLite `rowid`, so editing an entity preserves its position and replay restores insertion order. The unique `(kind,id)` key supports point lookups, but cannot provide that list order: SQLite otherwise collects and sorts every matching JSON document, potentially spilling large chat histories to disk.

`entities_kind` indexes `kind` alone. SQLite's ordinary secondary indexes include the rowid after their indexed values, so this provides the required insertion order within a kind without a temporary sort. No payload is copied into this index. `events_entity_id` indexes the existing event JSON's entity ID, narrowing history pagination and default-instruction provenance lookups to one entity's events. Event ID ordering remains unchanged.

These indexes are installed with `CREATE INDEX IF NOT EXISTS` when a board opens. Existing databases gain the indexes without replaying projections, changing rowids or rewriting events. Reopening after an interrupted index creation is safe. These are physical indexes over existing data, so the event format and decoder versions stay unchanged. The indexes add disk space and a small amount of work to writes; the event triggers and projection transactions remain intact.

The additional partial `entities_thread` index covers message/run lookups by kind and conversation ID, excluding job source documents and other entity kinds. Conversation history reads position metadata through this index and parses only the selected page's bodies. Full ordered lists retain `entities_kind`. See [workspace synchronization](workspace-synchronization.md).

## Reproducing the comparison

With the repository's supported Node version and dependencies installed:

```sh
node --import tsx scripts/performance/board-queries.ts > /tmp/pitchcrew-board-query-results.json
pnpm exec vitest run packages/board/test/query-indexes.test.ts --maxWorkers=2
```

The script creates temporary fictional databases with 5,000 and 25,000 messages, one job per ten messages, seven default roles, and one customized role. Message IDs use a deterministic permutation so ID order differs from insertion order. It reproduces the previous schema by dropping only the two new indexes from its own temporary database, measures it, then reopens through the normal board constructor to install and measure the indexes. One warmup precedes seven samples for each query. Default-instruction cache invalidation happens outside the read timer. The output retains raw samples and query plans; temporary databases are removed in `finally`.

The regression tests capture SQL from the actual `Board.list`, `Board.history` and default-instruction methods and inspect their query plans. They also verify ordering through edits, card deletion, reopening and rebuild; existing-database upgrades preserve exact event bytes and rowids, and retain append-only enforcement. Timings are diagnostic evidence, not CI thresholds.

## Local baseline, 2026-10-14

Median milliseconds from seven warm samples on the development Mac, Node 22.23.2:

| Operation                                | 5,000 messages, before → after | 25,000 messages, before → after |
| ---------------------------------------- | -----------------------------: | ------------------------------: |
| Ordered JSON rows from SQLite            |                   18.86 → 2.99 |                  376.55 → 49.18 |
| `Board.list`, including JSON parsing     |                  40.81 → 41.21 |                 506.72 → 195.36 |
| One role's history                       |                  14.04 → 0.038 |                   67.51 → 0.042 |
| Default-instruction status after a write |                  23.83 → 0.698 |                  103.34 → 0.767 |

Opening the existing fixture and installing both indexes took 25.8 ms and 96.9 ms respectively. Query plans changed from the `(kind,id)` index plus `USE TEMP B-TREE FOR ORDER BY` to an `entities_kind` search without sorting. History and role lookups use `events_entity_id` instead of scanning unrelated events. The smaller parsed-list result shows no meaningful improvement; JSON parsing and garbage collection still matter. Host scheduling and garbage collection produced visible sample variation. These query timings do not replace integrated startup, snapshot or renderer measurements.
