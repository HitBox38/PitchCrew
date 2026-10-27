# Code organization

Pitchcrew keeps its existing package boundaries. Within each package, files follow the responsibility they implement so a reader can find a feature without scanning an entire application file.

## React features

A feature uses this structure, with only the files it needs:

```text
ComponentName/
  index.tsx         # public component; assembles named sections
  components/       # focused child components
  hooks/            # state, effects, subscriptions and event handlers
  __tests__/        # tests of observable behavior
  helpers.ts        # pure calculations and transformations
  api.ts            # feature-specific HTTP operations
  types.ts          # props and domain contracts
  constants.ts      # stable configuration and options
```

Files that contain JSX use `.tsx`, including helpers or constants when needed. A child with substantial state or several sections can have its own feature folder, as `SkillsView/components/SkillEditor` does. Avoid empty files and directories.

Production TSX files have a maximum of 100 lines after formatting. `scripts/check-components.ts` enforces this through `bun run lint`. Extract sections with meaningful names and responsibilities; keep normal formatting and readable expressions. The limit applies to components, rather than forcing hooks, schemas or transactions into arbitrary fragments.

`App` owns the mounted workspace shell. Pages select workspace state and render their feature. `WorkspaceStore` owns snapshot polling, transient chat overlays and shared actions; route state remains in TanStack Router. Local form state belongs in the feature's hook. Pure helpers never call hooks, and action names do not start with `use`.

`App/components/WorkspacePage.tsx` gives standard routes a viewport-height paper frame, compact title header and scrolling body. Feature actions use `WorkspaceHeaderActions` to render in that header while their state stays in the feature. Chat and Profile keep their dedicated workspaces. Shared frame materials and editor density live in `styles/workspace-frame.css`; its body defaults use `:where()` so each feature can establish its own independent panes and scrolling without specificity overrides.

Shared domain labels, time formatting and role status live in `src/lib`. Primitive families keep their original public exports in `components/ui` and `components/ai-elements`. Internal sections can import the specific primitive they need.

App disclosures use the shared shadcn/Base UI controls: `Accordion`/`AccordionItem`/`AccordionTrigger`/`AccordionContent` for grouped rows, `AccordionSection` for a standalone expandable section, and `Collapsible` for custom trigger layouts. Never use native `<details>`/`<summary>` in `packages/ui/src` or recreate their behavior with ad hoc buttons; `bun run lint` enforces the native-element restriction. `AccordionSection` composes the shared accordion, accepts `heading`, `defaultOpen`, `onOpenChange` and trigger/content classes, and keeps its content mounted so closing a form preserves drafts. Use `multiple` for independently expandable grouped rows. Preserve initially open sections and defer document preview resources until expansion. Disclosure styles target the shared `data-slot` and Base UI state attributes, not native `summary` or `[open]` selectors. The standalone public landing page is outside this app-only lint rule.

## Styling

Use Tailwind utilities in feature JSX for ordinary flex/grid layout, spacing and responsive changes. Keep paper/clay materials, complex descendant selectors, Markdown formatting and shared motion in `src/styles`. Retain semantic class names when they identify materials, state or renderer smoke-test targets. Dynamic styles, such as card tilt and fit-meter widths, stay in Motion or inline styles.

`styles.css` establishes `theme`, `base`, `primitives` and `components` layers in that order. Shared UI and AI Elements defaults use the custom `primitive:` variant, including their state and responsive utilities. App and landing base layers default border colors to the theme hairline, including pseudo-elements; border-bearing primitive recipes also specify their color explicitly. Feature surfaces use paper edges and recessed document wells, while actionable attachments use clay. Keep warning/error borders and keyboard focus explicit. Shared buttons, fields, checkboxes and switches supply the app's materials by default; a `.form` wrapper supplies label layout rather than being required for themed controls. Feature CSS imports belong to `components`; global typography resets belong to `base`, below each control's type recipe. Focus outlines in `components` remain visible when a feature's material shadow replaces the primitive focus ring. Ordinary caller utilities remain unlayered and override both primitive defaults and feature materials without `!important`. For example, `<Button className="button h-12 px-2">` keeps the clay material while overriding its height and horizontal padding. `cn()` still resolves conflicts within each utility variant.

Chat-specific material files load through `styles/chat.css` with the lazy Chat route. That entry references `styles/theme.css` for responsive variants and imports its feature files into the existing `components` layer. Keep shared controls, tokens and workspace materials global so deep links and sheets retain their styles.

Keep the Tailwind utility import unlayered: nesting it in `utilities` would emit `primitive:` into `utilities.primitives`, above the feature material layer. Group and peer marker classes stay unprefixed because they identify the elements targeted by variants. New shared primitive defaults must use `primitive:`; feature `className` overrides use ordinary utilities.

Register reusable colors, shadow recipes, easing and typography in `styles/theme.css` with `@theme inline`. CSS can reference the same tokens directly. The named `phone`, `narrow`, `compact`, `chat` and `wide` thresholds preserve the existing feature layouts; `md` remains the sidebar's 768px desktop boundary, matching `useIsMobile`. Remaining feature CSS uses `@variant max-compact`, for example, rather than repeating a media-query number. Oxfmt sorts utility classes using the actual stylesheet and recognizes `cn`, `clsx` and `cva`.

Keep custom typography, shadow and easing names registered in `lib/utils.ts` as well, so `cn()` distinguishes sizes and shadow recipes from color utilities. `.gitattributes` keeps Oxfmt's LF endings consistent across platforms.

## Backend modules

Public package entry points retain the existing application API. Private modules separate responsibilities without changing event formats or approval boundaries:

| Area         | Modules                                                                                                         |
| ------------ | --------------------------------------------------------------------------------------------------------------- |
| Core         | Card, packet, role, skill, chat, run, runtime, event and workspace contracts                                    |
| Board        | Events and replay, cards, approvals, role seeding and database context                                          |
| Orchestrator | Crew lifecycle, models, skills, roles, cards, workflows, chat, proposals, tasks, scoped gateway and job sources |
| Background   | Per-platform service definitions, an injectable service host, daemon lock and launcher ownership                |
| HTTP         | Request security, chat streaming and route groups                                                               |
| Adapters     | Provider directories and shared process environment, health, prompts, launch and results                        |
| MCP          | Tool registration groups, scoped daemon client, computer driver and approval manager                            |
| Connectors   | Credential storage, status, HTTP, GitHub auth, Google auth/callback and service tool groups                     |
| Desktop      | Window/security setup and isolated renderer smoke verification                                                  |

Background service code in `orchestrator/src/background/` renders each definition as a pure function and sends every schtasks, launchctl and systemctl call and file write through a `ServiceHost`. Tests supply a simulated host, so they assert exact definitions and commands without touching the operating system.

Stateful backend facades hold a private context. Feature arrow functions take their typed context as the first argument; the context factory closes over one instance and passes it explicitly. This lets cooperating modules share a board and lifecycle state without exporting mutable global state. Transactions, event append/replay and exact-action approval consumption stay within their owning modules.

## Verification

Integration tests remain under each package's `test/` directory and are grouped by behavior. Shared fictional fixtures and setup/cleanup live in `test/helpers/`. Colocated feature tests use `__tests__`; Vitest discovers both layouts. Adapter tests mock native process launches so refactoring never requires live provider calls.

Run `bun run check`, `bun run format:check` and `bun run test:desktop` after a broad refactor. The desktop check launches an isolated daemon and verifies the shared production renderer, demo chat streaming, router history, skill creation, role settings panels, sandbox and window chrome.
