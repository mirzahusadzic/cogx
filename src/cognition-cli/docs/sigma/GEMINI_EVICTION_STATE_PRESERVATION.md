# Gemini Eviction & State Preservation Strategy

To maintain high performance while using a constrained context window (baseline ~14k-50k tokens), the system employs an aggressive **"Task-Based Eviction"** strategy. This document outlines how the system prevents "Amnesia" by transitioning from simple deletion to **"Semantic Compression"** and **"State Preservation"**.

## 🚀 Implemented Features

### 1. Architectural: The "Active Context" Scratchpad

The agent uses a persistent markdown file to store long-term working memory that survives tool log eviction.

- **File:** `.sigma/archives/<session_id>/active_context.md`
- **Purpose:** Stores complex findings, code snippets, and architectural notes.
- **Workflow:** Before marking a task as `completed`, the agent writes essential insights here using `write_file` or `edit_file`.

### 2. Gemini-Specific: Thought & Signature Preservation

For "thinking" models like `gemini-3-flash-preview`, preserving the internal reasoning state is critical for stability across turns.

- **Problem:** Standard eviction replaces an assistant's thinking/text parts with a generic string, losing the `thought: true` flag and the encrypted `thoughtSignature` required by the Gemini API.
- **Solution:** The `GeminiAgentProvider` pre-scans assistant turns during eviction to:
  1. Extract the `thoughtSignature`.
  2. Re-apply `thought: true` to the "tombstone" part.
  3. Attach the `collectedSignature` to the tombstone, ensuring the API accepts the history as valid and continuous.

### 3. Smart Tombstones (Semantic Compression)

Instead of a generic `[Logs evicted]` message, the system injects the task's `result_summary` directly into the conversation history.

- **Implementation:** `pruneTaskLogs` in `gemini-agent-provider.ts` retrieves the summary from the task state and includes it in both **tool output tombstones** and **assistant thinking tombstones**.
- **Outcome:** The _linear flow_ of the conversation remains understandable, even after the massive tool outputs (grep, read_file) or reasoning blocks are deleted.

### 4. Raw Log Archiving (The "Audit Trail")

Evicted logs are not permanently deleted; they are moved to a local archive for manual inspection if needed.

- **Location:** `.sigma/archives/<session_id>/<task_id>.log` (if `DEBUG_ARCHIVE=true` is set).
- **Auditability:** The tombstone message includes a direct instruction on how to retrieve the original logs: _"Use 'grep' on .sigma/archives/<session_id>/<task_id>.log if previous logs are needed."_

### 5. Validation & Annotation: "Distill or Die"

The `SigmaTaskUpdate` tool enforces quality summaries via the `ValidationService`.

- **Constraint:** When a task is marked `completed`, its `result_summary` is validated against any `acceptance_criteria` or `grounding` requirements.
- **Annotation:** If validation fails, the summary is annotated with a warning (`⚠️ [Sigma Validation] Missing criteria...`). If successful, it's marked with a success icon and score.
- **Model Instruction:** The system prompt explicitly instructs the model to provide a `result_summary` with a minimum of 15 characters to ensure meaningful insights are captured.

---

## 🧠 Memory & Eviction Rules for Agents

1. **Task-First (Token Health)**: ALWAYS mark a task as `in_progress` BEFORE running tools. This ensures tool outputs are tagged for surgical eviction.
2. **Distill Before Dying**: You are FORBIDDEN from completing a task until you have saved the _essential findings_.
   - **Simple Findings**: Write to `result_summary`.
   - **Complex Findings**: Write to `active_context.md`.
3. **Context Grooming**: Treat `active_context.md` as a volatile scratchpad. Delete obsolete notes once a sub-project is finished.
4. **Verification**: Before completing, ask: _"If I lose all my previous logs right now, do I have enough info in the summary/scratchpad to continue?"_

## 🛠 Technical Details (Implementation Reference)

### State Preservation in `gemini-agent-provider.ts`

```typescript
// Pre-scan for thought signature in assistant turns being evicted
if (isAssistantTurnInRange) {
  for (const p of parts) {
    if (p.thoughtSignature) {
      collectedSignature = p.thoughtSignature;
      break;
    }
  }
}

// ... later in map function ...
if (!hasAssistantTombstonePart) {
  hasAssistantTombstonePart = true;
  return {
    text: assistantTombstone, // Now includes result_summary if available
    thought: true,
    thoughtSignature: collectedSignature,
  };
}
```
