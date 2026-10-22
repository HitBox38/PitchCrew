# Settings redesign

Settings now separates everyday preferences, update decisions and privacy choices. Runtime maintenance keeps the installed version, known release, sign-in requirement and update action together. The existing daemon updater still owns installer verification, concurrency, progress and recovery.

## Design direction

Keep Pitchcrew’s existing materials rather than introduce a separate settings theme. The light palette uses paper `#f2f1ec`, surface `#f8f7f3`, ink `#2b2d31`, indigo `#3a5482`, moss `#53673d` and ochre `#82601c`; dark mode uses the existing corresponding tokens. Source Sans 3 carries settings navigation, headings and controls. Fraunces remains part of the surrounding product identity; settings adds no font dependency.

Use a quiet section rail and one scrolling work area. The rail describes what each section contains. Runtime rows share one bounded list so users can compare installations without repeated large cards. Only actions use the existing raised clay material. Status has text as well as color. Keep the main action visible and defer command output, timestamps and diagnostics to shared Base UI disclosures. No entrance animation is needed for frequent settings navigation.

```text
Settings
  General         Runtimes                         Check for updates
  Accounts        3 installed / 1 update available
  Job sources     Installed runtimes
  Runtimes        Codex 1.0.0       Update available  [Update] [Details]
  Writing         Claude 2.0.0      Up to date        [Set up]
  Packet rules    OpenCode 1.0.0    Up to date        [Details]
  Updates         Add another runtime
  Privacy         Check runtime updates automatically         [switch]
  Local data
```

The initial alternative of individual runtime cards repeated setup text, timestamps and commands at equal visual weight. The final list prioritizes decisions and comparison. General no longer requires scrolling through update settings to reach telemetry consent. When the Settings area is narrower than 46rem (phones, and tablets beside the app sidebar), the keyboard-accessible tab strip moves to the top and scrolls the selected section into view, including direct links. `useCompactSettings` measures the Settings area so the tab orientation matches the `settings` container query.

## Resolved pains

- `packages/ui/src/SettingsPage/components/RuntimeSettings.tsx`: ambiguous checking action. **Check for updates** now names its purpose, shows checking feedback and reports release results. Disabled release checks have an explicit explanation and a separate **Recheck installations** label.
- `packages/ui/src/RuntimeMaintenance/components/RuntimeRow.tsx`: runtime update actions appeared below repeated sign-in details. The collapsed row now keeps update, version and sign-in state visible, with assigned agents for context. Manual-only installations expose **Update instructions**.
- `packages/ui/src/RuntimeMaintenance/components/RuntimeUpdate.tsx`: installation progress, failure and retry must stay visible without expanding diagnostics. Progress explains that navigation is safe; busy updates explain what must finish first. Failed or interrupted updates show the installer-specific manual update command and copy control directly beside the error, with instructions to run it in a terminal and recheck the runtime. A successful update does not imply successful authentication.
- `packages/ui/src/RuntimeMaintenance/components/RuntimeAuthentication.tsx`: setup required nested disclosures. The row’s **Set up** action now reveals the instructions and sign-in command directly.
- `packages/ui/src/SettingsPage/index.tsx`: General mixed appearance, notifications, application updates, skill maintenance and telemetry. **Updates** and **Privacy** have dedicated URL-backed sections. An Updates link leads directly to runtime maintenance.
- `packages/ui/src/SettingsPage/components/SettingsTabs.tsx`: terse navigation and offscreen selected tabs on mobile. Desktop descriptions clarify each destination; mobile direct links reveal the selected tab.

## Further improvements implemented

Packet rules now opens in a form editor for word limits, bullets per section, allowed lines and text patterns. Collapsed rows describe the check in plain language and show whether it blocks the packet or warns. Each form controls the affected documents, limits, patterns and message; the existing daemon validation remains authoritative. Incomplete fields remain editable. Advanced JSON shares the same draft and retains malformed or unsupported imported source for correction. Import, export and reset live under Advanced JSON. Save, Discard and validation status remain in the persistent footer.

Accounts uses the same heading and list hierarchy as Runtimes. Connected accounts list granted services and agents with effective service access. Choose agents opens the existing agent configuration flow; it never grants a capability automatically. The shared connection and authentication flows remain intact.

Find a setting searches preference names and synonyms. The global command palette includes the same catalog when a query is entered. Both navigate to an explicit section and hash, reveal the control and move focus to the actual interactive element, including Base UI controls backed by hidden inputs.

Job sources shows saved/watching counts, a primary Add source action and switches for watching. Edited drafts use the shared unsaved-changes guard when cancelling, switching editors or navigating. Removing a source has a confirmation that explains that existing leads stay. Writing and Local data now share the heading hierarchy, and Writing shows active preference counts and a useful empty state.

Settings editor discard dialogs return focus to their own editor when users keep editing. Returning focus to an automatically activated navigation tab would reopen the navigation attempt and the same dialog.

## Suggested next change

**Offer guided runtime sign-in where the CLI supports it.** Setup still involves copying a command into a terminal. Investigate an explicit user-launched native sign-in flow, with completion followed by Recheck. Keep unknown authentication distinct from missing authentication and never read credential files. This requires runtime-specific work beyond a visual redesign.

## Verification

Browser fixtures also cover guided-rule saves and JSON round trips, all four rule types, malformed source preservation, unsaved-change decisions, Settings and global search focus, explicit account configuration handoffs, and mobile source draft/removal behavior. Runtime fixtures exercise the real user-session HTTP updater with fictional installers: release checks, a single update click from a collapsed row, progress across navigation, verified completion, missing sign-in after installation, busy blocking, installer failure and retry availability, manual instructions, unavailable-runtime deep links, dark mobile layout and keyboard tab navigation. Existing runtime maintenance tests retain coverage for ownership checks, duplicate operations and queue reservations. No test updates an installed runtime or makes a provider inference request.

The interface review also applies the [Web Interface Guidelines](https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md): named controls, focus visibility, live async status, text overflow, reduced motion, URL-backed navigation and shared disclosure semantics.
