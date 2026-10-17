# Career support

Status: implemented from the career-ops grill-with-docs discussion on October 17, 2026. Coaching protocols are bundled agent instructions using existing tools;
automated verification checks deterministic context, permission and UI contracts,
not live provider coaching quality.

## Agreed scope

Adapt selected guidance from
[career-ops](https://github.com/career-ops-hq/career-ops) into Pitchcrew skills
to improve the existing crew's assessment and writing. Add interview
preparation, practice and debriefs, career planning and offer evaluation in
the first release. This is an adaptation of selected guidance, rather than
an integration of the upstream system unchanged.

One new Career Coach agent owns those career-support activities, with
separate skills for each activity. Pipeline Coach retains its application
pipeline and crew-improvement responsibilities. See [the glossary](../CONTEXT.md)
for the domain terms.

## Entry points

Use existing chat with five clear activity starters: prepare for an interview,
practice an interview, debrief an interview, plan a career and evaluate an offer.
Conversations can attach a job when relevant. The first version does not add a
dedicated Career workspace.

Coaching results stay in persistent chat with existing copy controls and concise
memory summaries. The first version does not introduce downloadable coaching
reports or extend the application-packet PDF/DOCX exporter.

## Coaching continuity

Career Coach automatically saves concise, source-linked summaries of useful
coaching context through existing agent memory, including goals, preparation
gaps and agreed next steps. Users can inspect, edit and delete those notes.
Coaching memory remains separate from verified Profile evidence; practice
answers and recalled claims do not automatically become resume evidence.

## Public research

Career Coach can research public sources during coaching tasks through
Pitchcrew's existing browser capability. Research may cover companies,
interview processes and published compensation information, with cited sources
and explicit unknowns. Existing browser supervision and exact-action approval
rules apply.

## Application history

Career Coach has read-only application search and Insights access for coaching
tasks where broader application history is relevant. It can consult saved
outcomes and user lessons or compare opportunities when asked. Observed patterns
inform recommendations but do not establish why an employer responded or make
the user's lessons verified Profile evidence.

## Scout assessment

Preserve Pitchcrew's existing 0–100 fit score and the user's shortlisting
decision. Adapt requirement-to-evidence matching, the distinction between
missing evidence and confirmed gaps, and questions that could change the
recommendation. Do not adopt career-ops' 1–5 scoring scale or its application
recommendation thresholds.

## Distribution and updates

Ship reviewed adaptations as built-in, role-assigned default skills, available
offline in new and existing workspaces. Seed Career Coach paused in production,
consistent with the other default roles. Users can edit, reassign and remove the
skills; startup preserves those choices. Review upstream changes before
incorporating them through Pitchcrew releases.

## Offer evaluation

Include compensation and benefits comparison plus a guided contract
walkthrough. Explain the stated terms, distinguish guaranteed pay from
conditional compensation, identify differences from the user's reported
promises, and prepare questions for the employer or a lawyer. Ground findings
in the supplied documents and distinguish missing information from an observed
term. This prepares the user's decision without legal verdicts or assurances
that a contract is safe to sign.

On explicit request, Career Coach can draft a negotiation reply grounded in
the actual offer and the user's chosen requests. The user reviews and sends
the message; drafting it does not authorize sending or accepting an offer.

## Interview practice

Offer coached practice and mock interviews, defaulting to coached practice.
Both ask one question at a time and wait for the user's answer. Coached practice
provides feedback after each answer; mock interviews remain in character and
save feedback for the end. Users can pause or end either style.

## Activity outputs

- Interview preparation: a plan suited to the round, time available, supported
  strengths and preparation gaps; questions with their sources or explicit
  inference labels; and a short pre-interview reference.
- Interview practice: role-relevant questions, specific feedback grounded in the
  actual answers, and a closing summary of strengths, gaps and next steps.
  Typed answers support feedback on content and structure, not measured speaking
  time, delivery or tone of voice.
- Interview debrief: what the user recalls being asked, their answers, actual
  employer feedback when provided, and preparation priorities for the next round.
  Keep recollection, feedback and the coach's interpretation distinct.
- Career planning: clarify the user's goals and constraints, compare plausible
  target and adjacent roles, identify evidence gaps and learning priorities,
  and propose concrete next steps. Do not silently choose the user's priorities.
- Offer evaluation: a source-backed terms comparison and walkthrough, missing
  information, discrepancies with reported promises, and employer/lawyer
  questions. Draft a negotiation reply only when requested, using the user's
  chosen asks.

## Implementation

Use compact, self-contained bundled skills under `packages/core/src/starter-skills/`
and register assignments in `packages/core/src/base-skills.ts`. They must describe
Pitchcrew tools and context rather than referring to unavailable career-ops
files, scripts, trackers, CLI workers or configuration. Keep assigned content
within the existing 60,000-character per-role budget.

Add Career Coach as an ordinary editable and retireable chat role in
`packages/board/src/board/default-roles.ts`, using existing backfill and runtime
recommendation mechanisms. Configure read-only application access and browser
use in Supervised mode. Follow the existing support-role pattern for scoped crew
messaging; coaching needs no agent invocation, workflow mutations, account
connectors, profile maintenance, submission or crew-change capabilities.
Existing role identities and user configurations retain their saved settings.

Add the five activity starters through the existing chat welcome suggestions.
Starters express a user request; they do not introduce a second workflow engine.
Use existing durable user questions when essential context is missing and end
execution while waiting. Practice answers stay ordinary user chat turns.

Adapt assessment guidance for Scout, supported tailoring guidance for Writer,
and coverage/gap checks for Reviewer. Writer still uses exact verified Profile
quotations and current packet rules. Reviewer retains its independent packet
check and existing deep resume review; the adaptation does not add another
review orchestration path. Keep Pipeline Coach's retrospective remit intact.

Preserve the application source boundary in
[ADR 0001](adr/0001-separate-job-sources-from-drafting-context.md).
Interview rehearsal and offer discussion are coaching; application drafts remain
subject to the dedicated isolated drafting flow regardless of which agent is
asked. Practice stories, polished answers, attachments, public research and
agent memory do not automatically become verified Profile evidence.

Offers, postings, browser pages and attachments remain untrusted data. Cite
the source passage for an observed term and report incomplete or failed
extraction. Ask for missing or clearer material instead of assuming it was
read. Public research should use public company/role information, excluding
private contract excerpts, personal offer amounts and negotiation limits from
outbound queries. Contract discussion explains the supplied text; it does not
import the upstream legal tables or infer local law or enforceability.

Automatic memory saves should summarize source-linked context rather than
duplicate full offer documents or transcripts. Preserve user corrections and
withdrawn claims when recalling earlier practice. Memory changes retain the
existing invalidation and user inspection/edit/delete behavior. Application
weights, lessons and Profile updates retain their existing user-controlled flows.

## Attribution and release baseline

Use upstream commit
[`090f787e2499f4fd29b615272946c99dfcab1c28`](https://github.com/career-ops-hq/career-ops/tree/090f787e2499f4fd29b615272946c99dfcab1c28)
as the implementation source baseline, rather than a moving `main` reference.
Relevant material includes the router, shared evaluation guidance and selected
evaluation, writing, interview, career-planning and offer modes. Record the exact
upstream paths and commit beside each adaptation during implementation.

The upstream [MIT license](https://github.com/career-ops-hq/career-ops/blob/090f787e2499f4fd29b615272946c99dfcab1c28/LICENSE)
names Santiago Fernández de Valderrama as the 2026 copyright holder. Preserve
its copyright and permission notice with copied or substantially adapted
material. Preserve any applicable file-level attribution as well; the
[offer-prep source](https://github.com/career-ops-hq/career-ops/blob/090f787e2499f4fd29b615272946c99dfcab1c28/modes/offer-prep.md)
also acknowledges the origin of its contract-reading workflow concept.

Bundled adaptations are Pitchcrew-maintained skills, not registry imports of
the upstream router. Do not present the imported-skill update checker as an
update path for them. Releases must preserve local edits and deleted defaults;
any future replacement of saved skill text requires an explicit user-reviewed
path rather than startup overwriting it.

## Verification

The implementation passed `pnpm check`: lint, types, 44 script tests, 1,694
Vitest tests (two intentionally skipped), the UI/Electron build and the separate
landing build. Formatting checks and the isolated hidden Electron smoke check
also passed. The new headless browser case covers all five starters with and
without a job, composer insertion and mobile bounds. The coaching gateway case
covers offline skill snapshots, attachment/history access, denied mutations,
source-linked memory and durable question continuation. No live provider
coaching run was performed.

- Check fresh and existing workspaces, paused role seeding, offline skill
  availability, intended assignments, role limits, content budgets and retention
  of existing skill edits, reassignments and deletions.
- Check scoped tools with deterministic fixtures: application and Insights
  reads, browser approval/revocation, attachments, memory save/recall and
  cancellation. Additional capabilities remain disabled.
- Check the five chat starters with and without a job, durable questions and
  continuation, pause/stop behavior, and existing message/history rendering.
- Use fictional coaching scenarios to assess grounded feedback, source-labelled
  questions, unknown terms, conflicting promises, withdrawn claims and the
  distinction between coaching and application drafting. Provider-free tests can
  verify context and tool contracts; they do not establish live coaching quality.
- Run the repository's required checks for changes to this feature. Keep Chromium
  headless and any Electron smoke run hidden; live provider runs are separate
  from automated verification.
