# Pitchcrew

Pitchcrew is a local-first job-search app with a crew of AI agents. Keep opportunities on a board, give the crew your background notes, and work through fit assessment, application drafts, review and follow-up in one workspace.

It runs in your browser or an Electron desktop window. Your board, profile, chats and packets stay on this computer; AI runs use the CLI runtime and provider account you configure.

Production installations send anonymous page visits and feature usage to Pitchcrew's PostHog project. Opt out in **Settings > General > Usage analytics**. App content is excluded and sessions are never recorded. Development analytics is disabled by default. See [analytics configuration](docs/analytics.md).

**Status: working MVP.** The application workflow, crew chats, scheduled routines, read-only account connectors and approval-gated browser tools are implemented. Automated tests use fixtures and mock runtimes; live provider runs are not verified by that suite.

## What you can do

- **Find openings.** Save public Greenhouse, Ashby, Lever, Comeet and Workable job boards with title and location filters. Scans add new matching postings as leads and skip jobs already on the board, including ones you withdrew. Scout can scan on a schedule when you allow it.
- **Prepare applications.** Scout evaluates fit, Writer drafts a packet, and Reviewer checks it against your profile. Packets include a resume, cover letter, form answers, notes and supporting claims.
- **Build your crew.** Customize agents, mix runtimes, assign Markdown skills, and chat privately or in the shared crew conversation. Agents can hand off work through the board when their permissions allow it.
- **Apply with oversight.** Review and approve local Markdown, PDF or DOCX exports. An optional local browser can inspect application forms, fill them and submit with approval for each interaction.
- **Track progress.** Record submissions, interviews and outcomes, including applications made outside Pitchcrew. With Gmail access, Tracker can reconcile supported status updates and flag uncertain matches for review.
- **Learn from outcomes.** Rate how each application went, note lessons, and see outcomes, weights and lessons by tag on **Insights**. Merge duplicate tags, and mark silent applications as no response after you review a preview. Agents with application or pipeline access read these signals before they write; only you can change them. See [insights](docs/insights.md).
- **Maintain your background.** Import profile notes from GitHub or Google Drive. Documenter can watch selected sources and propose updates for your review.
- **Review the process.** Pipeline Coach can assess batches of applications and propose changes to the crew. Routines can schedule scans, reviews and other agent tasks while Pitchcrew is running.

## Quick start

