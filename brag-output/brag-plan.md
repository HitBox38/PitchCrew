# Brag Plan: Pitchcrew — actual app edition

## Planning rubric
1. **App:** A local-first job-search app with a configurable crew of role agents.
2. **Strongest claim:** The actual JobPacket interface says each claim quotes the user's profile notes word for word. The film shows that Sources section.
3. **Visual hook:** Pitchcrew's actual CrewCard icons and physical cards, captured from the built app.
4. **Product material:** Native CrewCard, BoardPage / JobCard, JobPacket Sources and InboxReview / PendingPacketDecision, all from packages/ui.
5. **Length:** 22 seconds, 1920×1080 at 30fps.
6. **Tone:** Polished, warm and product-focused. The app's own materials provide the identity.
7. **Audio:** Existing bundled vol.12 music bed, sparse accents and no narration.
8. **Caption:** I built Pitchcrew: a local-first job-search app with a crew that checks fit, drafts applications and reviews every claim against your notes. Nothing submitted without you.
9. **Flow:** Opportunities on Board → inspect the actual source-backed packet → review and approve the packet in Inbox.

## Capture method
Build packages/ui, run the actual daemon/UI in a fresh temporary directory with dev-only example fixtures, then capture the running app in a fresh Chrome/Playwright context at device scale 2. No real account profile or personal workspace is used. All product UI pixels come from the app; camera framing, editorial titles and a conventional cursor are added for the film. There is no recreated product UI or landing-page component in the current scenes.

The fictional Waypoint / Senior UI Engineer example supplies the packet and approval. The built-in fictional Alex Morgan profile is labelled as an example candidate. No application is submitted. The native packet contains Markdown attachments, so the film makes no PDF/DOCX-specific claim.

## Storyboard — 22.00 seconds

| Time | Picture | Copy and interaction |
| --- | --- | --- |
| 0.00–3.27 | Actual Scout, Writer and Reviewer CrewCard captures fan into view alongside the app's actual icon. | Meet your job-search crew. |
| 3.27–7.10 | Actual Board capture, with a camera crop bringing the real Shortlisted, Drafting and Ready cards into focus. | Every opportunity, on one board. |
| 7.10–10.93 | Actual JobPacket Sources element, including two claims and example.md citations. | Drafts with sources. Deliberate reading hold. |
| 10.93–17.47 | Actual Inbox pending packet and attachment tiles; then a late camera move to the native Approve packet action. The real approved-state capture replaces the pending-state capture after the click at 16.38. | You choose how to apply. No application submitted. |
| 17.47–22.00 | Actual app icon, Pitchcrew wordmark and public repository address. | Your search. Your crew. Local-first. Free and open source. |

## Identity and audio
The film uses the app's #f2f1ec paper, #2b2d31 ink and #2f6a69 teal for editorial framing. Its typefaces are the app's local Fraunces Variable and Source Sans 3 files. Product surfaces, typography, controls and alignment are captured directly, with their native styles intact.

Music remains Happy Beats / Business Moves vol.12 by Sascha Ende, ende.app, CC BY 4.0; gain .30 with .3s fade in and 1.25s fade out. The existing cue grid is retained. Major seams at 10.93 and 17.47 and the 16.38 approval click keep their musical timing. Sparse SFX remain on board reveal, Inbox reveal and approval. The decorative outro light retains source-derived audio energy modulation.

## Provenance and validation
See app-capture/provenance.json for source file and screenshot hashes, capture actions and the fixture source. The original two versions remain in revisions/v1 and revisions/v2. Check-v3 audits the composition and editorial text; captured UI text is inspected in rendered frames. Final verification checks picture duration, frame count, audio retention and the baked poster.
