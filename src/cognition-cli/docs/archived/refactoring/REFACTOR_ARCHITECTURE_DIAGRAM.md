# useClaudeAgent Refactor - Architecture Diagram

## Current State (Monolith)

```
┌─────────────────────────────────────────────────────────────────┐
│                     useClaudeAgent.ts                            │
│                        1,790 lines                               │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │ SDK Query    │  │ Turn Analysis│  │ Compression  │         │
│  │ Management   │  │ & Embeddings │  │ Trigger      │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │ Session      │  │ Token Count  │  │ Message      │         │
│  │ State Mgmt   │  │ Tracking     │  │ Rendering    │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │ Context      │  │ Overlay      │  │ Error        │         │
│  │ Injection    │  │ Population   │  │ Handling     │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
│                                                                  │
│  Problems:                                                       │
│  • Impossible to test in isolation                              │
│  • Bug fixes require understanding entire file                  │
│  • Re-embedding blocks UI                                       │
│  • Token reset bugs persist for weeks                           │
└─────────────────────────────────────────────────────────────────┘
```

## Target State (Modular)

```
┌─────────────────────────────────────────────────────────────────┐
│                  useClaudeAgent.ts (Orchestrator)                │
│                         150 lines                                │
│                                                                  │
│  • Compose sub-hooks                                            │
│  • Wire up event handlers                                       │
│  • Expose unified API                                           │
└─────────┬───────────────────────────────────────────────────────┘
          │
          │  Delegates to:
          │
    ┌─────┴─────────────────────────────────────┐
    │                                             │
    ▼                                             ▼
┌─────────────────────┐              ┌─────────────────────┐
│   SDK Layer         │              │  Analysis Layer     │
│  (450 lines)        │              │  (350 lines)        │
├─────────────────────┤              ├─────────────────────┤
│ useSDKQuery         │              │ useTurnAnalysis     │
│  • Query lifecycle  │              │  • Orchestration    │
│  • Resume logic     │              │  • Embedding cache  │
│  • Context inject   │              │                     │
│                     │              │ AnalysisQueue ⭐    │
│ useSDKMessageHandler│              │  • Background proc  │
│  • Process messages │              │  • Progress bar     │
│  • Extract session  │              │  • Non-blocking     │
│  • Update tokens    │              │                     │
└─────────────────────┘              └─────────────────────┘
    │                                             │
    │                                             │
    ▼                                             ▼
┌─────────────────────┐              ┌─────────────────────┐
│ Compression Layer   │              │  Session Layer      │
│  (300 lines)        │              │  (350 lines)        │
├─────────────────────┤              ├─────────────────────┤
│ useCompression      │              │ useSessionManager   │
│  • Orchestration    │              │  • State lifecycle  │
│  • Lattice storage  │              │  • SDK ID updates   │
│  • Recap generation │              │  • Anchor mapping   │
│                     │              │                     │
│ CompressionTrigger  │              │ SessionStateStore   │
│  • Threshold check  │              │  • Load/Save        │
│  • Flag management  │              │  • Migration        │
│  • Reset logic      │              │  • File operations  │
└─────────────────────┘              └─────────────────────┘
    │                                             │
    │                                             │
    ▼                                             ▼
┌─────────────────────┐              ┌─────────────────────┐
│  Token Layer        │              │  Rendering Layer    │
│  (180 lines)        │              │  (350 lines)        │
├─────────────────────┤              ├─────────────────────┤
│ useTokenCount       │              │ MessageRenderer     │
│  • State management │              │  • Format messages  │
│  • Reset semantics  │              │  • Apply colors     │
│                     │              │  • Streaming        │
│ TokenCounter        │              │                     │
│  • Math.max logic   │              │ ToolFormatter       │
│  • Reset flag       │              │  • Tool display     │
│  • Update handling  │              │  • Diff generation  │
└─────────────────────┘              └─────────────────────┘
```

## Data Flow (Compression Workflow)

```
1. User sends message
   │
   ▼
2. useSDKQuery creates query
   │
   ▼
3. useSDKMessageHandler processes response
   │
   ├─→ Updates token count (useTokenCount)
   │
   └─→ Extracts session ID (useSessionManager)
   │
   ▼
4. useTurnAnalysis analyzes message
   │
   ├─→ AnalysisQueue adds to background queue
   │
   └─→ Populates overlays (async, non-blocking)
   │
   ▼
5. CompressionTrigger checks threshold
   │
   ▼  (if threshold exceeded)
6. useCompression triggers compression
   │
   ├─→ Calls compressContext() from sigma/
   │
   ├─→ Saves lattice to disk
   │
   ├─→ Generates recap
   │
   ├─→ Resets token count (useTokenCount.reset())
   │
   └─→ Clears resume session ID
   │
   ▼
7. Next SDK message arrives with new session ID
   │
   ├─→ useSessionManager updates anchor state
   │
   └─→ CompressionTrigger resets flag
   │
   ▼
8. Ready for next compression cycle
```

## Testing Pyramid

```
                      ┌─────────────┐
                      │   E2E (10)  │  Full workflows
                      │             │  Real scenarios
                      └──────┬──────┘
                             │
                   ┌─────────┴──────────┐
                   │  Integration (15)   │  Hook interactions
                   │                     │  Cross-module
                   └──────────┬──────────┘
                              │
              ┌───────────────┴────────────────┐
              │        Unit Tests (50+)         │  Module isolation
              │                                 │  Edge cases
              │  • Token reset logic            │  Fast execution
              │  • Session state operations     │
              │  • Compression triggers         │
              │  • Analysis queue ordering      │
              │  • Message rendering            │
              │  • Tool formatting              │
              │  • SDK message parsing          │
              └─────────────────────────────────┘
```

