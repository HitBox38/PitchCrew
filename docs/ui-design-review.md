# UI and motion review — October 2026

The review covered Board, Chat and Crew work, Crew settings and connectors, Skills and its editor, Inbox and packet/browser approvals, Profile, Activity, the sidebar, command palette, notifications, and the shared popup components. The direction preserves Pitchcrew’s paper surfaces, clay controls, Fraunces headings, and role colors while making hierarchy, editing, and motion more consistent.

## UI changes

| Before                                                                                           | After                                                                                                                                                                                       | Purpose                                             |
| ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| Expanded pipeline stages competed with the growing workspace navigation.                         | Stages start collapsed; sidebar header and footer keep their space.                                                                                                                         | Make the main pages and crew easier to find.        |
| Crew actions stacked, Demo looked like a CLI model, and unavailable runtimes dominated the page. | Related actions sit together, Demo reads “Scripted,” status reads “Ready,” and unavailable runtimes live in a collapsible list.                                                             | Put the crew’s work ahead of runtime setup.         |
| Skills search floated away from the library.                                                     | Search aligns with its content; tighter rows and result counts clarify filtering.                                                                                                           | Make a larger library easier to scan.               |
| Profile, role, and skill edits could disappear on close or navigation.                           | Dirty-edit guards cover closing, note switching, route changes, and leaving the page; confirmations focus “Keep editing.”                                                                   | Prevent accidental loss of work.                    |
| Profile gave little save feedback and long filenames could widen small screens.                  | Saved/unsaved state stays visible, filenames wrap, and notes use a wrapping layout.                                                                                                         | Support phone widths down to 320px.                 |
| Mobile Chat could push the composer below the viewport.                                          | The conversation fits the viewport; transcript and Crew work scroll independently.                                                                                                          | Keep writing and sending within reach.              |
| Activity exposed raw event/actor identifiers and lacked filters.                                 | Readable labels, bounded search, type filters, counts, and useful empty states; filters survive deep links.                                                                                 | Make history useful as the workspace grows.         |
| Inbox copy focused on packet exports; browser review led with raw action names and JSON.         | Copy covers browser actions and directs role/skill suggestions to Crew work. Browser approvals show the action, target, and exact value, with complete payload and page evidence available. | Help users understand the decision they are making. |
| Connector sign-in requests looked disconnected.                                                  | Pending sign-in has its own label; connection copy explains read-only access and mobile rows wrap.                                                                                          | Reflect the current connector workflow.             |

## Motion choices

| Before                                                                               | After                                                                                                                                                                 |
| ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Every page entrance shifted the whole workspace.                                     | Frequent navigation stays instant; the shell remains stable.                                                                                                          |
| Button presses mixed springs, hover lifts, and CSS transforms.                       | Brief interruptible CSS press feedback, with quieter hover shadows.                                                                                                   |
| Dialogs combined Motion entrances with Base UI exit keyframes.                       | Base UI owns state, focus, and unmounting; one CSS transition handles both directions. An explicit presence bridge preserves exits for conditionally mounted editors. |
| The command palette used decorative perspective motion.                              | Keyboard-driven command access is instant.                                                                                                                            |
| Menus and tooltips used generic keyframes.                                           | Short transitions originate from their triggers; consecutive tooltips and trigger-aligned selects stay instant.                                                       |
| Collapsible areas snapped open.                                                      | A 200ms height/opacity transition explains the relationship to following content.                                                                                     |
| Role/skill suggestions and completed approval cards disappeared abruptly.            | Brief fades and position layout transitions acknowledge decisions. Initial lists and approval-tab changes stay instant.                                               |
| Reduced-motion rules suppressed every transition yet left competing transform rules. | Surface movement and scaling are removed; occasional surfaces retain a short fade. Command access remains instant.                                                    |

Installed Emil Kowalski’s `emil-design-eng`, `animate`, `animation-vocabulary`, `find-animation-opportunities`, `review-animations`, and `improve-animations` into the local Codex skills directory. Their guidance informed the interaction frequency, easing, timing, trigger origins, and reduced-motion review. Source: [Emil’s skills](https://www.skills.sh/emilkowalski/skills).

## Critique and improvement passes

1. The initial audit found stale workflow copy, crowded navigation, disconnected controls, silent edit loss, and competing animation systems. The first implementation addressed those structural issues while retaining the existing visual identity.
2. A separate read-only motion review found reduced-motion specificity problems affecting sheets and the command palette. Stronger surface-specific exceptions now remove translation and keep the command palette instant. Nested dialog exit registration was checked against Motion’s presence lifecycle.
3. Interaction review found a persistent navigation bypass after discarding an edit on a search-only route change. Discarding now resolves only the current route transition and closes or resets the edited surface. Repeated edits remain protected.
4. Desktop verification exposed Base UI 1.8 resuming toast timers on mouse leave while keyboard focus stayed inside. The viewport suppresses that handler while keyboard focus remains, and the existing hover/focus/stack/navigation/dismissal checks pass.
5. Native visual captures found a remaining small-screen filename layout issue and an oversized Activity filter. The final pass added wrapping note controls, preserved mobile save feedback, and constrained the filter width. Browser approvals also received readable action summaries and decision feedback.

## Verification

- `pnpm check`: lint, TypeScript, 310 tests across 28 files, and UI/Electron production builds.
- `pnpm test:desktop`: actual Electron renderer, streaming demo chat, routing history, feature panels, notification history, toast interaction/stacking, and light/dark title-bar integration.
- All seven pages inspected in a fictional isolated workspace at 1440×900 light and 390×844 dark; Crew additionally checked at 980px and Profile at 320px. No document-level horizontal overflow remained in those checks. Chat’s composer stayed inside both desktop and phone viewports.
- Editor checks covered keep/discard, note switching, role-to-Skills navigation, skill saving, same-page command navigation, and a second dirty edit. “Keep editing” retained the entered text and received initial focus.
- Reduced-motion inspection measured a sheet with `transform: none` and a 120ms fade; command popup and overlay had zero transition duration.
- Fictional role suggestions and packet decisions were exercised in the renderer. Browser action review preserved the full multiline value and remained within the phone viewport; the final read-only motion critique found no remaining presence or reduced-motion blockers.
- Review fixtures and screenshots stayed outside the repository. Live provider inference, real connector authentication, and external submissions were not exercised.

The production build retains a warning for the existing large Chat/Markdown bundle. That is a separate loading-performance opportunity; this review focused on interaction and presentation.
