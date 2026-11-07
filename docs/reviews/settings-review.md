# Settings comparison, changes and verification

This records the earlier visual settings pass. The later [runtime functionality review](runtime-setup-review.md) covers the implemented native setup and model-management follow-up, including the sign-in work listed below as a future improvement at the time.

Pitchcrew settings was compared with the local T3 source at `D:/CodeStuff/t3code`. This assessment covers settings, not either entire product. T3 was inspected as source; it was not exercised as a running app.

## The honest assessment

The old Pitchcrew settings area felt assembled feature by feature. Repeated headings, inconsistent rows, overly sparse General content and unclear device/workspace scope made a small set of settings harder to scan than T3's much larger catalog. Some problems were more serious than appearance: repeated search destinations could fail to reveal their target, save feedback could claim persistence that had failed, failed runtime recovery could disappear when the executable went missing, and incomplete rule fields printed raw validation data.

T3's advantage here is consistent composition and deliberate interaction handling. Copying its colors or adding more decorative clay would not fix those problems. Pitchcrew already had useful runtime diagnostics, scoped account access and guarded editors; the work improves how those capabilities are presented and reached.

| T3 reference                                                    | Lesson                                                               | Applied in Pitchcrew                                                                                                    |
| --------------------------------------------------------------- | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `apps/web/src/components/settings/SettingsSidebarNav.tsx`       | Group a large catalog into predictable destinations                  | Preferences / Connections / System rail, concise labels and a compact section picker                                    |
| `SettingsGroup.tsx` and `settingsLayout.tsx`                    | Reuse row, heading and scope structure                               | Shared sections, recessed preference trays and explicit device/workspace labels across all nine panels                  |
| `settingsSearch.ts` and target handling in `settingsLayout.tsx` | Search must reveal the actual setting, including repeated selections | Shared local/global destinations, fresh navigation tokens, disclosure opening, modal-aware focus and temporary outlines |
| Scoped settings and inheritance helpers                         | Explain where a setting takes effect                                 | Device versus workspace copy; T3's multi-environment inheritance machinery was not imported                             |

## Final changes

- **Layout:** condensed appearance controls and preference tray, shorter headers, consistent hierarchy, light/dark clay materials and 44px touch targets. Heavy panels load on demand with local loading and error boundaries.
- **Navigation:** URL-backed sections, labelled compact regions, guarded keyboard activation, lexical search, field-safe slash shortcut, repeated-target focus and disabled-control explanations.
- **Truthful saves:** success follows the actual changed control and checks known device storage values. Failures clear stale success and use the existing error toast without moving the switch under the pointer.
- **Runtimes:** attention-needed installations first, visible sign-in actions, separate attention/update counts, consistent dates and recovery after failed installation even when the CLI disappears. Hermes version parsing strips installation prose and paths before display; default detector behavior remains unchanged.
- **Rules:** a phone rule picker reveals and focuses its editor. Numeric fields show friendly bounds and linked errors; missing and invalid values have different summaries. Daemon validation remains authoritative, and malformed advanced JSON remains recoverable.
- **Other panels:** Updates and Privacy use shared sections; unavailable checks explain retained preferences. Accounts shows effective access for connected services. Source controls consistently say Watch. Service reassignment explicitly warns that a running service stops immediately and interrupts work.
- **Detector entry:** focus enters the first required field and returns to Add/Replace after close. Removing another provider's key preserves the open provider's unsaved draft.

## Independent review loop

Each row represents fresh independent reviews. Claude reviews used **Claude Opus 5.5**; Codex reviews used actual Codex agents.

| Version  | Codex                          | Claude Opus 5.5 | Main finding driving the next change                                                         |
| -------- | ------------------------------ | --------------- | -------------------------------------------------------------------------------------------- |
| V1       | 7.8                            | 6.6             | Sparse hierarchy, misleading preview, repeated navigation and save/focus defects             |
| V2       | 9.0                            | 7.6             | Updates/Privacy inconsistencies, runtime edge states and incomplete populated-state evidence |
| V3       | 9.2                            | 8.2             | Blank numeric fields exposed raw data; validation capture had not settled                    |
| V4       | 9.3                            | 8.9             | Service consequences, missing-versus-invalid labels and evidence precision                   |
| V5       | 9.4                            | 8.9             | Immediate service stop omitted; detector focus and storage-warning layout shift              |
| V6       | 9.1, then 9.4 after correction | 9.2             | Cross-provider draft loss fixed; two final minor interaction corrections followed            |
| V7 final | **9.4**                        | **9.3**         | Immediate removal focus and successful-save feedback corrected; no blocking findings         |

Detailed Claude reports: [V2](settings/claude-v2.md), [V3](settings/claude-v3.md), [V4](settings/claude-v4.md), [V5](settings/claude-v5.md), [V6](settings/claude-v6.md), [V7 final](settings/claude-v7.md). The [final Codex review](settings/codex-final.md) also found no blockers. Claude's final **9.3/10** clears the requested score above 9. Its conditions were a passing three-test evidence rerun and removal of machine-path captures; both are complete. Local home paths in raw reviews are redacted to `%USERPROFILE%`. Scores are reviewer judgments, not objective product metrics.

