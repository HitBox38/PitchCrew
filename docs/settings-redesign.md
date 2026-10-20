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

The initial alternative of individual runtime cards repeated setup text, timestamps and commands at equal visual weight. The final list prioritizes decisions and comparison. General no longer requires scrolling through update settings to reach telemetry consent. On mobile the existing keyboard-accessible tab strip scrolls the selected section into view, including direct links.

## Resolved pains

- `packages/ui/src/SettingsPage/components/RuntimeSettings.tsx`: ambiguous checking action. **Check for updates** now names its purpose, shows checking feedback and reports release results. Disabled release checks have an explicit explanation and a separate **Recheck installations** label.
- `packages/ui/src/RuntimeMaintenance/components/RuntimeRow.tsx`: runtime update actions appeared below repeated sign-in details. The collapsed row now keeps update, version and sign-in state visible, with assigned agents for context. Manual-only installations expose **Update instructions**.
- `packages/ui/src/RuntimeMaintenance/components/RuntimeUpdate.tsx`: installation progress, failure and retry must stay visible without expanding diagnostics. Progress explains that navigation is safe; busy updates explain what must finish first. Failed or interrupted updates show the installer-specific manual update command and copy control directly beside the error, with instructions to run it in a terminal and recheck the runtime. A successful update does not imply successful authentication.
- `packages/ui/src/RuntimeMaintenance/components/RuntimeAuthentication.tsx`: setup required nested disclosures. The row’s **Set up** action now reveals the instructions and sign-in command directly.
- `packages/ui/src/SettingsPage/index.tsx`: General mixed appearance, notifications, application updates, skill maintenance and telemetry. **Updates** and **Privacy** have dedicated URL-backed sections. An Updates link leads directly to runtime maintenance.
- `packages/ui/src/SettingsPage/components/SettingsTabs.tsx`: terse navigation and offscreen selected tabs on mobile. Desktop descriptions clarify each destination; mobile direct links reveal the selected tab.

## Suggested next changes

1. **Make packet rules editable without JSON.** `packages/ui/src/PacketRules/components/RulesEditor.tsx` exposes the full source document as the primary editor. Add ordinary controls for rule type, severity and conditions, a plain-language preview, and an Advanced source editor. Preserve current validation, explicit save and unsaved-change protection. Success: a user can add a warning rule without learning the schema.
2. **Finish account connection with a clear agent handoff.** `packages/ui/src/ConnectorSettings/index.tsx` tells users to enable services separately in role settings. After connecting, offer **Choose agents** and show which agents already have access. Keep every capability change explicit. Success: a connected account’s usefulness and next step are visible in the same flow.
3. **Add search within Settings.** Nine sections make navigation clearer but still require users to know where a preference lives. Extend the command palette with setting names and synonyms such as “sound,” “telemetry” and “CLI update”; open the exact section, reveal its control and move keyboard focus there. Success: a preference can be found without searching unrelated pages.
4. **Offer guided runtime sign-in where the CLI supports it.** Setup still involves copying a command into a terminal. Investigate an explicit user-launched native sign-in flow, with completion followed by Recheck. Keep unknown authentication distinct from missing authentication and never read credential files. This requires runtime-specific work beyond a visual redesign.

## Verification

Browser fixtures exercise the real user-session HTTP updater with fictional installers: release checks, a single update click from a collapsed row, progress across navigation, verified completion, missing sign-in after installation, busy blocking, installer failure and retry availability, manual instructions, unavailable-runtime deep links, dark mobile layout and keyboard tab navigation. Existing runtime maintenance tests retain coverage for ownership checks, duplicate operations and queue reservations. No test updates an installed runtime or makes a provider inference request.

The interface review also applies the [Web Interface Guidelines](https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md): named controls, focus visibility, live async status, text overflow, reduced motion, URL-backed navigation and shared disclosure semantics.
