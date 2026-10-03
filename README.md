# Pitchcrew

A local-first job-search workbench with a crew of role agents. Each role can use Demo, Claude Code, Codex, Gemini CLI, OpenCode, GitHub Copilot CLI, Cursor Agent, Goose, Kiro CLI, Grok Build, Pi, or oh-my-pi. The same shadcn-based React interface runs in a browser and a sandboxed Electron window.

**Status: working MVP.** Add opportunities, evaluate fit, draft and review packets, approve local exports, track your applications, and chat with each role or follow the crew conversation. See [AGENTS.md](AGENTS.md) for architectural invariants and [docs/mvp-design.md](docs/mvp-design.md) for design decisions.

## Run

Requires Node **22.18+ or 24.11+** (supported LTS lines) and **pnpm 11**. Windows is the verified development platform. Native SQLite and Electron dependencies may need build tooling if a prebuilt binary is unavailable.

```sh
pnpm install
pnpm dev
```

Open **http://127.0.0.1:4417**. Use the printed loopback address, including the port. The UI has hot reload; restart `pnpm dev` after daemon or adapter changes.

Open the desktop view with:

```sh
pnpm desktop
```

The desktop launcher reuses an existing daemon on the configured port, or starts one and stops it when the desktop app closes. Both views share the daemon's workspace.

For the built UI:

```sh
pnpm build
pnpm start
# Or launch the built UI in Electron:
pnpm desktop:prod
```

## Try the workflow

1. Choose **Try an example board** on the empty board for six fictional opportunities and a fictional profile, or add your own Markdown notes under **Your profile**. Demo drafting expects a name heading and factual bullet points.
2. Add an opportunity with its job description. Run **Evaluate fit**, then **Shortlist**.
3. Run **Draft application**, then **Review packet**. Inspect the resume, letter, form answers, note, source evidence, and history in the opportunity sheet.
4. Request export approval. In **Approval inbox**, inspect the exact packet, approve it, then export it. Generated PDFs and DOCX files have inline previews; DOCX browser layout may differ from Word. The complete source text is also available. The export directory appears in decision history.
5. Apply yourself, then record the manual submission and track screening, interviews, and outcomes.

**Demo makes no AI calls.** Its fit scores are keyword examples and its drafts reuse profile bullets; they need personalization before use. Loading examples is explicit and refuses to overwrite an existing profile.

In **Your crew**, choose **Create agent** for a guided setup: purpose and instructions, runtime/model, opt-in tools, saved skills, an optional first routine, and a final review. The flow works for any responsibilities. Role, skill assignments and routine save together; the first routine starts paused unless you enable it. Define a stable lowercase role ID, name and responsibilities. Each role has one runtime agent. Choose chat and scoped tools or an existing application workflow seat (evaluate fit, draft packets or review packets), then enable only the capabilities it needs. New roles start with crew actions and connectors disabled. Pause roles in settings or the sidebar; retirement requires confirmation, prevents future runs and edits, and keeps chat, skills, schedules and event history. Retired IDs cannot be reused. No additional roles are automatically created. See [configurable roles](docs/roles.md).

In **Your crew**, select a runtime, optional model, instructions, agent capabilities, and whether a role is enabled. Every real runtime uses the same searchable model picker with a CLI default option. Opening settings or changing the runtime loads its native model catalog where supported; results are cached for five minutes, and **Refresh models** forces a new check. The field labels runtime results and suggested fallbacks separately. Claude Code, Gemini CLI and Goose use curated suggestions; unavailable or failing runtimes also fall back to suggestions. Runtime catalogs reflect what the CLI reports, not a guarantee of model access. Changing runtimes resets the model to CLI default; Demo does not use a model. Provider-qualified choices save the full `provider/model` value, and existing saved model names remain visible even when outside the catalog. Real runtimes must already be installed on PATH with their native authentication configured. Health detection runs only `--version`; model discovery never starts a conversation or inference turn. Chat turns and workflow runs may use your provider account, including bounded agent-requested follow-ups. Real provider executions have not been exercised during automated verification. See [model discovery](docs/model-discovery.md) for runtime support.

