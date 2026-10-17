export const improveSystem = {
  name: 'improve-system',
  description:
    'Finds recurring crew correction patterns and proposes measurable improvements. Use when the user asks Pipeline Coach to improve the crew, review repeated mistakes or follow up on an earlier improvement.',
  content: `# Improve the crew from observed corrections

Use this retrospective when the user requests it, or within an explicitly configured review routine. Focus on repeated crew behavior and the smallest useful improvement. Ordinary fit, drafting and review tasks do not start a retrospective.

## Select evidence you can actually read

- Announce the intended review and use the user's chosen applications and date window. If scope is missing, ask with pitchcrew_ask_user and end the turn. Do not create a recurring review without the user's chosen cadence.
- Start with pitchcrew_application_insights for the selected tags/dates. Use pitchcrew_read_pipeline with input.section set to cards, runs, events, roles or reviews. Follow nextCursor pages within the agreed scope; report unread pages or truncated evidence as coverage gaps.
- Read individual review, run_configuration and role_configuration details with entityId when needed. Review all current non-retired roles, including paused roles and yourself; mark seats without relevant evidence insufficient_evidence.
- Use saved card feedback, board events, user lessons, earlier review findings and follow-up results. Cite real event IDs and identify the affected applications/runs. The event list contains bounded metadata, not full conversation history; do not claim to mine other agents' private memories, session files or raw CLI logs.
- Compare saved launch configurations with current instructions and assigned skills. Missing historical configuration stays unknown. Current packet detail does not establish what an earlier run produced.

## Distinguish repetition from duplicate records

- Require at least two independent occurrences across distinct runs or applications before proposing a standing rule. Progress updates, repeated feedback on one unchanged packet and multiple reports of the same incident count once. Keep single incidents as watch items; an immediate task-specific fix need not become a permanent rule.
- Separate observed corrections from hypotheses. An employer rejection is an outcome, not evidence that the crew made a particular mistake. User weights and lessons provide context, not causal proof or verified profile facts.
- Check whether the applicable launch instructions already covered the problem. If they did, investigate an execution, missing-context or tool limitation instead of adding the same rule again. Preserve necessary constraints while preferring a focused clarification or consolidation over accumulating instructions.
- Check previous reviews and their latest follow-ups. Do not repeat dismissed recommendations without new evidence; describe that evidence when reopening one. If a previous proposal's decision is unavailable, say so rather than assuming adoption or rejection.

Example: the same unsupported claim appearing in three event updates is one incident. Unsupported claims in two independently drafted applications can support a pattern; first check whether Writer's saved instructions already prohibited them.

## Measure without inventing a score

- Report the window, applications and distinct runs examined, independent correction counts by theme, and coverage gaps. A correction rate needs a defined eligible-run denominator and observable corrections; otherwise report counts and mark the rate unavailable.
- Compare with an earlier review only when scope, task mix and measurement definitions are comparable. Show numerator/denominator and small-sample limits. Silence or missing logs does not establish that the crew is working well.
- For each candidate improvement, define an observable next-run check and an evaluation window or sample. For example: count reviewed drafts needing unsupported-claim corrections across the next five eligible drafts. Report what is observed without claiming the instruction change caused the result.
- Do not estimate token spend, cache savings or model quality from run status, elapsed time or outcomes. If the permitted tools lack usage/billing evidence, mark cost analysis unavailable. Model comparisons require an explicitly authorized comparison with comparable tasks and criteria; do not launch experiments as part of this skill.

## Save findings and propose bounded changes

- Save evidence-backed findings with pitchcrew_save_pipeline_review, declaring criteria, every-seat assessments, a concrete nextRunImprovement and measurement. Its findings require event evidence; when there is no supported finding, give the user a coverage/metrics summary and watch items instead of fabricating a finding just to save a review.
- For a role instruction change, read the current role_configuration revision and use pitchcrew_propose_crew_changes tied to your own saved review/finding. Preserve unrelated instructions, explain the exact change and expected check, and notify the user before proposing. If the target is paused or a permission is unavailable, explain the blocker and leave a recommendation for user review.
- For a genuinely new reusable skill, use pitchcrew_propose_skill with the narrowest role assignment and the supporting review/event references in its reason. This tool adds skills; it does not update an existing skill. For an existing skill, present its ID, exact before/after edit and assignment for the user to apply in Skills; do not add a competing copy.
- Prioritize the few changes best supported by evidence and stay within tool limits. Only the user's explicit decision adopts a proposal. Do not change capabilities, packet rules, application weights, lessons or tags, save proposed instructions as memory, or ask peers to adopt recommendations outside the normal user-reviewed flow.

## Follow up

Use pitchcrew_update_pipeline_review to record evaluating/resolved/dismissed status, observed metrics and real follow-up event evidence. Resolve only when the result and evidence support it; record inconclusive outcomes explicitly. Leave original criteria intact and explain any new measurement separately. Summarize findings, watch items, pending decisions and the next check for the user. Do not create a schedule or launch other agents merely to collect evidence.

Adapted for Pitchcrew from the retrospective approach in gasserane/personal-skills/improve-system (https://skills.sh/gasserane/personal-skills/improve-system). Uses Pitchcrew's scoped evidence and user-reviewed proposals instead of the original personal logs, hooks and spend audit.`,
} as const;
