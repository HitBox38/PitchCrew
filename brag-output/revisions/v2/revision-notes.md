# Revision 2 — cursor, clay depth and board alignment

| Before | After | Why |
| --- | --- | --- |
| The custom pointer had an irregular silhouette. | Conventional macOS arrow artwork, sourced from the Hyperframes cursor primitive, at 34×46 with a defined tip. | The pointer must be immediately recognizable. |
| Flat card fills, one shallow shadow and flat buttons. | Pitchcrew's theme recipes: upper-left lighting, layered outer and inset shadows, raised rims, recessed wells and glazed action buttons, scaled for the video. | Match the app's clay material and visible depth. |
| Job motion used 437px steps; the columns used 450px steps. Crew rows had separate widths. | Shared 430px columns with 20px gaps, 20px inner gutters and 450px movement steps. Cards and crew rows are 390px wide. | Remove the increasing horizontal drift and keep everything inside the window. |
| Translation and physical card pose had no separate surfaces. | A moving wrapper carries a briefly lifted and tilted inner card; both return to the exact grid at rest. | Show the app's dimensional feel while preserving alignment and reading clarity. |

## Review verdict

Approve for this authored marketing film. The pointer artwork, grid, final card positions and material rendering were inspected in the preview and frame captures. There are no remaining feel-breaking findings in the requested scope. The lift explains a handoff and settles before the readable hold; opacity is never sprung. The video remains 22 seconds with the same music and approval story.

## Validation

- Hyperframes check: zero errors and zero warnings; 68/68 text contrast checks passed.
- At 10s, the preview measured column left edges at 400, 850 and 1300px, each 430px wide.
- Crew rows measured 420, 870 and 1320px, each 390px wide, with a common 812px top and 90px height.
- The reviewed job measured x=1320, y=498, width=390, height=294; the packet measured x=870, y=498 with identical dimensions. Both have the same 20px column inset.
- The window is x=160, y=270, 1600×650. The crew rows now end at 902px, inside the 920px lower edge.
- Pointer artwork and contact were inspected at 4.39s, 16.38s and 16.65s.

Original output and composition sources are preserved under revisions/v1/.
