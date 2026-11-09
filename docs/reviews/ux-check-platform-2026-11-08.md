# Platform corrections for the UX validation run

The first full `bun run check` finished with 11 failed, 3,311 passed and eight skipped tests. Lint, typecheck and the 54 PostHog script tests passed. The failed test stage prevented the later build stages from running in that command. These results are not a green full check.

The terminal report identified the failures below. The corrections change test assumptions and fixture readiness, not production code or application assertions.

| Failure                                     | Evidence                                                                                                                                          | Test correction                                                                                                                                                                                                                   |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AI Elements exact clipboard copy, two tests | Windows clipboard returned CRLF where expected source used LF. Blank lines and all non-newline text matched.                                      | Normalize CRLF to LF only on Windows before exact clipboard equality. Rendered source assertions remain exact.                                                                                                                    |
| Brief dirty guards, four tests              | The fixture expected a lead's brief-confirmation decision after lead confirmation was intentionally deferred until shortlisting.                  | Parent updated the fixture to shortlist its job. The focused four-test rerun passed; this correction is owned by the main UX change.                                                                                              |
| Detector key persistence, one test          | `stat().mode & 0777` returned decimal 438 (`0666`) rather than 384 (`0600`) on Windows.                                                           | Retain the exact POSIX mode assertion on non-Windows platforms. All persistence, redaction, digest binding, removal and authorization assertions still run on Windows. No Windows ACL guarantee is inferred from POSIX mode bits. |
| Run instruction output paths, two tests     | Native `path.join` produced backslashes, while assertions hard-coded slash paths.                                                                 | Build the fictional run directory and expected paths with `path.join`. File contents, concurrent-write waits and deferred-skill checks stay exact.                                                                                |
| Startup lazy imports, one test              | Node rejected raw `C:` loader path with `ERR_UNSUPPORTED_ESM_URL_SCHEME` before the daemon import test ran.                                       | Pass the existing `import.meta.resolve('tsx')` file URL directly to `--import`. Keep the optional-engine import rejection hook and snapshot assertions.                                                                           |
| Recovery router interaction, one test       | First `page.goto` hit its five-second timeout while the cold Vite fixture optimized dependencies and reloaded. The first user action had not run. | Allow 30 seconds for initial navigation and 45 seconds for that test. Later locator/action timeouts remain five seconds; router blocking, preserved draft and zero-recovery-command assertions are unchanged.                     |

The AI Elements fixture's first navigation also has an explicit 30-second timeout after a focused retry previously timed out at ten seconds before executing any test. This changes setup readiness only.

## Focused validation

Focused detector (four), run-instructions (three) and startup-import (one) tests passed: eight of eight, in about 16 seconds. After native input stopped, AI Elements (12) and recovery interactions (four) ran together with `--maxWorkers 1`: both files passed, 16 of 16 tests, in 31.36 seconds. No further assertion or timeout changes were needed. Formatting, lint and `git diff --check` passed for the five owned test files.

Commands:

```powershell
npx --yes bun@1.4.4 x --no-install vitest run --project unit-and-api packages/orchestrator/test/detectors.test.ts packages/orchestrator/test/run-instructions.test.ts packages/orchestrator/test/startup-imports.test.ts
npx --yes bun@1.4.4 x --no-install vitest run --maxWorkers 1 packages/ui/test/ai-elements.test.ts packages/ui/src/ChatView/__tests__/recovery-interactions.test.ts
```

These focused checks passed 24 tests in five files. They do not replace a full check of the final patch. The fixture build still reported the existing CSS `::highlight` optimizer, large chunk and ineffective PDF.js dynamic-import warnings.

The next full check finished with **3356 passed, 6 failed, 8 skipped** in 1990.55 seconds. Three confirmed 15-second integration timeouts affected external-stdio's example-workspace evidence case, scoped MCP stdio and production chat-checkpoint initialization; timed-out initialization also left Windows cleanup handles busy. Three further failures involved new prompt contract cases and the newly added `cardPacketStage` export while source changed during this run. A fresh, coherent two-file rerun of those contract/action tests passes 39/39; this full run is not proof of the final frozen patch. The two owned integration files now mock unrelated native CLI discovery while keeping Demo, actual stdio and production replay real: 10/10 pass, and the previously failing cases take 1.463 seconds and 144 milliseconds. See `ux-test-stability-2026-11-08.md`.

Separately, concurrent development daemons were found to share Vite's UI dependency cache. Missing shared cache metadata and real `504 Outdated Optimize Dep` dependency responses broke new lazy imports in the native app and independent review tabs. This is being corrected as UX-20 rather than attributed to the feature UI diff or hidden by repeated cache deletion. A fresh full check is required once the correction round is settled; no final green check is claimed.

The original full check was performed while source changes and native UI activity continued. Its terminal failures are documented above; claims about the final patch require checks of the updated files. No provider inference is used by these fixture checks.
