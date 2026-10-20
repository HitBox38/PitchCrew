# Application process quality

Status: implemented from the October 20, 2026 grill-with-docs discussion.
Automated checks cover deterministic rendering, persistence, permission and UI
contracts; live provider writing and coaching quality are not measured.

## Agreed scope

Adapt selected ideas from
[ai-job-search](https://github.com/MadsLorentzen/ai-job-search/tree/d621ebe63549dffb291edea7f7621cd00e67ddb1)
to improve Pitchcrew's existing application process:

- Document verification of generated PDF and DOCX bytes.
- User-specific writing preferences shared by drafting and review.
- Persistent, source-linked recurring gap analysis building on Career Coach.

See the [glossary](../CONTEXT.md) for agreed domain terms and the implementation
contracts below for limits and source handling.

## Agreed document verification policy

Clear document failures block export: an unreadable PDF, an empty text layer,
or meaningful text demonstrably lost during rendering.

Suspected quality issues remain advisory warnings: stranded headings, large
gaps, unusual reading order, or exceeding the page target. Heuristic checks can
produce false positives, including for multilingual documents. A readable
two-page resume can therefore still proceed after a page-target warning; a
document that demonstrably dropped an employment entry requires correction.

Present findings before the existing export approval, identifying the affected
page where available and explaining the issue. Document verification does not
establish compatibility with every ATS or replace factual review and the
existing export approval.

## Agreed automatic correction policy

During a user-started draft or review, Writer may make one automatic correction
pass for actionable document findings, followed by document verification and
Reviewer recheck. Corrections preserve verified facts and required content.

After that pass, stop and report remaining issues. Blocking failures still
prevent export, while advisory warnings remain non-blocking. Report renderer
or font failures directly rather than asking Writer to rewrite around them.
Export retains the existing user approval.

## Agreed format coverage

The first version checks both PDF and DOCX documents. PDF verification covers
extracted text, content retention and page layout. DOCX verification covers
file structure and content retention. Final Word layout is not verified;
any available DOCX page count remains an estimate.

Failures apply to the affected file. A failed PDF check does not prevent a
valid DOCX from proceeding to export approval. This preserves DOCX as an
option for scripts unsupported by the PDF renderer. No unavailable format
should be described as generated or verified.

## Agreed incomplete verification policy

If an essential readability or content-retention check cannot finish, block
export of the affected file, explain what remains unverified and offer retry.
The first version has no export-unverified override for these checks. A PDF
text-extraction timeout therefore prevents that PDF from proceeding, while a
successfully verified DOCX remains available.

If an advisory layout check cannot finish, allow export with a clear
"layout not checked" warning. Incomplete verification is distinct from a
completed check that found a document defect.

## Agreed writing preference direction

Support both explicit writing preferences and automatic learning from the
user's edits. Writer and Reviewer use a shared writing guide. Other agents,
including Pipeline Coach, can critique the writing produced under that guide
within their permitted review scope.

User edits and agent critiques are distinct sources of feedback; the guide
concerns style rather than verified facts.

## Agreed writing preference activation

Explicit user instructions apply immediately within their stated scope. A
consistent user edit across two separate applications can automatically become
a writing preference, with visible supporting examples and Undo. Repeated
edits to one application do not establish that cross-application pattern.

One-off edits remain tentative. Inferred preferences cannot override explicit
instructions. Making one bank letter more formal therefore stays specific to
that application; repeatedly removing generic enthusiastic openings can become
a standing preference.

Agent critiques propose guide changes for user review. An agent's stylistic
opinion alone does not become the user's preference.

## Agreed automatic learning default

Automatic preference learning is on by default for new chat corrections, with
a switch in Settings > Writing. The two-application threshold still applies.
Do not mine older conversations unless the user explicitly requests it.

Turning learning off preserves the existing guide and stops learning new
preferences. Explicit user preference updates remain available.

## Agreed correction learning source

The first version learns from explicit user chat corrections tied to a specific
application draft, retaining the user's instruction and the before/after text.
Examples include removing an opening or shortening bullets. Writer's own
revisions do not count as evidence of the user's preferences.

A direct editor for generated application drafts is outside this effort's
first version. The shared guide still supports explicit preference updates.

## Agreed writing guide management

Manage the shared guide in Settings > Writing, with links from draft and
review screens. Show explicit and learned preferences, their scope and
supporting correction examples, and provide Edit, Disable and Undo controls.
Show proposed guide changes from Pipeline Coach or other permitted agents
for user review.

The guide is revisioned board state, separate from shared skills. Each application
run saves the applicable guide snapshot. Explicit preferences take precedence
over learned preferences; neither can override factual evidence, packet rules
or user approval.

## Agreed Undo and Disable behavior

Undo removes a learned preference and retires its supporting examples. The
same evidence cannot restore it during refresh; automatic learning requires
two fresh corrections across separate applications before it can return.

Disable keeps a preference inactive until the user explicitly re-enables it.
Explicit instructions retain precedence over any subsequently learned rule.

## Agreed gap analysis scope

Career Coach analyzes a target set chosen by the user through selected jobs or
role/tag filters, including relevant leads the user has not yet applied to.
Unrelated saved jobs do not automatically influence learning priorities.

Findings distinguish evidence gaps, confirmed skill gaps and application
coverage gaps. Each finding cites actual requirements from the jobs examined.
Missing Profile evidence alone does not establish a confirmed skill gap.

For example, unrelated management jobs should not push leadership training
above a technical capability repeatedly requested by the user's target roles.

## Agreed career action plan

Persist the gap list and career action plan in Insights. Career Coach explains
and updates the plan through chat. Each gap keeps its source jobs and
requirements, and progress survives across conversations.

Keep up to three active priorities, each with a concrete next step and a
completion criterion. Track completing an action separately from demonstrating
a capability: finishing a course does not automatically establish verified
Profile evidence.

Career Coach recommends ordering using requirement importance, recurrence, the
user's goals and available time, with a rationale and explicit unknowns. This is
a coaching judgment rather than a hidden numeric score. Only the user selects
the three active priorities.

## Agreed progress updates

Clear user statements in chat directly update career action plan progress
without another confirmation step, retaining the source message. "I finished
the Kubernetes course" records user-reported completion, "I'm halfway through"
records progress, and "I might start next week" leaves the action planned.

Action completion remains distinct from resolving a skill gap or adding
verified Profile evidence.

## Agreed action plan refresh policy

Relevant job or Profile changes immediately mark affected findings out of date.
Career Coach refreshes the analysis on request or through an optional routine
configured by the user, using the existing routine system.

Refresh preserves progress and active priorities and suggests changes supported
by new evidence. For example, new verified Kubernetes experience flags the
corresponding gap for reassessment without silently replacing the current plan.

## Implementation contracts

### Document verification

`packages/packet/src/verification/` independently renders and verifies each
requested file. PDFjs reads actual PDF bytes; Mammoth extracts actual DOCX text.
Essential extraction runs in an isolated worker with a 15-second timeout, a
256 MB heap limit, a 10 MB file limit and a 100-page PDF limit. Failed essential
checks block that file. Advisory geometry failures produce a layout warning.

Content comparison uses the renderer's visible Markdown text for formatted
exports and literal text for plain exports. NFKC normalization and counted
characters tolerate wrapping, compatibility glyphs and bidi visual order;
whitespace, soft hyphens and directional controls are excluded. Missing
characters block the file. This comparison detects omissions and repeated-text
loss; it does not prove sentence order, semantic equivalence or ATS compatibility.
PDF coordinates provide advisory gap, margin, sparse-page, heading and
extraction-order findings. DOCX always explains that Word controls final layout.

Ordinary drafting/review checks formatted PDF output and tries DOCX when PDF
fails. Actionable PDF layout warnings can trigger one isolated Writer correction
and independent Reviewer recheck, sharing the original 30-minute budget. This
cycle cannot recursively start itself, including after a saved user-question
continuation within the same application chain. Managed deep review folds findings into
its existing single correction and recheck stages. Renderer/font failures are
reported rather than sent to Writer for a rewrite. `pitchcrew_lint_packet`
includes document findings too.

Export approval verifies the requested layouts/formats, omits blocked files and
stores reports alongside the frozen valid bytes. With no valid requested files,
requesting approval fails with the findings. Export rechecks the frozen bytes
and the current run, Profile and packet-rule gates before consuming approval.
A bounded digest cache reuses successful checks only after validating bytes;
blocked checks can be retried. See [packet exports](packet-exports.md).

### Writing guide and correction evidence

Settings > Writing supports explicit preferences, scopes, automatic learning,
Edit, Disable/Enable, learned-rule Undo, supporting before/after examples and
critic proposals. Revision checks reject stale writes and stale proposal adoption.
At most 100 preferences and 100 retained proposals are supported.

`pitchcrew_application_quality` provides the ordinary-chat actions. A correction
must quote the current user request and target an existing attached application
draft. The gateway records its packet digest and queues an isolated Writer task;
launch rejects a changed draft. Only the quoted correction, permitted Profile,
structured application context and guide enter drafting, rather than the source
conversation or raw posting. The exact before/after text remains local board
history and is exposed to the configured provider only when requested through
scoped tools. Workspace snapshots carry bounded metadata, with full examples
loaded on demand in Settings.

Automatic activation compares normalized preference labels within the same
scope across two distinct application IDs with changed output. The agent labels
the candidate; the server enforces source provenance, independent applications,
changed text, learning eligibility and retired evidence. This is not a semantic
proof that two corrections express the same preference. The visible evidence,
Edit, Disable and Undo controls let the user correct it. Learning starts at
installation; toggling learning resets the eligibility boundary so time spent
off cannot later be mined. Writer-only revisions are excluded.

Pipeline critics need `reviewPipeline` to read cross-application correction
examples and propose changes. Others see only corrections for their attached
job. Evidence reads are paginated and bounded; oversized before/after content is
omitted with an explanation. Critic proposals require an exact user decision.
Explicit standing instructions in chat require a quoted current user instruction;
ambiguous or unsupported phrasing can be entered directly in Settings.

### Career plans

Insights supports up to 20 named plans. Scope accepts up to 100 selected jobs,
a case-insensitive exact tag and/or a title substring; populated filters combine
as intersections. Leads are included. Career Coach reads the scoped sources in
bounded pages through `plans_read`, then saves up to 50 findings per refresh.
Without a plan ID, reads return plans and scope counts rather than all job text.

Every finding needs an exact requirement from a scoped job's structured brief,
or a quotation from its saved posting for an unassessed lead. Raw postings remain
untrusted research material and never become drafting context. A new finding
cannot assert a confirmed skill gap; the user confirms that classification in
Insights. Requirement provenance is checked mechanically, while the coach's
interpretation and priority rationale remain reviewable judgments.

A hash of scope, matching jobs, packet content and Profile marks changes stale
in snapshots. Refresh checks that hash and the plan revision. Stable normalized
labels retain priority and progress. Omitted priorities or progressed actions
remain visible as absent from the latest analysis, rather than disappearing.
Clear current user progress quotations can update a plan immediately. Conservative
English affirmative checks reject tentative/negative language; use the manual
progress control or clarify the statement when wording is unsupported. Progress
never writes verified Profile evidence.

Read access requires `readApplications`; refresh/progress additionally requires
`manageCareerPlans`. New default Career Coach roles receive both, but existing
role settings are preserved: enable career plan management in Crew when needed.
The Insights chat action explains unavailable permissions. Existing opt-in
routines can request refreshes; no routine is created automatically.

### Persistence and existing boundaries

Event version 25 adds writing guides, correction evidence and career plans.
Version 24 queue events and prerelease quality events remain readable.
Projection updates and events share board transactions and survive replay.
Optimistic revisions protect edits and analysis. Board-backed changes participate
in existing snapshot revision checks; Profile changes additionally affect plan
staleness. Existing application weights and lessons remain user-only.

Relevant entry points:

- [Document checks](../packages/packet/src/verification/index.ts).
- [Ordinary repair](../packages/orchestrator/src/quality/repair.ts).
- [Managed review](../packages/orchestrator/src/crew/deep-reviews/flow.ts).
- [Quality gateway](../packages/orchestrator/src/quality/agent.ts).
- [User decisions](../packages/orchestrator/src/quality/user.ts).
- [Writing settings](../packages/ui/src/WritingSettings/index.tsx).
- [Career plans](../packages/ui/src/CareerPlans/index.tsx).

## Acceptance scenarios

- A readable two-page resume produces a warning and can proceed to approval.
  A demonstrably missing employment entry blocks the affected document.
- Essential extraction timeout blocks that file; an unavailable advisory
  layout check produces "layout not checked". A verified DOCX remains available
  when the PDF cannot be generated or verified.
- A correction cycle stops after one Writer correction pass and Reviewer
  recheck. Renderer faults are reported directly, and corrected content needs
  review before export approval.
- One user correction remains tentative; consistent corrections across two
  separate applications can activate a preference. Writer-only edits and
  duplicated records of one correction do not establish a user preference.
- Explicit instructions win conflicts. Agent critiques require user adoption.
  Undo retires its examples, Disable persists until re-enabled, and turning
  learning off preserves the guide. Old conversations are excluded by default.
- Scope filters exclude unrelated jobs. Findings distinguish missing evidence,
  confirmed learning needs and omitted application coverage, with source
  requirements and incomplete coverage visible.
- Plan progress survives restart. A clear user message can record course
  completion without adding Profile evidence. Relevant source changes mark
  findings out of date, and refresh preserves active priorities and progress.

Use fictional fixtures and deterministic gateway, HTTP and renderer checks;
automated verification does not establish live provider writing or coaching
quality. Follow repository instructions for any headless browser or hidden
desktop verification needed by an implementation slice.
