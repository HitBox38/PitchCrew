# Runtime settings functionality: T3 comparison and verification

2026-11-07, branch `t3/settings-page-review-improvements`. This follows the [visual settings pass](settings-review.md). The functionality work received **five fresh Claude Opus 5.5 reviews** and **seven fresh Codex reviews**, using actual agent runtimes. Final scores are **Claude 9.1/10** and **Codex 9.4/10**, both recommending shipping with no must-fix findings. These are reviewer judgments, not objective product measurements.

## Honest comparison

The earlier redesign improved presentation, but Pitchcrew still lagged behind T3 in runtime setup. It had detection, maintenance and per-agent model selection; it lacked an integrated native sign-in flow, a workspace executable override and central model-choice management. Better rows alone did not close that gap.

The follow-up implements those local workflows. It does not make Pitchcrew equivalent to T3's larger provider platform. T3 still supports provider instances, schema-driven provider configuration, secret sources, project/environment scope and remote administration that Pitchcrew does not implement.

The local T3 comparison used `D:/CodeStuff/t3code`, especially `apps/web/src/components/settings/ProviderSettingsPanel.tsx`, `ProviderSettingsForm.tsx`, their logic helpers and `_chat.settings.providers.tsx`. T3 was reviewed as source, not exercised as a running comparison app.

| Function                                | Pitchcrew result                                                                                                                                   |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Guided setup                            | Installation → Sign-in → Models, opening at the step that needs attention; drafts survive step changes                                             |
| First installation                      | Explicit, bounded official npm install for eight supported missing CLIs in the workspace data folder; four runtimes retain manual guidance         |
| Executable selection                    | Absolute-path override, resolved-path/source/ownership diagnostics, validation before adoption and consistent selection for checks and future runs |
| Native sign-in                          | Codex ChatGPT app-server login and Claude Code native browser/code login, cancel/retry, bounded lifetime and native readiness verification         |
| Model choices                           | Discovery, filtering, favorites, visibility, ordering and explicit unverified custom selectors/reasoning definitions                               |
| Existing selections                     | Hidden and unlisted saved models stay visible; preference changes do not rewrite agents or conversations; in-use custom definitions are protected  |
| Maintenance                             | Existing verified updater, manual instructions, busy reservations, progress and failure recovery remain available                                  |
| Multi-instance and remote configuration | Not implemented; this remains one local workspace with one configured executable per runtime                                                       |

See [runtime setup](../runtime-setup.md) for the support matrix, storage, routes and access boundaries, and [model discovery](../model-discovery.md) for native catalog behavior.

## Technical corrections

- Setup, updates, native sign-in, metadata checks and agent work share runtime reservations. Changing an executable or account invalidates native sessions before adoption or authentication can proceed. Storage failures cannot silently select an unverified executable.
- Executable overrides use an asynchronous workspace scope rather than a process-global setting. Supported Windows npm shims run through Node without a shell; standard Windows npm ownership is recognized.
- Native authentication is private and user-session protected. URLs and one-time codes stay outside events, snapshots and agent tools. Native CLI account readiness is checked without inference; current readiness cannot be replaced by an old successful sign-in result.
- The installed Codex app-server rejected `--ignore-user-config`; that unsupported argument was removed from account reads and sign-in. Scoped agent execution restrictions remain intact.
- Model writes use revision conflicts and preserve drafts. Stale focus reads cannot overwrite a save or an explicit refresh. Preference reads on focus use the latest known catalog and never spawn discovery, including after its cache expires.
- A damaged preferences file preserves native discovery and reasoning. The list becomes read-only with one explicit recovery action. Recovery backs up the whole damaged file before resetting choices across runtimes; saved agent/conversation selectors are retained. Missing custom definitions supply no invented reasoning support.
- Acknowledged mutations remain successful when only the follow-up refresh fails. Installer disk failures release reservations, retain truthful uncertainty about the result and do not crash output callbacks. Finished installation failures fold into a previous-attempt disclosure once the runtime is ready.
- Phone icon actions have 44px width and height, the editor fields stack, failure messages precede recovery actions, and the setup count follows the displayed native catalog.

## Review iterations

| Claude pass | Score   | Main correction before the next review                                                                    |
| ----------- | ------- | --------------------------------------------------------------------------------------------------------- |
| V1          | 7.6     | Sign-in action hierarchy, private code entry, truthful step state and recovery                            |
| V2          | 8.4     | Historical install failures, acknowledged saves, timeout wording and model-state clarity                  |
| V3          | 8.6     | Unreadable preferences blocked healthy native model pickers; recovery and touch targets needed correction |
| V4          | 8.9     | Contextual recovery copy, inline recovery actions, phone field alignment and process-free focus reads     |
| V5 final    | **9.1** | No must-fix findings; recommends shipping                                                                 |