## Evidence

The browser suite starts an isolated production-mode daemon (`dev: false`), checks actual installed CLIs and asserts that Demo is absent. No personal jobs or Profile notes are loaded. Initial local QA detection found Claude Code, Codex, OpenCode, Grok, Pi, oh-my-pi and Hermes available; Cursor Agent was detected as incompatible.

The matrix covers all nine sections at 1280 by 800 and 390 by 844, dark phone appearance, nested-scroll captures, named panels/regions and touch-target checks. Additional fixtures cover connected accounts, a watched source/editor, consent on/off, missing sign-in, runtime updates/failure, missing-executable recovery, healthy service, read-only external access, detector focus, storage failure, search and settled rule errors.

Only a small visually inspected, non-sensitive final selection is kept in the repository:

- [Desktop General](settings/images/final-desktop-general.png)
- [Phone General, dark](settings/images/final-phone-dark-general.png)
- [Settled narrow rule error](settings/images/final-narrow-rule-error.png)
- [Configured Privacy, dark](settings/images/final-privacy-dark.png)
- [Settings search](settings/images/final-search.png)

The complete local matrix is archived outside the repository in the temporary directory named `pitchcrew-settings-review-artifacts-20261107`. It includes host-specific diagnostics and earlier versions. Versioned captures are ignored by Git; future captures should also use an external output directory.

## Validation

Final checks use pinned Bun 1.4.4 and Node 24.20.0. The initially launched manual QA daemon used global Bun 1.4.2; subsequent package commands use the pinned version.

| Check                                                           | Final result                       |
| --------------------------------------------------------------- | ---------------------------------- |
| Settings, runtime, update and evidence browser suites           | **31 passed** across four files    |
| Targeted settings/service/rules/runtime unit and adapter suites | **211 passed** across eleven files |
| Root typecheck, including landing typecheck                     | Passed                             |
| Root lint and component/disclosure standards                    | Passed                             |
| UI and Electron production builds                               | Passed                             |

After the last two interaction corrections, all **3 evidence browser tests** and **6 save-feedback unit tests** passed again, along with typecheck and lint. The evidence rerun also rebuilt the production UI. The combined results above precede only these two narrowly tested corrections.

Commands:

```powershell
bunx bun@1.4.4 x vitest run --project ui packages/ui/test/settings-evidence.test.ts packages/ui/test/settings-workflows.test.ts packages/ui/test/runtime-settings.test.ts packages/ui/test/app-updates.test.ts

bunx bun@1.4.4 x vitest run --project unit-and-api packages/ui/src/SettingsPage/__tests__ packages/ui/src/PacketRules/__tests__/helpers.test.ts packages/ui/src/JobSourcesSettings/__tests__/helpers.test.ts packages/ui/src/BackgroundServiceSettings/__tests__ packages/ui/src/RuntimeMaintenance/__tests__ packages/orchestrator/src/runtime-maintenance/__tests__ packages/adapters/test/health-version.test.ts packages/adapters/test/hermes-version.test.ts packages/adapters/test/cli-runtime.test.ts packages/adapters/test/hermes-runtime.test.ts

bunx bun@1.4.4 run typecheck
bunx bun@1.4.4 run lint
bunx bun@1.4.4 run build
```

The root test script first runs unrelated PostHog CLI tests. Two existing Windows tests fail with a doubled drive pathname (`C:/C:/...`) in `readiness.test.ts` and `scheduled-reports.test.ts`. The complete root suite is therefore **not** claimed to pass. Targeted Vitest suites above pass. Existing PDF highlight CSS, ineffective PDF.js dynamic import and large Chat bundle build warnings remain.

## Limits and follow-up

No real installer, provider sign-in or OS service reassignment was exercised. Real CLI detection and Codex/Claude reviews used installed runtimes. Uncommon failure/release/account states are explicitly fictional fixtures; installers do not update real CLIs. Detector focus tests save/remove only an obviously fictional key inside the temporary workspace and never call a detector service. Analytics fixture traffic is intercepted.

Semantic and keyboard checks are automated; no human screen-reader or physical-phone keyboard audit is claimed. Populated phone evidence is narrower than desktop, and the narrow numeric-error fixture is a resized desktop context, not a touch-keyboard test. Packaged MCP configuration is not exercised by the source-mode fixture.

Claude's remaining optional follow-ups are clearing the hidden Saved status after a storage-failure-then-success sequence (the visible stamp and toast are correct), and adding a confirmation before moving another workspace's service. Neither blocks its ship recommendation. A later repeated Saved announcement may be missed by a screen reader; no human screen-reader pass was performed.

The next substantive improvement is a user-launched native sign-in flow for runtimes that support one. It needs runtime-specific design and security boundaries; the current terminal workflow remains explicit.