Open **Skills** to add reusable Markdown instructions, edit their name, description or content, and delete them. Assign a skill to **All agents** or choose any stored active roles. Each skill shows who made it: its GitHub source owner, the agent behind a custom suggestion, or **You** for skills you create. Search by skill or creator, or filter by agent; individual agent views also show shared skills. Role settings show the skills that apply to that agent and link to the library. Every new chat or workflow run receives its assigned skills, including agent-requested follow-ups. Edits and deletion affect future runs; active runs keep their starting snapshot. Skills are stored in the local board with append-only history and copied into each run as `skills/<skill-id>/SKILL.md`. Managed skills use the shared runtime prompt, so they work even when a CLI’s ambient skill discovery is disabled. Demo stays deterministic. Choose **Import from skills.sh**, paste a public GitHub-backed skill URL such as `https://skills.sh/owner/repository/skill-name`, then **Load skill** to review its Markdown and choose its agents before saving. Imported skills show their source and offer **Load latest instructions** when editing; loading alone never updates the saved skill. Imports read public GitHub trees and immutable blobs without credentials or a CLI installer. Every load resolves the latest GitHub HEAD; only immutable blob contents are cached. Supplied hashes never select a version. Imports check up to 20 definitions with matching folders first. Only SKILL.md instructions are included; supporting scripts, assets, private repositories and non-GitHub sources are deferred.

The ten starter skills are loaded automatically on workspace startup: cover-letter, humanizer, resume-bullet-writer, unslop, view-pdf, article-writing, grilling, research, writing-fragments and writing-shape. Writing skills default to Writer, research and questioning to Scout, and humanizer/PDF review to Reviewer. Edit their content or assignment, or delete them on **Skills**; removed starters stay removed across restarts. Existing skills are preserved. New imports and startup loads always fetch the latest source, with no lockfile hash pinning. Catalog imports use the listed GitHub path; article-writing now uses its renamed repository, `affaan-m/ECC`, and the previous URL remains supported. Missing or offline sources appear on the Skills page with **Retry missing starter skills**; retries preserve deletions. view-pdf requires separate viewer tooling. Individual skills allow 50,000 characters, with a 60,000-character total per agent. **Starter skills → Import** can restore a removed skill manually. Set `PITCHCREW_SEED_SKILLS=0` to skip startup imports, including in isolated automated tests.

