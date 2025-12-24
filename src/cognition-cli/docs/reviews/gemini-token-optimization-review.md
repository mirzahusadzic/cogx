# Review: Gemini Token Optimization Strategy

**Date**: 2025-05-24
**Reviewer**: Cognition Agent (Gemini 3.0 Pro)
**Status**: Approved with Recommendations

## Executive Summary

The proposed "Semantic Checkpointing" strategy is **viable** and effectively addresses the 1M TPM limit. The `SigmaTaskUpdate` tool serves as an excellent semantic trigger for compression, allowing the system to maintain a lean context window (< 50k tokens) while preserving high-level intent.

## Analysis by Component

### 1. 1M TPM Limit Effectiveness

- **Verdict**: Effective.
- **Analysis**: By keeping the context window under 50k tokens via aggressive checkpointing, we ensure that even at high interaction speeds (e.g., 10 turns/min), the TPM consumption stays around 500k, well within the 1M limit. Without this, a growing context window would quickly throttle the agent to < 2 turns/min.

### 2. Semantic Checkpointing Viability

- **Verdict**: Viable and Technically Feasible.
- **Analysis**:
  - `GeminiAgentProvider.ts` can detect `SigmaTaskUpdate` completion events in the runner loop.
  - `context-reconstructor.ts` is already equipped to reconstruct "Quest Mode" context, including the active `todos` list.
  - The integration requires injecting the "compression logic" into the `GeminiAgentProvider` loop to replace the message history with the reconstructed recap when the threshold is met.

### 3. Provider-Level Pruning Risks

- **Verdict**: **High Risk Identified in Bash Logging.**
- **Risk Detail**: The current `truncateOutput` implementation in `src/llm/providers/tool-helpers.ts` truncates the **tail** of long outputs (keeping the head).
  - For `bash` commands (compilation, tests), the error information is typically at the **end** of the output.
  - **Consequence**: The agent may lose visibility into build failures, leading to "I don't see any error" hallucinations.
- **Recommendation**: Modify `truncateOutput` to preserve the **tail** (last 5k chars) for `bash` outputs, or use a "Head + Tail" strategy (e.g., first 2k + last 5k) when `eGemma` summarization is unavailable or skipped.

## Implementation Roadmap

1. **Immediate Fix**: Patch `src/llm/providers/tool-helpers.ts` to use "Head + Tail" truncation for `bash` outputs.
2. **Provider Logic**: Implement the compression trigger in `GeminiAgentProvider.ts`:
   - Monitor `cumulativePromptTokens`.
   - Monitor `part.functionResponse` for `SigmaTaskUpdate`.
   - Call `contextReconstructor.reconstructQuestContext` when triggered.
   - Replace `this.sessionService` history with the recap.

## Conclusion

The strategy is sound. The dependence on `SigmaTaskUpdate` aligns perfectly with the "Manager/Worker" paradigm and ensures that the agent's high-level plan persists even when the low-level execution details are pruned.