Claude's detailed reports: [V1](runtime-setup/claude-v1.md), [V2](runtime-setup/claude-v2.md), [V3](runtime-setup/claude-v3.md), [V4](runtime-setup/claude-v4.md), [V5 final](runtime-setup/claude-v5.md).

Codex scores progressed **8.3 → 8.8 → 8.9 → 9.1 → 9.3 → 9.4 → 9.4**. Findings drove Windows installer ownership, bounded disk-failure handling, session invalidation ordering, native-auth cleanup, stale-read guards and current-account readiness fixes. Its final two passes found no P0–P2 issues. The last nonblocking installer-status wording issue was corrected and covered by a regression. See the [final Codex report](runtime-setup/codex-final.md).

## Verification

Commands use pinned Bun 1.4.4 and genuine Node 24.20.0 for Vitest and build CLIs.

| Check                                                                                                   | Result                                    |
| ------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| Adapters, setup, auth, maintenance, model preferences, discovery, reasoning and private API unit suites | **387 passed, 2 skipped**, 33 files       |
| Runtime setup/model browser regressions after final changes                                             | **24 passed**, two files                  |
| Combined settings/runtime/update browser suites                                                         | **55 passed**, six files                  |
| Private API and model-preference checks after process-free focus change                                 | **6 passed**                              |
| Root lint and component/disclosure rules                                                                | Passed; 1,090 production TSX files        |
| Root and landing typecheck                                                                              | Passed                                    |
| UI and Electron production builds                                                                       | Passed after the catalog-count correction |

The browser regressions cover executable validation and draft guards, accepted saves with failed reads, installation progress/cancel/retry, historical recovery, native sign-in resume/cancel/code/verification/expiry, stale account results, model conflict/draft recovery, stale GET races after saves and explicit refreshes, unreadable-file recovery, preserved native reasoning, missing custom metadata, 44px touch targets and discovery-free focus reads. Explicit refresh still discovers models and updates the native count.

```powershell
bunx bun@1.4.4 run lint
bunx bun@1.4.4 run typecheck
bunx bun@1.4.4 run build
bunx bun@1.4.4 run format:check
bunx bun@1.4.4 x vitest run --project ui packages/ui/test/runtime-setup.test.ts packages/ui/test/runtime-models.test.ts packages/ui/test/runtime-settings.test.ts packages/ui/test/settings-workflows.test.ts packages/ui/test/settings-evidence.test.ts packages/ui/test/app-updates.test.ts
```

The complete root test script is not claimed green: its unrelated PostHog Windows tests in `readiness.test.ts` and `scheduled-reports.test.ts` already fail with doubled drive paths (`C:/C:/...`). Existing PDF highlight CSS, PDF.js dynamic-import and large-bundle build warnings remain.

## Real runtime evidence and limits

Read-only checks used installed **Codex 0.167.0** and **Claude Code 2.1.318**, detected their selected executables and reported authenticated native account metadata. Native discovery returned **8 Codex models** and **13 Claude models**. These observations are not fixed catalog promises or proof of entitlement to every model.

No real OAuth completion, account switch, managed install or inference was performed. Automated native-process and UI states are fictional fixtures in temporary workspaces; the new runtime setup coverage uses production-mode services rather than the Demo runtime. Codex and Claude reviews used actual agent runtimes. No human screen-reader or physical-phone audit is claimed.

Claude's final optional follow-up is a display inconsistency: after discovery-cache expiry, a separate installation recheck can replace the workspace's native catalog with fallback suggestions; a later focus read can show that labeled fallback until explicit refresh. Saved selections remain intact and no process starts on focus. Stacking fields on coarse-pointer desktops is intentional. These did not block either final ship recommendation.

## Curated evidence

All images use explicitly fictional runtime/account/model states, with no real credential or home path. Full temporary captures stay outside the repository.

- [Desktop model choices](runtime-setup/images/models-desktop.png)
- [Phone model choices, dark theme](runtime-setup/images/models-phone-dark.png)
- [Native Claude code entry](runtime-setup/images/claude-signin-code.png)
- [Unreadable preferences with native models retained](runtime-setup/images/model-preferences-recovery.png)
- [Failed installation with retry and recheck](runtime-setup/images/installation-retry.png)
