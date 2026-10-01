# MVP design

Pitchcrew is a personal job-search workbench. The same React renderer opens in a browser or a sandboxed Electron window; both use a daemon bound to 127.0.0.1.

Visual language: claymorphism and wabi-sabi used as materials rather than decoration. Paper: the page, sheets and documents are flat rice paper with grain and hairline edges. Clay: only things you press (buttons, job cards, the active tab or nav item, the select) have volume; pipeline columns are trays pressed into the paper. Wabi-sabi: natural dye colours, radii a hair off symmetric, and no ornaments, slogans or fake controls. Copy is plain and specific, and summaries come from board data. Tokens: paper #f2f1ec, surface #f8f7f3, sumi ink #2b2d31, muted #61646b, aizome indigo #3a5482 (actions only), teal #2f6a69 (Scout), plum #76517a (Writer), moss #53673d (success, Reviewer), ochre #82601c (awaiting approval), rose #9f4757 (closed). Dark mode follows the system by default; a System / Light / Dark switch in the sidebar overrides it and is remembered in the browser. public/theme.js applies the choice before the first paint, and every colour, shadow and texture is a token redefined under :root[data-theme='dark'], so clay keeps a faint top-left rim and the dyes are lifted for contrast. Typography: locally bundled Fraunces for headings and Source Sans 3 for body text. Left-aligned navigation and a spacious horizontal pipeline make application progress the main visual.

```
sidebar (shadcn)            | toggle · running roles
  search ⌘K · new job N     | page heading + data summary / add job
  board › stages · crew …   | pipeline / closed toggle, filter
  crew status · actions     | pipeline trays / job cards
  recently opened           | recent board events
  theme · data folder       |
```

The board is the product's organizing structure. Cards show company, role, location and salary, fit, owner or state. A detail sheet contains the packet and immutable history. Empty states offer add-an-opportunity and explicitly labeled example-data actions. No fictional data is presented as a live job search.

Packages: core (contracts and transitions), board (SQLite events and projections), adapters (demo, Claude Code, Codex), packet (evidence validation and files), mcp (role-scoped tools), orchestrator (HTTP daemon and run scheduling), ui (shared renderer), desktop (Electron host).

The sidebar is the shadcn Sidebar: it collapses to an icon rail with tooltips (⌘B/Ctrl+B, the toggle or the edge rail), remembers that state in a sidebar_state cookie, and becomes a sheet below 768px. It holds search (a cmdk command palette over views, jobs, roles and actions, ⌘K/Ctrl+K), new job (N), workspace navigation with counts and a collapsible list of pipeline stages that scroll to and highlight their column, crew status with a Configure / Pause menu, recently opened jobs (kept in localStorage), a theme menu, and the data folder with copy-path. UI interactions use shadcn/ui source components: buttons, text inputs, selects, checkboxes, tabs, dialogs, side sheets, sidebar, command, dropdown menus, tooltips and kbd. Base UI (@base-ui/react) provides focus trapping and keyboard behavior. Styling keeps the workbench identity through shared Tailwind theme tokens and scoped CSS. Fonts are bundled locally, with no third-party font requests.

Tooling uses Oxlint, Oxfmt, Vite's Oxc React transforms, and Rolldown. tsdown builds the Electron main process. TypeScript remains the type checker; ESLint and Prettier are absent.

MVP flow: add lead → scout evaluates → shortlist → writer drafts → reviewer requests changes or agrees → request local export approval → approve/reject → export packet. Track manually submitted applications and interviews. Export is deliberately local; there is no sending or submitting connector in the MVP.

Real runtime launches are explicit user actions. Provider CLIs receive isolated role folders and scoped MCP tools; their own sign-in stays with the CLI. No shared runtime sessions. Demo is deterministic and labeled. Scheduler support and automatic discovery are deferred.

Claude Code, Codex, Gemini CLI and OpenCode implement the same adapter contract. Gemini CLI receives per-run system settings that disable built-in tools, extensions, skills and hooks and allow only the Pitchcrew MCP server. OpenCode receives isolated configuration and a fresh primary agent with deny-by-default permissions, only Pitchcrew MCP tools allowed, external plugins disabled and session sharing disabled. Its credential data directory stays with the CLI; user config and custom provider definitions are not imported. Adapter contract tests use fictional subprocesses without provider calls.

Every card/crew/approval/run change appends a versioned event and updates its projection in one SQLite transaction. Old event decoders are retained. Approval tokens bind a card, exact packet snapshot, action, and digest; the MCP export gate consumes the token once. Agents have no approve tool. HTTP user mutations require a same-origin session and application header. Run capabilities expire when a run finishes.

Verification covers actual HTTP and MCP stdio flows using fictional sources, plus an isolated Electron/production-daemon smoke test with screenshot evidence. Packet lint validates registered source quotes and word limits; it does not prove the factuality of every free-form sentence. The full packet remains subject to independent review and user approval. Provider integrations have been checked against installed CLI help and mock process contracts, without spending tokens on live runs.
