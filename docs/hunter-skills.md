# Hunter skill adaptation

Status: design agreed through the October 18, 2026 grill-with-docs discussion.
Implemented as two bundled skills, ordinary chat starters and a local scoped
LinkedIn draft checker. Automated verification covers deterministic behavior
and permission contracts, not live provider research or writing quality.

## Agreed scope

Adapt selected guidance from
[Hunter](https://github.com/Jakeschincariol/hunter-skill), assessed at commit
`f40d6a94b61283785b20e47a237608d5b1976b1c`, for two activities:

- Company research briefs covering the business, recent developments, relevant
  team and interview process, with cited sources, source distinctions and gaps.
- LinkedIn profile drafting grounded in the user's actual experience and target
  role family, with proposed text for the user to review and publish themselves.

Do not import the complete upstream bundle unchanged. Contact research and
outreach are outside this adaptation's scope. Preserve Pitchcrew's board,
Profile evidence, isolated drafting, independent review and approval boundaries;
do not introduce Hunter's parallel JSON workspace or ATS score.

The assessment ran all 164 upstream tests successfully. A separate probe showed
that changing an achievement's ownership from "Assisted" to "Led" still passed
the upstream truth checker. Its lexical checks are not sufficient evidence that
a rewrite preserves a factual claim. Automated helper tests do not validate
live agent quality or hiring outcomes.

## Entry points and continuity

Both activities live in existing chat. Keep complete research briefs and
LinkedIn drafts in the conversation, with concise source-linked summaries in
the agent's existing memory for continuity. Do not add dedicated pages or a
separate research/profile storage model. Memory remains separate from verified
Profile evidence, and users retain the existing memory inspection, editing and
deletion controls.

## Default role assignments

Assign the company research skill to Scout and Career Coach: Scout uses it to
help evaluate opportunities, while Career Coach uses it for interview and
career preparation. Assign LinkedIn profile drafting to Career Coach. These
are ordinary skill assignments that users can change; they introduce no new
crew role or tool permissions.

## Research initiation

Users can explicitly ask Scout or Career Coach to research a company or produce
a full company brief whenever they consider it useful. Agents may also research
relevant public information as part of the current requested task, such as
evaluating an opportunity or preparing for an interview, within existing browser
permissions and supervision. Do not automatically produce a full brief for
every discovered job; produce the full brief when requested.

## Company brief coverage

Return a balanced brief covering the business and product, relevant team,
recent developments, reported interview process and material employer concerns,
such as reported layoffs or instability. Give concerns dated sources,
distinguish reporting from inference, and translate relevant uncertainties into
useful questions for the employer. Do not turn an allegation or an isolated
candidate report into an established company fact.

## Research freshness and unavailable browsing

Reuse relevant sourced background from earlier research, while rechecking
time-sensitive information such as recent news and the reported interview
process when it is needed for the current task. For example, preparation for
tomorrow's interview should refresh those details rather than treating a
three-week-old brief as current. Preserve source dates and distinguish newly
checked information from retained background.

If browsing is unavailable, continue with a clearly dated, partial brief and
identify what could not be checked. Do not invent current information or add
background refresh schedules.

## Research sharing

Scout and Career Coach may share relevant research through existing visible
crew conversations when the current user task needs it. Handoffs should carry
a concise summary, source links and research dates. Each agent retains its own
memory, and sharing follows existing conversation membership and bounded
follow-up rules. Do not introduce a shared company database or treat another
agent's summary as newly verified research.

## LinkedIn inputs and evidence

Career Coach can use saved Profile evidence and current LinkedIn text supplied
by the user. Keep supplied LinkedIn text identified as user-reported material;
it does not automatically become verified Profile evidence. Ask about missing
facts and contradictions before adding claims, and preserve the user's actual
responsibility, experience and achievements when rewriting. The user reviews
and publishes the proposed text themselves.

## LinkedIn output

Default to a section-by-section review of the headline, About, skills and
selected experience sections. For each section, show the current text when
supplied, ready-to-paste proposed text and a short explanation of the changes.
Honor narrower edit requests. Flag missing evidence instead of filling gaps,
and align the wording with the user's target role family.

## LinkedIn field validation

Include measured character counts and over-limit warnings beside draft fields.
Use deterministic validation rather than model-estimated counts. Keep the
limits identifiable by source and review date; LinkedIn's live editor remains
the final authority if its limits change. State what the checker actually
measures. A length result is not verification of factual accuracy, keyword
effectiveness or hiring outcomes, and no ATS score is introduced.

## Implementation approach

Follow the existing bundled career-skill pattern: two compact, self-contained
skills under `packages/core/src/starter-skills/`, registered in the base-skill
catalog with the agreed default assignments. Include upstream attribution at
the reviewed commit and retain Hunter's MIT copyright and permission notice.
Updates ship through reviewed Pitchcrew releases. Preserve user edits,
reassignments and deletions through the existing seed/update behavior and stay
within the assigned-skill content budget.

Add a Research a company chat starter for Scout and Career Coach and an Improve
my LinkedIn starter for Career Coach using the existing suggestion controls.
Starters initiate ordinary chat requests and ask for essential missing context
through existing durable questions. Neither activity requires an attached job.

Provide a small deterministic TypeScript field checker through the scoped MCP
gateway for the draft text supplied in the current task. Bound its input and
return measured lengths, applicable limits and warnings without changing the
text. Define and test its Unicode counting semantics, and disclose any
uncertainty about LinkedIn's own counting behavior. Never claim that validation
ran when the tool was unavailable or failed. This checker needs no browser,
account writes, shell execution or external network access. Do not bundle the
upstream Python helpers, JSON tracker, company allowlist or Claude-specific
browser/account integration.

Company research must work across industries and countries. Prefer relevant
primary sources, identify official company statements as such, and clearly
label third-party reporting, candidate anecdotes and inference. Public filings
are useful when relevant, not a prerequisite for researching a private or
non-US employer. Keep private Profile and chat content out of public queries.
Research does not establish the user's personal motivations or verified
Profile facts and cannot bypass confirmed application drafting context.

The implementation retains existing role settings and permissions. Both skills
are editable and reassignable; deleting one prevents startup from restoring it.

## Field checker contract

`pitchcrew_check_linkedin_draft` accepts `input.fields`, a bounded list of
`{ field, text, label? }`, and/or `input.skills`, the complete proposed skills
list. Supported fields are `headline`, `about`, `position_title` and
`position_description`. Text limits are respectively 220, 2,600, 100 and 2,000,
reported by the reviewed Hunter source rather than confirmed in LinkedIn Help.
Each result includes the source and October 18, 2026 review date. The 100-skill
limit is sourced to [LinkedIn Help](https://www.linkedin.com/help/linkedin/answer/a549047/adding-and-removing-skills-on-your-profile).

Lengths use UTF-16 code units, including spaces and newlines, without trimming
or normalization, with code-point counts alongside them. Emoji sequences can
occupy multiple units; the live editor may count differently. Skills are counted
as supplied without deduplication; duplicates and blank labels produce warnings.
The result does not include the draft text. The tool has no network or account
side effects and requires an active chat run through the scoped gateway. It is
omitted from isolated source-extraction and application runs, and direct gateway
calls remain subject to those restrictions and existing waiting, summarization,
conversation-access, role-pause and cancellation checks.

## Verification plan

- Check offline catalog inclusion, default assignments, role content budgets
  and preservation of existing skill edits, assignments and deletions.
- Test field-checking boundaries, Unicode input, empty and oversized input,
  exact-text preservation and the scoped gateway plus actual MCP stdio path.
- Verify the new starters with and without job context and keep existing
  starters working through the existing UI tests.
- Check instruction contracts for citations, dated/partial research,
  task-relevant sharing, user-reported LinkedIn provenance, unsupported claims,
  narrow edits and manual publication. These checks do not establish live
  provider coaching quality.
- Run the repository's formatting, lint, type, relevant test and build checks
  for the implementation. Do not use live provider calls in automated tests.

No new ADR is needed: this uses the established chat, memory, skill and scoped
tool architecture without introducing a difficult-to-reverse design choice.

## Verification results

On October 18, 2026, `pnpm check` passed on Node 22.23.2: lint, root and landing
types, all 44 Node script tests, 1,715 Vitest tests (two skipped), and production
UI, Electron main/preload and landing builds. Focused checks exercised the real
MCP stdio checker, invalid inputs, Unicode and limit boundaries, active-chat
access and revocation, isolated-run denial, offline seeding and user skill
customizations. Headless Chromium verified both new starters, existing coaching
starters, optional job context and mobile layout. Adapter contracts also cover
oh-my-pi's ordinary-chat tool list while preserving native-tool restrictions.
No live provider runs or LinkedIn publication were performed.

See the [glossary](../CONTEXT.md), existing
[career support](career-support.md) and the accepted
[drafting context boundary](adr/0001-separate-job-sources-from-drafting-context.md).
