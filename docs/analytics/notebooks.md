# Analytics notebooks

Two prepared native notebooks support the weekly review and release verification. The offline planner emits real `notebooks-create-markdown` and `notebooks-add-cell` inputs, not a rich-text schema guessed from an old API. It embeds dashboard summary components, the saved sanitized exception insight, narrative cells and the reviewed SQL library. It requests neither Python, sandbox compute, AI summaries nor recurring execution.

On October 12, 2026, the current connection exposed these schemas and `notebooks-list` succeeded in PitchCrew EU project 295060 with no existing notebooks. Creation has not been attempted: writes wait for integrated code and dashboards. The old disabled `notebooks-create` tool is not needed. Resource creation permissions still need to be confirmed when the coordinator activates these plans.

```sh
node scripts/posthog/notebooks.mjs list
node scripts/posthog/notebooks.mjs plan weekly_review /tmp/pitchcrew-notebook-bindings.json
node scripts/posthog/notebooks.mjs plan release_check /tmp/pitchcrew-notebook-bindings.json
node --test scripts/posthog/notebooks.test.mjs
```

The bindings file supplies `project_id: 295060`, a whole-second UTC `cutoff`, `listing_complete: true`, the complete current `existing_notebooks` listing, `catalog` (`unavailable`, `no_match` or `proposed`), and a `bindings` array. Each binding has exactly `{kind, key, id, project_id}`. Dashboard keys are `usage`, `adoption`, `workflow`, `diagnostics`, `web`, `heatmaps`, `ai_mcp` and `engineering`; their IDs must be positive integers verified with `dashboard-get` in this project. The `sanitized_errors` insight binding needs its short ID, verified with `insight-get`. The existing exception insight has short ID `79UVPFXi`; verify its final updated query before binding. No fake IDs or personal credentials belong in committed artifacts.

The planner rejects a duplicate title from the complete listing, missing/ambiguous/cross-project bindings, invalid dates and unknown options. Supplied verification metadata is an assertion by the operator, not proof that the API resources exist. Pagination, current permissions and live verification remain coordinator responsibilities.

Activation sequence:

1. Confirm the connected project, inspect current tool schemas and review dashboard/insight bindings after their final updates. List all notebooks, following pagination. Inspect an existing exact title using `notebooks-get` rather than creating a duplicate.
2. Consult the governed catalog. Approved, non-drifted measures supersede these noncanonical SQL derivations; do not claim the notebook makes them canonical. Recheck source events/properties after deployment/import. Missing collection remains unknown.
3. Invoke `plan.create.tool` with `plan.create.input`. Read the creation response's notebook **short ID**, not UUID or URL. Use `bindNotebookCells(plan, shortId)` from `notebooks-library.mjs` to produce the remaining inputs.
4. Invoke each cell sequentially. SQL cells run immediately and return their result or a run ID; inspect failures, and poll `notebooks-run-cell-result` if necessary before continuing. Stop on a failed creation/cell. Inspect current content before resuming a partial notebook; blindly replaying cells would duplicate them.
5. The final `notebooks-get` must confirm cell order, titles, linked resource identities, query code and successful bounded results. Use `notebooks-update-cell` to repair SQL or markdown cells with their actual node IDs; do not append dead attempts. Persist live notebook links in the coordinator's deployment record.

SQL cells use exactly seven elapsed days with a pinned inclusive start/exclusive end and maximum 100 rows; Jerusalem affects day buckets, not the elapsed window. Pinning avoids changing counts while an investigation is written. The notebooks do not refresh this window automatically. For a later review, update each SQL cell's cutoff deliberately and record the new window. Dashboard and insight widgets retain their own saved date filters and current results; their numbers cannot be assumed to match pinned SQL cells.

Coverage notes accompany every query. Setup readiness counts observations, not installation activation. Request metrics cover reviewed deliberate UI mutations; run outcomes require an active observer. Exceptions are sanitized, deduplicated and bounded. CI/PR rows are opt-in custom repository imports, not native Engineering Analytics proof. Native Metrics/Logs activation, separately deployed landing instrumentation, masked replay consent and runtime-versus-generation AI coverage are explicit review checks. No raw app content, log bodies, tool payloads, provider prompts or person profiles are requested. There is no merge/deploy action and no automatic health verdict.

Current native behavior and widget identities were verified through connected tool schemas and [PostHog notebook documentation](https://posthog.com/docs/notebooks). SQL sources and compiler verification are documented in [sql.md](sql.md); compile success does not establish collection.
