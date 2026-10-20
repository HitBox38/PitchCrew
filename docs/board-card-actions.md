# Board card actions

Board card actions are available from the three-dot button on each job in Pipeline and Closed.

## Access and movement

The three-dot actions menu replaces the six-dot drag handle in the same position. Whole-card mouse dragging remains available. Touch and keyboard users change status through **Move to…**, which lists individual statuses. The menu trigger and card body share one animated surface, so the trigger follows the card’s hover lift and tilt. Drag transforms remain on the outer wrapper. Touch gestures scroll the board rather than starting a card drag.

Manual status changes record local bookkeeping. They do not start agents, export packets or submit applications. Existing status restrictions and approval invalidation still apply.

## Common actions

- **Open details**.
- **Move to…**.
- **Copy job posting link**, available when the job has a URL.
- **Delete job…**, separated at the bottom and requiring confirmation.

Deletion uses the existing job deletion behavior: remove the card from the board, retain stored history and exported files, cancel queued requests and follow-ups and pause attached routines. There is no Trash or user-facing restore action. The confirmation dialog explains these consequences and initially focuses **Keep job**. **Mark withdrawn** is the alternative for a job the user may want to revisit.

## Status shortcuts

Show shortcuts relevant to the current status rather than every action on every card:

- New leads: **Shortlist** and **Mark withdrawn**.
- Other jobs before applying: **Mark submitted** and **Mark withdrawn**.
- Jobs after applying: record screening, interviewing, an offer, rejection or no response; **Mark withdrawn**.
- Closed jobs: reopen through **Move to…**.

**Mark withdrawn** moves the job to Closed and preserves its history. It does not notify the employer.

Menu status changes keep the user's current Pipeline or Closed view and show a confirmation toast. A card that leaves the current view disappears from that list. Reopening from Closed also leaves the user in Closed. Dragging retains its existing behavior of following the card to its destination.

## Crew shortcuts

Show the relevant existing workflow action for the job's stage:

- **Evaluate fit** for a new lead.
- **Draft application** for a shortlisted job or requested changes.
- **Review packet** at the review stage.
- **Cancel run** while an agent is working.

Required brief confirmations and approval steps retain their existing flows. If a brief needs preparation or confirmation, a crew shortcut opens job details rather than starting work. Crew actions enter the shared job queue. A duplicate shortcut opens its pending entry; work for another job does not disable the same agent. Disabled actions explain missing agents, runtimes, profile notes or packets. The Queue page supports future stages and intentional repeats. Status changes and deletion remain disabled while the job is owned or has an active workflow or attached chat run. The daemon rechecks these restrictions for user status changes and deletion.

## Persistence and focus

Menu status changes and drags share the existing manual-status endpoint, optimistic preview and rollback. Neither creates submission receipts. The new session-protected `DELETE /api/cards/:id` route calls the existing deletion transaction as the user and rejects active attached chat runs as well as workflow runs and ownership.

After a move, the destination page is revealed within the current view. If the card leaves that view or is deleted, focus moves to a neighboring visible card menu, falling back to the selected board view control or the empty board’s Add job action. The page owns mutation and deletion-dialog state so deleting the last card retains focus handling after the pipeline unmounts. Menu and dialog focus restoration yield to this board focus handling when an action removes or relocates its trigger.

## Verification

Headless browser regressions cover shared hover movement, menu isolation from card opening and dragging, posting-link copying, withdrawal and reopening without switching views, keyboard access to individual grouped statuses, deletion confirmation and focus, failed status rollback, cancellation during attached chat work, whole-card mouse dragging, required brief review before crew execution, bounded phone-sized touch menus, and stationary reduced-motion hover. HTTP tests cover UI-session enforcement, deletion in every status, history replay, active-work rejection, and queued-work/routine cleanup. Existing board transaction tests cover approval invalidation and rollback.