| Runtime                                                                                                        | Executable     | Model setting                                    |
| -------------------------------------------------------------------------------------------------------------- | -------------- | ------------------------------------------------ |
| Claude Code                                                                                                    | `claude`       | CLI model name, or empty for its default         |
| Codex                                                                                                          | `codex`        | CLI model name, or empty for its default         |
| [Gemini CLI](https://geminicli.com/docs/cli/headless/)                                                         | `gemini`       | CLI model name, or empty for its default         |
| [OpenCode](https://opencode.ai/docs/cli/)                                                                      | `opencode`     | `provider/model`, or empty for its default       |
| [GitHub Copilot CLI](https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-command-reference) | `copilot`      | CLI model name, or empty for its default         |
| [Cursor Agent](https://cursor.com/docs/cli/reference/parameters)                                               | `cursor-agent` | CLI model name, or empty for its default         |
| [Goose](https://block.github.io/goose/docs/guides/goose-cli-commands/)                                         | `goose`        | `provider/model`, or native environment defaults |
| [Kiro CLI](https://kiro.dev/docs/cli/acp/)                                                                     | `kiro-cli`     | CLI model name, or empty for its default         |
| [Grok Build](https://docs.x.ai/build/cli)                                                                      | `grok`         | CLI model name, or empty for its default         |
| [Pi](https://github.com/earendil-works/pi)                                                                     | `pi`           | `provider/model`, or empty for its default       |
| [oh-my-pi](https://github.com/can1357/oh-my-pi)                                                                | `omp`          | `provider/model`, or empty for its default       |

Gemini CLI uses per-run system settings to disable built-in tools, extensions, skills and hooks, and allow only Pitchcrew MCP. OpenCode uses an isolated configuration directory, a fresh session, `--pure` to disable external plugins, and permissions that deny every tool except `pitchcrew_*`. Automatic session sharing is disabled. OpenCode's user configuration (including custom provider definitions) is not loaded; built-in providers use the CLI's existing sign-in or environment configuration. These adapters target Gemini CLI 0.62 and OpenCode 1.18; older versions may need an upgrade. Neither adapter reads or copies provider credentials.

GitHub Copilot CLI receives an isolated `COPILOT_HOME`, only `pitchcrew/*` tools available, built-in MCP disabled, hooks disabled in run settings, and session export disabled. Its native keychain or native authentication environment must supply sign-in; fallback tokens stored in the user's Copilot configuration file are not imported. This adapter targets Copilot CLI 1.0.91.

Cursor Agent receives isolated CLI settings and project MCP configuration, an explicit permission allowlist for `Mcp(pitchcrew:*)`, and denials for shell, file reads/writes and web fetching. It runs without `--force` or automatic tool review. MCP server approval permits connection; it does not bypass tool permissions. Cursor Agent 2026.09.26 or newer is required: older builds do not isolate global MCP discovery, so they appear unavailable with upgrade instructions. Native credential/data locations remain unchanged. Runtime-managed enterprise policies and account extensions remain subject to the runtime's behavior.

Goose uses an isolated `GOOSE_PATH_ROOT` and an explicit recipe containing only Pitchcrew MCP, with no saved session. Its user configuration, plugins and hooks are not imported. Set the model to `provider/model` using `openai`, `anthropic`, `google`, `ollama` or `openrouter`; alternatively, set `GOOSE_PROVIDER` and `GOOSE_MODEL` in the daemon environment. Providers that launch another agent CLI are excluded because they can expose tools outside this recipe. Native keyring/environment authentication stays with Goose; file-based credentials in the user configuration are not imported. This adapter targets Goose 1.44.0.

Kiro CLI runs one fresh ACP session using the V2 engine and an isolated `KIRO_HOME`. The generated custom agent exposes and trusts only `@pitchcrew/*`, disables external MCP discovery and powers, and has no resources or hooks. Pitchcrew declines ACP permission requests and provides no filesystem or terminal client capabilities. Configure native headless authentication using `KIRO_API_KEY` in the daemon environment; existing login files are not imported. This adapter targets Kiro CLI 2.26.1. See [Kiro headless authentication](https://kiro.dev/docs/cli/headless/).

Grok Build uses an isolated `GROK_HOME`, a fresh headless session and only its native MCP search/call helpers. Only Pitchcrew MCP is configured and permitted; native file reads (including file-backed MCP arguments) are denied. Built-in shell, editing, web and subagent tools are excluded, and memory, compatibility discovery and automatic updates are disabled. Set `XAI_API_KEY` in the daemon environment; existing login files are not imported. The adapter requires the official xAI Grok Build CLI 1.0.45 or newer.

Pi requires version 1.0.0 or newer from the current `earendil-works/pi` project, which includes native MCP support. It receives an isolated `PI_CODING_AGENT_DIR` and loads only the built-in MCP extension with direct Pitchcrew tool exposure. Built-in tools, ambient extensions, skills, prompt templates, context files and session persistence are disabled. Older Pi packages without native MCP support appear unavailable with upgrade instructions.

oh-my-pi requires `omp` 18.4.9 or newer. It receives isolated configuration and data paths, waits for Pitchcrew MCP discovery, and exposes the five application MCP tools plus the three browser tools when computer use is enabled. Ambient plugins, foreign configuration discovery, native tools, rules, skills, memory and auto-learning are disabled. On Windows, the Pitchcrew data directory must be on the same drive as the user home so OMP's native configuration-root resolution can isolate the run.

Pi and oh-my-pi inherit their CLI's native provider authentication environment (for example, `ANTHROPIC_API_KEY` or `OPENAI_API_KEY`). User auth files, OAuth login files and custom provider configuration are not imported. Leave the model empty for the runtime's default or use `provider/model`. Pitchcrew never reads, copies or stores these credentials.

These integrations have subprocess contract coverage; live provider runs have not been verified.

## Connect GitHub and Google Workspace

In **Your crew → Connected accounts**, connect GitHub with a fine-grained token or Google Workspace with Desktop OAuth browser sign-in. Then enable GitHub, Gmail, Drive/Docs, Calendar or Sheets in each role’s settings. Access defaults to disabled. Agents can use these read-only MCP tools for company research, portfolio evidence, recruiter email and interview preparation in both chat and card workflows. Sending mail, editing files and posting still require future approval-gated tools. See [connector setup and available tools](docs/connectors.md).

## Chat with your crew

Open **Chat** or click a role in the sidebar. Talk privately with any stored role, or join the **Crew conversation** to see agent messages and handoffs. Attach a job to give a turn application context. AI Elements provides the conversation, Markdown messages and composer in Pitchcrew’s visual style.

Replies appear as the runtime produces text, including replies to other agents in the crew conversation. Streaming uses native CLI updates: Claude Code and Cursor provide text deltas; runtimes such as Codex `exec` and OpenCode may provide complete message items instead. Live previews become saved messages only after the turn succeeds. **Stop** clears unfinished replies, and reconnecting restores active previews.

Runtimes can use their exposed board-backed tools to message another agent, invoke themselves or another role, shortlist the attached lead, request packet changes, and queue drafting/review runs. Every exchange and task is visible in chat. Follow-ups wait for the current turn to finish and are limited to six per user-started chain; **Stop** cancels that chain. Paused roles and disabled capabilities are enforced by the daemon. Demo chat is scripted and does not reason or call tools.

Open **Routines** to create a one-time action or a repeating task for an agent. Choose a start time and timezone, an elapsed interval or a daily/weekday/weekly/monthly pattern, and optionally a total run limit or end date. Custom five-field cron expressions support other calendar patterns. Edit, pause, resume or delete schedules from the page, or ask an agent in chat, for example: "Every weekday at 9 AM, review my applications for two weeks." Agents can manage routines for themselves or delegate to another agent using scoped tools. **Create, edit and delete scheduled actions** controls this capability; targeting another role also requires **Invoke itself and other roles**. Each occurrence starts a fresh chat turn with current settings and skills. Schedules persist across restarts and run only while the local daemon is open; busy/paused roles wait, and overdue repeats coalesce into one run. Deleting leaves history and any active run intact. Outward actions still require their existing approvals. Demo remains scripted. See [routines](docs/routines.md) for timing, permissions and restart behavior.

Agents can propose changes to their own instructions or capabilities. Inspect the proposed values in chat and choose **Apply changes** or **Decline**. Applying waits for that role’s active runs to finish. Agents cannot apply these changes themselves or approve exports. With opt-in capabilities they can assess inspected form requirements and capture submission evidence; users verify the outcome. They can also discuss skills with you or each other and suggest adding a custom Markdown skill or a public GitHub-backed skills.sh URL. Open **Crew work → Suggested skills** to inspect the reason, assignment, source and full instructions, then choose **Add skill** or **Decline**. Each run can make at most three skill suggestions. Adding a suggestion saves the exact reviewed snapshot for future runs; it does not fetch a new upstream version.

## Use a local browser

Install Chromium with `pnpm browser:install`, then enable **Computer use** in a role's settings. Ask the agent to work on an application in chat. It opens a dedicated browser on this computer and can inspect pages, navigate, fill fields, select options, press keys, click and upload exact exported Markdown/PDF/DOCX packet files. Review every interaction in **Inbox**, including the final submit click. Approvals bind the exact action and current page, work once, and expire when the run ends. Sign in manually in the dedicated window when needed. Attach the job card for packet uploads. Enable **Assess inspected application forms** to save actual controls, required flags and file formats on the job, with missing answers and explicitly unknown sections. Enable **Record approved submission attempts and evidence** for purpose-marked submit clicks/Enter actions linked to the current exported packet. Uncertain outcomes block further interactions until you verify the captured website confirmation or provide your own external verification, or verify no submission occurred. See [computer use](docs/computer-use.md) for tools, boundaries and limitations.

## Pull profile notes from GitHub or Google Drive

Open **Profile** and choose **GitHub** or **Google Drive**. Connect your account on that page, choose a folder, review its documents, and import the facts you want your crew to use. Account connections are shared with Crew settings; importing your profile does not enable connector access for any role.

For a resume repository, start with its factual source folder, such as `about-me`, with background notes, work experience and one Markdown file per project. GitHub imports nested Markdown/text files at a single commit. Add another source for a `general` folder if you also keep a baseline resume there. Writing skills and tailored application packets belong in their own workflows.

Drive imports nested folders containing Google Docs, Markdown and plain text. Paste a Drive folder link or ID. PDFs, shortcuts and other binary formats are skipped.

Imported documents remain separate local profile notes with source paths, links, revisions and content hashes. **Review updates** loads a fresh preview; new and changed documents are selected by default, while locally edited notes require explicit selection before replacement. Removed upstream documents remain local. Removing a source keeps its notes and leaves the account connected. Previews expire after ten minutes and after daemon restart; importing uses the reviewed snapshot without fetching again. Each source is bounded to 100 documents, 30 folders, 50,000 characters per document and 1 million characters in total. Profile updates wait until active runs finish.

## Your data

By default, everything is stored outside the repository:

```text
~/.pitchcrew/
  pitchcrew.db                    # SQLite projections and append-only event log
  connectors/credentials.json    # local GitHub/Google connector credentials
  profile/*.md                   # factual source notes
  profile-sources.json           # reviewed import provenance and source configuration
  roles/<role>/AGENTS.md          # instructions managed in Crew settings
  roles/<role>/CLAUDE.md          # imports AGENTS.md
  roles/<role>/runs/<run-id>/     # isolated runtime working folders
    skills/<skill-id>/SKILL.md    # snapshots of assigned Markdown skills
  packets/<card-id>/try-*/        # Markdown packets, claims.json and approved PDF/DOCX artifacts
```

Runtime MCP configuration is passed per run. Pitchcrew does not read or store provider credentials. To keep a demo separate, use PowerShell before starting the daemon:

```powershell
$env:PITCHCREW_HOME = "$env:USERPROFILE\.pitchcrew-demo"
$env:PITCHCREW_PORT = '4418'
pnpm dev
```

`PITCHCREW_HOME` must be outside this repository. Manage skills through the Skills page. Edit role instructions through Crew settings; the daemon regenerates instruction files from stored settings on startup. Profile files can also be edited directly while no roles are running.

## Architecture

| Package        | Responsibility                                                                                                                               |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `core`         | Strict TypeScript contracts, Zod validation, card transitions, connector capabilities                                                        |
| `board`        | SQLite event log, projections, exact-payload approval tokens and browser action approvals                                                    |
| `orchestrator` | Loopback daemon, chat/workflow launches, bounded crew tasks, persistent routines, scoped capabilities                                        |
| `adapters`     | Demo and native CLI/ACP runtime integrations                                                                                                 |
| `mcp`          | Official SDK stdio server, card/profile/chat/workflow tools, proposals, read-only connectors, approval-gated export and browser interactions |
| `packet`       | Source-quote and word-cap checks, versioned Markdown files                                                                                   |
| `ui`           | React, shadcn/ui, AI Elements, Tailwind, locally bundled fonts, Vite                                                                         |
| `desktop`      | Sandboxed Electron host for the shared renderer                                                                                              |

Agent application tools are scoped to the attached card; conversation reads are scoped to the role’s own chat and the shared crew chat. Messages, proposals and follow-up tasks are persisted in the board. Agents cannot approve actions, apply their own role changes, or use another role's runtime session. Approval binds the exact packet and is consumed once in the MCP export gate. A revised packet requires a fresh approval. The daemon recovers interrupted runs, releases their card claims, and marks interrupted queued tasks failed after restart.

The UI polls the daemon every two seconds. HTTP APIs use a local session, application header, origin checks, and host checks. Production assets use a content security policy. Electron disables Node integration, isolates the renderer, and denies permissions and external navigation.

See [Code organization](docs/code-organization.md) for feature folders, component boundaries and backend module ownership.

## Tooling and verification

**Oxlint** replaces ESLint, and **Oxfmt** handles formatting. Vite 8 / its React plugin use Oxc transforms and Rolldown; **tsdown** builds the Electron main process with Rolldown. TypeScript remains the type checker.

```sh
pnpm lint
pnpm format
pnpm format:check
pnpm typecheck
pnpm browser:install # install Chromium once for browser tools and tests
pnpm test
pnpm build
pnpm check          # lint, typecheck, tests, build
pnpm test:desktop   # built UI + isolated Electron renderer/daemon smoke test
```

Tests use fictional fixtures and temporary workspaces. They cover transitions, append-only history and projection replay, stale/reused approvals, evidence checks, concurrent claims, cancellation, HTTP boundaries, mock CLI parsing, and the real MCP stdio connection. They make no paid provider calls. The desktop test sends a demo chat through the production renderer and saves a screenshot and JSON evidence in a temporary directory.

## MVP boundaries

Discovery is manual. Roles launch from user chat/workflow actions, persistent routines and bounded crew follow-ups. Exports are local Markdown and optional PDF/DOCX files: there is no email sender, bespoke one-page builder, OS/background scheduler or automatic Coach installation. Users can enable batch pipeline reviews and schedule them through ordinary routines while Pitchcrew is open. Role-scoped browser interactions can submit forms with individual user approvals. Desktop installers, auto-updates and further runtimes are deferred.

Packet lint checks registered claims against exact source quotes and enforces word caps. It cannot prove every free-form sentence is factual; the independent reviewer and the user still need to inspect the complete packet.

Choose the document format on a reviewed job before requesting export approval. Inbox previews the exact generated PDF and the complete DOCX source text, with byte digests. Approved export writes the frozen files; downloads become available after export. Unsupported PDF characters fail explicitly; choose DOCX for Unicode. Documents render literal Markdown as text and never execute HTML or fetch embedded links.
Pipeline review prerequisites are available through opt-in crew capabilities: bounded batch evidence, every-seat assessments, measurable follow-ups and explicit user approval for targeted role changes. No Coach agent or routine is added automatically. See [pipeline reviews](docs/pipeline-reviews.md).
