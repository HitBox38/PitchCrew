---
status: accepted
---

# Separate job sources from drafting context

Design decision accepted on 2026-10-12 and refined on 2026-10-13; the runtime implementation follows this boundary. An application incident exposed hidden employer-page directives being followed in employer-facing copy. Prompt warnings, profile quotation checks and a second reviewer reading the same description did not establish whether those directives were legitimate application requirements.

Writer and Reviewer will receive a structured job brief and accepted application requirements rather than the original employer text through their prompts or tools. Source text remains available to the user and the extraction step. Visible, application-relevant requests can become proposed requirements; known hidden directives are excluded and flagged, and ambiguous requests need user clarification. Before the first draft for every job, the user confirms the complete brief and exact proposed requirements in one compact review screen, including flagged text, regardless of whether visibility can be established. Scout can assess fit beforehand. Saving a description does not constitute drafting confirmation.

This boundary trades unrestricted drafting access to original descriptions for reduced exposure to rejected or hidden directives. It adds a confirmation step for every job: checking requirements alone would allow a compromised extractor to carry a directive into company context or another brief field. Extracted briefs remain untrusted reference material: extraction can err, confirmation grants no agent permissions, and this design does not guarantee that all prompt injections are prevented.

The boundary applies to every application draft, including employer-facing chat copy and drafts produced by custom agents. Chat can discuss source material, but drafting must use a separate context that excludes raw source text from earlier messages, attachments and agent handoffs as well as direct source reads. Workflow seat or agent identity must not provide a bypass.

Source extraction will use a separate restricted run, limited to reading the selected job source and returning a structured brief, proposed requirements and flagged directives. It will receive no profile, private account access, agent memory, crew messaging, scheduling or workflow actions. The daemon must enforce these limits rather than relying on the extractor's instructions. Scout can assess fit afterward using the brief and profile. This adds a processing step and limits the access and side effects available to a compromised extractor; it does not establish the semantic safety of its output.

Drafting confirmation and packet review are bound to the exact adopted brief and requirement set. Adopting changes invalidates both: the user reviews the differences and confirms the new context, and the packet must be reviewed against it before export. An unchanged refresh or a rewrite using the same confirmed context does not require another drafting confirmation. Confirmation is not a blanket decision for all future versions of a job.

Missing personal opinions or other personal answers must produce a question to the user rather than an inferred response. Unanswered required questions block the packet from becoming Ready; supported sections can be drafted while waiting, and optional unanswered questions can be omitted. Writer may polish user-supplied answers but must not infer that the user likes or has used an app from projects or public research. This addresses invented answers to legitimate requirements as well as content influenced by hidden directives.

Personal application answers stay specific to the application by default, using their saved user-answer provenance. Reuse across jobs requires the user to explicitly save the answer to Profile. Factual achievements remain subject to the existing verified-profile quotation requirements; a subjective application answer is not a substitute for that evidence.

Existing unsent packets, including Ready packets and previously exported packets, must satisfy drafting confirmation and fresh packet review before another export or browser submission is permitted. Assess this when a packet is next used rather than rewriting all cards at startup. Preserve existing text, files and history, and show that the packet needs the new checks; an earlier export is not evidence that its source context satisfied this boundary.

Extraction failure, invalid extraction output or a runtime unable to enforce the required context and tool restrictions stops drafting. Recovery can retry, use a supported runtime selected by the user, or accept a manually prepared brief through the same confirmation step. Recovery must not fall back to passing the original description into a drafting run.

See [the implementation plan](../application-source-safety.md) for rollout, enforcement paths, verification and residual limitations.
