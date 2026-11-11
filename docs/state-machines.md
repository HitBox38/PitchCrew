# State machines

Generated from `packages/core/src/lifecycles.ts` by `bun run docs:state-machines`. Do not edit by hand.

Each diagram is the complete list of moves a status may make. Saving an entity without
changing its status is always allowed. Tests refuse any other move
(`PITCHCREW_LIFECYCLES=enforce`); an installed daemon saves it and warns once, so a move
the tables missed never stops work. To add a move, change the table, run the generator and
cover the new edge with a test.

## Job

Checked by `board.move`. Crew work saves jobs through `board.crewMove`, which also allows these rework moves (`reworkTransitions`):

- changes_requested → in_review
- agreed → in_review
- awaiting_approval → in_review
- in_review → drafting

User and `manageWorkflow` corrections may record any status.

```mermaid
stateDiagram-v2
  [*] --> lead
  lead --> shortlisted
  lead --> withdrawn
  shortlisted --> drafting
  shortlisted --> withdrawn
  drafting --> in_review
  drafting --> changes_requested
  in_review --> agreed
  in_review --> changes_requested
  changes_requested --> drafting
  changes_requested --> withdrawn
  agreed --> awaiting_approval
  agreed --> changes_requested
  awaiting_approval --> agreed
  awaiting_approval --> changes_requested
  awaiting_approval --> submitted
  submitted --> screening
  submitted --> interviewing
  submitted --> rejected
  submitted --> withdrawn
  submitted --> ghosted
  screening --> interviewing
  screening --> rejected
  screening --> withdrawn
  screening --> ghosted
  interviewing --> offer
  interviewing --> rejected
  interviewing --> withdrawn
  interviewing --> ghosted
  offer --> withdrawn
  ghosted --> screening
  ghosted --> interviewing
  ghosted --> withdrawn
  rejected --> [*]
  withdrawn --> [*]
```

Named sets:

- `preparing`: lead, shortlisted, drafting, in_review, changes_requested, agreed, awaiting_approval
- `applied`: submitted, screening, interviewing, offer
- `closed`: rejected, withdrawn, ghosted
- `draftable`: shortlisted, changes_requested
- `reviewable`: in_review, agreed, awaiting_approval

## Run

Checked on every board write.

```mermaid
stateDiagram-v2
  [*] --> running
  running --> waiting
  running --> completed
  running --> failed
  running --> cancelled
  waiting --> completed
  waiting --> failed
  waiting --> cancelled
  completed --> [*]
  failed --> [*]
  cancelled --> [*]
```

Named sets:

- `live`: running, waiting
- `settled`: completed, failed, cancelled

## Crew task

Checked on every board write.

```mermaid
stateDiagram-v2
  [*] --> queued
  queued --> running
  queued --> failed
  queued --> cancelled
  running --> waiting
  running --> completed
  running --> failed
  running --> cancelled
  waiting --> completed
  waiting --> cancelled
  failed --> queued
  failed --> cancelled
  completed --> [*]
  cancelled --> [*]
```

Named sets:

- `live`: queued, running, waiting
- `engaged`: running, waiting
- `recoverable`: queued, running
- `settled`: completed, failed, cancelled

## Message delivery

Checked on every `chat_request` write, per recipient.

```mermaid
stateDiagram-v2
  [*] --> queued
  [*] --> paused
  queued --> running
  queued --> paused
  queued --> cancelled
  running --> queued
  running --> waiting
  running --> completed
  running --> paused
  running --> failed
  running --> cancelled
  waiting --> completed
  waiting --> failed
  waiting --> cancelled
  paused --> queued
  paused --> completed
  paused --> cancelled
  failed --> queued
  failed --> paused
  failed --> cancelled
  completed --> [*]
  cancelled --> [*]
```

Named sets:

- `done`: completed, cancelled
- `unsent`: queued, paused, failed
- `stopped`: paused, failed
- `engaged`: running, waiting
- `moving`: queued, running
- `active`: queued, running, waiting

## Question

Checked on every board write.

```mermaid
stateDiagram-v2
  [*] --> pending
  pending --> answered
  pending --> cancelled
  answered --> cancelled
  cancelled --> [*]
```

## Packet approval

Checked on every board write.

```mermaid
stateDiagram-v2
  [*] --> pending
  pending --> approved
  pending --> rejected
  approved --> consumed
  approved --> rejected
  consumed --> [*]
  rejected --> [*]
```

Named sets:

- `open`: pending, approved
- `granted`: approved, consumed

## Browser action approval

Checked on every board write.

```mermaid
stateDiagram-v2
  [*] --> pending
  [*] --> approved
  pending --> approved
  pending --> rejected
  approved --> consumed
  approved --> rejected
  approved --> failed
  consumed --> failed
  rejected --> [*]
  failed --> [*]
```

Named sets:

- `open`: pending, approved
- `used`: consumed, failed

## Submission attempt

Checked on every board write.

```mermaid
stateDiagram-v2
  [*] --> uncertain
  uncertain --> confirmed
  uncertain --> not_submitted
  confirmed --> [*]
  not_submitted --> [*]
```

## Deep review

Checked on every board write.

```mermaid
stateDiagram-v2
  [*] --> running
  running --> waiting
  running --> completed
  running --> needs_changes
  running --> failed
  running --> cancelled
  waiting --> running
  waiting --> failed
  waiting --> cancelled
  failed --> running
  completed --> [*]
  needs_changes --> [*]
  cancelled --> [*]
```

Named sets:

- `live`: running, waiting
- `resumable`: waiting, failed

## Review subagent

Checked on every board write.

```mermaid
stateDiagram-v2
  [*] --> running
  [*] --> unavailable
  running --> completed
  running --> failed
  running --> cancelled
  completed --> [*]
  failed --> [*]
  cancelled --> [*]
  unavailable --> [*]
```

## Delegation round

Checked on every board write.

```mermaid
stateDiagram-v2
  [*] --> queued
  queued --> running
  queued --> collecting
  queued --> completed
  queued --> cancelled
  running --> queued
  running --> collecting
  running --> completed
  running --> cancelled
  collecting --> queued
  collecting --> running
  collecting --> completed
  collecting --> cancelled
  completed --> [*]
  cancelled --> [*]
```

Named sets:

- `settled`: completed, cancelled

## Proposal

Checked on every board write.

```mermaid
stateDiagram-v2
  [*] --> pending
  pending --> applied
  pending --> rejected
  applied --> [*]
  rejected --> [*]
```

## Profile update

Checked on every board write.

```mermaid
stateDiagram-v2
  [*] --> pending
  pending --> applying
  pending --> rejected
  applying --> applied
  applied --> [*]
  rejected --> [*]
```

Named sets:

- `open`: pending, applying

## Tracking signal

Checked on every board write.

```mermaid
stateDiagram-v2
  [*] --> pending
  [*] --> applied
  [*] --> ignored
  pending --> applied
  pending --> rejected
  applied --> [*]
  ignored --> [*]
  rejected --> [*]
```
