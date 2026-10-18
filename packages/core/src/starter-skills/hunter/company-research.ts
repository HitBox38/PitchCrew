import { hunterSkill } from './common.ts';

export const companyResearch = hunterSkill(
  'career-company-research',
  'Research a company with dated sources, relevant team context, interview information, employer concerns and useful questions.',
  'hunter-research',
  `# Research a company

Users can ask for company research or a full company brief directly. Also research relevant public information when it helps the current requested task, such as evaluating an opportunity or preparing for an interview. Do not automatically produce a full brief for each discovered job. A full brief is produced when requested. During an isolated fit or application run, remain within that run's supplied context and available tools; do not fetch original job sources or bypass tool restrictions.

Establish the company and purpose from the conversation, optionally using the attached job. Disambiguate similarly named companies, parent/subsidiary relationships and relevant country or team when material. Ask for essential missing context instead of silently choosing the wrong employer. Reuse sourced background already available in conversation or memory. Recheck time-sensitive information such as recent news and the interview process when relevant now; distinguish newly checked facts from older background and retain dates. Do not add background refresh schedules.

Use pitchcrew_computer_inspect, pitchcrew_computer_request and pitchcrew_computer_execute only within existing browser permissions and supervision. Search with public company/role information; never transmit private Profile notes, user identity, chat text, offer amounts or negotiation limits in queries. If browsing is unavailable, declined or sources are inaccessible, continue with a clearly dated, partial brief from available material, naming what could not be checked. Do not imply that a page was read when it was not.

For a full brief, cover: business and product; relevant team and work; recent developments; the reported interview process; material employer concerns; unknowns and questions to ask. Keep it compact and prioritize what matters to this user's purpose. A narrow research request can receive a narrower answer. Prefer relevant primary sources such as company/product pages, official hiring guidance and public filings. Filings are optional when useful, not a requirement for private or non-US employers. Identify company statements as company statements, not proof of workplace culture. Separate third-party reporting, candidate anecdotes, inference and official information. A recruiter's current description of this specific process takes precedence over a generic published loop; preserve and explain discrepancies. Practice questions inferred from the role are not actual or guaranteed interview questions.

Attach a source link and relevant publication/as-of date to material claims, including employer concerns such as reported layoffs, instability or workplace issues. Distinguish a report, allegation or isolated candidate account from an established fact. Explain relevance without inventing causation, certainty or a universal employer-risk score. Turn consequential gaps and concerns into useful questions for the employer. Do not invent current financial figures, team membership, hiring plans or interview policies; unknown means unknown. Public company observations do not establish why the user wants to work there. Keep that personal answer for the user.`,
);
