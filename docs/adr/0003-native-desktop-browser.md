---
status: accepted
---

# Native desktop browser with automation on the same pages

The screenshot-based browser remained difficult for humans to use after its capture latency was improved. The user clarified that normal browser interaction and fast agent operation are the acceptance criteria, and chose desktop first; the web app may retain streamed viewing.

Electron owns isolated native browser views and persistent per-agent website sessions. The daemon connects to those exact pages through a private, authenticated automation relay scoped to one job or standalone conversation. Its existing application approval, packet, private-takeover and uncertain-submission checks remain authoritative. Guest pages receive no application preload or access to the app's privileged renderer, and the relay never exposes the app window's target.

This deliberately adds a desktop browser integration alongside headless Chromium for the web app. It trades one shared rendering path for direct human typing, selection, clipboard, scrolling and native browser behavior. Increasing stream cadence cannot provide those semantics. Browser engine/profile differences and native view composition now need explicit lifecycle and compatibility testing; existing headless sign-ins are not silently copied into the new Electron profiles.

The same browser-driver contract serves both engines so job workflow policy stays in the daemon. Native view bounds and presentation belong to the desktop host. Agent screenshots and inspection remain independent of presentation, and final submission still requires exact approval and separate verification. See [computer use](../computer-use.md) for behavior and validation.
