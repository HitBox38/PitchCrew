# Runtime authentication: T3 comparison and review iterations

2026-11-07, branch `t3/settings-page-review-improvements`. This extends the [settings redesign](settings-review.md) and [runtime setup/model work](runtime-setup-review.md). The current phase adds private per-runtime credentials and a shared native authentication contract. Reviews use installed Codex and Claude Opus 5.5 agent runtimes; the Demo runtime is not used.

## Result and remaining T3 gap

| Capability                  | Pitchcrew result                                                                                                                                                      |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Private runtime credentials | All twelve production runtimes have an explicit field allowlist, write-only secret values, saved/inherited/disabled/unset sources, opaque revisions and guarded saves |
| Browser sign-in             | Codex, Claude Code and Cursor Agent native flows                                                                                                                      |
| Native sign-in terminal     | Real Windows/Node PTY for the fixed OpenCode, Copilot and Grok auth-only commands                                                                                     |
| ACP authentication          | Fixed Grok adapter discovers installed-CLI methods, records browser consent and verifies with a no-prompt handshake; no filesystem, terminal or tool capabilities     |
| Other runtimes              | Allowlisted keys/provider settings and truthful external setup guidance; no fabricated OAuth support                                                                  |
| Managed Grok OAuth          | Private workspace auth file, isolated operation homes, serialized refresh use, conditional refresh persistence and cleanup                                            |
| Recovery                    | Typed credentials error separate from installation; direct recovery landing, private exact backup, reset-all confirmation and preserved native accounts               |
| T3 features still absent    | Arbitrary ACP/provider registry, multiple named provider instances, broader project/environment scopes and remote administration                                      |

The reference was source at `D:/CodeStuff/t3code`. T3 also uses native CLI/environment setup for many providers; it does not place every runtime behind one universal browser sign-in. This implementation follows its shared interaction/credential architecture within Pitchcrew's existing adapters. It does not claim complete T3 parity. See the [support matrix and boundaries](../runtime-authentication.md).

## Independent iterations

| Review          | Score  | Findings and resulting correction                                                                                                                                                                                                           |
| --------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Claude V1       | 6/10   | Typed-empty secrets silently disabled inheritance; validation choices/copy were missing; corrupt credentials looked like missing installation; desktop consent opened an empty window; terminal device links and copying were awkward       |
| Claude V2       | 7.5/10 | Non-secret empty editing snapped back; invalid inherited endpoints could expose embedded credentials; consent lacked acknowledgement feedback; terminal copying retained obsolete redraw frames; evidence needed a coherent settled refresh |
| Codex V2        | 8.4/10 | CLI stderr/ACP protocol failures could persist a known secret; PTY redaction skipped short allowlisted credentials                                                                                                                          |
| Codex V3        | 9.2/10 | No outstanding P0–P2 after privacy and first UX corrections                                                                                                                                                                                 |
| Codex V4        | 9.3/10 | Approved latest credential editing, inherited-value privacy, recovery, consent, rendered-buffer copying and scope corrections; no outstanding P0–P2                                                                                         |
| Claude V3       | 8.8/10 | Approved with no must-fix findings; consent wrapping, recovery emphasis, nested-dialog backdrop, copy-feedback lifetime and phone terminal guidance needed polish                                                                           |
| Codex V5        | 9.3/10 | Approved final polish, backdrop extension, responsive terminal and owned feedback timers; no outstanding P0–P2                                                                                                                              |
| Claude V4 final | 9.2/10 | Approved with no must-fix findings; verified the final 27-image set, corrected hierarchy/layout, endpoint states and actual Electron dispatch evidence                                                                                      |

Final reviews: **Claude Opus 5.5 9.2/10** and **Codex 9.3/10**, both approving. Scores are independent reviewer judgments, not objective product measurements. Claude progressed **6 → 7.5 → 8.8 → 9.2** through four fresh review iterations.

Reports: [Claude V1](runtime-authentication/claude-v1.md), [Claude V2](runtime-authentication/claude-v2.md), [Claude V3](runtime-authentication/claude-v3.md), [Claude V4 final](runtime-authentication/claude-v4.md), [Codex V2](runtime-authentication-codex-v2.md), [Codex V3](runtime-authentication/codex-v3.md), [Codex V4](runtime-authentication/codex-v4.md), [Codex V5 final](runtime-authentication/codex-v5.md).

After the final review, the one low-priority text fix was applied: joining source/description/invalid-value sentences no longer produces a doubled period. The existing invalid-inherited-endpoint browser case now asserts that correction. That focused browser check passed after the correction. The frozen review images preserve the reviewed state. Optional cosmetic follow-ups remain: make the recovery success paragraph read more like a resolved status, and reduce duplicate incomplete-field guidance. Neither blocks either approval.

## Corrections verified

