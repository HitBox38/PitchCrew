---
status: accepted
---

# Native desktop browser with automation on the same pages

The screenshot-based browser remained difficult for humans to use after its capture latency was improved. The user clarified that normal browser interaction and fast agent operation are the acceptance criteria, and chose desktop first; the web app may retain streamed viewing.

Electron owns isolated native browser views and persistent per-agent website sessions. The daemon connects to those exact pages through a private, authenticated automation relay scoped to one job or standalone conversation. Its existing application approval, packet, private-takeover and uncertain-submission checks remain authoritative. Guest pages receive no application preload or access to the app's privileged renderer, and the relay never exposes the app window's target.

This deliberately adds a desktop browser integration alongside headless Chromium for the web app. It trades one shared rendering path for direct human typing, selection, clipboard, scrolling and native browser behavior. Increasing stream cadence cannot provide those semantics. Browser engine/profile differences and native view composition now need explicit lifecycle and compatibility testing; existing headless sign-ins are not silently copied into the new Electron profiles.

The same browser-driver contract serves both engines so job workflow policy stays in the daemon. Native view bounds and presentation belong to the desktop host. Agent screenshots and inspection remain independent of presentation, and final submission still requires exact approval and separate verification. See [computer use](../computer-use.md) for behavior and validation.

## Renderer composition update

Desktop pages now use Electron `<webview>` elements in a permanent shell-owned renderer host. The original sibling `WebContentsView` composition forced app overlays to hide the page and repeatedly change native presentation during automation. DOM hosting lets context menus, popovers, dialogs and sheets render above the live page. Guest elements stay attached while routes and browser chrome change; the expanded browser shares its permanent Base UI dialog with the guest for keyboard focus and accessibility.

The main process still owns creation, page identity, scoped automation, network policy, private input and persistent partitions. It authorizes each blank guest with a one-shot nonce and exact partition, verifies the captured attached guest against main-frame IPC registration, strips preload and privilege settings, and rejects nested webviews. Reloading the trusted renderer closes its old guests and relays; it never substitutes another page under old evidence.

Electron cannot adopt an existing popup child into a DOM webview through supported APIs. Script and sign-in popups therefore use owned, sandboxed native browser windows, preserving the actual opener instead of reopening only the URL. They remain in the scoped session and follow its control and cleanup rules. This deliberately replaces the old popup-as-embedded-tab presentation.

Background automation guests remain on-screen beneath the app. Their compositor surface scales to fit a narrow window without changing the website's layout viewport. Electron capture remains bounded and credential-masked, with exact physical display backing pixels normalized before returning the image.
