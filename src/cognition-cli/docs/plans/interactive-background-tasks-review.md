# Review: Interactive Background Task System Specification

**Reviewer:** Claude Opus 4.5
**Date:** 2025-12-01
**Document Under Review:** `interactive-background-tasks.md` by Claude Sonnet 4.5

---

## Executive Summary

This is a **well-structured specification** that correctly identifies the core problem (broken conversation flow, permission spam, hardcoded workflows). However, it makes several architectural decisions that warrant reconsideration, particularly the rejection of headless TUI instances and the introduction of a custom markdown-to-workflow parser.

**Overall Assessment:** 7/10 - Good foundation, needs refinement before implementation.

---

## What the Spec Gets Right

### 1. Problem Statement is Accurate

The four problems identified are real and well-articulated:

- Broken conversation flow (manual handoff)
- Permission modal spam
- Hardcoded workflows
- No inter-process communication

### 2. IPC Protocol is Clean

The `ParentMessage` / `ChildMessage` types are well-designed:

- Simple JSON-based protocol
- Clear separation of concerns
- Supports the key use cases (input request, permission escalation, progress)

### 3. Permission Manifest Concept is Valuable

The frontmatter-based permission declaration:

```yaml
permissions:
  tools: [read_file, write_file]
  autoApproveRisks: [safe, moderate]
  paths: [docs/**]
```

This is a good abstraction that enables:

- Self-documenting command capabilities
- No code changes to add permissions
- Composable security model

### 4. Use Cases are Concrete

The onboarding, PR analysis, and blast radius examples demonstrate clear value.

---

## Critical Issues

### 1. Premature Rejection of Headless TUI

**Spec says:** "Headless TUI Instance (Rejected) - Too resource intensive, complex orchestration"

**Problem:** This dismisses the user's original suggestion without adequate justification. A headless TUI instance would:

| Aspect               | Custom Workflow Parser | Headless TUI      |
| -------------------- | ---------------------- | ----------------- |
| Reuses existing code | No - new parser        | Yes - same agent  |
| LLM interpretation   | Needs custom executor  | Built-in          |
| Tool support         | Needs reimplementation | Already works     |
| SIGMA integration    | Needs new wiring       | Already connected |
| Resource cost        | Lower per-task         | Higher per-task   |
| Dev complexity       | High (new system)      | Medium (IPC only) |

**Recommendation:** Revisit headless TUI as the execution backend, with the IPC protocol from this spec as the communication layer.

### 2. Markdown Parsing is Fragile

The spec proposes parsing markdown to extract:

- Questions from numbered lists
- Bash commands from code blocks
- Templates from sections

**Problem:** Markdown is for humans, not machines. Edge cases abound:

- What if a numbered list isn't a question?
- What if a code block is an example, not an executable command?
- How do you handle conditional logic?

**The LLM already interprets markdown.** The current slash commands work because the LLM reads the markdown and decides what to do. A deterministic parser will be more brittle.

**Recommendation:** Use the markdown as an LLM prompt (current behavior), not as a structured workflow definition. The IPC layer handles communication; the LLM handles interpretation.

### 3. Missing: Where Does the LLM Run?

The spec describes parsing workflows but doesn't address:

- Which LLM executes the background task?
- Does it share tokens/quota with main conversation?
- Can it use different models (e.g., cheaper model for background)?

**Recommendation:** Add a section on LLM execution context:

```typescript
interface BackgroundTaskConfig {
  model?: string; // Override model for this task
  maxTokens?: number; // Budget limit
  shareQuota?: boolean; // Count against main session?
}
```

### 4. Missing: Session/Context Sharing

How does the background task access:

- SIGMA conversation memory?
- Current file context from main conversation?
- User preferences established in main session?

The spec mentions IPC for input/output but not for context initialization.

**Recommendation:** Define context inheritance:

```typescript
interface TaskContext {
  sigmaSessionId?: string; // Link to SIGMA for memory recall
  inheritedFiles?: string[]; // Files already read in main session
  parentSessionSummary?: string; // Compressed context from parent
}
```

### 5. Timeline is Unrealistic

"Phase 1-4 in 4 weeks" for:

- IPC infrastructure
- Permission system
- Workflow parser
- Full integration

This is a substantial architectural addition. More realistic: 8-12 weeks for MVP.

---

## Suggested Modifications

### Alternative Architecture: Hybrid Approach

Combine the best of both worlds:

