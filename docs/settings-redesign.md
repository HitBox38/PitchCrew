# Settings redesign

Settings now separates everyday preferences, update decisions and privacy choices. Runtime maintenance keeps the installed version, known release, sign-in requirement and update action together. The existing daemon updater still owns installer verification, concurrency, progress and recovery.

## Design direction

Keep Pitchcrew’s existing materials rather than introduce a separate settings theme. The light palette uses paper `#f2f1ec`, surface `#f8f7f3`, ink `#2b2d31`, indigo `#3a5482`, moss `#53673d` and ochre `#82601c`; dark mode uses the existing corresponding tokens. Source Sans 3 carries settings navigation, headings and controls. Fraunces remains part of the surrounding product identity; settings adds no font dependency.

Use a quiet section rail and one scrolling work area. The 192px rail groups Preferences, Connections and System settings with icons and concise labels. Runtime rows share one bounded list so users can compare installations without repeated large cards. Only actions use the existing raised clay material. Status has text as well as color. Keep the main action visible and defer command output, timestamps and diagnostics to shared Base UI disclosures. No entrance animation is needed for frequent settings navigation.

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

The initial alternative of individual runtime cards repeated setup text, timestamps and commands at equal visual weight. The final list prioritizes decisions and comparison. General no longer requires scrolling through update settings to reach telemetry consent. When the Settings area is narrower than 46rem (phones, and tablets beside the app sidebar), a labelled section picker replaces the rail beside the search button; content becomes a labelled region and direct links retain their section. `useCompactSettings` measures the Settings area so the tab orientation matches the `settings` container query.

## Resolved pains

- `packages/ui/src/SettingsPage/components/RuntimeSettings.tsx`: ambiguous checking action. **Check for updates** now names its purpose, shows checking feedback and reports release results. Disabled release checks have an explicit explanation and a separate **Recheck installations** label.
- `packages/ui/src/RuntimeMaintenance/components/RuntimeRow.tsx`: runtime update actions appeared below repeated sign-in details. The collapsed row now keeps update, version and sign-in state visible, with assigned agents for context. Manual-only installations expose **Update instructions**.
- `packages/ui/src/RuntimeMaintenance/components/RuntimeUpdate.tsx`: installation progress, failure and retry must stay visible without expanding diagnostics. Progress explains that navigation is safe; busy updates explain what must finish first. Failed or interrupted updates show the installer-specific manual update command and copy control directly beside the error, with instructions to run it in a terminal and recheck the runtime. A successful update does not imply successful authentication.
- `packages/ui/src/RuntimeMaintenance/components/RuntimeAuthentication.tsx`: setup required nested disclosures. The row’s **Set up** action now reveals the instructions and sign-in command directly.
- `packages/ui/src/SettingsPage/index.tsx`: General mixed appearance, notifications, application updates, skill maintenance and telemetry. **Updates** and **Privacy** have dedicated URL-backed sections. An Updates link leads directly to runtime maintenance.
- `packages/ui/src/SettingsPage/components/SettingsTabs.tsx`: terse navigation and offscreen selected tabs on mobile. Desktop groups clarify each destination; mobile direct links select the correct labelled picker value.

## Further improvements implemented

Packet rules now opens in a form editor for word limits, bullets per section, allowed lines and text patterns. Collapsed rows describe the check in plain language and show whether it blocks the packet or warns. Each form controls the affected documents, limits, patterns and message; the existing daemon validation remains authoritative. Incomplete fields remain editable. Advanced JSON shares the same draft and retains malformed or unsupported imported source for correction. Import, export and reset live under Advanced JSON. Save, Discard and validation status remain in the persistent footer.

Advanced JSON uses a lazily loaded CodeMirror editor with clay controls, a recessed surface, syntax colors, line numbers, indentation, bracket pairing/matching, packet-rule property/value suggestions, and inline errors from JSON parsing and daemon validation. The toolbar’s settings button opens a clay JSON editor settings dialog with Format on save, Format on paste and Format while typing; all default off and are remembered independently on this device. Settings/global search focuses the dialog trigger. Automatic editing formats only valid complete JSON, preserves the caret and joins paste formatting to the original Undo step. With Format on save off, saved source formatting survives reloads and exports. Editor tab switches preserve undo history and position; Cmd/Ctrl+S saves.

Accounts uses the same heading and list hierarchy as Runtimes. Connected accounts list granted services and agents with effective service access. Choose agents opens the existing agent configuration flow; it never grants a capability automatically. The shared connection and authentication flows remain intact.

Find a setting searches preference names and synonyms. The global command palette includes the same catalog when a query is entered. Both navigate to an explicit section and hash, reveal the control and move focus to the actual interactive element, including Base UI controls backed by hidden inputs.

