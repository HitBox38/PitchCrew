# UX-20 screen recovery and development cache isolation (implementation note), 8 November 2026

Implementation sub-agent note (Claude Opus 5.5) for UX-20 in `ux-journey-2026-11-08.md`. Parent native verification and the fresh independent reviews are still pending. This note does not claim a score.

## Cause (confidence)

- **Shared development dependency cache. High confidence in the mechanism; the specific deleting process is still unattributed.** `registerUi` created every development Vite server with the default `packages/ui/node_modules/.vite`. Besides the scratch daemon, nine backend test files start development UI servers on that same cache, most of them unintentionally (`dev: true` defaults to `ui: 'dev'`). Vite 8 removes or replaces `deps` when metadata is missing or its config hash differs. When that happens, a live server with an older browser hash answers `504 Outdated Optimize Dep` for real imports. The parent's observation matches: CardDetails returned 200 while its Base UI, Streamdown, Lexical, cmdk, docx-preview and pdfjs dependencies returned 504.
- **Silent automatic reload. Confirmed in source.** TanStack's `lazyRouteComponent` (1.170.41) reloads the window once per error message, tracked by a `sessionStorage` marker, and never imports again after that. A reload loses unsent composer, question and brief drafts held in renderer memory.
- **A retry cannot fix a failed module download. Confirmed experimentally.** In headless Chromium 153, a second `import()` of a chunk whose dependency returned 504 rejected without making any new request: chunk hits stayed 1 and dependency hits stayed 1. Chromium keeps the failed module graph for the life of the document. Electron 44 is Chromium-based; the experiment did not run on Electron itself.

## Changes

### Development cache lifecycle (backend)

- `packages/orchestrator/src/http/ui.ts`: `prepareDevUiCache` gives each development server its own `cacheDir` under `packages/ui/node_modules/.vite`, so it stays inside Vite's existing serving boundary with no new filesystem allow-list.
  - **Persistent (CLI default):** `pitchcrew-daemon-<sha256(resolved data folder)[0:16]>`. The existing `daemon.lock` already allows one daemon per data folder, which makes the cache exclusive. Restarts keep it warm, and the number of caches is bounded by the number of data folders used. The first start after this change optimizes once into the new folder.
  - **Temporary (`uiCache: 'temporary'`, tests):** `mkdtemp` `pitchcrew-temporary-*`. Before Vite closes, `settleCache` waits until no `_temp_` run is in progress and nothing has changed for one second, capped at 15 seconds. After Fastify closes, the folder is removed, then removed once more if a late write recreated it. Folders older than 24 hours left by crashed test daemons are swept at the next temporary start.
  - **Removal boundary:** `ownedCacheDirectory` accepts only a direct child of the resolved `node_modules/.vite` whose name starts with `pitchcrew-temporary-`. Vite's shared `deps`, persistent caches and other paths are refused.
  - Production static serving, Host/Origin/session hooks, lazy optional engines and CLI `--dev` behavior are unchanged. The existing shared `deps`/`deps_temp_*` folders were not touched.
- `packages/orchestrator/src/server.ts`: adds the `uiCache` option and passes the data folder to `registerUi`.
- Tests that start development servers but never request UI now pass `ui: false`: `mcp/test/stdio.test.ts` (2), `mcp/test/profile-maintenance.test.ts`, `orchestrator/test/instruction-updates.test.ts`, `routines.test.ts`, `single-instance.test.ts` (3), `skill-update-checks.test.ts`, `startup-authentication.test.ts` and `user-input.test.ts`. The two deliberate development UI checks (`server.test.ts` 15005 and `mcp/test/fixtures/bun-runtime.ts --development`) use `uiCache: 'temporary'`. `test/helpers/daemon.ts` forwards `uiCache`.

### Recovery for failed screens (frontend)

- `packages/ui/src/lib/retryable-lazy.ts`: replaces `lazyRouteComponent` for every route and the palette, and `React.lazy` for the job, add-job, agent-settings and new-conversation panels. It never reloads on its own. Failures are thrown to a boundary, `preload` is kept, and `retryFailedLoads()` lets the next render call the importer again.
- `packages/ui/src/LoadRecovery/`: clay recovery card (`ui-card`) with plain wording, technical details behind a shared `Collapsible` with a copyable `SourceBlock`, and explicit actions:
  - **File failed to download** (module or chunk error): "<Page/Job details> didn’t load". The body says the app couldn't download part of itself, that reloading fetches it again and that saved work is safe. The primary action is **Reload Pitchcrew…**, which opens an inline confirmation: "Saved jobs, packets and conversations stay. Unsent messages and unsaved edits in this window are lost." It offers **Reload** and **Keep this window**. **Try again is deliberately not offered**, because the experiment above shows it would fail again silently.
  - **Render crash:** "… stopped working". **Try again** (re-render) is primary, with Reload Pitchcrew… secondary. The copy says unsent drafts stay while the window is open.
  - **Reload safeguards:** reload runs only after confirmation, never automatically, and cannot loop. If an existing unsaved-editor `beforeunload` guard keeps the window open, a note after 1.5 seconds says so instead of failing silently.
