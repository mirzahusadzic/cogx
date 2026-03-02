# Migration Plan: Minimax Agent Provider Refactoring

## Objective

Migrate `MinimaxAgentProvider` to extend the recently introduced `BaseAgentProvider`. This will consolidate redundant logic for multi-turn loops, system prompt construction, and streaming output, while maintaining Minimax-specific API configurations.

## Phase 1: Preparation

- [x] Review `BaseAgentProvider` requirements and `Anthropic` SDK usage in `MinimaxAgentProvider`.
- [x] Identify Minimax-specific logic (e.g., rolling prune, base URL) to be preserved.

## Phase 2: Refactoring

- [x] Modify `MinimaxAgentProvider` to extend `BaseAgentProvider`.
- [x] Implement the `internalStream` method:
  - Convert `AgentMessage[]` to Minimax-compatible format.
  - Call the Anthropic SDK with the Minimax endpoint.
  - Yield `UnifiedStreamingChunk` objects.
- [x] Override `buildTools` or use standard tool implementation if compatible.
- [x] Remove the manual `executeAgent` loop and redundant helper methods.

## Phase 3: Cleanup & Verification

- [x] Delete `src/llm/providers/minimax/agent-tools.ts` if logic is fully integrated into the provider or base class.
- [x] Run `npm run build` to check for type errors.
- [x] Run `npm run lint:changed` to ensure code style consistency.
- [x] Run tests: `npm test src/llm/providers/minimax/__tests__/agent-provider.test.ts`.

## Impact

- **Maintenance**: Significant reduction in boilerplate code in the Minimax provider.
- **Consistency**: Standardized streaming and usage tracking across all providers.
- **Stability**: Leverages the battle-tested base class flow.
