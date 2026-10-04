# Routines and scheduled actions

Routines persist an agent, task text, optional attached application, start time and repetition rules in the local board. Users manage them at `/routines` or ask an agent in chat. Agents use `pitchcrew_list_routines`, `pitchcrew_save_routine` and `pitchcrew_delete_routine`; they can also delegate schedule management through existing crew messages and invocations. Demo replies remain scripted and do not call tools.

## Timing

- A schedule without `cron` or `intervalMinutes` runs once at `startAt`.
- `intervalMinutes` repeats on an elapsed-time grid anchored to `startAt`, with a minimum of one minute.
- `cron` uses five deterministic fields: minute, hour, day of month, month, weekday. Calendar repeats use the IANA `timezone`, including daylight-saving changes. Random `H` fields and second-frequency cron are rejected. One-time timestamps can include seconds.
- `maxRuns` limits total dispatched occurrences, including failed/interrupted attempts. `endsAt` limits the time window; neither is required. Both can be used together. Editing retains the count; increasing the limit or changing the schedule can extend a routine.
- The editor interprets its date fields in the displayed timezone and rejects nonexistent times at a daylight-saving transition. Monthly dates missing from a month are skipped.

The daemon checks schedules every second while listening. It does not install OS jobs, wake the machine or run while Pitchcrew is closed. A busy or paused role, unavailable runtime, profile write or revoked originating capability postpones dispatch. Repeating schedules coalesce downtime into at most one overdue occurrence and resume on the next future boundary. A routine past its end time does not catch up. A routine's active follow-up chain finishes before its next occurrence can start.

## Execution and permissions

Each occurrence starts an isolated chat turn with the current role, runtime, model, instructions and assigned skills. For example, a Scout routine with `discoverJobs` enabled can scan saved job sources every few hours; see [job discovery](job-discovery.md). Its request is saved as a system message in the assigned role's chat; validated replies use the usual notifications. Runs carry `routineId` and `scheduledFor`. The scheduled agent can request workflow runs through its existing tools, with the usual card transitions and six-follow-up limit for each occurrence's chain.

`manageRoutines` controls agent mutations. Cross-role operations also require `invokeAgents`. Card-bound schedules are accessible only from runs with that attached application; card-free schedules are scoped by permitted roles. The daemon rechecks the last editor's current role permissions before an agent-managed routine fires. A user edit takes responsibility for that schedule. These permissions never grant connector access, role/skill changes, exports, browser approval or external submission.

Pausing or deleting stops future dispatches and leaves an active run alone. Stop the run from chat to cancel it and its follow-ups. Deletion saves a tombstone; it never removes event history and an update cannot restore a deleted routine.

## Persistence and restart

Version 8 adds routine events, scheduled-run metadata and the optional routine capability; versions 1–7 remain decodable. Every routine update appends an event and updates its projection transactionally. The scheduler consumes an occurrence before starting a runtime, so a crash cannot replay it and spend tokens twice. A crash between consuming and launching can miss that occurrence; failed/interrupted occurrences are not automatically retried. Recurring schedules continue with the next eligible occurrence. Existing startup recovery marks interrupted runs and follow-ups failed.

Run and scheduler errors appear on the routine and in chat/activity. Routine management HTTP routes use the existing UI session/header/origin/Host security. MCP calls use the existing per-run capability and cancellation checks. All outward-action approval gates remain in MCP.