- `router.ts` sets `defaultErrorComponent: RouteLoadError`. Child-route failures render inside the root App outlet, so the sidebar, app bar and in-memory drafts remain. A failure of the root App chunk itself renders the same card on its own.
- `PanelLoadBoundary` / `recoverablePanel`: a failed sheet or dialog becomes a small clay dialog with Close (the panel's own close action) and Reload/Try again, so the workspace keeps working. Closing arms another import request for the next open.
- `WorkspacePalette` wraps the palette in the same boundary. `styles/load-recovery.css` holds the styles; targets are 32px, or 44px on coarse pointers or narrow screens, and reduced motion is respected.

## Checks run (all focused)

- `vitest packages/orchestrator/test/dev-ui-cache.test.ts` (unit-and-api, maxWorkers 1): **5 passed**. Covers per-data-folder persistence and separation, never Vite's `deps`, temporary removal and stale sweep sparing other caches, settling while `_temp_` exists plus the bounded timeout, and the boundary rejecting the base, `deps`, nested, `..` and outside paths. It also covers **two concurrent real development daemons**: each serves its own optimized React module, closing the second removes only its cache, and the first still returns 200 with real optimized code rather than 504.
- `server.test.ts -t "serves Vite deep links"` with port remap 15005→15995: passed twice. A pre-settle run showed an unhandled rolldown write error and a recreated folder. Both were fixed by `settleCache` and the re-removal, and that leftover folder from my own run was deleted.
- `vitest packages/ui/src/LoadRecovery` (unit-and-api): **6 passed**. Covers: a failed import reaches the boundary, with no re-import or reload without a request and with `window.location.reload` and `sessionStorage` stubs untouched; an explicit request imports again; a shared in-flight import; module failure copy (Reload…, Close, Technical details, no Try again, no module URL or browser wording in visible markup); crash copy (Try again, drafts sentence); panel Close and Try again wiring; and the router's default error component.
- `tsc --noEmit`, `bun run lint` (including the 100-line component check) and `oxfmt --check` on changed files: pass.
- **Not run:** `packages/ui/test/load-recovery.test.ts` (new Playwright test, port 14783). It aborts newly requested `/assets/*.js` chunks and checks that Decisions shows the clay card inside the shell, with no Try again, no automatic reload, Technical details opening, and the confirmed Reload rendering Decisions after one reload. It also checks that a failing job sheet closes cleanly, Board still works and no reload happens. It was not run because the UI project's global setup rebuilds `packages/ui/dist`, which the active full check is serving. The edited non-UI tests were also not run individually: their fixed ports could collide with the full check. They typecheck, and the edits only add `ui: false`.

## Handoff and objections

1. After the full check finishes, the parent should run `bun run vitest run packages/ui/test/load-recovery.test.ts --project ui --maxWorkers 1` and the changed backend files.
2. On restart, the scratch daemon uses `pitchcrew-daemon-<hash>` and optimizes once. No manual cache clearing is needed. The old shared `deps`/`deps_temp_*` folders are now unused by daemons and were left in place.
3. `AGENTS.md` needs a line (parent coordinates): development daemons keep an exclusive Vite cache per data folder, tests use temporary caches, and failed lazy screens show the clay recovery card with an explicit confirmed reload.
4. Objection to the review's "auto-reload once" acceptance criterion: it was not implemented. Reload stays explicit and confirmed, with draft-loss wording, as the parent directed.
5. Remaining limits:
   - In persistent mode, closing Vite mid-optimization keeps Vite's own cancel behavior. This is pre-existing and limited to one daemon's own cache.
   - Existing `SettingsErrorBoundary` reloads directly without the draft warning. It is explicit, not automatic, and could adopt the shared card later.
   - `usePaletteReady`'s existing import-failure toast is unchanged.

## Parent verification after handoff

The new production-browser recovery suite now passes **2/2**. Parent corrected test-only strict locators and counted actual main-frame document requests rather than SPA frame events; an unchanged performance time origin also checks that no silent reload occurred. The explicit confirmed reload restores Decisions; a failed job sheet closes without replacing Board. Ten cache/server/changed-backend files pass **64/64**, including the two concurrent real dev-daemon cache check.

Native Electron verification stopped only the idle scratch daemon, opened an unloaded job sheet, observed the clay failure dialog, opened Reload Pitchcrew…, chose Keep this window, then closed the sheet. Board remained usable. Restarting uses the isolated cache and job details/Decisions load normally. Screenshots are under the scratch workspace outside the repository. Vite's normal development reconnect reload is distinct from loader recovery and was not used as evidence of draft preservation.

Parent added the cache/recovery guidance to AGENTS.md and moved SettingsErrorBoundary onto the same shared recovery card. Current focused UI checks pass **94/94 across fourteen files**. The final full check and fresh independent UX gate remain outstanding.
