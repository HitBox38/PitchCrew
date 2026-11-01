# Pitchcrew design system

`@pitchcrew/design-system` owns the reusable React primitives and paper/clay theme used by the browser/Electron app and public Next.js landing page. It has no dependency on the app, workspace store, router, daemon or core job types. App-specific AI Elements compositions and job/workflow features remain in `packages/ui`.

This is a private Bun workspace package. It exports TypeScript source, so consumers compile it with their own bundler; there is no separate library build. React and React DOM are peers to keep a single renderer instance. Component families have client boundaries for Next.js; the `utils` entry stays usable in server code.

## Use in another workspace

Add `"@pitchcrew/design-system": "workspace:*"` to its dependencies, then import a component family:

```tsx
import { Button } from '@pitchcrew/design-system/button';
import { Input } from '@pitchcrew/design-system/input';
import { cn } from '@pitchcrew/design-system/utils';

<Button variant="secondary" className="h-12">
  Continue
</Button>;
```

Import the shared CSS once, at the start of the consumer's global stylesheet:

```css
@import '@pitchcrew/design-system/styles.css';
@import './site-theme.css';
@import './site-layout.css' layer(components);
```

The entry includes Tailwind 4's theme, preflight and utilities, the shared tokens/variants, primitive materials, transitions and an explicit source scan for this package's class names. Consumers keep their feature CSS and source scanning local. The `theme.css` export supplies tokens and variants alone for `@reference` in lazy stylesheets. Consumer theme overrides follow the shared import. Fonts are loaded by each app; defaults use Source Sans 3 and Fraunces Variable.

The cascade order is `theme`, `base`, `primitives`, `components`, then unlayered caller utilities. Defaults use `primitive:` so ordinary caller classes override them. Set `data-theme="dark"` on the document root for dark mode; theme persistence belongs to the consumer. Surface transitions respect reduced motion without requiring an app provider.

Families include buttons, inputs, textareas, checkboxes, switches, cards, badges, dialogs, sheets, menus, popovers, tooltips, tabs, accordions, collapsibles, command menus, calendar/time fields, sidebar, toasts and chat primitives (message, bubble, scroller, attachment, trace and code block). Import by family rather than through a single package-wide barrel. Prop types are exported with their families. Base UI composition uses `render`, and buttons default to `type="button"`.

Vite consumes the source package directly. Next.js consumers can list `@pitchcrew/design-system` in `transpilePackages`. Keep imports inside this package relative; the local `@/` generator alias is only for shadcn scaffolding, not a dependency on the desktop app's alias. Run shadcn from this directory when adding shared primitives and expose new families explicitly in `package.json`.

Root lint, typecheck, formatting and Vitest discovery include this package. The app's existing headless interaction tests exercise these primitives through the production Vite build; the landing production build also verifies the Next.js client/server boundary. See [code organization](../../docs/code-organization.md).