- Credentials use a private file outside board history, snapshots and run folders. Reads omit secret values. Invalid inherited non-secret values are hidden with fixed guidance. Filesystem permissions are not OS-keychain encryption.
- Runtime scopes apply to authentication, checks, models and launches without mutating the daemon environment. Credential/executable/account changes invalidate durable sessions before adoption and retain runtime reservations.
- Empty secret typing undoes that field. Empty non-secret edits remain visibly incomplete and cannot be posted. Explicit Disable is the only field action that suppresses inheritance. Source labels, pending summaries, choices and fixed validation/busy errors make multi-field changes reviewable.
- Native auth uses exact flow and interaction IDs, cancellation and bounded owned processes. CLI success without a proven account stays completed/unverified. Logout is named, scoped and confirmed.
- Desktop browser consent opens only the validated URL after acknowledgement. Accepted consent has visible feedback and a secondary reopen action; blocked web popups retain a direct link.
- The PTY handles real VT input/output with incremental secret filtering, bounded tails and owned shutdown. Its themed renderer copies and scans the actual xterm buffer, joins soft wraps, omits erased chooser frames, and copies selected Ctrl/Cmd+C without interrupting sign-in.
- Background reads cannot clear action failures or acknowledged-save warnings. Mutation cancellation is separate from status refreshes, and progress polling continues around pending operations.
- Corrupt credentials block execution while preserving actual installation health. Recovery expands even after the panel was already loaded, keeps exact damaged bytes privately and reports backup/inheritance consequences.

## Verification

Commands use pinned Bun 1.4.4 and genuine Node 24.20.0 for Vitest/build tooling.

| Check                                                                                    | Result                                                                           |
| ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Adapter, authentication, PTY, credential, setup, model-preference and maintenance suites | 452 passed, 2 platform skips, 41 files                                           |
| Latest private connection API                                                            | 9 passed, including hidden invalid inherited endpoints                           |
| Final combined settings/runtime browser suite                                            | 76 passed, 7 files; includes all 45 runtime setup/model/auth cases               |
| Latest focused credential/maintenance/preferences/terminal unit recheck                  | 30 passed, 6 files                                                               |
| Actual hidden Electron asynchronous link dispatch                                        | Passed, normal unforced exit; OS launch intercepted, no external network/browser |
| Root lint/component/disclosure checks                                                    | Passed; 1,107 production TSX files                                               |
| Root and landing types                                                                   | Passed                                                                           |
| UI and Electron builds                                                                   | Passed                                                                           |

Counts above are separate runs with overlapping coverage, not a unique-test total. The final browser run covers incomplete endpoint editing, hidden inherited endpoints, safe busy feedback, late recovery expansion, browser acknowledgement, current-screen terminal redraw/copying, real PTY input/completion, drafts, conflicts, exact backup bytes and native-account preservation. Captures wait for bounded finite animations and two paint frames; the coherent review set has a SHA-256 manifest in the task's temporary evidence directory.

During the initial review, read-only CLI inspection verified native help/metadata, including Grok ACP-advertised methods. Automated services ran in production mode with isolated data, fictional accounts and local subprocess fixtures. A genuine Node PTY was exercised through the real manager, private API and browser renderer, including typed input and unverified completion. That review did not execute a real OAuth/account change, installation or Pitchcrew provider inference run; the later live follow-up below adds actual Codex/Claude execution. Human screen-reader, physical-phone, every-provider live-auth and packaged-installer audits are not claimed.

Actual Electron 44.5.1 also verified the delayed renderer request with no active user gesture through the unchanged production external-navigation handler. The OS launch boundary alone was intercepted: one hidden/unfocused window, one valid request, no false blocked-link feedback, no external network and normal exit. The old blank popup was correctly blocked. See the [native verification report](runtime-authentication/electron-link-verification.md) and [result JSON](runtime-authentication/electron-link-result.json). This verifies dispatch, not provider OAuth or the external OS browser.

At this review, the complete root test command was not claimed green because two pre-existing Windows PostHog CLI tests had doubled-drive paths. A later [follow-up](runtime-authentication/live-validation.md) fixed those launchers, passed all 54 PostHog tests, and completed four live Codex/Claude turns through Pitchcrew with existing signed-in accounts. The full repository Vitest suite was not rerun in that follow-up. Existing PDF highlight CSS, PDF.js dynamic-import and large-bundle build warnings remain.

## Curated evidence

All captures use fictional accounts, credentials and provider states. No real credential or home path appears. The final Opus review uses the same settled captures, frozen before its run.

- [Credentials, desktop](runtime-authentication/images/credentials-desktop.png), [phone dark](runtime-authentication/images/credentials-phone-dark.png), [phone changes/actions](runtime-authentication/images/credentials-phone-dark-actions.png), [declared provider choice](runtime-authentication/images/provider-choice.png)
- [Incomplete endpoint draft](runtime-authentication/images/incomplete-endpoint.png), [invalid inherited endpoint hidden](runtime-authentication/images/hidden-inherited-endpoint.png)
- [Recovery landing](runtime-authentication/images/recovery-needed.png), [backup/inheritance confirmation](runtime-authentication/images/recovery-done.png)
- [Real Windows PTY](runtime-authentication/images/real-pty.png), [redrawn chooser](runtime-authentication/images/terminal-redraw.png), [phone device URL/code](runtime-authentication/images/terminal-phone-dark.png)
- [Browser consent acknowledged](runtime-authentication/images/browser-consent.png), [native sign-out](runtime-authentication/images/native-signout.png), [workspace sign-out](runtime-authentication/images/workspace-signout.png)
