# Insights and learning signals

Learning signals let you record what each application taught you, so you and your crew can learn from outcomes before writing the next one. You set every signal. Agents with the right access can read a summary, but they never change it.

## What you record

Open a job and find **What you learned** under Outcome.

- **Weight.** A whole number from -2 to +2: strong miss, miss, neutral, win, strong win. It is your own judgment of how the application went, apart from its outcome. A rejection after a great interview can still be a win. New and older jobs start at 0.
- **Lessons.** Short notes about what worked or what to change. Each lesson keeps the time you added it. A job keeps up to 20 lessons of up to 1,000 characters each. Removing a lesson hides it from the job, but the job history keeps the earlier version.
- **Tags.** Jobs already have up to 10 tags. Insights group jobs by tag, ignoring case.

## Outcomes

Pitchcrew derives an outcome from each job's state:

| Outcome  | States                                 |
| -------- | -------------------------------------- |
| Positive | Interviewing, Offer                    |
| Negative | Rejected, No response (`ghosted`)      |
| Neutral  | Withdrawn                              |
| Pending  | Every other state, including Screening |

## The Insights page

**Insights** in the sidebar shows:

- Outcome counts for the jobs that match the filters.
- A weight distribution from -2 to +2.
- Recent lessons grouped by outcome, newest first.
- A tag scoreboard: number of jobs, positive share, average weight and up to five sample companies. Positive share counts only decided jobs, meaning positive, negative or neutral ones, so pending jobs do not lower it. Sort by jobs, positive share, average weight or name. Select a tag to filter by it.

Filter by tag and by an applied date range. The applied date is the submission time for jobs registered as applied outside Pitchcrew, and the date the job was added for all others. Example jobs loaded in development are left out. Filters live in the address, so a filtered view can be bookmarked.

Small numbers are weak evidence. Outcomes show what happened, not why.

## Tidy up

Both actions show a preview and ask you to confirm. Agents cannot run them.

- **Merge tags.** Choose an old tag and type a new one. Every job with the old tag gets the new tag instead, and the old tag is removed. The match ignores case, so you can also fix spelling, for example `reactjs` to `React`. A job that already has both keeps one. Because the old tag is dropped, no job goes over 10 tags.
- **Silent applications.** Choose a number of days from 1 to 365. The default is 21. Then select **Find silent applications**. The list shows submitted jobs with no status change for that long. Example jobs are not listed. Select the ones to mark and add an optional note for the job history, then confirm. Each batch marks up to 200 selected jobs; check again to process the rest. Nothing runs on a schedule.

A silent application is measured from its last effective status time, following the [tracking rules](tracking.md): your own status changes, backdated external submissions and accepted email evidence. When an agent or an example moved the job into Submitted, the time of that move is used.

Marking moves the job from Submitted to No response through the normal state machine. The new effective time is the day the silence reached your chosen number of days, not the moment you confirm. A reply dated after that day can still move the job to Screening or Interviewing, through email tracking or by hand. Jobs with active workflow work stay unselectable. If a selected job changes after the preview, the whole batch is rejected; check again.

## Agent access

`pitchcrew_application_insights` is a read-only MCP tool. It needs `readApplications` or `reviewPipeline`, the two existing capabilities that already grant cross-application reads. No new capability is added, and defaults are unchanged: Tracker and Submitter have application reads, and Pipeline Coach has pipeline review. Scout and Writer are told to use insights only when you give them one of these capabilities.

The tool accepts optional `tag`, `sort`, `from` and `to`. Dates are ISO times with an offset. `tagLimit` goes up to 50 and `lessonLimit` up to 10 per outcome. Lessons are cut to 500 characters. Each response stays within 64 KB. If it would not fit, the tool shortens the lesson lists first, then the tag list, and sets `truncated`. The gateway rechecks the role, its capabilities and the active run on every call.

There is no agent tool or gateway action to set weights, add lessons, merge tags or mark jobs as no response. The HTTP routes for these require the local UI session:

| Route                                     | Purpose                           |
| ----------------------------------------- | --------------------------------- |
| `PUT /api/cards/:id/weight`               | Set the weight                    |
| `POST /api/cards/:id/lessons`             | Add a lesson                      |
| `DELETE /api/cards/:id/lessons/:lessonId` | Remove a lesson                   |
| `POST /api/tags/merge`                    | Merge tags                        |
| `GET /api/insights/stale?days=21`         | Preview silent applications       |
| `POST /api/insights/stale`                | Mark selected jobs as no response |

## Persistence

Event version 11 adds optional `weight` and `lessons` fields to card events. Weights, lessons, tag merges and no-response marks are ordinary user card events, each written with its card projection in one transaction. Versions 1 to 10 remain decodable and replayable; cards without learning fields read as weight 0 with no lessons. Prerelease version 10 learning snapshots remain decodable unchanged, alongside version 10 discovery snapshots. The insights calculation is a pure function in `@pitchcrew/core/insights`, shared by the Insights page and the MCP tool.

Tests use fictional jobs and temporary workspaces: v11 appends and mixed v9/v10/v11 replay with both historical v10 payload families and raw-row retention, imported learning signals and idempotent re-import, outcome and scoreboard math, filters, tag merges at the 10-tag cap, stale previews and marks with effective times, changed cards and active work, HTTP session boundaries, capability gating and MCP output bounds.