```
┌─────────────────────────────────────────────────────────────────┐
│ Main TUI (Parent)                                               │
│ - Primary conversation                                          │
│ - Spawns child TUI instances                                    │
│ - Handles IPC messaging                                         │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       │ IPC (from this spec)
                       │
┌──────────────────────▼──────────────────────────────────────────┐
│ Headless TUI Child (reuses existing agent)                      │
│ - Reads .md file as prompt (not parsed)                         │
│ - Uses same GeminiAgentProvider / ClaudeProvider                │
│ - Permission manifest from frontmatter → ToolGuardian           │
│ - Sends IPC messages for input/escalation                       │
│ - Returns structured results                                    │
└─────────────────────────────────────────────────────────────────┘
```

**Benefits:**

1. No custom workflow parser needed
2. Full LLM capabilities in background
3. All existing tools work immediately
4. Permission frontmatter still applies
5. IPC protocol from spec is preserved

### Simplified Permission Model

Instead of a new permission manifest, extend existing `tool-safety.ts`:

```typescript
// In .claude/commands/onboard-project.md frontmatter
---
permissions:
  riskThreshold: moderate  # Auto-approve up to this level
  pathScope: [docs/**, .open_cognition/**]
  escalateAbove: dangerous
---
```

This maps directly to existing risk classification without new infrastructure.

### Phased Implementation

**Phase 1 (MVP):** IPC + Headless TUI spawning (2-3 weeks)

- Parent can spawn `cognition-cli tui --headless --command /onboard-project`
- Child sends structured JSON output
- Basic input request/response works

**Phase 2 (Permissions):** Frontmatter parsing + ToolGuardian (2 weeks)

- Parse permission manifest from markdown
- Apply path restrictions and risk thresholds
- Escalation protocol

**Phase 3 (Polish):** Context sharing + UI integration (2-3 weeks)

- SIGMA context inheritance
- TUI status display for background tasks
- Graceful cancellation and error recovery

---

## Open Questions (Additional)

Beyond those in the spec:

6. **Model selection for background tasks:** Should background tasks use a cheaper/faster model by default?
7. **Parallel execution:** Can multiple slash commands run concurrently? How do they interact?
8. **Persistence:** If main TUI crashes, can background tasks resume?
9. **Testing:** How do we test IPC behavior in CI without spawning actual processes?

---

## Conclusion

The spec demonstrates solid thinking about the problem space. The IPC protocol and permission manifest concepts should be preserved. However, the execution model should shift from "custom workflow parser" to "headless TUI instance with IPC," which:

1. Reduces implementation complexity
2. Reuses battle-tested agent infrastructure
3. Maintains full LLM capabilities in background tasks
4. Aligns with the user's original suggestion

**Recommended Next Steps:**

1. Prototype headless TUI spawning with basic IPC
2. Validate permission frontmatter parsing
3. Test with `/onboard-project` as first use case
4. Iterate based on real-world friction points

---

## Addendum: Review of v1.1 (Post-Revision)

**Date:** 2025-12-01

Sonnet incorporated all major feedback. Here's the delta:

### Changes Accepted

| Original Critique                 | v1.1 Resolution                                      |
| --------------------------------- | ---------------------------------------------------- |
| Rejected headless TUI too quickly | Now SELECTED as primary approach                     |
| Custom markdown parser is fragile | Removed; markdown = LLM prompt                       |
| Missing LLM execution context     | Added `model`, `maxTokens`, `shareQuota` to manifest |
| Missing context sharing           | Added `TaskContext` interface (Section 3.4)          |
| Timeline unrealistic (4 weeks)    | Revised to 8-12 weeks with 4 phases                  |
| No revision history               | Added Section: Revision History                      |

### v1.1 Assessment

**Score: 9/10** - Ready for implementation planning.

**Remaining Minor Concerns:**

1. **IPC stderr usage** - Spec mentions piping stderr but doesn't define what goes there (logs? errors only?)

2. **`src/agents/base/ToolExecutor.ts`** - This file doesn't exist in current codebase. Phase 2 should reference actual tool execution path.

3. **Backward compatibility** - Could use more detail on migration path for existing slash commands that don't have frontmatter.

4. **Testing strategy** - Open Question #9 asks about CI testing without spawning processes. Consider: mock IPC layer, in-process headless mode for tests.

### Verdict

**Approved for Phase 1 prototyping.** The spec now represents a well-reasoned architecture that:

- Reuses existing infrastructure (low risk)
- Solves the core problems (high value)
- Has clear success criteria
- Documents trade-offs honestly

