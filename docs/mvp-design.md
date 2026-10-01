# MVP design

Pitchcrew is a personal job-search workbench. The same React renderer opens in a browser or a sandboxed Electron window; both use a daemon bound to 127.0.0.1.

Visual language: claymorphism merged with wabi-sabi. Surfaces are soft, puffy clay (an inner highlight from the top left, an inner shade and a diffuse drop shadow to the bottom right; inputs and tracks are pressed in). The canvas is warm washi paper with grain and fibre texture, radii are slightly asymmetric so nothing looks machine-perfect, and a kintsugi gold seam is the single decorative accent. Tokens: paper #f1eadd, clay surface #f7f2e9, ink #3a322b, muted #6b6054, terracotta #a65638 (actions only), moss #5b6c45 (success, Reviewer), aizome indigo #4c5f7e (Scout), plum #7d5470 (Writer), ochre #8f6420 (awaiting approval), gold #c39a3e (kintsugi). Typography: locally bundled Fraunces (soft, wonky axes) for headings and Source Sans 3 for body text. Left-aligned navigation and a spacious horizontal pipeline make application progress the main visual.

```
navigation | page heading / add opportunity
           | search / stage filters
           | pipeline columns / application cards
           | crew availability / recent board events
```

The board is the product's organizing structure. Cards show company, role, working arrangement, fit, owner, and the next useful action. A detail sheet contains the packet and immutable history. Empty states offer add-an-opportunity and explicitly labeled example-data actions. No fictional data is presented as a live job search.

Packages: core (contracts and transitions), board (SQLite events and projections), adapters (demo, Claude Code, Codex), packet (evidence validation and files), mcp (role-scoped tools), orchestrator (HTTP daemon and run scheduling), ui (shared renderer), desktop (Electron host).

UI interactions use shadcn/ui source components: buttons, text inputs, selects, checkboxes, tabs, dialogs, and side sheets. Radix provides focus trapping and keyboard behavior. Styling keeps the workbench identity through shared Tailwind theme tokens and scoped CSS. Fonts are bundled locally, with no third-party font requests.

Tooling uses Oxlint, Oxfmt, Vite's Oxc React transforms, and Rolldown. tsdown builds the Electron main process. TypeScript remains the type checker; ESLint and Prettier are absent.

MVP flow: add lead → scout evaluates → shortlist → writer drafts → reviewer requests changes or agrees → request local export approval → approve/reject → export packet. Track manually submitted applications and interviews. Export is deliberately local; there is no sending or submitting connector in the MVP.

Real runtime launches are explicit user actions. Provider CLIs receive isolated role folders and scoped MCP tools; their own sign-in stays with the CLI. No shared runtime sessions. Demo is deterministic and labeled. Scheduler support and automatic discovery are deferred.

Every card/crew/approval/run change appends a versioned event and updates its projection in one SQLite transaction. Old event decoders are retained. Approval tokens bind a card, exact packet snapshot, action, and digest; the MCP export gate consumes the token once. Agents have no approve tool. HTTP user mutations require a same-origin session and application header. Run capabilities expire when a run finishes.

Verification covers actual HTTP and MCP stdio flows using fictional sources, plus an isolated Electron/production-daemon smoke test with screenshot evidence. Packet lint validates registered source quotes and word limits; it does not prove the factuality of every free-form sentence. The full packet remains subject to independent review and user approval. Provider integrations have been checked against installed CLI help and mock process contracts, without spending tokens on live runs.
