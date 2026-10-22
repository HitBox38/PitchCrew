# Bounded Board and command lists

The Board searches every job before rendering a page. Each pipeline column renders at most 20 jobs; Closed renders at most 40. Persistent Previous/Next buttons and an announced range expose every result, while column and toolbar counts continue to describe the entire matching list. Changing the search resets the page; removing jobs clamps the visible range. Pages are disabled during dragging and saves.

Manual moves retain the existing status endpoints, optimistic state and rollback. The drag controller reveals the moved card's destination page before restoring keyboard focus, including when a move switches between Closed and Pipeline. Whole-card mouse dragging, individual status targets and Motion's separate card transforms remain available. The card actions menu now provides touch and keyboard status changes; see [board card actions](board-card-actions.md). A failed move reveals the original card when the preview clears.

The command palette scores the whole board with cmdk's existing `defaultFilter`, preserving title, company, location, tag and ID matches and score ordering. It mounts 25 job results per page. Previous/Next job results are ordinary selectable cmdk options, so arrow keys and Enter can reach every job without closing the palette. A custom filter gives only these internal paging options the lowest positive score and drops Settings entries scoring below 0.01 (scattered-letter matches); other views, roles and actions retain cmdk filtering. Jobs and Settings render in order of their strongest match, because React re-renders undo cmdk's DOM group sorting. New searches reset to page one and show a matching count/range. No job is discarded from the workspace snapshot or search.

## Verification

Unit regressions cover 2,500-job fuzzy matching beyond the first page, exact scorer ordering, complete result reachability, page removal/clamping and reveal selection for moved jobs. The native performance fixture uses 2,500 fictional jobs (500 active, 2,000 closed), production assets and a hidden, non-focusable Electron window with telemetry disabled. It measures five view switches in each direction and five command palette opens. Heavy benchmark runs are serialized with the other performance workstreams.

On this macOS M4 Pro host, the controlled before/after run measured:

| Metric                                   |         Before |      After |
| ---------------------------------------- | -------------: | ---------: |
| Open Closed, median of 5                 |     7,292.3 ms |    39.2 ms |
| Return to Pipeline, median of 5          |     5,530.5 ms |    31.2 ms |
| Open command palette, median of 5        |       510.5 ms |    36.7 ms |
| First palette open, including lazy chunk |     1,189.0 ms |   579.3 ms |
| Pipeline jobs / DOM nodes                |   500 / 11,056 |   20 / 981 |
| Closed jobs / DOM nodes                  | 2,000 / 42,518 | 40 / 1,364 |
| Mounted palette job options              |          2,500 |         25 |

The final native check also verified full-board search for job 2495, Closed page two containing exactly 40 mounted jobs, palette search for job 2499, page navigation and query reset, and the empty-result message. Trusted Electron keyboard events moved a job from Closed page two to Lead; its destination mounted on pipeline page two, its drag handle regained focus, and a separate read-only SQLite query confirmed the persisted `lead` state. The window was never shown or focused, and no renderer errors were recorded. A captured screenshot was inspected for layout. Post-script renderer working set was 1,463.4 MiB before and 423.5 MiB after; this is an observation without forced GC, not a leak test, and the after script performed extra correctness checks.

These are local provisional results: host load exceeded 100, five samples do not establish field percentiles, and the baseline/final scripts used the same Electron 44.5.1 executable with separate fictional data directories. Cold palette loading still costs about 579 ms. The scripts did not exercise providers, touch input, or failed network saves; existing status-gate and sensor tests remain relevant. Ordinary status changes retain their exit animations; switching pages resets the presence boundary so an outgoing page does not temporarily double the mounted result set. No version, dependencies, server endpoint or persisted schema changed.

Raw local evidence: `/tmp/pitchcrew-perf-20261014/board-lists/before-v3.json`, `after-final.json`, `persisted-keyboard-move.json` and `after-final.json.png`. Failed generated-wrapper syntax attempts were excluded from all metrics and hidden-window verification; subsequent wrappers were syntax-checked before launch. All owned fixture/native processes and generated desktop wrappers were removed after verification.
