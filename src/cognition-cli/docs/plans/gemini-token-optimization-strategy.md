# Gemini Token Optimization Strategy: TPM Alignment

## Problem Statement

The current Gemini 3.0 implementation faces a "Token Pressure" crisis:

- **TPM Limit**: 1,000,000 tokens.
- **Turn Size**: ~58,000 tokens (baseline).
- **Runway**: < 20 steps before hitting quota.
- **Context Bloat**: Large tool outputs (grep, read_file) and long thinking blocks quickly exhaust the window.

## Proposed Optimization: "Semantic Checkpointing"

### 1. SigmaTaskUpdate as Semantic Trigger

- **Strategy**: Trigger `triggerCompression()` immediately when a task is completed or a major phase transition occurs via `SigmaTaskUpdate`.
- **Logic**: If `tokens > semanticThreshold` (default 50,000) AND a task status changes, trigger compression.
- **Benefit**: Flushes implementation noise (logs, error loops) while the "Mental Map" is clean.
- **Proactive Awareness**: When context exceeds `semanticThreshold`, the TUI injects a `<token-pressure-warning>` reminding the model to close the current task to trigger this optimization. This encourages "Semantic Checkpointing" before a TPM crisis occurs.

### 2. TPM-Aware Runway Management

- **Strategy**: Monitor cumulative TPM usage.
- **Logic**: Calculate `remaining_tpm = 1,000,000 - current_session_tokens`. If `estimated_next_turn_size > remaining_tpm`, force compression regardless of the 150k threshold.
- **Benefit**: Prevents session death due to quota exhaustion.

### 3. Aggressive Provider-Level Pruning

- **Strategy**: Intercept tool outputs in `gemini-agent-provider.ts` before they are sent to the model.
- **Logic**:
  - Truncate `read_file` outputs > 5,000 tokens with a "Recall pointer".
  - **Bash Output (Head + Tail)**: Truncate `bash` logs using a "Head + Tail" strategy (e.g., first 2k + last 5k characters) to ensure compilation errors at the end are preserved.
  - Summarize character-level diffs into line-level summaries.

### 4. Thinking Token Budgeting

- **Strategy**: Dynamically adjust `thinkingBudget` based on remaining TPM.
- **Logic**: If TPM is low, reduce `thinkingBudget` from 24k to 8k to prioritize action over reasoning.

### 5. Quest-Mode Recap Density

- **Strategy**: Enhance `context-reconstructor.ts` to prioritize `SigmaTaskUpdate` IDs.
- **Logic**: The recap should contain _only_ the current `todos` list and the last 3 turns if in "Quest Mode", relying on semantic search for everything else.
