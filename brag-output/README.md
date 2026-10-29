# Pitchcrew launch film

The current film uses captured elements from the running app: native Crew cards, Board/JobCard, JobPacket Sources and Inbox approval. All data is fictional. Camera framing, titles, a conventional cursor and music form the edit.

- `brag-v3.mp4` / `brag.mp4`: current 22-second 1080p film at 30fps, with music and subtle SFX.
- `brag-v3.jpg` / `brag.jpg`: selected poster, also baked into video frame zero.
- `share-copy.txt`: ready-to-post caption with the required music credit.
- `composition/`: editable Hyperframes project with local assets.
- `app-capture/`: capture scripts, method and provenance hashes.
- `check-final.json` / `verification.json`: final checks and media verification.
- `revisions/v1/` and `revisions/v2/`: previous films and sources.

## Edit or render

Install FFmpeg 6+ and FFprobe on PATH, then run from `composition/`:

```sh
npm run dev
npm run check
npm run render -- --quality delivery --output ../brag.mp4
```

Hyperframes is pinned to 0.8.191. Fonts, actual app captures, the app logo, GSAP, music and SFX are local. See app-capture/README.md to recapture current app components. Keep the music credit with public posts.
