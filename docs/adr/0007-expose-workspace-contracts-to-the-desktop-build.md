---
status: accepted
---

# Expose workspace contracts to the desktop build

Electron, MCP, the daemon and the renderer consume the same native browser contract. Relative imports into core made the contract depend on checkout layout. The desktop package also consumed MCP network and credential helpers and the daemon's GitHub release check without declaring those dependencies.

Core exports the native browser and profile modules by name. Electron, the daemon and MCP import the schemas there. Renderer imports of these schemas' types are erased. Desktop also consumes narrow MCP and orchestrator exports for its existing host policies. Their implementations stay with their owners. A new bridge package would add a release and packaging boundary for the same contracts.

Desktop declares these workspaces as build dependencies. Its main and preloads are bundled into an installer app directory separate from the daemon's runtime packages. The desktop build fails on warnings so an unresolved workspace import cannot silently become an external module. Installer staging and dedicated Node helpers keep their explicit resource paths.
