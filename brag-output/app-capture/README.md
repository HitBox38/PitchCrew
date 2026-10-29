# Native app captures

The film's product elements are screenshots of the running app, built from the current packages/ui source. This folder contains the capture scripts and a provenance manifest. Captures are stored in composition/assets/app.

The daemon uses a newly created temporary data directory, dev-only fictional examples, no seeded online skills, no analytics, and no runtime authentication/release probes. No live provider inference is needed. The profile is the app's explicitly fictional example candidate. The approval script approves only a fictional packet and does not export or submit an application.

Start a fresh capture workspace from the repository root:

```sh
node --import tsx brag-output/app-capture/serve.ts
```

After its ready message, use another terminal for capture.ts, capture-crew.ts and capture-sources.ts. Run capture-approval.ts last because it changes the fictional approval state. Restart serve.ts with a new temporary workspace before repeating that decision. PITCHCREW_CAPTURE_PORT can select a separate port; the capture script URL must match.

Browser captures use the system Google Chrome through the same Playwright package used by the app's UI suites, in a fresh isolated context with local fonts loaded and reduced motion for settled capture. The main captures are at 1600×1000 CSS pixels with device scale 2. Crew close-ups use browser zoom for video readability. The movie adds camera framing and editorial text around these actual pixels.
