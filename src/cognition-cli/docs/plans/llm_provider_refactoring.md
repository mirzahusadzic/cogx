# Plan: LLM Agent Provider Refactoring

## 1. Goal

Consolidate redundant logic from `GeminiAgentProvider`, `OpenAIAgentProvider`, and `ClaudeProvider` into a unified `BaseLLMProvider`. This will reduce boilerplate by ~40%, centralize SDK noise suppression, and standardize streaming/token usage tracking.

## 2. Architectural Design

- **Base Class**: `BaseLLMProvider` (abstract)
- **Pattern**: Template Method for `executeAgent` workflow.
- **Unified Interface**: `StreamingResponse` delta format across all providers.

## 3. Task Allocation & Granularity (TPM Strategy)

To maintain high context fidelity and prevent token limit issues, the refactor is broken into 12 atomic tasks. Each "Complex" task is further subdivided into setup/implementation/verification phases.

| Task ID | Component | Complexity | Description |
| :--- | :--- | :--- | :--- |
| **L-01** | `BaseLLMProvider` | Low | Define abstract class with basic state (usage, messages). |
| **L-02** | Noise Suppression | Low | Extract `suppressNoise` / `restoreNoise` to base class/utility. |
| **L-03** | Interface Sync | Med | Define `UnifiedStreamingChunk` interface in `src/llm/types.ts`. |
| **L-04** | Context Helpers | Low | Move `getGroundingContext` and `getDynamicThinkingBudget` to base. |
| **L-05** | Gemini: Adapter | High | Refactor `GeminiAgentProvider` to extend base. Implement `internalStream`. |
| **L-06** | Gemini: Verify | Med | Run `npm test` and verify Gemini TUI streaming/thinking. |
| **L-07** | OpenAI: Adapter | High | Refactor `OpenAIAgentProvider` to extend base. Normalize generators. |
| **L-08** | OpenAI: Verify | Med | Run `npm test` and verify OpenAI TUI tool calls. |
| **L-09** | Claude: Adapter | Med | Refactor `ClaudeProvider` to extend base. |
| **L-10** | Claude: Verify | Low | Run `npm test` for Claude. |
| **L-11** | Tool Mapping | Med | Centralize Sigma-to-Provider tool translation utilities. |
| **L-12** | Cleanup | Low | Remove redundant code from individual provider files. Build check. |

## 4. Implementation Details

### Phase 1: The Foundation (Tasks L-01 to L-04)

- Define `protected abstract internalStream(...)` in `BaseLLMProvider`.
- Move standard `executeAgent` orchestration to the base class:
  1. `suppressNoise()`
  2. `setupContext()` (Grounding, System Prompts)
  3. `for await (const chunk of this.internalStream(...))`
  4. `updateUsage(chunk)`
  5. `restoreNoise()`

### Phase 2: Provider Migration (Tasks L-05 to L-10)

- **Challenge**: Mapping ADK (Gemini) events (`on('content', ...)` vs. `on('thinking', ...)`) to the same stream as OpenAI's async generators.
- **Solution**: Use `ReadableStream` or a custom async iterator wrapper in `internalStream` to normalize these sources.

### Phase 3: Verification Loop

- For each provider, the "Verify" task MUST include:
  1. `npm run build`
  2. `npm test src/llm/providers/<provider>/...`
  3. Manual verification of TUI "Thinking" blocks and "Tool Execution" logs.

## 5. Metrics for Success

- **Code Reduction**: Target < 250 lines per provider (currently ~600-900).
- **Extensibility**: Adding a new provider should only require implementing `internalStream` and `mapTools`.
- **Consistency**: Token usage tracking and noise suppression work identically across all models.