## Module Dependencies

```
useClaudeAgent (Orchestrator)
│
├─→ useSessionManager
│   └─→ SessionStateStore
│       └─→ fs (file system)
│
├─→ useTokenCount
│   └─→ TokenCounter (pure logic)
│
├─→ useTurnAnalysis
│   ├─→ AnalysisQueue
│   │   └─→ EmbeddingService
│   └─→ ConversationRegistry
│
├─→ useCompression
│   ├─→ CompressionTrigger
│   ├─→ compressContext (from sigma/)
│   └─→ reconstructSessionContext (from sigma/)
│
├─→ useSDKQuery
│   ├─→ useSDKMessageHandler
│   │   ├─→ MessageRenderer
│   │   └─→ ToolFormatter
│   └─→ injectRelevantContext (from sigma/)
│
└─→ Debug logging utilities

Key:
→  Dependency
└─→ Nested dependency
```

## Critical Path (Compression Bug)

### Before (Monolith)

```
Token count update
   │
   ▼
Check if > threshold
   │
   ▼
Set compressionTriggered = true
   │
   ▼
Start async compression
   │
   ├─→ Compress context (async)
   │
   ├─→ Save lattice (async)
   │
   └─→ Reset token count ❌ TOO LATE!
        (happens inside async block)
   │
   ▼
More messages arrive
   │
   ▼
Token count keeps increasing ❌ BUG!
```

### After (Modular + Tested)

```
Token count update
   │
   ▼
CompressionTrigger.shouldTrigger()
   │  (isolated, testable)
   ▼
YES → useCompression.trigger()
   │
   ├─→ Reset token count IMMEDIATELY ✅
   │   (before any async logic)
   │
   ├─→ Start async compression
   │   └─→ (won't affect token count)
   │
   └─→ Set compressionTriggered = true
   │
   ▼
Next SDK message with new session ID
   │
   ▼
CompressionTrigger.reset()
   │  (isolated, testable)
   ▼
Ready for next compression ✅
```

## Background Queue Flow

```
User Message Arrives
   │
   ▼
useTurnAnalysis.add(message)
   │
   ▼
AnalysisQueue.add(turn)  ← Returns immediately!
   │
   └─→ Adds to queue
   │
   └─→ Triggers processQueue() (async)
        │
        │  Meanwhile, UI remains responsive ✅
        │
        ▼
    processQueue() runs in background
        │
        ├─→ Takes turn from queue
        │
        ├─→ Generate embedding (slow)
        │
        ├─→ Calculate novelty
        │
        ├─→ Populate overlays
        │
        ├─→ onProgress(remaining) ← Update UI
        │
        └─→ Loop until queue empty
            │
            ▼
        Queue empty
            │
            ▼
        onComplete() ← Notify UI
```

## File Structure

```
src/tui/hooks/
├── useClaudeAgent.ts                    [150 lines]
│
├── sdk/
│   ├── useSDKQuery.ts                   [200 lines]
│   ├── useSDKMessageHandler.ts          [250 lines]
│   └── types.ts
│
├── analysis/
│   ├── useTurnAnalysis.ts               [200 lines]
│   ├── AnalysisQueue.ts                 [150 lines] ⭐
│   └── types.ts
│
├── compression/
│   ├── useCompression.ts                [200 lines]
│   ├── CompressionTrigger.ts            [100 lines]
│   └── types.ts
│
├── session/
│   ├── useSessionManager.ts             [200 lines]
│   ├── SessionStateStore.ts             [150 lines]
│   └── types.ts
│
├── tokens/
│   ├── useTokenCount.ts                 [100 lines]
│   ├── TokenCounter.ts                  [80 lines]
│   └── types.ts
│
└── rendering/
    ├── MessageRenderer.ts               [200 lines]
    ├── ToolFormatter.ts                 [150 lines]
    └── types.ts

Total: ~2,300 lines in 15 focused modules
(vs 1,790 lines in 1 monolith)
```

## Success Metrics Dashboard

```
┌──────────────────────────────────────────────────────────┐
│              Code Quality Metrics                        │
├──────────────────────────────────────────────────────────┤
│  Lines per file:        < 250  ✅                        │
│  Cyclomatic complexity: < 10   ✅                        │
│  Test coverage:         > 95%  ✅                        │
│  ESLint violations:     0      ✅                        │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│              Performance Metrics                         │
├──────────────────────────────────────────────────────────┤
│  Turn analysis:    < 200ms     ✅                        │
│  Compression:      < 5 seconds ✅                        │
│  Session load:     < 2 seconds ✅                        │
│  UI blocks:        Never       ✅                        │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│              Reliability Metrics                         │
├──────────────────────────────────────────────────────────┤
│  Token reset bugs:      0      ✅                        │
│  Session data loss:     0      ✅                        │
│  Compression success:   100%   ✅                        │
│  Error clarity:         High   ✅                        │
└──────────────────────────────────────────────────────────┘
```

---

**Version**: 1.0  
**Date**: 2025-11-08  
**Status**: Architecture Approved
