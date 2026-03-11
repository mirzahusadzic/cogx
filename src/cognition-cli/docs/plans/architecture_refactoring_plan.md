# Cognition Σ (Sigma) Architectural Refactoring Plan

## 🌟 The Good: Smart Architectural Choices

### 1. Out-of-Process Execution (ZeroMQBus)

Using ZeroMQ as an IPC bus is the smartest decision in this codebase. Node.js is single-threaded; if the TUI (React/Ink) shared the same event loop as heavy AST parsing (Genesis) or LLM stream buffering, the terminal would constantly freeze or stutter. Decoupling the UI from the cognitive daemon via message-passing creates a highly resilient microkernel architecture.

### 2. The Dual-Lattice Separation

Keeping conversational memory (`.sigma`) isolated from structural project knowledge (`.open_cognition`) is excellent Domain-Driven Design. It prevents chat-history noise from polluting the code-graph context, allowing for highly targeted RAG (Retrieval-Augmented Generation) strategies.

### 3. Context Pruning via SigmaTasks (The Amnesia Rule)

A critical and advanced architectural feature is the **SigmaTaskUpdate** orchestration layer. Rather than letting the LLM context window blindly fill up with tool execution logs and file reads, `SigmaTaskUpdate` enforces strict task boundaries. When a task is marked `completed`, the system actively _prunes/evicts_ the associated tool logs, forcing the agent to distill knowledge into a `result_summary`. This aggressively maintains a lean, high-fidelity context window, preventing token bloat during long-running coding sessions.

## 👃 The Bad: Architectural Smells

### 1. "Utility Soup" (Anemic Domain Model)

Having 441 utilities compared to only 99 components and 2 services is a massive red flag. This indicates an "Anemic Domain Model." Instead of encapsulating logic within cohesive domain objects (e.g., a `ContextWindow` class that manages its own token pruning), the business logic is likely scattered across hundreds of disconnected, procedural helper files. This makes the codebase incredibly difficult to refactor because it's hard to track side effects and state changes.

### 2. The `PGCManager` God Object

With a blast radius of 33 components, `PGCManager` is violating the Single Responsibility Principle (SRP). It appears to be handling vector embeddings, database connections, file I/O, and query construction all at once. If you want to change how embeddings are chunked, you risk breaking the query engine.

## ⚠️ The Ugly: Systemic Risks

### 1. Split-Brain State Management

Because the system is split across an IPC boundary, state exists in two places: the TUI (React Context/Hooks) and the backend daemon (`SessionStateStore`). Synchronizing complex state (like a heavily nested task list or streaming tokens) over a message bus requires robust eventual consistency handling. If a ZeroMQ message is dropped or malformed, the UI will desync from the actual agent state, leading to phantom "in progress" tasks.

### 2. Domain/Network Model Conflation (`AgentMessage`)

Using `AgentMessage` as both the internal domain model and the network transmission payload (DTO) tightly couples the system. If you need to add metadata purely for network routing (e.g., chunk sequence IDs for streaming), you are forced to leak that infrastructure logic into the UI layer.

## 💡 Strategic Recommendations for Refactoring

### Phase 1: Deconstruct `PGCManager` (The Facade Strategy)

To safely refactor the `PGCManager` God Object (blast radius: 33 components), follow a multi-step "Facade" migration:

1. **Environment Isolation**: Extract `pgcRoot` resolution and directory initialization into a new `PGCStoreContext` class.
2. **Service Splitting**:
   - `PGCQueryService`: Wraps `StructuralIndex` and `ObjectStore`. Provides read-only access for search and semantic lookup.
   - `PGCIndexerService`: Wraps `TransformLog` and `ReverseDeps`. Handles write-heavy indexing and dependency graph updates.
3. **The Facade Pattern**: Transform the existing `PGCManager` into a thin wrapper (Facade). It will instantiate the new services internally and delegate its existing methods to them. This ensures zero-impact on the 20+ files currently importing `PGCManager`.
4. **CRITICAL: JSDoc Preservation**: During extraction, **all JSDoc documentation must be preserved**. The 50+ line class-level documentation and individual method JSDocs from `src/core/pgc/manager.ts` must be copied to the new services and adapted, ensuring no metadata or architectural context is lost or orphaned.

### Phase 2: Introduce DTOs (Data Transfer Objects)

Create a strict boundary between IPC messages and internal models. Translate `AgentMessageDTO` coming off the ZeroMQ bus into a rich `DomainAgentMessage` before the UI or Oracles consume it.

### Phase 3: Consolidate Utilities into Services

Group related utility functions into cohesive Service classes or modules to establish clear boundaries and reduce the cognitive load of navigating hundreds of helper functions. Expand the use of explicit state machines to manage UI/Daemon synchronization safely.
