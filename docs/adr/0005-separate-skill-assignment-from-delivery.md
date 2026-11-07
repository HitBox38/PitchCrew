---
status: accepted
---

# Separate skill assignment from instruction delivery

Accepted on 2026-11-03. Including every assigned skill's full text made unrelated procedures consume every run's context, while a 60,000-character assignment cap could prevent importing cover-letter. Assignment now controls availability; **Include in every run** controls eager delivery, and other assigned instructions load through a read-only scoped MCP tool from the run's frozen skill snapshot.

Existing skills retain full inclusion, new hand-written skills default to included and new imported procedures default to on demand. The bundled prompt-injection guard stays included by default. Explicit selections include the full assigned snapshot once, irrespective of delivery mode. Updates preserve the user's delivery setting, and old pending proposals retain their original inclusion semantics.

We rejected switching every existing skill to on demand because custom skills can contain standing instructions. Native skill discovery conflicts with several adapters' deliberately disabled native tools; scoped MCP provides one portable contract. Raising the aggregate cap would repeat the same problem at another threshold. Prompt transports use stdin, files or ACP, and model catalogs expose no dependable context capacity, so no replacement combined character quota is introduced. Individual content and library-count limits remain.

Source extraction remains tools-free. Restricted application runs can read only their own frozen assigned text; no additional source context or capabilities are granted. Prompt files and runtime prompts share the same delivery plan, and native session identity includes its format revision. On-demand delivery reduces initial context but does not prevent resumed conversations from accumulating instructions or guarantee that a model follows them.

Full assigned snapshots remain in run history, with a theoretical content ceiling of roughly five million characters per run. Measure launch and event-storage costs rather than substituting mutable latest-version reads; an immutable revision store can be a separate change if measurements warrant it. See [skill delivery](../skills.md) for behavior, migration and verification.
