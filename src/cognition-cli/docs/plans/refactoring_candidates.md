# Refactoring Candidates Analysis

This document identifies code patterns in the Cognition Σ repository that share high structural similarity and suggest concrete refactorings based on their architectural roles.

## 🔍 Refactoring Candidates Found

### 1. Agent Management Hooks (0.91 similarity)

- **Symbols:**
  - `useAgentHandlers` (`src/tui/hooks/useAgent/use-agent-handlers.ts`)
  - `useAgent` (`src/tui/hooks/useAgent/index.ts`)
  - `useAgentServices` (`src/tui/hooks/useAgent/use-agent-services.ts`)
  - `useAgentMessaging` (`src/tui/hooks/useAgent/use-agent-messaging.ts`)
  - `useAgentSync` (`src/tui/hooks/useAgent/use-agent-sync.ts`)

- **Shared Patterns:**
  - All hooks accept `options` and `state` as arguments.
  - Significant property drilling of `AgentOptions` and `AgentState`.
  - Repetitive return patterns for common handlers and side effects.

- **💡 Refactoring Suggestion:**
  - **Extract Context:** Create `AgentContext` to provide options and state to all sub-hooks.
  - **Implement Context Hook:** Replace property drilling with a simple `useAgentContext()` call within sub-hooks.
  - **Potential code reduction:** ~120 lines (~25% of hook logic).
  - **Effort:** Medium (2-3 hours).

### 2. LLM Agent Providers (0.83 similarity)

- **Symbols:**
  - `GeminiAgentProvider` (`src/llm/providers/gemini/agent-provider.ts`)
  - `MinimaxAgentProvider` (`src/llm/providers/minimax/agent-provider.ts`)
  - `OpenAIAgentProvider` (`src/llm/providers/openai/agent-provider.ts`)
  - `ClaudeProvider` (`src/llm/providers/claude/agent-provider.ts`)

- **Shared Patterns:**
  - All implement the `AgentProvider` interface.
  - Redundant logic for handling tool calls, message buffers, and history orchestration.
  - Similar error handling and retry mechanisms.

- **💡 Refactoring Suggestion:**
  - **Create Base Class:** Develop `BaseLLMProvider` to encapsulate tool handling and state management.
  - **Template Method Pattern:** Define abstract methods for provider-specific API interactions (e.g., `_generateContent`).
  - **Potential code reduction:** ~250 lines (~30% of provider logic).
  - **Effort:** Medium-High (4-5 hours).

### 3. Orchestrators (0.81 similarity)

- **Symbols:**
  - `GenesisOrchestrator` (`src/core/orchestrators/genesis.ts`)
  - `OverlayOrchestrator` (`src/core/orchestrators/overlay.ts`)
  - `UpdateOrchestrator` (`src/core/orchestrators/update.ts`)

- **Shared Patterns:**
  - All extend `BaseOrchestrator` and implement `IOrchestrator`.
  - Follow a consistent "fetch -> process -> update" lifecycle.
  - Identical logging and error propagation patterns.

- **💡 Refactoring Suggestion:**
  - **Composition over Inheritance:** Shift towards a "Pipeline" architecture for data extraction.
  - **Generic Pipeline:** Implement a `GenericOrchestrator` that accepts interchangeable `DataFetcher` and `ResultProcessor` strategies.
  - **Potential code reduction:** ~150 lines (~20% of orchestrator logic).
  - **Effort:** Medium (3-4 hours).

## 📊 Summary

- **Total opportunities found:** 3 groups (12 symbols)
- **Estimated total code reduction:** ~520 lines
- **Total estimated effort:** 9-12 hours
- **Primary benefit:** Improved DRY compliance, reduced boilerplate for new providers, and cleaner state management in TUI hooks.

---
*Analysis generated on 2026-02-28 using Cognition Σ Pattern Similarity Engine.*
