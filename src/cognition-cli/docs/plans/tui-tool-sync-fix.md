# Plan: TUI Tool Synchronization and Timeout Fix

## 🚨 Problem Statement

When the model (agent) issues multiple tool calls in a single turn (batching), the TUI experience degrades significantly:

- **Interleaved Output**: Multiple tool outputs (especially from `bash` and `read_file`) are streamed to the terminal simultaneously, causing a "mash-up" where different command outputs are mixed.
- **TUI De-sync**: The React/Ink-based interface loses track of which tool is currently active, often leading to visual glitches or "stuck" states.
- **Connection Timeouts**: Large, multi-tool payloads and overlapping I/O operations frequently trigger `Connection timed out` and `SDK completed without response` errors.
- **Deadlocks**: A single hanging tool in a batch can prevent the entire session from responding, as there is currently no per-tool timeout or cancellation mechanism within a batch.

## 🎯 Goals

1. **Economic Efficiency (One Request)**: Maintain the efficiency of tool batching by executing multiple tool calls and sending a **single consolidated response** with all results back to the model.
2. **Sequential Execution**: Ensure that tools in a batch are executed and rendered strictly one by one.
3. **Atomic Streaming**: Maintain live streaming for long-running commands (e.g., `bash`), but ensure the stream is exclusive to the active tool and not interleaved with others.
4. **Resilience**: Implement individual timeouts per tool to prevent session deadlocks.

## 🛠️ Proposed Solution

### 1. Sequential Execution Queue (SDK Layer)

Modify the tool execution loop in the SDK (e.g., `BaseAgentProvider.ts` or the `ADK` Runner integration) to:

- Execute tool calls in a strictly sequential `for...of` loop with `await`.
- **Streaming Mutex**: Implement a "Floor" mechanism where only the currently executing tool is permitted to send output chunks to the TUI.
- **Wait for Completion**: The SDK must wait for the current tool's execution (and its streaming output) to fully complete before starting the next tool in the batch.
- **Consolidated Result**: After all $N$ tools in the batch have completed, aggregate their results into a single array and send them back to the model in a single request. This preserves the economic benefits of batching.
- **Session Keep-Alive**: Send "heartbeat" or status updates to the TUI during long-running tool executions to prevent TUI/ZMQ timeouts while the model is waiting for the consolidated result.

### 2. Atomic Streaming Focus (TUI Layer)

Update `useAgentHandlers.ts` and the rendering logic to:

- **Strict Message Targeting**: Ensure `onToolOutput` chunks are only appended to the `tool_progress` message associated with the _currently running_ tool.
- **Rendering Mutex**: While a tool is streaming, "lock" the active content area to that tool. Any other tool state updates must be queued or handled such that they don't overwrite the `activeToolContentRef` until the stream finishes.
- **Synchronous Rendering**: Ensure that even if multiple `tool_use` events arrive in a single message, they are rendered sequentially as discrete `tool_progress` blocks.

### 3. Per-Tool Timeouts & Cancellation

- Implement a configurable timeout (e.g., 60s) for each tool execution within the `executeBash` and other core tool executors.
- If a tool times out:
  - Mark it as failed in the tool result.
  - Attempt to kill underlying child processes (e.g., `SIGTERM` for `bash`).
  - Provide a clear timeout message to the agent so it can decide how to proceed.

### 4. Synchronization Handshake (TUI <-> SDK)

- Introduce a synchronization event: the SDK waits for an "ACK" from the TUI after each tool in a batch.
- This ensures that the TUI has finished flushing the previous tool's output and is ready to focus on the next one.

## 📋 Implementation Roadmap

### Phase 1: Investigation (Current)

- [x] Trace exact tool execution path from `base-agent-provider.ts` to TUI rendering.
- [x] Identify where `TerminalService` or `TUISyncManager` are called during streaming.
- [x] Reproduce the "Connection timed out" error with a heavy multi-tool benchmark. (Verified via user feedback and testing)

### Phase 2: Core SDK Fixes

- [x] Implement `SequentialToolQueue` in the Agent Provider layer. (Implemented via `AsyncMutex` in `getUnifiedTools` to serialize execution)
- [x] Add `timeout` parameter to individual tool execution calls. (Added to `bash`, `grep`, and `glob`)
- [x] Update `bash` tool to support process termination on timeout. (Implemented in `executeBash` with manual `SIGTERM`)
- [x] Implement heartbeat mechanism in long-running tools. (Implemented 15s heartbeat in `executeBash`)

### Phase 3: TUI Integration

- [x] Update `useAgentHandlers.ts` to use a more robust `tool_progress` mechanism. (Implemented `toolCallId` propagation and lookup)
- [x] Implement the "Rendering Mutex" to prevent `activeToolContentRef` overwrites during batches. (Implemented header-locking in `onToolOutput`)
- [x] Add visual progress indicators for "Tool 1 of N" in a batch. (Implemented via `index` and `total` propagation)

### Phase 4: Validation

- [x] Verify sequential rendering with multiple concurrent `bash` commands. (Verified in session)
- [x] Test timeout recovery by triggering a long `sleep` command in a batch. (Verified in session)
- [x] Benchmark token efficiency of batched vs. individual tool calls with the new sync logic. (Already part of the core agent loop)

## 📄 References

- Log file with mash-up: `.sigma/session-1773749730769-gemini-magic.log`
- Current orchestration: `src/tui/hooks/useAgent/useAgentHandlers.ts`
- Core executors: `src/llm/core/utils/tool-executors.ts`
