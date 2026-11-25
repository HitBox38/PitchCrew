# Product

<!-- impeccable:product-schema 1 -->

> Inferred record. The user ran this session as an unattended goal, so impeccable's init interview was not held. Every fact below is inferred from repository evidence (README.md, AGENTS.md, CONTEXT.md, docs/, packages/landing/PRODUCT.md) and should be confirmed with the user. Source files are named per section.

## Platform

web

(Inferred from packages/ui: one React renderer shared by the browser workspace and the Electron desktop shell; phones get their own layout. docs/ui-architecture.md, docs/desktop-shell.md.)

## Users

(Inferred from packages/landing/PRODUCT.md and docs/status.md.) Tech professionals such as engineers, designers and product managers who are actively looking for a job and already use, or are willing to install and sign in to, an AI coding CLI (Codex, Claude Code, Gemini CLI, Grok Build and others). In the app they run a job search over weeks: adding and triaging leads, shortlisting, letting role agents draft and review application packets, approving exports and browser submissions, answering agent questions, and tracking outcomes. They work mostly on a laptop and check in from a phone.

## Product Purpose

(Inferred from README.md and AGENTS.md.) Pitchcrew is a local-first job-search app with a crew of role agents (Scout, Writer, Reviewer, Submitter, Tracker, Documenter, Pipeline Coach, Career Coach and user-created agents). Pitchcrew starts the user's installed runtime CLIs, gives them scoped MCP tools and keeps shared state on a board. Success in the app is a user who always knows what the crew is doing and what needs them, and who sends applications they can stand behind without doing the crew's work themselves.

## Positioning

(Inferred from packages/landing/PRODUCT.md and AGENTS.md invariants.) A crew, not a chatbot: separate role agents coordinate through persistent board state, never through hidden agent-to-agent channels. Nothing is made up: packet claims quote the user's own profile notes and an independent Reviewer checks them. Nothing leaves the device without the user: exports, browser submissions, role and skill changes require explicit approval enforced in the tool layer, not in prompts.

## Operating Context

(Inferred from docs/board.md, docs/board-action-queue.md, docs/inbox-redesign.md, docs/routines.md.)

- Work is scheduled per job: each job has its own queue; the workspace runs five jobs or standalone conversations at once by default. Questions, failures and stops release a slot.
- The user's interventions are decisions: packet approvals, browser action approvals, answers to agent questions, drafting confirmations, role and skill proposals, submission follow-ups and verification.
- Agents also work on schedules (routines, the optional background service, Gmail reconciliation) while the app is closed or unattended.
- Desktop windows from about 1024 to 1600px wide are the main working size; phones show one stage at a time.

## Capabilities and Constraints

(Inferred from AGENTS.md and CONTEXT.md.)

- The canonical vocabulary is CONTEXT.md. Notably: job queue, standalone conversation queue and workspace queue (never "agent queue"); queued board action; crew follow-up; delegation round; user input request; Inbox request; manual status change.
- Card states and allowed transitions live in packages/core/src/states.ts.
- Manual status changes are bookkeeping only; they never start agents, export or submit.
- The UI shows public agent activity only; private reasoning and raw tool input/output stay excluded.
- Home is the Needs you desk and the board is the map in Pipeline (docs/adr/0006-home-is-the-needs-you-desk.md).

## Brand Commitments

(Inferred from packages/landing/PRODUCT.md and docs/design-language.md.) Name: Pitchcrew. Voice: warm, calm, plain English; no hype or exclamation marks. The app has one design, clay (paper ground, raised clay objects, recessed trays, bead semantics: ochre waits on the user, plum means an agent is executing, rose failed, moss recorded positive outcomes). The three-piece mark is not redrawn.

## Evidence on Hand

Fictional demo data only (development example data and the prototype scenario fixture). No real users, testimonials, metrics or benchmarks exist; never fabricate them.

## Product Principles

1. The user decides; the crew does the work. Never imply automatic applying or submission.
2. Truth over polish: every claim about the user and the product is verifiable.
3. Show the crew honestly: what is running, waiting, failed or idle, and why.
4. Local and owned: data, AI accounts and approvals stay with the user.

## Accessibility & Inclusion

WCAG 2.2 AA in light and dark themes: contrast, keyboard access, visible focus, desktop targets of at least 32px and 44px on touch, and reduced-motion equivalents (docs/design-language.md).
