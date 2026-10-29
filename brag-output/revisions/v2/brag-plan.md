# Brag Plan: Pitchcrew

## Planning rubric
1. **App:** A local-first job-search app where Scout, Writer and Reviewer help turn opportunities into reviewed application packets.
2. **Strongest claim:** “Nothing made up, and nothing submitted without you.” (`packages/landing/src/Hero/index.tsx`.)
3. **Visual hook:** The three-piece clay P and teal, indigo and plum crew surfaces on warm paper.
4. **Actual UI:** The board's fictional Forma / Design Engineer card, the Scout → Writer → Reviewer handoff, a packet claim linked to experience.md, and user export approval.
5. **Shortest satisfying film:** 22 seconds, 1920×1080, 30 fps.
6. **Tone:** polished; a warm, tactile product film, with confident typography and motivated transitions.
7. **Audio:** A steady, clean music bed with three quiet, motion-matched accents. No narration.
8. **Caption:** I built Pitchcrew: a local-first job-search app with a crew that checks fit, drafts applications and reviews every claim against your notes. Nothing submitted without you.
9. **User flow:** Add an opportunity → Scout checks fit, Writer drafts and Reviewer checks sources → inspect the packet and approve its export.

## The angle
Your job search has a crew behind it; you keep the final say. Show the application doing real work, then make the source citation and user approval the payoff.

## Hook
“Your job search, with a crew behind you.” The actual three-piece P and three raised crew tiles make the product identity visible immediately.

## Key moments
- Forma / Design Engineer, the existing fictional example, gets its 85% fit assessment.
- Writer and Reviewer hand off on the same opportunity; the board progresses to In review and Reviewed.
- A resume line matches experience.md. The visible pointer presses Approve export; this grants a local export, not an application submission.

## Outro
Pitchcrew. “Nothing submitted without you.” Free and open source. The public repository supplies the CTA.

## Visual identity
- Paper #f2f1ec; bright surface #fdfcf9; inset #e8e6df.
- Ink #2b2d31; secondary text #61646b.
- Scout teal #2f6a69; brand indigo #3a5482; Writer plum #76517a; Reviewer moss #53673d.
- Display: Fraunces Variable, 600. Body: Source Sans 3, 400/600/700. Local font files from packages/ui.
- Raised rounded clay cards with white rims and soft physical shadows, matching the app.

## Audio direction / Music cue guidance
- Bundled Happy Beats / Business Moves vol. 12 by ende.app, source 0–22s; gain 0.30, 0.3s fade in, 1.25s fade out.
- Read assets/music/cues/happy-beats-business-moves-vol-12-by-ende-dot-app.music-cues.md and JSON from the brag skill.
- Beat grid: 3.27, 4.39, 6.56, 8.74, 10.93, 13.11, 16.38, 17.47.
- Major cue locks: Reviewer reveal at 8.74s, evidence scene at 10.93s, outro at 17.47s.
- Sequential crew reveals are two seconds apart; each remains readable after arrival.
- Audio-reactive treatment: source-derived energy subtly changes the presence of the logo's surrounding light; no text scale pulses or visualizer.
- Three accents: board reveal, evidence panel arrival and user approval. Prefer low high-frequency-risk files.

## Storyboard — 22.00 seconds total

### 1. Your crew — 0.00–3.27 (3.27s)
Large two-line hero copy from Hero/index.tsx, with the actual app icon and Scout, Writer and Reviewer tiles. Fast arrival followed by a settled headline hold. The tiles carry into the working board's three stages.
Sequential/interaction: crew tiles enter at 0.56, 1.09 and 1.64; the full set then holds.
Transition: horizontal carry into the application board.
Audio intent: a clean warm opening; let the music establish the pace.

### 2. One opportunity, three agents — 3.27–10.93 (7.66s)
Reconstruct the app's actual board materials and labels at video-readable scale. Show Forma / Design Engineer / Berlin · Hybrid / 85% fit (fictional demo data). Scout checks fit at 4.39, Writer drafts at 6.56, Reviewer checks at 8.74. A highlight travels across Shortlisted → Drafting → Ready; the job status and packet update in the focused card.
Sequential/interaction: cursor selects Evaluate fit; three crew results arrive, stay visible, and culminate in Reviewed. The sequence condenses separately requested workflow steps; it does not assert automatic end-to-end application submission.
Transition: the packet panel expands into the source-backed review.
Audio intent: quiet thud on board reveal; no sound on every label.

### 3. Your notes, your approval — 10.93–17.47 (6.54s)
Headline: “Your notes. Your approval.” A resume preview carries the exact existing demo line “Created reusable UI components and documented their interaction patterns.” Beside it, experience.md shows the same line and “Matches your notes word for word.” A source link visibly connects them. The user pointer presses Approve export at 16.38; the button becomes Export approved. A note says final submission requires approval.
Sequential/interaction: matching evidence appears at 11.46; the exact quote holds over four seconds. User approval lands at 16.38.
Transition: the approved panel contracts toward the brand icon as the final paper stage opens.
Audio intent: soft panel accent and precise approval click.

### 4. Pitchcrew — 17.47–22.00 (4.53s)
Actual icon and Pitchcrew wordmark. “Nothing submitted without you.” “Free and open source.” Public repository CTA: github.com/HitBox38/PitchCrew. The last frame holds fully settled for over three seconds.
Sequential/interaction: none; deliberate still finish.
Audio intent: bed resolves with a 1.25s fade.

## Grounding and privacy
The film uses the public source and its explicitly fictional Forma job. No real candidate, user data, live account, private workspace or credential is used. The sample resume shows no personal name. Fit scores are illustrative demo values, not measured production outcomes. Recreated UI is presented as a fictional example and its text is grounded in README.md, Journey/demo/data.ts, Journey/demo/packet.ts and ReviewThread/constants.ts.

## Revision 2
Replace the custom cursor silhouette with a conventional macOS arrow. Use Pitchcrew's real layered clay, recessed and glazed material recipes, scaled to the video, plus restrained perspective on the intro cards and temporary card lift during board handoffs. Use one measured grid for columns, moving cards, the packet and crew rows. Preserve all story timing, copy, music and the 22-second duration. See revision-notes.md for findings and measured geometry.
