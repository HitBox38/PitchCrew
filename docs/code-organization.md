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

Production TSX files have a maximum of 100 lines after formatting. `scripts/check-components.mjs` enforces this through `pnpm lint`. Extract sections with meaningful names and responsibilities; keep normal formatting and readable expressions. The limit applies to components, rather than forcing hooks, schemas or transactions into arbitrary fragments.

`App` owns the mounted workspace shell. Pages select workspace state and render their feature. `WorkspaceStore` owns snapshot polling, transient chat overlays and shared actions; route state remains in TanStack Router. Local form state belongs in the feature's hook. Pure helpers never call hooks, and action names do not start with `use`.

Shared domain labels, time formatting and role status live in `src/lib`. Primitive families keep their original public exports in `components/ui` and `components/ai-elements`. Internal sections can import the specific primitive they need.

## Styling

Use Tailwind utilities in feature JSX for ordinary flex/grid layout, spacing and responsive changes. Keep paper/clay materials, complex descendant selectors, Markdown formatting and shared motion in `src/styles`. Retain semantic class names when they identify materials, state or renderer smoke-test targets. Dynamic styles, such as card tilt and fit-meter widths, stay in Motion or inline styles.

`styles.css` establishes `theme`, `base`, `primitives` and `components` layers in that order. Shared UI and AI Elements defaults use the custom `primitive:` variant, including their state and responsive utilities. Feature CSS imports belong to `components`; global resets belong to `base`. Material controls inherit the app's typography in `components`, preserving their existing appearance above primitive defaults. Ordinary caller utilities remain unlayered and override both primitive defaults and feature materials without `!important`. For example, `<Button className="button h-12 px-2">` keeps the clay material while overriding its height and horizontal padding. `cn()` still resolves conflicts within each utility variant.

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
| HTTP         | Request security, chat streaming and route groups                                                               |
| Adapters     | Provider directories and shared process environment, health, prompts, launch and results                        |
| MCP          | Tool registration groups, scoped daemon client, computer driver and approval manager                            |
| Connectors   | Credential storage, status, HTTP, GitHub auth, Google auth/callback and service tool groups                     |
| Desktop      | Window/security setup and isolated renderer smoke verification                                                  |

Stateful backend facades hold a private context. Feature functions declare their context with a typed `this` parameter; the context factory binds those functions to one instance. This lets cooperating modules share a board and lifecycle state without exporting mutable global state. Transactions, event append/replay and exact-action approval consumption stay within their owning modules.

## Verification

Integration tests remain under each package's `test/` directory and are grouped by behavior. Shared fictional fixtures and setup/cleanup live in `test/helpers/`. Colocated feature tests use `__tests__`; Vitest discovers both layouts. Adapter tests mock native process launches so refactoring never requires live provider calls.

Run `pnpm check`, `pnpm format:check` and `pnpm test:desktop` after a broad refactor. The desktop check launches an isolated daemon and verifies the shared production renderer, demo chat streaming, router history, skill creation, role settings panels, sandbox and window chrome.
