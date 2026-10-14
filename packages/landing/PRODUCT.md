# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Tech professionals (engineers, designers, product managers and similar roles) who are actively looking for a job. They already use, or are comfortable installing and signing in to, an AI coding CLI such as Codex, Claude Code or Gemini CLI. They are evaluating whether to trust an AI tool with their applications and personal history.

## Product Purpose

Pitchcrew is a free, local-first desktop app (macOS, Windows, Linux) that gives a job search a crew of AI role agents on a shared board. Agents find and assess roles, draft tailored resumes, cover letters and form answers, review them, and track applications. The user decides what to pursue and approves anything that leaves their computer. Success on the website is a visitor downloading the app; GitHub is the secondary action.

## Positioning

Primary promise: a crew for the whole job search (find, draft, review, track), shown through one fictional job. Key proof: nothing is made up, and nothing is exported or submitted without you. Every claim in an application packet must quote the user's own profile notes word for word; an independent Reviewer agent checks it; exports, browser submissions, role changes and skill changes require explicit user approval enforced in the tool layer, not in prompts. Job postings are treated as untrusted input; the agents that draft and review never see raw posting text.

Supporting proof:

- A crew, not a chatbot: Scout (fit) → Writer (draft) → Reviewer (review), with support agents (Submitter, Tracker, Documenter, Pipeline Coach) and user-created agents, coordinating through a shared board.
- Your machine, your AI: board, profile, chats and packets stay in local storage; agents run through the AI CLI and provider account the user already has. Pitchcrew sells no AI plan.

## Operating Context

- Setup: download the installer (bundles Node, local server and Chromium), install and sign in to a supported AI CLI separately, add factual profile notes, add a job.
- Supported runtimes: Codex, Claude Code, Gemini CLI, OpenCode, GitHub Copilot CLI, Cursor Agent, Goose, Kiro CLI, Grok Build, Pi, oh-my-pi and Hermes Agent.
- Job sources: public Greenhouse, Ashby, Lever, Comeet and Workable boards, single posting links, manual entry, and import of past applications (JSON/CSV/legacy SQLite trackers).
- Exports: Markdown, PDF and DOCX packets after approval. Optional browser assistance: supervised by default; user-granted autonomous preparation on approved sites may navigate and fill forms, but submission, buttons, keys and dialogs always need an exact user decision. Sign-in and CAPTCHAs stay manual.
- Installers are currently unsigned on Windows and macOS, and macOS builds are not notarized.

## Capabilities and Constraints

- Free to download and use; AI usage costs belong to the user's provider plan.
- Local storage does not make provider-backed AI runs offline; relevant context goes to the chosen provider when an agent runs.
- The app counts anonymous feature usage by default with an opt-out; the website counts anonymous visits and download clicks by default, with a footer opt-out and Do Not Track respected.
- License: MIT (`LICENSE` at the repository root). The source is public on GitHub, so the page may say Pitchcrew is open source under the MIT License.
- Existing implementation: Next.js App Router, Tailwind, Base UI/shadcn, Motion, locally served fonts, server-rendered content, GitHub-release-backed download chooser, PostHog with a closed property allowlist (see docs/landing-page.md).

## Brand Commitments

- Name: Pitchcrew.
- Mark: the existing three-piece mark (`public/favicon.svg`, shared with the desktop app icon). Do not redraw it.
- Voice: warm, calm, plain English. No hype, no exclamation marks, no "supercharge"/"10x" language.
- Not binding: the current headline, the "next chapter" tagline and the current paper visual style.

## Evidence on Hand

- The desktop app's own React components (`packages/ui`) rendered with labelled fictional data: the job drawer, chat turn and claim tracer. `public/screenshots/board.png` (a real app capture with fictional demo data) is kept only for search metadata.
- Public GitHub repository under the MIT License, and releases with SHA-256 checksums.
- Absent and must not be fabricated: testimonials, user or download counts, ratings, hiring-result claims, press, company logos, benchmarks.

## Product Principles

1. The user decides; the crew does the work. Never imply automatic applying or submission.
2. Truth over polish: every claim about the user and about the product must be verifiable.
3. Local and owned: the user's data, AI account and approvals stay theirs.
4. Honest setup: be upfront about the AI CLI requirement, provider costs and unsigned installers.

## Accessibility & Inclusion

WCAG 2.2 AA in both light and dark themes: contrast, keyboard access, visible focus, target sizes, and a reduced-motion equivalent for every animation.