Good collaborative iteration between Sonnet and Opus.

---

## Addendum: Gemini 3 Pro Preview Review (v1.2)

**Date:** 2025-12-01
**Reviewer:** Gemini 3 Pro Preview

### Executive Summary

**Verdict:** The plan is technically sound but has a major architectural risk regarding React hooks reuse.

### Strengths Identified

1. **Headless TUI Concept** - Spawning a new process for background tasks (`cognition-cli tui --headless`) is a robust way to ensure process isolation. It prevents a background task from crashing the main UI.

2. **Markdown as Prompt** - Treating `.md` files as prompts rather than parsing them deterministically is brilliant. It leverages the LLM's natural ability to follow instructions, which is much more flexible than a custom parser.

3. **IPC Protocol** - The JSON-lines protocol over stdio is standard and well-understood. Separating logs to `stderr` and data to `stdout` is a best practice.

### Risks Identified

| Risk                               | Severity | Description                                                                                                                                | Resolution                                                                                     |
| ---------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| **A: React Hooks Reuse**           | High     | `useAgent.ts` is heavily entangled with React hooks (`useState`, `useEffect`, `useRef`). Cannot be reused directly in headless mode.       | Implement "Headless Agent Loop" that uses `AgentProviderAdapter` directly (framework-agnostic) |
| **B: Session File Conflicts**      | Medium   | `SessionStateStore` writes to `.sigma/{anchorId}.state.json`. Parent and child would corrupt each other's state if sharing same anchor ID. | **FIXED in v1.3** - Child tasks use unique `taskAnchorId` for write isolation                  |
| **C: ToolGuardian Implementation** | Low      | Clean addition. Existing `onCanUseTool` callback can be replaced/wrapped with `ToolGuardian.checkPermission()`.                            | Straightforward implementation                                                                 |

### Detailed Analysis: Risk A (React Hooks)

The spec says: _"Reuses existing agent infrastructure (GeminiAgentProvider, ClaudeProvider)"_

**Reality Check:** The core agent logic in `src/tui/hooks/useAgent.ts` (2097 lines) relies on:

- `useState` for messages, isThinking, error state
- `useEffect` for initialization, session lifecycle
- `useRef` for embedder, registries, adapters
- `useCallback` for sendMessage, interrupt

**Solution:** The `AgentProviderAdapter` class (which `useAgent` uses) _is_ framework-agnostic. The plan is viable if we implement the loop around `AgentProviderAdapter` manually in `headless.ts`, mimicking what `useAgent` does:

- Token counting (simple number, not React state)
- Session management (use `SessionStateStore` directly)
- Message handling (simple array, not React state)

### Gemini's Recommendation

> Proceed with the plan, but be aware that **Phase 1** will involve writing a "Headless Agent Loop" that duplicates some of the orchestration logic currently found in `useAgent.ts`. This is actually good—it decouples the agent from the UI.

### Opus Assessment of Gemini's Review

| Gemini's Point                 | Accuracy  | Notes                                                     |
| ------------------------------ | --------- | --------------------------------------------------------- |
| Risk A: Hooks can't be reused  | ✓ Correct | But overstated - `AgentProviderAdapter` already decoupled |
| Risk B: Session file conflicts | ✓ Correct | Addressed in v1.3 with session isolation                  |
| Risk C: ToolGuardian is clean  | ✓ Correct | Low risk                                                  |
| "Slightly higher effort"       | ✓ Fair    | ~20% more than spec suggests                              |

**Conclusion:** Gemini's review provides valuable implementation-level insights that complement the architectural review. The session isolation fix (Risk B) has been incorporated into v1.3 of the specification.

---

### Additional Insight: Parent as Write Master

In follow-up discussion, Gemini identified a key architectural pattern for handling write contention:

**The Problem:**

- Multiple background agents (headless processes) cannot share the `AnalysisQueue` memory object
- They _do_ share LanceDB files on disk
- This creates potential write contention

**Gemini's Solution:**

> Background tasks should send their analysis results back to the Parent TUI via IPC, and let the Parent TUI queue them into its `AnalysisQueue`.

**Result:**

- **Zero Write Contention**: Only the Parent writes to the DB
- **Zero Locking Complexity**: No file locks needed
- **Scalability**: Analysis distributed (CPU in child), commits centralized (Parent)

This pattern is common in distributed databases (leader-follower replication). The Parent TUI acts as the **Write Master** for the session's memory.

**Status:** Added to spec as Section 3.5 in v1.3.

---

**END OF REVIEW**