Download a production installer from [GitHub Releases](https://github.com/HitBox38/PitchCrew/releases): Windows x64 (`.exe`), macOS Apple Silicon or Intel (`.dmg`), or Linux x64 (`.AppImage`/`.deb`). Installers include Node.js, the daemon, its dependencies and Chromium; configure provider CLIs and authentication separately. Windows and macOS builds are unsigned and macOS builds are not notarized, so your operating system may require permission to open them. Each successful push to `main` publishes a commit-tagged release after CI and packaged-app checks pass. Existing data stays in `~/.pitchcrew`.

For development from source:

Requires **Node.js 22.18+ or 24.11+** (supported LTS lines) and **pnpm 11**. Windows is the verified development platform. Native SQLite and Electron dependencies may need build tools if prebuilt binaries are unavailable.

```sh
pnpm install
pnpm dev
```

Open **http://127.0.0.1:4417**. Use the printed loopback address and port. The UI reloads as you edit it; restart the daemon after backend or adapter changes.

For the desktop window:

```sh
pnpm desktop
```

The launcher reuses an existing daemon or starts one. A daemon started by the launcher stops when the window closes. If the background service is installed, the launcher starts it instead and leaves it running. Browser and desktop views connected to the same daemon share a workspace.

For the built UI:

```sh
pnpm build
pnpm start
```

Or run `pnpm desktop:prod` to build and launch it in Electron.

### Run in the background

Routines run only while a daemon is open. To start the production daemon at login without a window, build the UI and install the per-user background service:

```sh
pnpm build
pnpm service install
```

It uses Task Scheduler on Windows, a LaunchAgent on macOS and a systemd user unit on Linux, without administrator rights. `pnpm service status`, `start`, `stop`, `logs` and `uninstall` manage it, and **Settings > Local data** shows its state. Only one daemon runs per data folder. See [background service](docs/background-service.md).

### Explore without an AI account

Development mode includes **Demo**, a deterministic runtime that makes no AI calls. On an empty board, load the example board to try six fictional opportunities and a fictional profile. Examples refuse to overwrite an existing profile; use a separate data folder if you already have one.

Demo and example loading are available only when the daemon uses `--dev`, as with `pnpm dev` or a daemon started by `pnpm desktop`. Demo scores and drafts are scripted examples.

### Set up a real workspace

Fresh workspaces show an introduction and setup checklist. You can defer setup and reopen **Getting started** from the sidebar.

1. **Add your background in Profile.** Write factual Markdown notes or import a reviewed folder from GitHub or Google Drive.
2. **Configure agents in Crew.** Choose an installed runtime, optional model and permissions. Enable an agent for each workflow seat: fit assessment, drafting and review.
3. **Add a job on Board.** Save its description and URL, then start the workflow below. Or add job sources in **Settings > Job sources** and choose **Scan now**.

New production workspaces start with paused Claude Code agents. Development defaults use Demo. Existing agent settings are preserved; Demo agents cannot run in production until you select a real runtime.

## From opportunity to application

1. **Evaluate fit**, then decide whether to **Shortlist** the job.
2. **Draft application**, then **Review packet**. Inspect the full text and source evidence; request changes when needed.
3. Choose Markdown, PDF and/or DOCX and a layout, then **Request export approval**.
4. In **Inbox**, review the exact files, approve the export, then export them locally. A changed packet needs a fresh approval.
5. Apply yourself and record the submission, or use the approved browser workflow. Track screening, interviews and outcomes on the same card.

PDF and DOCX exports use the **Formatted** layout by default. It turns Markdown headings, bold and italic text, lists and links into a one-column document with clickable blue links. The resume gets tight margins and 10 point text for a one-page fit. Pandoc frontmatter and LaTeX spacing commands such as `\vspace{-8pt}` are left out. **Plain text** prints the Markdown literally, as earlier versions did. Inbox previews every document and shows its page count. It warns when a resume runs past one page. PDF names any character its font cannot show, while DOCX preserves Unicode. DOCX layout may differ in Word. See [packet exports](docs/packet-exports.md).

**Settings > Packet rules** holds your own mechanical house rules, such as word limits, bullets per job, exact employer headers and banned phrases. Errors block drafts, reviews and exports; warnings appear in review notes. See [packet rules](docs/packet-rules.md).

You can also register an application you already submitted elsewhere, with its submission time and confirmation note, without generating a packet. See [application tracking](docs/tracking.md).

Moving from another tracker? **Import applications** on Board takes a JSON or CSV file of up to 1,000 past applications with their statuses, dates, tags and notes. You review a preview of every row (new, duplicate or invalid) before anything is saved, and importing the same file again skips rows already imported. `node scripts/convert-legacy-tracker.mjs <tracker.db> <applications.json>` converts a legacy SQLite tracker into that format. See [importing past applications](docs/tracking.md#importing-past-applications).

## Your crew

Each agent has a name, responsibilities, instructions, runtime, model and allowed tools. The defaults are ordinary editable agents:

| Agent          | Purpose                                            | Additional setup                                          |
| -------------- | -------------------------------------------------- | --------------------------------------------------------- |
| Scout          | Assess job fit and identify missing evidence       | Profile notes and a job description; job sources to scan  |
| Writer         | Draft application packets                          | Profile notes and a shortlisted job                       |
| Reviewer       | Check accuracy and suggest corrections             | A drafted packet                                          |
| Submitter      | Inspect forms and assist with approved submissions | Chromium; an exported packet for packet uploads           |
| Tracker        | Reconcile application updates from email           | Connected Google account and Gmail permission             |
| Documenter     | Propose profile updates from watched sources       | Connected account, matching permission and a source watch |
| Pipeline Coach | Review the pipeline and propose crew improvements  | A review scope and enough board history                   |

Choose **Create agent** in Crew to define another role, select tools and skills, and optionally add a first routine. Custom agents start with optional capabilities disabled. Connecting an account does not grant agents access to it. Default agents have no seeded routines or source watches.

### Runtimes

Pitchcrew supports **Claude Code, Codex, Gemini CLI, OpenCode, GitHub Copilot CLI, Cursor Agent, Goose, Kiro CLI, Grok Build, Pi and oh-my-pi**. Different agents can use different runtimes.

Install the CLI on `PATH` and configure its native authentication before using it. **Settings > Runtimes** shows availability; Crew settings choose the runtime and model. Leave the model empty for the CLI default, or use the searchable picker. Version checks and model discovery do not start an inference turn; chats, workflows and follow-ups can use your provider account.

See [runtime setup](docs/runtimes.md) for executable names, authentication requirements and version constraints, and [model discovery](docs/model-discovery.md) for catalog behavior.

### Chats, skills and routines

**Chat** offers private role threads and a shared crew conversation. Attach a job for application context. Replies stream where the runtime supports it; only successful final replies are saved. Agents with permission can message each other and queue follow-ups, limited to six per user-started chain. **Stop** cancels the chain.

**Skills** holds reusable Markdown instructions assigned to all agents or selected roles. Write your own, import a public GitHub-backed skills.sh link, or review an agent's suggestion. Imports copy `SKILL.md` instructions only. New runs receive a snapshot of their assigned skills; edits affect future runs and grant no additional tools.

On startup, Pitchcrew loads missing skills from a ten-entry public GitHub starter catalog. Existing edits and deletions are preserved. Failed imports can be retried from Skills. Set `PITCHCREW_SEED_SKILLS=0` to skip startup imports.

**Routines** schedules one-time or repeating agent tasks with a timezone and optional end date or run limit. Routines persist across restarts and run only while the daemon is open; the [background service](docs/background-service.md) keeps it open after you log in. Busy or paused agents wait; overdue repeats coalesce into one run. See [routines](docs/routines.md).

## Job discovery

Open **Settings > Job sources** to save a company's public job board. Pitchcrew supports Greenhouse, Ashby, Lever, Comeet and Workable. Give each source a company name and the board name from its link, then optional filters: title keywords to include or exclude, location keywords and remote only. **Test source** previews matching postings without adding anything. **Scan now** adds new matching postings to Board as leads, with the job ID and source recorded on each card. A Comeet source needs the company UID and the public careers token from the company's careers page; [job discovery](docs/job-discovery.md) explains where to find them.

Pitchcrew reads only the providers' official public APIs, without signing in, and converts descriptions to plain text. A posting already on the board, in any state, is never added again, so withdrawing a lead dismisses it for good.

To let Scout scan, enable **Scan your saved job sources and add new matching leads** in its settings under Role tools. It is off by default. Scout can then scan from chat or a routine, assess the new leads and tell you about strong matches. Agents cannot add, change or remove sources. See [job discovery](docs/job-discovery.md).

Agent suggestions for instructions, capabilities and skills appear in **Chat > Crew work**. You review and decide whether to apply them. [Pipeline reviews](docs/pipeline-reviews.md) use the same explicit approval model for targeted crew changes.

## Accounts and profile sources

Connect accounts in **Settings > Accounts**, or from **Profile**:

- **GitHub:** connect your existing GitHub CLI (`gh`) login for read-only repository, file, issue and pull-request tools. First-time setup is install `gh`, run `gh auth login --hostname github.com --web`, then connect in Pitchcrew. Credentials stay with `gh`; manual fine-grained tokens remain available under Advanced. See [connector setup](docs/connectors.md#github).
- **Google Workspace:** read Gmail, Drive/Docs, Sheets and Calendar with Desktop OAuth.

Enable each service separately for the agents that need it. Connectors are read-only. See [connector setup](docs/connectors.md) for permissions and Google OAuth configuration.

Profile imports let you review and select documents from nested GitHub or Drive folders. GitHub imports use one pinned commit; Drive supports Google Docs, Markdown and plain text. Import applies the reviewed snapshot. Refresh flags local edits and keeps files removed upstream; removing a source keeps your local notes.

Optional watches let agents propose source refreshes or new notes backed by project evidence. You approve the exact proposed changes and verify personal facts before they enter your profile. See [profile maintenance](docs/profile-maintenance.md).

## Browser assistance and approvals

Install the local browser:

```sh
pnpm browser:install
```

Enable **Computer use** for an agent and ask it to help with an application. It opens a visible, isolated Chromium window. The agent can inspect pages; navigation, clicks, fills, selections, keypresses and exported-packet uploads each require an approval in **Inbox**. Sign-in and CAPTCHA handling stay manual.

Browser approvals allow one exact interaction on the reviewed page and expire when the run ends. Optional form assessments save inspected requirements for Writer. Submission receipts capture approved attempts; uncertain outcomes pause further interactions until you verify the result. See [computer use](docs/computer-use.md).

Local packet exports also require a single-use approval for the exact packet and frozen document bytes. These checks are enforced by the tools. Agents cannot approve their own actions or adopt their own settings changes.

## Local data and privacy

The default data folder is `~/.pitchcrew` (`%USERPROFILE%\.pitchcrew` on Windows). It contains the SQLite board and event history, profile notes, chats, skills, routines, packet rules, role instructions, isolated run folders and versioned packets.

Pitchcrew does not read, copy or store AI provider credentials. The runtime uses its native authentication. Connected GitHub and Google credentials are stored separately in `connectors/credentials.json` inside the data folder, as local JSON without encryption. Protect that folder using your operating system's account and disk protections.

AI runs send context to the configured runtime/provider, and connected services make network requests when used. Local storage does not make provider-backed runs offline.

To use a separate workspace and port in PowerShell:

```powershell
$env:PITCHCREW_HOME = "$env:USERPROFILE\.pitchcrew-demo"
$env:PITCHCREW_PORT = '4418'
pnpm dev
```

`PITCHCREW_HOME` must be outside this repository. **Settings > Local data** shows its path. Manage agent instructions in Crew; generated instruction files are refreshed from stored settings. Profile changes require all runs to be idle.

## Current limits

- Job discovery covers public Greenhouse, Ashby, Lever, Comeet and Workable boards you add yourself. Other job sites stay manual. There is no automatic outreach or email sender.
- Routines run only while the daemon is open. The optional background service starts it at login but does not wake a sleeping computer. Automated tests use a simulated service manager, not the real Windows, macOS and Linux ones.
- Computer use covers an isolated Chromium browser, not the whole desktop.
- Packet checks verify registered quotations and your mechanical packet rules. They cannot prove every sentence is factual; review the complete packet.
- Formatted exports use one built-in template per document, and DOCX page counts are estimates. PDF covers Latin, Greek, Cyrillic and Hebrew with its own fonts. Japanese, Chinese and Korean need an installed font such as Yu Gothic, Hiragino or Noto Sans CJK; see [packet exports](docs/packet-exports.md#fonts-and-characters). Arabic and Indic scripts export as DOCX only.
- Desktop installers and auto-updates are deferred. Live provider execution is outside automated verification.

## Development

The workspace uses strict TypeScript, pnpm workspaces, SQLite, Fastify and the official MCP SDK. The shared UI uses React, shadcn/ui, AI Elements, Tailwind, TanStack Router and Zustand, built with Vite 8. Electron hosts the same renderer. Oxlint and Oxfmt handle linting and formatting; Vitest runs the tests.

Pitchcrew launches runtime CLIs with scoped MCP tools. Shared work is persisted on the board, with an append-only event history; the runtime supplies the agent execution loop.

| Package                 | Responsibility                                                     |
| ----------------------- | ------------------------------------------------------------------ |
| `packages/core`         | Contracts, validation, capabilities and card transitions           |
| `packages/board`        | SQLite events, projections and approval state                      |
| `packages/orchestrator` | Loopback daemon, run launches, crew tasks and routines             |
| `packages/adapters`     | Provider-specific CLI and ACP integrations, plus Demo              |
| `packages/mcp`          | Scoped tools, read-only connectors and export/browser gates        |
| `packages/packet`       | Evidence checks, packet rules, packet files and PDF/DOCX rendering |
| `packages/ui`           | Shared browser and desktop renderer                                |
| `packages/desktop`      | Sandboxed Electron host                                            |

```sh
pnpm lint
pnpm format:check
pnpm typecheck
pnpm browser:install # once, for browser tools and tests
pnpm test
pnpm build
pnpm check           # lint, typecheck, tests and build
pnpm test:desktop    # isolated daemon and actual Electron renderer
```

Use `pnpm format` to apply formatting. Tests use fictional fixtures, temporary workspaces and mock provider processes. Coverage includes board replay, approvals, HTTP boundaries, adapter contracts, MCP stdio and isolated Chromium. They make no paid provider calls.

GitHub Actions runs [CI](.github/workflows/ci.yml) on every pull request, pushes to `main`, merge queues and manual dispatches. It checks lint, formatting, types and production builds, runs the complete test suite on Node 22 and 24 with Chromium, and verifies the actual Electron renderer on macOS and Windows. It also builds installers and checks the packaged app on Windows, macOS and Linux. Installs use the pinned pnpm version and frozen lockfile; newer commits cancel superseded runs except for pushes to `main`, which each retain their release build. Test reports, desktop evidence and installers are retained for seven days. The repository’s `main` branch ruleset requires the single **CI** status check from GitHub Actions and an up-to-date branch before merging. That check passes only when all jobs succeed; the ruleset has no bypass actors.

The [Release workflow](.github/workflows/release.yml) publishes the verified installers and SHA-256 checksums after successful push CI on `main`, using `build-<full commit SHA>` tags. It downloads artifacts from that exact CI run without checking out or executing repository code, and alone has release write permission. Reruns resume drafts or skip an already published release. `pnpm desktop:package` builds the current platform's installers locally; `pnpm test:packaged` verifies the unpacked app starts its bundled daemon, renders the UI and stops its owned daemon. Packaging uses the build machine's Node 24 executable, so build on each target platform and architecture. Signing and notarization credentials are not configured.

Read [AGENTS.md](AGENTS.md) for repository rules, [code organization](docs/code-organization.md) for module conventions, and [MVP design](docs/mvp-design.md) for architectural decisions.
