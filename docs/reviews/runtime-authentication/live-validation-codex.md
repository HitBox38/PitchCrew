# Windows launcher and manual live-runtime check: independent Codex review

2026-11-07. **9.2/10 — approve the reviewed implementation. No outstanding P0–P2 findings.** This is a source review of the two Windows PostHog test-launch fixes and `packages/orchestrator/test/runtime-live.smoke.ts`. The parent's actual provider run is separate evidence; this report does not invent a live success result.

The parent subsequently supplied the completed run's retained `result.json`. I read that artifact: `passed` is true; Codex 0.167.0 (`gpt-6.1-sol`, low) and Claude Code 2.1.318 (`sonnet`, low) each completed a first turn and resumed turn, observed the real profile MCP gateway, matched the expected reply markers and reused the native session. Both model catalogs report `runtime`, with 8 and 13 entries respectively. No job card was created. The parent reports normal process exit; I did not rerun inference independently.

## Windows launchers

Both tests now convert their module-relative file URLs with Node's `fileURLToPath()` before passing the path to `spawnSync`. This handles Windows drive paths and escaped filename characters, while retaining the existing command arguments and private-input assertions. The current changes are limited to imports and the two launch arguments. The existing tests execute the actual helper CLIs, so the reported focused 20/20 and complete PostHog 54/54 passes meaningfully verify the repair. I inspected the source/diff; I did not rerun those already-passing suites.

## Live-check integrity

- The opt-in guard executes before importing or creating the daemon. The `.smoke.ts` filename is outside the automated `*.test.ts` globs, so ordinary tests cannot start provider inference through this entry point.
- The workspace is a new `mkdtemp` directory outside the repository. Seeded default roles are paused, development mode is false, analytics and update checks are disabled, and the script never reads or modifies the user's normal Pitchcrew workspace.
- Readiness, model discovery, role configuration, conversation creation and message admission use production HTTP routes with a real local session and Origin/client headers. Queue processing, run execution and native adapters are not mocked.
- Both temporary roles have every declared optional capability disabled. The intended MCP operation is the read-only profile tool against fictional local content. No account switch, login/logout, credential copying, connector/browser action or external message is invoked by the harness.
- The service gateway observation records a profile call only after the original gateway returns successfully. A marker match alone would be insufficient because the normal prompt also contains the profile; the explicit gateway observation supplies the missing tool-use proof.
- The second turn has a distinct request/run and does not restate its checkpoint. Production `prepareSession` sends only messages after the previous checkpoint when resuming. A matching answer plus the same valid native ID, directory and updated saved-message checkpoint is meaningful evidence of the actual resume path.
- Success requires both runtimes, no job cards and no Demo-configured role. Safe output contains phase/result metadata and an evidence path, with no raw provider errors, credentials or session transcript. Private temporary evidence is retained for inspection.

## Limits to retain in the result report

The five-minute controller is an attempt deadline: it aborts HTTP waits/polling and then invokes production daemon shutdown, which cancels owned runs. Startup and shutdown still use their own production bounds, so this is not an independent hard process-kill guarantee. The model catalog result records its source; any fallback should remain labelled as such in the final report.

The isolation guarantee concerns Pitchcrew data and fictional inputs. Native CLI session/cache state and ordinary token refresh can still use their existing account homes, as the harness explicitly records. This is not a fresh OAuth flow, account-isolation, refresh-token renewal, packaged-app or every-provider compatibility audit. No provider inference was performed by this independent reviewer.
