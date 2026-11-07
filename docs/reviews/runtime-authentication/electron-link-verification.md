# Hidden Electron asynchronous sign-in link verification

2026-11-07. **Passed on actual Electron 44.5.1, with embedded Node 24.21.0.** The renderer, BrowserWindow, IPC/preload, popup dispatch and production [`installExternalNavigation`](../../../packages/desktop/src/external-navigation.ts) handler are real. The only replaced production boundaries are `shell.openExternal` and `dialog.showMessageBox`, so this verification cannot open the operating-system browser or a native dialog.

Reproduce from the repository root with genuine Node:

```sh
node --import tsx packages/desktop/test/runtime-signin-link.smoke.ts
```

The runner bundles an isolated fixture with the existing tsdown tooling, strips inherited authentication variables from the child environment, creates a private temporary Electron profile and launches one hidden, non-focusable window. The fixture serves only an isolated loopback HTML page, installs the unchanged production navigation handler and executes an asynchronous renderer function. After a 150 ms awaited delay, it records `navigator.userActivation.isActive` and calls `window.open` with the same `_blank`, `noopener,noreferrer` arguments used after consent.

| Assertion                                                        | Observed result                                              |
| ---------------------------------------------------------------- | ------------------------------------------------------------ |
| Renderer user activation at delayed open                         | `false`                                                      |
| Validated HTTPS request reaching intercepted OS-opening boundary | Exactly once, `https://auth.openai.com/authorize?fixture=1`  |
| Blocked-link feedback for that valid request                     | None                                                         |
| Old empty-placeholder `window.open('', '_blank')`                | Actual `unsupported-protocol` feedback; never sent to the OS |
| BrowserWindow instances created                                  | One; no Electron popup                                       |
| Window shown or focused                                          | Never                                                        |
| Native dialogs                                                   | Zero                                                         |
| External network requests                                        | Zero                                                         |
| Process completion                                               | Normal exit code 0, without forced cleanup                   |

The successful run retained `result.json` and safe stage diagnostics under the task-owned temporary `pitchcrew-runtime-signin-link-PHx5Y0` directory. The pinned Electron development package fetched its missing binary before the first attempt. An initial fixture bootstrap used top-level asynchronous module initialization and hit its startup deadline; that fixture-only issue was corrected by entering through `app.whenReady().then(...)`. Production code was not changed. The successful run completed normally.

This closes the previous unobserved asynchronous Electron popup-dispatch concern: actual Chromium/Electron did dispatch the request without active user activation, and the production handler routed it correctly. It does **not** verify the external operating-system browser, any provider page, OAuth completion, installed-app packaging or real account state. No actual browser opening, authentication, inference or Demo runtime was used.

Implementation: [runner](../../../packages/desktop/test/runtime-signin-link.smoke.ts), [actual Electron fixture](../../../packages/desktop/test/fixtures/runtime-signin-link-main.ts), [IPC observation preload](../../../packages/desktop/test/fixtures/runtime-signin-link-preload.ts).
