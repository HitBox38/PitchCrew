# Desktop shutdown performance

The October 14, 2026 local performance sweep found a native process-exit stall on an Apple M4 Pro running macOS 26.6.2 (25G83), Node 22.23.2 and Electron 44.5.1. The native stall is intermittent in this environment and remains unresolved. The change here fixes bounded smoke-test supervision and adds evidence; it does not claim a faster production quit.

## Reproduction and diagnosis

The unmodified production desktop entry produced successful UI evidence, with its window verified hidden and unfocused, but its process did not exit within the 45-second observation. An earlier run exited about 34.7 seconds after UI evidence. A native sample during the stall showed the main thread inside Electron teardown ending in `usleep`, rather than application JavaScript.

The minimized controls import only Electron and Node built-ins:

| Case                                      | Observation                                                                              |
| ----------------------------------------- | ---------------------------------------------------------------------------------------- |
| No window                                 | Process exited with code 0, approximately 1–2.6 seconds including launch                 |
| No window, single-instance lock           | Process exited with code 0, approximately 1.2 seconds including launch                   |
| Hidden blank window                       | Window closed and Electron emitted `quit` within 6 ms; process still alive at 10 seconds |
| Hidden blank window, single-instance lock | Same post-quit stall                                                                     |
| Hidden blank window, software GPU         | Same post-quit stall                                                                     |
| Close window, await `closed`, then quit   | Same post-quit stall                                                                     |

These controls contain no Pitchcrew UI, preload, HTTP connection, provider, updater, packaged launcher, unsaved edit or debugger. They isolate this observed failure beyond the application’s JavaScript quit lifecycle. They do not establish that every OS or Electron build is affected.

[Electron issue 52582](https://github.com/electron/electron/issues/52582) reports the same blank-window/native-`usleep` symptom. Its author reports resolution after updating their physical Mac to macOS 26.6. Our 26.6.2 machine still reproduces, so that report is corroborating evidence, not a verified remedy for this environment. No speculative Electron downgrade/upgrade or force-exit workaround is applied.

Run the repository’s minimal, hidden reproduction:

```sh
node --import tsx scripts/performance/desktop-shutdown.ts
```

It writes an isolated temporary report and returns nonzero if a process exceeds its deadline. It runs the no-window control and hidden `about:blank` window sequentially. It never opens or focuses a visible window, starts a provider, accesses user workspace data or changes the production desktop entry.

## Reliable smoke evidence and deadlines

Only isolated smoke runs install the native shutdown recorder. `<result.json>.shutdown.json` records the request time and elapsed times for window close, window closed, `will-quit` and `quit`. Parent-observed process exit is a separate measurement, `shutdownToExitMs`. Receiving `quit` or successful UI evidence never counts as process-exit success.

The source desktop smoke retains its 120-second UI deadline; the packaged smoke retains 300 seconds. Both apply a separate 10-second deadline once the smoke requests a quit. A failed check sends SIGTERM to its own desktop child, allows two seconds for termination, then uses SIGKILL only as failed-test cleanup. Every deadline path rejects, even if graceful termination subsequently returns code 0. Ordinary production quit, renderer unsaved-edit guards, daemon/service ownership and updater handoff are unchanged.

On the measured post-change run, the actual Pitchcrew window closed in 5.8 ms and emitted `quit` in 9.0 ms, but the process still stalled. The supervisor correctly reported failure and finished about 12.1 seconds after UI evidence instead of waiting indefinitely. This is a test-harness improvement; the native process-exit budget still fails.

Regression tests use actual child processes to cover successful exit, a nonzero exit despite successful UI evidence, ignored SIGTERM, and the separate shutdown deadline. Lifecycle tests verify that evidence does not suppress unload or equate `quit` with process exit. Cross-platform installer replacement and live provider shutdown are outside this diagnosis.

The combined performance-fix branch later passed the complete hidden desktop workflow and exited 104 ms after its quit request (window closed in 5.2 ms). Three production daemon SIGTERM checks also exited successfully in 12–44 ms. These successful observations do not erase the minimized blank-window failures or establish a production fix for the native stall.