Job sources shows saved/watching counts, a primary Add source action and switches for watching. Edited drafts use the shared unsaved-changes guard when cancelling, switching editors or navigating. Removing a source has a confirmation that explains that existing leads stay. Writing and Local data now share the heading hierarchy, and Writing shows active preference counts and a useful empty state.

Settings editor discard dialogs return focus to their own editor when users keep editing. Desktop arrow keys move focus without activating sections; Enter or Space starts guarded navigation.

## Suggested next change

**Guided runtime setup is implemented in the follow-up.** [Runtime setup](runtime-setup.md) adds native Codex/Claude sign-in, executable selection, supported first installs and model management. Other CLIs retain their own sign-in instructions. Authentication checks remain distinct from model entitlement and provider inference.

## Verification

Browser fixtures also cover guided-rule saves and JSON round trips, all four rule types, malformed source preservation, unsaved-change decisions, Settings and global search focus, explicit account configuration handoffs, and mobile source draft/removal behavior. Runtime fixtures exercise the real user-session HTTP updater with fictional installers: release checks, a single update click from a collapsed row, progress across navigation, verified completion, missing sign-in after installation, busy blocking, installer failure and retry availability, manual instructions, unavailable-runtime deep links, dark mobile layout and keyboard tab navigation. Existing runtime maintenance tests retain coverage for ownership checks, duplicate operations and queue reservations. No test updates an installed runtime or makes a provider inference request.

The interface review also applies the [Web Interface Guidelines](https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md): named controls, focus visibility, live async status, text overflow, reduced motion, URL-backed navigation and shared disclosure semantics.

## T3 comparison and follow-up

The November settings pass borrows T3's grouped navigation, clear row hierarchy, explicit scope and visible search destinations. It keeps Pitchcrew's clay materials and one-workspace model. General is condensed into appearance plus a two-row preference tray; the inaccurate cropped chat-width preview is removed. Heavy settings panels load on demand behind local loading/error boundaries. Scope uses this device for browser/desktop preferences and this workspace for data shared through the local daemon. Onboarding remains workspace state.

Autosave feedback follows the actual user-targeted control and verifies known device storage values, including failures immediately after a successful save. A storage failure uses the existing toast so the setting stays under the pointer. Repeated search results carry a fresh navigation token, wait for modal focus restoration, and reveal a temporary outline. Runtime hashes use validated known runtime IDs. Mobile sections use labelled regions rather than orphaned tab panels, and all settings buttons/disclosures/switches receive 44px minimum touch targets. Runtime maintenance sorts attention-needed installations first without changing launch, authentication, update or approval gates.

Detector key forms focus their first required field and return focus to the row action after closing; removing a key in another row preserves the open draft. Moving a background service explicitly warns when it immediately stops the other workspace's running service and interrupts its work.

## Contributor rules

App-wide settings live at `/settings`, with URL-backed General, Writing, Packet rules, Accounts, Job sources, Runtimes, Updates, Privacy and Local data sections. A 192px rail groups them under Preferences, Connections and System; desktop Base UI tabs move focus with arrows and activate on Enter/Space. Below 46rem of Settings width, a labelled shared Select replaces the rail and each panel is a labelled region. Content stays within 760px (Packet rules uses the full width). Heavy panels load on demand with a local loading/error boundary. General uses theme swatches and a recessed row tray for reading width and sound, with a separate workspace introduction action. Autosave confirmation follows the specific changed control; known device preferences must match persisted storage before showing Saved for two seconds. Failed device persistence shows a session-only notice and clears earlier confirmations. Find a setting (also `/` outside fields and overlays) and global search navigate to exact hashes, including repeated targets and runtime rows, then focus and visibly outline the target after modal focus restoration. Page and section copy distinguish this device (browser or desktop preferences) from this workspace (shared data on the computer running Pitchcrew). Accounts shows granted services and effective agent access, with Choose agents opening agent configuration without granting permissions. Job sources protects drafts and confirms removal while retaining leads. Runtimes leads with attention-needed rows (including failed updates whose CLI disappeared), keeps update/sign-in/assigned-agent facts visible, and puts automatic checks above the list; Check for updates becomes Recheck installations when release checks are disabled. Updates, errors and manual recovery commands remain visible across navigation. Packet rules retains Rules | Advanced JSON, a phone rule picker with focus recovery, inline accessible numeric errors, incomplete-draft summaries, malformed-source preservation, unsaved guards and pinned Save/Discard footer. Updates holds Pitchcrew and skill checks; Privacy holds analytics, diagnostics and replay consent. Settings controls use at least 44px targets on phones/coarse pointers. Theme and notification sounds retain their existing device preference stores and storage keys; the notification panel offers a synchronized sound shortcut. Audio unlock runs only while sounds are enabled and suspends after the final overlapping alert. Crew owns agent configuration. See [docs/settings-redesign.md](settings-redesign.md).
