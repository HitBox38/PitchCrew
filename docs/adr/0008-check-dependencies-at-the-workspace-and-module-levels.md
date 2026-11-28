---
status: accepted
---

# Check workspace dependencies and eager module imports

The original manifests described an acyclic graph while 21 crew modules still formed a cycle. Desktop had the opposite problem. Its bundled code consumed three workspaces whose names were absent from its manifest. Either view alone missed a dependency that affected developers.

Each package owns its exported entry points and declares the workspaces it consumes. Oxlint checks imports under package source directories, including the public paths, the renderer's type-only core root and the provider adapter boundary. Colocated contract tests can exercise the source they compare. TypeScript checks the declared exports. The workspace test checks the declared graph, including build dependencies. Both read the root workspace patterns and package manifests.

Eager imports must support a defined initialization order. Feedback during execution can still be explicit. The crew context binds its queue drain at composition so delivery, recovery and routine code can wake the scheduler. Lazy loading remains appropriate for route and document resources. The crew refactor preserved the time of every queue wakeup. Deferring imports to conceal a cycle would have changed when dependencies became available.

Each browser-safe domain export contains the values its consumers share. The renderer can use the same packet fields, import limits and lifecycle groups as a daemon schema without loading its validator. The rule worker uses only its runtime settings, document labels and evaluator. Worker termination, timeouts and heap limits remain with the isolated worker implementation.
