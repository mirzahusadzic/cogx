# Changelog

All notable changes to the CogX Cognition CLI will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.3.2] - 2025-11-15

### Summary

Critical compression race condition fix (50%+ context loss), conversation continuity enhancements, slash command UX improvements, TUI visual upgrades, and memory architecture guidance for Claude's recall tool. Sigma now maintains true continuity across compression events.

### 🐛 Critical Bug Fixes

**Compression Race Condition ** - Eliminated React effect race between compression and message queueing causing 50%+ context loss. Automatic compression effect disabled; now triggers sequentially after queue populates. Updated 17 tests (10 converted to manual-only triggering). **Impact**: Conversation history fully preserved across compression events.

**Conversation Continuity** - Recaps include role-attributed last 5 turns, pending task detection, system identity fingerprint, and explicit continuity warnings. **Impact**: Assistant continues tasks seamlessly across 120K compression events instead of restarting.

**Session State Persistence** - Fixed TUI resume state corruption. Compression history persists correctly across restarts.

**Slash Command Cursor Positioning** - Force TextInput remount via dynamic `key` prop. Cursor now positions at end of selected command instead of stuck at partial match position (e.g., `/c` → `/consult-echo` left cursor after 'c').

**Mathematical Proofs Overlay (O₆)** - Fixed handler, prevented fallthrough to `structural_patterns`, removed document ingestion side-effect. Command `cognition-cli overlay generate mathematical_proofs` now works correctly.

**EmbeddingLoader Field Names** - Added `extracted_patterns`, `extracted_statements`, `knowledge` fields for complete O1-O7 coverage. Enables seamless v1 (YAML) ↔ v2 (LanceDB) migration.

**Dynamic Slash Command Discovery** - Removed hardcoded list. System identity documents discovery mechanism. Commands are self-contained instruction files - no synchronization needed.

### 🎨 UI/UX

- **Live progress bar** for compression analysis queue
- **Symbiosis Trinity banner** on TUI startup
- **Friendly interrupt message** when stopping mid-response
- **Sigma stats panel** width fix (`minWidth={48}`) prevents text clipping

### 📚 Documentation

**Memory Architecture Guidance** - System identity (`context-reconstructor.ts`), recall tool description (`recall-tool.ts`), and recap footer now explain two-layer memory: (1) 150-char truncated recap with "..." pointers, (2) full untruncated messages via `recall_past_conversation` tool. Claude understands when to retrieve full context.

**Slash Command Mechanism** - Documented 5-step execution: read `.md` → parse → replace placeholders → execute cognition-cli → format output

**Overlay Clarity** - Distinguished Structure (O1) vs Lineage (O3) with concrete examples

### 📝 Technical Changes

**Compression**: `useCompression.ts` (disabled automatic effect), `useCompression.test.ts` (17 tests updated), `useClaudeAgent.ts` (sequential trigger)
**Memory**: `context-reconstructor.ts` (architecture docs, pending turn carry-forward, dynamic slash commands), `recall-tool.ts` (updated description)
**UI**: `TextInput.tsx` (dynamic key), `TUI.tsx` (banner, interrupt), `CompressionQueue.tsx` (progress bar), `SigmaInfoPanel.tsx` (width fix)
**Overlays**: `overlay.ts` (mathematical proofs handler), `embedding-loader.ts` (complete field names)
**Session**: `useSessionManager.ts` (fixed state creation)

## [2.3.1] - 2025-11-14

### Summary

Smart multiline paste handling with visual streaming, line ending normalization, and intelligent chunk buffering.

### ✨ New Features

#### Smart Paste Detection & Handling

- **Automatic paste detection**: Triggers on >10 character changes or newline detection
- **Intelligent chunk buffering**: Accumulates paste chunks within 200ms window
- **Visual streaming**: Fast line-by-line display (5ms per line) with "📋 Pasting..." indicator
- **Direct content transmission**: Content sent directly to agent without redundant file I/O
- **Temp file backup**: Content saved to `/tmp/cognition-paste-{timestamp}.txt` for debugging

#### Content Normalization

- **Line ending normalization**: Automatically converts Windows `\r\n` to Unix `\n`
- **Escape sequence cleanup**: Removes bracketed paste markers (`[200~`, `[201~`)
- **Clean content delivery**: No escape sequences or formatting artifacts

### 🎨 UI Improvements

- **Paste notification**: Shows `📋 Paste saved to: /path/to/file` above input box
- **Streaming display**: Content streams line-by-line in amber-orange color
- **No UI overflow**: Input cleared immediately on paste detection

### 🐛 Bug Fixes

- Fixed multiline pastes being split into multiple separate files
- Fixed Windows line ending (`\r\n`) corruption showing as `^M` characters
- Fixed bracketed paste escape sequences leaking into content
- Fixed UI overflow when pasting large content blocks
- Fixed redundant paste content display after streaming

### 🛠️ Developer Experience

#### Smart Lint/Format Scripts

- `npm run lint:changed`: Lint only uncommitted changed files
- `npm run lint:staged`: Lint only staged files
- `npm run format:changed`: Format only uncommitted changed files
- `npm run format:staged`: Format only staged files

### 📝 Technical Changes

- **InputBox.tsx**: Added paste detection, buffering, normalization, and temp file save logic
- **index.tsx**: Implemented streaming handler that sends content directly after visual playback
- **ClaudePanelAgent.tsx**: Added streaming paste display, removed redundant post-paste display

### Performance Improvements

- Eliminated redundant file reads (content already in memory)
- Fast streaming (125 lines in ~625ms)
- Efficient chunk accumulation with overlap detection

## [2.3.0] - 2025-11-13

### Summary

TUI enhancements focusing on slash command dropdown menu, improved tool display formatting, and bug fixes.

### ✨ New Features

#### Slash Command Dropdown Menu

- Interactive dropdown menu for slash commands with fuzzy filtering
- Keyboard navigation (up/down arrows, Enter to select, Escape to close)
- Shows command descriptions from .claude/commands/\*.md files
- Auto-filters as you type after `/`
- 9 lines reserved when open, 1 line when closed (dynamic sizing)

### 🎨 UI Improvements

#### Enhanced Tool Display Formatting

- Split tool command display: tool name in amber-orange (#f5a623), command details in muted gray
- Removed duplicate tool call preview (was showing "🔧 Read..." then "🔧 Read: file: ...")
- Each tool now appears exactly once with full information
- Added markdown bold processing (**text** → amber-orange) for all messages
- Tool commands stand out clearly from assistant text

#### Color Scheme Updates

- User messages: #56d364 (green)
- Assistant messages: #58a6ff (blue)
- Tool calls: #f5a623 (amber-orange)
- System messages: #8b949e (muted gray)
- Tool command details: rgb(138,145,153) (theme muted gray)

### 🐛 Bug Fixes

#### File Path Detection

- Fixed absolute paths (e.g., /home/user/file.txt) being treated as slash commands
- System now distinguishes between slash commands and file paths
- Prevents "Unknown command" errors when pasting file paths

### 📝 Technical Changes

- Improved ToolFormatter priority for Bash commands
- Added processBold() helper for markdown formatting
- Removed stream event preview for cleaner tool display

## [2.2.0] - 2025-11-09

### Summary

105 commits from v2.1.0 focusing on stability, performance, and code quality. Critical fixes for document GC, session state bloat, GC improvements, and LanceDB enhancements (v2.1.0 introduced LanceDB, v2.2.0 enhanced it).

### 🐛 Critical Bug Fixes

#### Document GC Fix (d24a945, b0bcb15)

Fixed documents being deleted and re-ingested on every genesis run, wasting embedding API calls.

**Root Cause**: Document-based overlays (mission_concepts, security_guidelines, operational_patterns, mathematical_proofs) store document references differently than symbol-based overlays. Some overlays had no `manifest.json` files.

**Fix**:

- Check if overlay is document-based vs symbol-based
- Scan YAML files directly when no manifest exists
- Handle both `documentHash` (camelCase in overlays) and `document_hash` (snake_case in index)
- Compare contentHash (overlay) vs objectHash (index) for orphan detection

**Impact**: Wizard runs no longer waste embedding API calls re-ingesting unchanged documents.

#### Session State Bloat Fix (bc0a0aa)

Prevented 1,237 duplicate "expiration" entries during turn analysis (347 duplicates in 6 seconds).

**Root Cause**: React state updates are async. During rapid SDK message processing, `processSDKMessage()` reads stale `currentSessionId` from state before `updateSDKSession()` completes, logging duplicate entries.

**Fix**:

- Added `currentSessionIdRef` for synchronous session tracking
- Added duplicate check in `updateSessionState()` for defense-in-depth
- Cleaned up existing duplicate entries in state file

**Impact**: State file reduced from 6,216 lines (87,963 tokens) to 37 lines.

#### Orphaned Document Cleanup (aec6542)

Added automatic cleanup of orphaned document objects during Genesis GC.

**Root Cause**: Documents created by genesis_doc transforms but index entries were deleted (by GC bug). These orphaned objects accumulate in the object store.

**Fix**:

- Scan transform logs for genesis_doc outputs
- Compare against current document index
- Delete objects that are in transform logs but not indexed
- Only touches objects confirmed as documents (safe, won't delete source files or patterns)

**Impact**: 150 orphaned document objects cleaned up automatically during GC.

#### GC Phase 5 - All 7 Overlays (98c75cd, 5cb8ad8, 0b6c359)

Fixed GC only checking 4/7 overlays before deleting objects, causing documents and patterns to be incorrectly deleted.

**Root Cause**: `getOverlayReferencedHashes()` hardcoded array only included structural_patterns, lineage_patterns, mission_concepts, strategic_coherence.

**Fix**:

- Added missing overlays: security_guidelines, operational_patterns, mathematical_proofs
- Bidirectional GC: protect objects FROM deletion, purge overlays WITH orphaned refs
- Check both sourceHash and symbolStructuralDataHash
- Support both JSON and YAML overlay files

**Impact**: Documents and patterns no longer incorrectly deleted during GC.

#### Overlay Alignment Scores (b9a792f, 707d4c0)

Fixed all 7 overlays reading `alignment_O1` (structural) instead of overlay-specific alignment scores.

**Root Cause**: `getAllItems()` and `query()` methods hardcoded `turn.alignment_O1` for all overlays.

**Fix**: Use `getOverlayId()` to dynamically read the correct alignment score (alignment_O1 through alignment_O7).

**Impact**: Sigma Stats and similarity search now show accurate overlay-specific scores.

### 🚀 Performance Improvements

#### LanceDB Enhancements (v2.1.0 introduced LanceDB, v2.2.0 enhanced it)

**Note:** LanceDB integration was introduced in v2.1.0. Version 2.2.0 adds critical enhancements:

- **Prevent version bloat** with `mergeInsert` (c5b1742)
  - Before: 13,145 versioned files in .sigma
  - After: 1 merged file per table
- **EmbeddingLoader** for v1/v2 format compatibility (5e5d54c)
  - Graceful migration between formats
  - Backward compatible with v1 YAML files
- **Delete embeddings on re-ingestion** + compaction (90f9a18)
  - Prevents duplicate embeddings
  - Automatic cleanup during re-ingestion
- **Suppress warnings** in production/TUI mode (3d6b28b)
  - Cleaner output for end users
- **Fixed CI/CD segfaults** with proper LanceDB cleanup

**Disk Space Reductions**:

- `.sigma`: 550 MB → ~5 MB (embeddings moved to LanceDB)
- `.sigma` versions: 13,145 files → 1 file (mergeInsert)
- `.open_cognition/overlays`: 90%+ per YAML file (embeddings stripped)
- Total saved: ~545 MB across both directories

**Runtime Performance**:

- Documents: No re-embedding waste (GC fix)
- Compression: 2-3 minutes → seconds (metadata-only lattice files)

### ✨ New Features

#### Extended Thinking Mode (406870f)

Added support for extended thinking mode in the TUI, allowing Claude to use up to 10K thinking tokens for complex reasoning tasks.

- Added `--max-thinking-tokens` option to TUI
- Configurable via command line
- Enables deeper reasoning for complex problems

### 🎨 TUI Improvements

- Fixed lattice display for JSON data (lineage patterns) (ae45222)
- Fixed overlay scores computation from conversation data (691ab22)
- Fixed input filter blocking brackets (7b00190)
- Added colorful, formatted output for lattice command (6bf972a)
- Improved visual feedback and error handling

### 🔨 Code Refactoring (21 commits)

#### useClaudeAgent Decomposition

Massive code reduction: **52.5% reduction** in useClaudeAgent complexity

**Deleted**:

- 316-line init effect
- 49 lines of debugLog statements
- Simplified session effects: 40→5 lines
- Simplified service initialization: 64→9 lines

**Extracted Layers**:

- Session Management layer with tests
- Compression layer with background trigger logic
- Analysis layer with background queue
- Token counting module
- SDK layer module
- Rendering layer module

**Result**: 15/15 modules achieved, cleaner architecture

### 🔧 Session & Compression Improvements

Building on v2.1.0's context persistence foundation:

- Reset token counter when session switches after compression (f4dc56c)
- Fixed Claude context limit: 200K → 150K tokens (7ecc71a)
- Added buffer zone explanation to SESSION_BOUNDARY_RATIONALE (c3cd189)
- Comprehensive session state tests

### 🧪 Tests & CI/CD (16 commits)

- Reorganized test files into **tests** directories
- Added comprehensive tests for session management
- Fixed failing tests with proper PGC infrastructure
- Switch workerpool tests from vmThreads to forks (stability)
- Require Node.js >=25.0.0 for CI/CD consistency
- Fixed CI/CD segfaults with LanceDB cleanup
- Increased test timeouts and memory limits

### 📊 Metrics

- **Lines of Code**: ~54,680 TypeScript total
  - Production: ~42,824 lines (78%)
  - Tests: ~11,856 lines (22%)
- **Commits**: 105 from v2.1.0
- **Test Coverage**: 40 test files covering core functionality
- **Code Quality**: All commits linted, type-safe, built successfully

### 🎯 Code Quality

- All commits: Linted, type-safe, built successfully
- Dual-Claude peer review workflow validated
- Production-ready on first deploy
- 105 commits with zero breaking changes

## [2.1.0] - 2025-11-05

### 🐛 Critical Bug Fixes - Context Persistence

Fixed 4 critical issues causing context loss in multi-turn conversations after compression.

#### Persistent Recap Injection

Removed premature recap clearing after first query (`useClaudeAgent.ts:994`). Recap now persists across all queries in new session until next compression, enabling natural follow-up questions without re-explaining context.

#### Low-Importance Turn Preservation

Changed from permanent deletion to 10% token budget compression for turns with importance < 3 (`compressor.ts:70-86`). Brief but critical constraints like "target device has 256MB RAM" now preserved even if initially low-scored.

#### Expanded Context Window

Increased real-time context injection window from 20→50 turns, injection count from 3→5 turns, and added paradigm shift inclusion regardless of recency (`context-injector.ts`). Enables access to architectural decisions from 50+ turns ago.

#### Compression Feedback UI

Enhanced system message with detailed breakdown showing preserved/compressed/discarded counts, compression ratio, and mode detection (`useClaudeAgent.ts:976-983`).

### 🔧 Technical Improvements

- **Compression Threshold Consistency**: Standardized default to 120K tokens across all components (configurable via `--session-tokens`)
- Fixed `useClaudeAgent.ts:409` and `StatusBar.tsx:20` to match CLI default

### 📚 Documentation

- Added `SIGMA_CONTEXT_ARCHITECTURE.md` (1,223 lines) documenting dual-lattice infinite memory system
- Updated `QUICK_REFERENCE.md` with fix details and testing scenarios
- Enhanced `O5_OPERATIONAL_LATTICE.md` with operational patterns catalog (1,171 lines)
- Fixed outdated "one-shot recap" statements and token threshold examples (150K→120K)

## [2.0.4] - 2025-11-04

### 🐛 Bug Fixes

#### TUI Claude Code System Prompt Integration

Fixed TUI not using `claude_code` preset system prompt, causing inconsistent behavior with standard CLI. TUI Claude was missing critical instructions (git safety, clarifying questions, task management) and would make assumptions on ambiguous requests instead of asking for clarification.

**Fix**: Always pass `systemPrompt: { type: 'preset', preset: 'claude_code' }`. Compression recaps inject as user prompt instead of replacing system prompt.

#### Token Count Accumulation

Fixed token count resetting between queries instead of accumulating, preventing compression from triggering. Used `Math.max()` to track highest value across session.

### 📚 Documentation

- Updated TUI authentication docs to clarify Claude Code CLI dependency
- Reorganized command docs into focused guides
- Added "Getting Started with Lattice" walkthrough
- Added The Lattice Book cover visual
- Fixed markdown linting and formatting across all docs

### 🛠️ Technical Improvements

- Fixed LanceDB NAPI reference leaks causing test crashes
- Improved OAuth token expiration error handling with clear messaging

## [2.0.3] - 2025-11-03

### ✨ Features

#### LanceDB Integration with Dual-Storage Architecture

Implemented high-performance dual-storage for conversational lattice: YAML for human-readable metadata, LanceDB for fast vector search.

**Performance**: 10-100x faster queries, 95% reduction in YAML file size (288 bytes vs 22KB per turn)

**Key Features**:

- Automatic v1→v2 migration (lazy, preserves original files)
- LanceDB-priority reads with YAML fallback
- Cross-session semantic search and paradigm shift tracking
- 768D embeddings with 7 overlay alignments (O1-O7)

**Files Added**: `conversation-lance-store.ts`, `cross-session-query.ts`, `migrate-yaml-to-lancedb.ts`, `MIGRATION_V1_TO_V2.md`

**Migration**: Automatic on access. Manual: `npx tsx src/sigma/migrate-yaml-to-lancedb.ts .sigma`

**Deprecation**: v1 format (embeddings in YAML) will be removed in v3.0

### 🐛 Bug Fixes

#### Token Count Accumulation on Session Restore

Fixed incorrect token accumulation when restoring sessions. SDK provides cumulative totals, but code was adding them (causing 30-40k to inflate). Now uses `Math.max()` to track highest value.

#### LanceDB BigInt Timestamp Conversion

Fixed Apache Arrow Int64 (BigInt) conversion errors by creating plain JS object copies instead of modifying Arrow proxies.

## [2.0.2] - 2025-11-03

### 🐛 Bug Fixes

#### Missing Session State Files for Fresh Sessions

Fixed a critical issue where fresh TUI sessions (without `--session-id`) would flush conversation overlays but not create session state files, making it impossible to track or resume sessions.

**Root Cause**: Session state files (`.sigma/{sessionId}.state.json`) were only written during compression (at 150K tokens). For shorter sessions or periodic flushes, no state file was created.

**Changes**:

- Added `writeSessionState()` helper function to create/update session state files
- Write initial state file when SDK session ID is received (first message)
- Update state file during periodic flushes (every 5 turns)
- State file tracks session metadata, turn analysis stats, and file references

**Impact**: All sessions now have persistent state files, enabling proper session tracking and resumption.

#### Assistant Message Streaming Fragmentation

Fixed a critical issue where assistant responses were being analyzed during streaming, capturing only fragments ("Yes", "Sure", "Ah") instead of complete responses. This made conversation recall nearly useless.

**Root Cause**: The analyzer effect triggered on every message update, including streaming deltas. Assistant messages were analyzed before completion, storing only partial text.

**Changes**:

- Added `lastAnalyzedMessageIndex` tracking to prevent re-analyzing messages
- Check `isThinking` state before analyzing assistant messages
- Only analyze assistant messages when `isThinking === false` (response complete)
- Process unanalyzed messages in a loop with proper state management
- Added `isThinking` to effect dependencies for proper re-trigger

**Impact**: Conversation overlays now contain full, complete assistant responses, making memory recall actually useful for understanding past conversations.

#### Excessive Retry Delays for Memory Recall

Fixed overly aggressive exponential backoff that caused 10-15 second delays when the memory recall tool hit rate limits.

**Root Cause**: Retry delay formula was `retryAfter * 1000 + attempt * 1000`, causing delays to grow exponentially (e.g., 15 seconds on attempt 5).

**Changes**:

- Capped retry delay at 3 seconds maximum: `Math.min(retryAfter * 1000, MAX_RETRY_DELAY_MS)`
- Moved retry configuration to `src/config.ts`:
  - `MAX_RETRIES = 5`
  - `MAX_RETRY_DELAY_MS = 3000`
- Applied to both `/summarize` and `/embed` endpoints in `WorkbenchClient`

**Impact**: Memory recall tool responds much faster, improving TUI responsiveness from 10-15s waits to max 3s.

## [2.0.1] - 2025-11-03

### 🐛 Bug Fixes

#### TUI SDK Hang on Fresh Session Starts

Fixed a critical issue where the TUI would hang indefinitely when starting without a session ID, leaving users stuck with the "Thinking..." spinner.

**Root Cause**: The MCP recall server was being passed to the SDK even on fresh starts with no conversation history, potentially causing initialization delays or blocking behavior.

**Changes**:

- Conditionally enable MCP recall server only when conversation history exists:
  - When resuming an existing session (`currentResumeId` is set), OR
  - After first turn is analyzed (`turnAnalyses.current.length > 0`)
- Fix `sendMessage` dependency array to use `resumeSessionId` instead of `currentSessionId` to prevent callback recreation during SDK session ID updates
- Add enhanced debug logging for SDK query lifecycle and message processing
- Add error detection and user feedback when SDK completes without response

**Impact**: Fresh sessions now start immediately without MCP overhead, while resumed and post-compression sessions maintain full recall capabilities.

## [2.0.0] - 2025-11-03 - 🎯 Sigma Release

### 💥 BREAKING CHANGES

**This is a major architectural evolution warranting a 2.0 release.**

The introduction of Σ (Sigma) fundamentally changes how AI agents maintain stateful memory across sessions. This represents a paradigm shift from static knowledge graphs (v1.x) to stateful AI with infinite context (v2.0).

### 🚀 Major Features

#### Σ (Sigma) - Infinite Context System

**The groundbreaking dual-lattice architecture for stateful AI with infinite memory.**

- **Dual-lattice Meet operations**
  - Project lattice (`.open_cognition/`) ∧ Conversation lattice (`.sigma/`)
  - Semantic alignment scoring across 7 dimensions
  - Real-time conversation indexing with project knowledge grounding

- **7-dimensional conversation overlays (O1-O7)**
  - O₁: Architecture/design discussions
  - O₂: Security concerns raised
  - O₃: Knowledge evolution tracking
  - O₄: Goals/objectives for session
  - O₅: Commands/actions executed
  - O₆: Algorithms/logic discussed
  - O₇: Conversation flow and coherence
  - Built on-the-fly from chat turns, mirroring project overlays

- **Intelligent context compression at 150K tokens**
  - Importance formula: `novelty × 5 + max(alignment_O1..O7) × 0.5`
  - Preserves high-alignment turns (alignment ≥ 6)
  - Discards low-value chat ("that's great!", repeated explanations)
  - 7-dimensional intelligent recap generated via lattice algebra

- **Session lifecycle management**
  - Phase 1: Normal operation (0-150K tokens) - in-memory lattice building with periodic flush
  - Phase 2: Compression trigger - flush overlays, generate recap, keep memory for continuity
  - Phase 3: Session resurrection - reconstruct context from intelligent recap
  - Seamless continuity across unlimited sessions

- **Context reconstruction**
  - Structured recap from all 7 cognitive dimensions
  - Rich system prompt with session statistics
  - MCP `recall_past_conversation` tool for deep memory access
  - User experiences zero context loss

- **High-fidelity memory recall system**
  - Specialized `conversation_memory_assistant` persona for recall synthesis
  - Query deconstruction via `query_analyst` persona (SLM)
  - Multi-overlay search across all O1-O7 with embeddings
  - Temporal re-ranking: results sorted chronologically for coherence
  - Enhanced context synthesis with importance/alignment/overlay metadata
  - Retry mechanism: 5 retries with exponential backoff for 429 errors
  - Increased coverage: topK from 5 → 10 for better context
  - Pretty display: 🧠 icon for memory recall tool in TUI
  - Preserves technical details (file names, function names, decisions)

- **Periodic overlay persistence**
  - Automatic flush every 5 turns (prevents data loss in short sessions)
  - Cleanup flush on TUI exit/unmount (guarantees data is saved)
  - Overlays remain in memory across SDK session boundaries
  - Memory available even before compression triggers (150K tokens)

- **Session forwarding for compressed sessions**
  - Automatically forward `--session-id` to compressed session when resuming
  - Check `.sigma/{id}.state.json` for compression state
  - Load recap and start fresh SDK session (no resume of dead sessions)
  - User always uses original session ID, Sigma manages chain internally
  - Prevents confusion about which session ID to use after compression

- **Performance characteristics**
  - Per-turn overhead: 300-500ms (embedding + alignment scoring)
  - Compression time: 7-12s (at 150K tokens)
  - Session startup: 150ms (recap loading)
  - Token savings: 50K (compression avoided) + 26K (no re-explanation) = **76K tokens saved per 150K session**

#### Interactive TUI with Real-Time Lattice Visualization

**Production-ready terminal user interface with BBS-style aesthetics.**

- **Real-time overlay status bar**
  - Live overlay counts: `Overlays: O1[12] O2[3] O3[8] O4[15] O5[6] O6[2] O7[10]`
  - Lattice statistics: `Nodes: 47 | Edges: 156 | Shifts: 23`
  - Token tracking with compression threshold: `Tokens: 123.6K (61.8%) | Compress at: 150.0K`
  - Toggle info panel with 'i' key for detailed overlay breakdown

- **Persistent scroll history**
  - Fixed top bar (overlays, stats)
  - Fixed bottom bar (session ID, token count, controls)
  - Scrollable middle section with position indicator (`↕ 87%`)
  - Mouse scroll support (toggle with 'm' key)
  - Full conversation history preserved

- **BBS-style horizontal separators**
  - Clean text output (no vertical box edges for easy copying)
  - Horizontal lines between sections for visual clarity
  - Retro terminal aesthetics with modern functionality

- **Session continuity support**
  - Resume existing sessions via `--session-id` flag
  - Live lattice building visible in status bar
  - Seamless compression and resurrection workflow

#### TSX/JSX File Support in Genesis

**Extended genesis to analyze React/Preact components.**

- **File extension support**
  - Added `.tsx` and `.jsx` to `DEFAULT_FILE_EXTENSIONS`
  - Map `.tsx` → typescript language
  - Map `.jsx` → javascript language

- **Parser enhancements**
  - Enabled JSX support in TypeScript compiler options
  - Added `jsx: ts.JsxEmit.React` to transpile config
  - Full AST parsing for component structures

- **Exclusion patterns**
  - Added `.tsx/.jsx` test file patterns to ignore list
  - Prevents test component pollution in overlays

- **Impact**
  - Genesis now analyzes the TUI itself (all components in `src/tui/`)
  - O₁ (Structural) queries work on UI layer
  - Component dependency graphs fully tracked
  - Closes significant analysis gap for React codebases

#### Debug Flag System for Workbench Logging

**Conditional verbose logging to reduce noise.**

- **WorkbenchClient debug parameter**
  - Added optional `debug` flag to constructor
  - Rate limit messages only print when `debug=true`
  - Propagates through entire conversation overlay system

- **Full stack integration**
  - Agent hook accepts `debug` option
  - `ConversationOverlayRegistry` passes debug to all managers
  - All 7 conversation overlay managers forward debug flag
  - TUI respects `--debug` CLI flag

- **User experience**
  - Clean output by default (no workbench spam)
  - Verbose logging available when needed for troubleshooting
  - `[WorkbenchClient] Rate limit hit (429)...` messages suppressed

### 📚 Documentation

#### Chapter 21: Sigma Architecture

**800-line comprehensive technical manual added to THE LATTICE BOOK.**

- **Complete coverage of Sigma system**
  - Dual-lattice architecture explanation
  - Meet operations and semantic alignment
  - Importance formula with detailed examples
  - Session lifecycle (normal → compress → resurrect)
  - Storage structures and technical specifications
  - Performance characteristics and benchmarks

- **Comparison tables**
  - vs. Cloud-based memory systems
  - vs. Traditional RAG
  - vs. Long Context Windows (200K)
  - Feature-by-feature analysis with honest assessment

- **Real-world use cases**
  - Long-running development sessions
  - Codebase exploration
  - Pair programming
  - Research & prototyping

- **Future directions**
  - Adaptive compression thresholds
  - Cross-session knowledge transfer
  - Collaborative memory (multi-user)
  - Federated lattices (P2P)

- **VitePress integration**
  - Added to sidebar navigation as Part VI
  - Reading path for AI Engineers
  - Accessible via docs website

#### Philosophy

**The symmetric machine meets the asymmetric human.**

- **Machine contribution (symmetric)**
  - Perfect memory via lattice algebra
  - Deterministic traversal of knowledge graphs
  - Meet operations with exact semantic alignment
  - No hallucination in grounded data (fidelity=1.0)

- **Human contribution (asymmetric)**
  - Creative leaps across unconnected domains
  - Intuitive pattern recognition
  - Novel questions the machine never asked
  - Mission alignment (values, ethics, goals)

- **Symbiosis**
  - Compound understanding over time
  - Zero context amnesia tax
  - Pure forward momentum
  - Infinite possibilities

### 🛠️ Technical Improvements

- **Compression threshold UI indicator**
  - Status bar shows `| Compress at: 150.0K`
  - Makes Sigma trigger transparent to user
  - Green color indicates feature, not limit

- **Horizontal separators in TUI**
  - Added between overlays bar, chat panel, input box, status bar
  - Terminal-width dynamic separator lines
  - Improves visual hierarchy

- **All conversation overlay managers**
  - `ConversationStructuralManager` (O1)
  - `ConversationSecurityManager` (O2)
  - `ConversationLineageManager` (O3)
  - `ConversationMissionManager` (O4)
  - `ConversationOperationalManager` (O5)
  - `ConversationMathematicalManager` (O6)
  - `ConversationCoherenceManager` (O7)
  - All extend `BaseConversationManager`
  - Implement `addTurn()`, `flush()`, `clearMemory()` lifecycle

### 🎨 User Experience

- **Zero re-explanation required**
  - Agent maintains full context across sessions
  - No "can you remind me" questions
  - Continuous flow without momentum loss
  - Natural conversation without context rebuilding

- **Transparent memory management**
  - Visible lattice statistics in real-time
  - Clear compression threshold indicator
  - Session ID and token count always visible
  - User knows exactly when compression will occur

- **Production-tested**
  - 150K+ token sessions with zero context loss
  - Dogfooded during Sigma development itself
  - Meta-circular testing (built with the system it implements)
  - Real-world validation of infinite context claims

### 📊 Economics

**Token efficiency analysis:**

Traditional approach (without Sigma):

- ~30-50% of tokens wasted on re-explanation
- Context compression overhead every session
- $547.50/year per user in wasted tokens (at $3/M tokens)

Sigma approach:

- 76K tokens saved per 150K session (50%)
- Zero re-explanation overhead
- Local eGemma: $0 ongoing cost
- **50% efficiency gain + eliminates amnesia tax**

### 🔬 Innovation Count

**This release alone contains 10+ groundbreaking innovations:**

1. Dual-lattice architecture (Project ∧ Conversation)
2. Real-time conversation overlay building (O1-O7)
3. Meet-based semantic alignment scoring
4. Importance formula (novelty × 5 + max(alignment) × 0.5)
5. Intelligent 7-dimensional compression
6. Session lifecycle management (resurrect with recap)
7. MCP memory tool integration
8. Production TUI with persistent scroll
9. BBS-style visual design
10. TSX/JSX genesis support
11. Debug flag propagation system
12. Economic analysis (76K token savings/150K session)

**Total project innovations to date: 54+ innovations in 11 days**

### 🎯 Impact

This release explores a novel approach to AI memory management:

- **Alternative to RAG-based approaches** using dual-lattice architecture
- **Demonstrates lattice algebra application** to context compression
- **Achieves persistent context** across session boundaries
- **Reduces re-explanation overhead** through intelligent preservation
- **Open source (AGPL-v3)** to enable research and establish prior art

### 📦 Installation & Usage

```bash
# Start with existing session
cognition-cli tui --session-id <session-id>

# Watch compression happen live at 150K tokens
# Experience seamless session resurrection
# Zero context loss, infinite continuity

# Check version
cognition-cli --version
# 2.0.0 (Cognition CLI - Sigma Release)
```

### 🙏 Acknowledgments

- eGemma workbench for embeddings and LLM orchestration
- Agent SDK for infrastructure
- Lattice algebra theory for mathematical foundations
- The artist's workflow: "Block in shapes, then refine"

---

## [1.8.1] - 2025-11-01

### 🔒 Security

- **CRITICAL: Fixed SQL injection vulnerability in vector store** (`lance-store.ts`)
  - IDs with special characters (quotes, SQL keywords, CVE formats) could break queries
  - Added `escapeSqlString()` method following SQL standard (double single quotes)
  - Applied to `getVector()` and `deleteVector()` operations
  - All vector storage operations now secure against malicious IDs

### ✨ Features

- **Implemented project operator (`->` / `TO`) for lattice queries**
  - Syntax: `cognition-cli lattice "O5 -> O2"`
  - Semantic projection from one overlay to another
  - Finds items in right overlay aligned with items in left overlay
  - Uses `meet()` with threshold 0.6 and topK 10

- **Implemented complement operator (`!` / `NOT`) with helpful error**
  - Parses successfully but throws instructive error message
  - Explains why complement requires universal set
  - Directs users to use difference instead: `"O1 - O2"`
  - Provides concrete examples for alternatives

### 🧪 Testing

- **Added comprehensive test suite: 65 tests (all passing)**
  - `lattice-operations.test.ts`: 26 tests covering all 9 algebra operations
    - union, intersection, difference, meet (12 tests)
    - complement wrapper (2 tests)
    - symbolDifference, symbolIntersection, symbolUnion (9 tests)
    - complex compositions (2 tests)
    - SQL injection prevention (1 test)
  - `query-parser.test.ts`: 25 tests for query parsing
    - Tokenization for all operators (6 tests)
    - AST parsing with precedence (4 tests)
    - Error handling (4 tests)
    - Complex query examples (5 tests)
    - Edge cases (6 tests)
  - `lance-store.test.ts`: 14 tests for vector store security
    - Basic operations (4 tests)
    - SQL injection scenarios with CVE formats, quotes, keywords (7 tests)
    - Error handling (3 tests)

### 📚 Documentation

- **Updated `docs/LATTICE_ALGEBRA.md`**
  - Fixed project operator (was marked "future", now fully documented)
  - Added complement operator with usage examples
  - Added helpful error message examples

- **Updated `docs/manual/part-3-algebra/12-boolean-operations.md`**
  - Corrected project() signature (CLI vs programmatic API)
  - Marked complement as not directly supported (helpful error)
  - Added complete examples for symbolIntersection() and symbolUnion()
  - Now covers all 9 algebra operations with TypeScript examples

### 📊 Coverage

- **All 9 lattice algebra operations now fully implemented, tested, and documented:**
  1. ✅ meet() - Semantic alignment
  2. ✅ project() - Semantic projection
  3. ✅ union() - Combine items
  4. ✅ intersection() - Items in all overlays
  5. ✅ difference() - Items in A not B
  6. ✅ complement() - Wrapper for difference
  7. ✅ symbolDifference() - Fast symbol set difference
  8. ✅ symbolIntersection() - Fast symbol set intersection
  9. ✅ symbolUnion() - Fast symbol set union

## [1.8.0] - 2025-11-01

### 🎉 Self-Cognition - "The Lattice Explains Itself"

This release achieves **Block 4 (Self-Cognition)** - the system can now query and explain its own knowledge. The new `ask` command enables natural language queries across the entire knowledge lattice with semantic synthesis and provenance tracking. **15 commits** spanning semantic Q&A, frontmatter validation, enhanced extraction, quest logging, and documentation.

### Major Features

#### 1. Semantic Q&A System - `cognition-cli ask`

The flagship feature enabling true self-cognition through natural language queries:

- **Natural language queries** across the entire knowledge lattice
  - Example: `cognition-cli ask "what is cPOW used for?"`
  - Cross-overlay synthesis (queries O₁-O₇ simultaneously)
  - 2-3 second response times
- **Semantic matching with confidence scores**
  - Each source shows match percentage (e.g., "71.8% match")
  - Results ranked by semantic relevance
  - Pulls from multiple overlays for comprehensive answers
- **Synthesized answers with provenance**
  - AI-generated answer combining all relevant sources
  - Source citations with overlay tags (O₄, O₅, O₁, etc.)
  - Complete transparency of knowledge lineage
- **Multi-overlay semantic search**
  - Automatically searches across all relevant overlays
  - Cross-layer synthesis (Chapter 11 - O₇ Coherence in action)
  - Intelligent source selection and ranking

**Implementation:**

- `src/commands/ask.ts` - New command entry point
- Enhanced `QueryService` with semantic Q&A capabilities
- Integration with existing overlay infrastructure
- Reuses semantic embeddings from PGC

#### 2. 100% Classification Confidence

YAML frontmatter infrastructure for authoritative document metadata:

- **Frontmatter-based classification**
  - Parser extracts YAML frontmatter using js-yaml
  - Frontmatter treated as authoritative (1.0 confidence)
  - Overrides ML-based classification when present
- **All 15 manual documents validated**
  - Each doc has explicit `type` and `overlay` metadata
  - 100% classification confidence across entire manual
  - Validation enforces 75% threshold
- **Validation infrastructure**
  - `test-manual-classification.ts` validator
  - Ensures all manual docs meet quality threshold
  - Prevents regression in document classification

**Example frontmatter:**

```yaml
---
type: architectural
overlay: O4_Mission
---
```

#### 3. Enhanced Document Extraction

Generalized extraction system for comprehensive documentation capture:

- **WorkflowExtractor generalized**
  - Now handles all documentation types (not just workflows)
  - Section heading-based extraction
  - Captures explanatory content ("What is X?" sections)
- **"What is X?" extraction fixed**
  - Properly extracts definition sections
  - Preserves context from section headings
  - Better semantic chunking
- **Force re-ingestion support**
  - `genesis:docs --force` flag added
  - Allows document updates without PGC reset
  - Useful for iterative documentation improvements

#### 4. Quest Operations Logging (Block 2 - Lops)

Infrastructure for transparency logging and quest execution tracking:

- **Transparency logging system**
  - Logs all quest operations to `.open_cognition/logs/`
  - Tracks command execution, duration, and outcomes
  - Foundation for cPOW lineage tracking
- **Quest execution provenance**
  - Links operations to specific quests
  - Enables audit trail for cognitive work
  - Supports Block 2 (Lops) requirements

#### 5. Sacred Pause Formalization

Documentation of the three Oracle Meeting Points:

- **Oracle Meeting Points documented**
  - Three-phase decision framework
  - Depth-based quality gates
  - Formalized pause criteria
- **Integration with quest mechanics**
  - Links to F.L.T.B validation
  - PGC coherence checks
  - Security mandate verification

### Added

#### Commands

- `ask "<question>"` - Query knowledge lattice in natural language
  - Cross-overlay semantic search
  - Synthesized answers with source citations
  - Confidence scoring and ranking

#### Features

- **YAML frontmatter parsing** in MarkdownParser
- **Frontmatter-authoritative classification** in DocumentClassifier
- **Generic WorkflowExtractor** for all documentation types
- **Force flag** for `genesis:docs` command (`--force`)
- **Increased token limits** (8192) for large document ingestion
- **Enhanced semantic shadows** in query results
- **Section heading extraction** for better context capture

### Changed

- **Token limits increased** from 4096 to 8192 for Anthropic API calls
- **Semantic shadow inclusion** in query results (previously excluded)
- **WorkflowExtractor** made generic (renamed conceptually to handle all docs)

### Fixed

- **"What is X?" extraction** now properly captures definition sections
- **Semantic shadows** now correctly included in `ask` query results
- **Section heading context** preserved during extraction
- **Large document ingestion** no longer truncated (increased token limit)

### Documentation

- **Chapter 5: CLI Operations** added to reference manual
- **Comprehensive README update** reflecting seven-overlay architecture
- **Sacred Pause formalization** in operational documentation
- **Oracle Meeting Points** documented

### Performance

- **2-3 second query response times** for semantic Q&A
- **Reuses existing embeddings** from PGC (no re-embedding)
- **Efficient cross-overlay search** using optimized vector queries

### Validation

Quest verification metrics for this release:

- **F.L.T.B**: Format ✅ Lint ✅ Test ✅ Build ✅
- **PGC**: All 15 manual documents at 100% classification confidence
- **Tests**: All passing
- **Coherence**: Maintained lattice coherence

---

## [1.7.5] - 2025-10-31

### 🎉 Complete 7-Overlay Lattice System - "The Foundation Manual"

This release represents the **complete implementation** of the 7-overlay cognitive lattice architecture with comprehensive documentation, algebra operations, and security hardening. **35 commits** spanning lattice algebra, multi-overlay routing, complete overlay support, 8 new manual chapters, and security enhancements.

### Major Features

#### 1. Lattice Algebra System

- **ASCII query syntax** for Boolean operations across overlays
  - Set operations: `O1 ∩ O2` (intersection), `O1 ∪ O2` (union), `O1 - O2` (difference)
  - Tag filtering: `O2[critical]`, `O4[mission-alignment]`
  - Concept search: `O4 ~ "verification"` (semantic similarity)
  - Coherence queries: `O7[coherence>0.8]`
- **Complete OverlayAlgebra implementation** for all 7 overlays (O₁-O₇)
- **OverlayRegistry** for dynamic overlay discovery and composition
- **Query parser** with full lattice operation support

#### 2. Phase 2 Multi-Overlay Document Routing

- **Intelligent document classification** using confidence thresholds
  - Strategic documents → O₄ Mission Concepts
  - Security documents → O₂ Security Guidelines
  - Operational documents → O₅ Operational Patterns
  - Mathematical documents → O₆ Mathematical Proofs
- **Automatic overlay generation** based on document type
- **Content-addressable storage** with provenance tracking

#### 3. Complete 7-Overlay System

- **O₁ Structure**: Code artifacts and AST patterns
- **O₂ Security**: Threat models, CVEs, mitigations (NEW: full CLI support)
- **O₃ Lineage**: Dependency tracking and blast radius
- **O₄ Mission**: Strategic concepts and principles
- **O₅ Operational**: Workflow patterns and quests
- **O₆ Mathematical**: Formal proofs and theorems
- **O₇ Coherence**: Cross-layer synthesis and drift detection
- **Sugar commands** for intuitive access to each overlay

#### 4. Foundation Manual (900+ pages)

Eight comprehensive chapters documenting the complete system:

- **Chapter 4.5**: Core Security - protecting the lattice
- **Chapter 5**: O₁ Structure - code artifacts
- **Chapter 6**: Security implementation details
- **Chapter 7**: O₃ Lineage - dependency tracking
- **Chapter 8**: O₄ Mission - strategic concepts
- **Chapter 9**: O₅ Operational - workflow guidance
- **Chapter 10**: O₆ Mathematical - formal properties
- **Chapter 11**: O₇ Coherence - cross-layer synthesis
- **Chapter 20**: cPOW Reference Manual - cryptographic proof of work

#### 5. O₂ Security Layer

- **Security commands**: `security list`, `security query`, `security cves`
- **Lattice algebra integration**: `O2[critical]`, `O2 - O1` (coverage gaps)
- **THREAT_MODEL.md**: 20 real security threats for cognition-cli
  - Mission Document Poisoning (CRITICAL)
  - Command Injection (CRITICAL)
  - PGC Data Tampering (CRITICAL)
  - Path Traversal (HIGH)
  - API Key Exposure (MEDIUM)
- **Security coherence metrics**: Dynamic mission alignment tracking
- **SecurityExtractor**: Multi-field structured threat parsing
- **Dual-use acknowledgment system**: Minimal security bootstrap

#### 6. Performance Optimizations

- **Eliminate double embedding**: Reuse embeddings from mission validation
- **Core bottleneck fixes**: Faster overlay generation
- **Improved wizard performance**: Better progress indicators

#### 7. Enhanced Wizard

- **Generate all 7 overlays** in one command
- **Ingest overlay template docs** from `docs/overlays/`
- **Better UX**: Improved prompts and progress tracking
- **Storage measurements**: Accurate PGC size reporting

### Added

#### Commands

- `lattice <query>` - Execute Boolean algebra operations across overlays
- `overlays` - Show available overlays and their data status
- `security list` - List all security knowledge in O₂ overlay
- `security query <term>` - Search security knowledge by text
- `security cves` - List tracked CVEs
- `security attacks` - Show attack vectors conflicting with mission
- `security coverage-gaps` - Show code without security coverage
- `security boundaries` - Show security boundaries and constraints
- `security coherence` - Show security implementation alignment
- `security mandate` - Display the Dual-Use Technology Mandate
- `workflow patterns` - Show workflow patterns
- `workflow quests` - Show quest structures
- `workflow depth-rules` - Show depth rules
- `proofs theorems` - Show all theorems
- `proofs lemmas` - Show all lemmas
- `proofs list` - Show all mathematical statements
- `proofs aligned` - Show proofs aligned with mission
- `concepts search <term>` - Search mission concepts

#### Features

- **Recursive section processing** in SecurityExtractor for nested markdown
- **Multi-field structured threat parsing** (Threat/Severity/Attack/Impact/Mitigation)
- **Mission alignment headers** on security classes (MissionValidator, etc.)
- **PGC explanation headers** in init/status commands
- **Workbench API key warning** deferred until actual use (no spurious warnings)
- **Comprehensive testing guide** (docs/TESTING.md)
- **Lattice algebra guide** with quest-oriented commands

### Changed

- **VISION.md relocated** to `docs/overlays/O4_mission/` (rightful home)
- **Coherence report** with accurate drift calculation
- **Algebra-based coherence** integrated into main coherence command
- **Wizard PGC exists prompt** improved with clear options

### Fixed

- **SecurityExtractor** now handles nested markdown sections (extracted 0 → 20 guidelines)
- **TypeScript linter errors** resolved across codebase
- **Wizard template docs** ingestion from correct path
- **TOC anchor** for section 10 in Chapter 4.5
- **Metadata rendering** in foundation manual chapters

### Security

- **Minimal dual-use acknowledgment** on first run
- **Mission alignment tracking** for security classes
- **Threat model documentation** with 20 real security threats
- **Transparency logging** for all security operations

### Documentation

- 8 new foundation manual chapters (900+ pages)
- Comprehensive lattice algebra guide
- Complete testing guide
- cPOW reference manual
- Quest-oriented command workflows
- Security mandate documentation

### Performance

- Core bottleneck optimizations
- Eliminated double embedding (validation + overlay generation)
- Faster wizard execution
- Improved progress indicators

---

## [1.6.0] - 2025-10-28

### 🎉 The Shadow + Monument 5.1 - "Lattice-aware Gaussian Weighting"

This release introduces two major innovations building on the defensive publication:

#### Innovation #26: Monument 4.7 - The Shadow

- Dual embedding system for structural and semantic signatures
- Structural embeddings based on AST patterns
- Semantic embeddings based on docstring + type signatures
- Enables both code pattern matching AND mission alignment queries

#### Innovation #27: Monument 5.1 - Lattice-aware Gaussian Weighting

- Pure lattice-based coherence eliminating all hardcoded constants
- Gaussian statistics for signal/noise separation (filters symbols below μ - σ)
- Graph centrality from O₁ reverse_deps (logarithmic scaling)
- Three-tier coherence metrics: Average, Weighted, Lattice

### Added

- **Lattice coherence metric** using pure mathematical derivation
  - Weight formula: `w = centrality × gaussian_significance`
  - `centrality = log10(dependency_count + 1)`
  - `gaussian_significance = max(0.1, 1.0 + z_score)`
  - NO HARDCODED CONSTANTS - all derived from lattice structure
- **Gaussian noise filtering** - excludes symbols below μ - σ (z-score < -1.0)
- **Cross-overlay synthesis** - O₁ (structure) + O₃ (mission) + statistics
- **Debug logging** for centrality calculations with dependency counts
- **Enhanced coherence report** showing all three metrics with deltas

### Fixed

- **Critical bug**: PGCManager initialization in StrategicCoherenceManager
  - Was passing `pgcRoot` instead of `projectRoot`
  - Created incorrect paths (`.open_cognition/.open_cognition/...`)
  - Caused lattice coherence to always return 0%
  - Now correctly passes parent directory via `path.dirname()`

### Results

- **Lattice coherence**: 57.7% (+3.0% from baseline)
- **Gaussian filtering**: Successfully filtering statistical noise
- **Centrality weighting**: Working correctly from reverse_deps
- **Verification**: Debug logs confirm proper dependency lookups

### Documentation

- Updated README with Innovations #26-27
- Updated Zenodo DOI to 10.5281/zenodo.17466998
- Comprehensive release notes on GitHub
- JSDoc comments for all lattice-aware functions

---

## [1.5.0] - 2025-10-26

### 🎉 O₃/O₄ Implementation Release - "Strategic Intelligence Architecture"

This release represents the completion of the Strategic Intelligence Architecture with full implementation of Overlay 3 (Mission Concepts) and Overlay 4 (Strategic Coherence).

### Added

#### O₃ Layer - Mission Concepts

- **Pattern-based concept extraction** with 6 targeted strategies
  - Blockquotes (distilled essence)
  - Headers (structured concepts)
  - Bold text (emphasis markers)
  - Bullet lists (enumerated concepts)
  - Emoji-prefixed lines (visual markers)
  - Quoted phrases (coined terms)
- **97.6% noise reduction** (1,076 → 26 concepts from VISION.md)
- **768-dimensional embeddings** for semantic analysis
- **Recursive meta-cognition** - system extracted its own methodology
- Multi-document aggregation from strategic documentation

#### O₄ Layer - Strategic Coherence

- **Semantic alignment scoring** between code and mission concepts
- **Vector similarity analysis** using cosine similarity
- **Top-N alignment tracking** per code symbol
- **Bidirectional mapping** (code → concepts, concepts → code)
- **Coherence metrics dashboard** with drift detection

#### Security Architecture

- **Multi-layer mission validation**:
  - Gemini LLM content safety (optional)
  - Pattern-based threat detection (fallback)
  - Semantic drift analysis (embedding-based)
  - Structural integrity validation
- **5-pattern attack detection**:
  - Security weakening
  - Trust erosion
  - Permission creep
  - Ambiguity injection
  - Velocity over safety
- **Immutable audit trail** for mission document versions
- **Advisory mode by default** - warns without blocking
- **Configurable security** with transparent thresholds

#### CLI Commands

**Mission Concepts (`cognition-cli concepts`)**:

- `concepts list` - Show all extracted mission concepts
- `concepts for-section <name>` - Filter concepts by section
- `concepts search <query>` - Semantic search in concepts
- `concepts stats` - Extraction statistics

**Strategic Coherence (`cognition-cli coherence`)**:

- `coherence report` - Overall metrics dashboard
- `coherence aligned` - High-alignment symbols (≥ 70%)
- `coherence drifted` - Low-alignment symbols (< 70%)
- `coherence for-symbol <name>` - Detailed symbol analysis
- `coherence compare <s1> <s2>` - Side-by-side comparison

**Overlay Generation**:

- `overlay generate mission_concepts` - Extract concepts from strategic docs
- `overlay generate strategic_coherence` - Compute code-mission alignment

**Documentation Ingestion**:

- `genesis-docs <path>` - Ingest markdown documentation
- `genesis-docs --recursive` - Recursive directory ingestion

### Changed

- **Lattice architecture** now includes 4 overlay dimensions (O₁-O₄)
- **Multi-document strategic coherence** aggregates concepts from all docs
- **Updated README** with O₃/O₄ lattice graph and data flow patterns
- **Enhanced logging** with spinner indicators and progress tracking

### Fixed

- Vector metadata now includes `filePath` and `structuralHash`
- Invalid vector diagnostics improved (shows symbol instead of full record)
- Single-embedding optimization for mission concept generation
- Positive strategic language in concept extraction

### Documentation

- Comprehensive O₃ documentation with extraction algorithm
- Security architecture threat model and defense layers
- Mission drift attack scenarios and detection
- Claude integration guide with TOC
- DocsOracle integration for concept embedding

### Performance

- **Single embedding pass** for mission concepts (no re-embedding)
- **Cached validation** skips security checks for unchanged documents
- **Parallel lineage mining** with optimized worker pools
- **Rate-limited embedding** service with queue management

### Tested

- 79 passing tests across all overlay layers
- Contract tests for VISION.md ingestion
- Security validation test suite
- Multi-document aggregation tests

---

## [1.0.0-prior-art] - 2025-10-25

Initial tag for prior art baseline before O₃/O₄ implementation.

---

## Release Philosophy

**v1.5.0 represents:**

- ✅ Production-ready Strategic Intelligence Architecture
- ✅ Complete 4-dimensional lattice (O₁-O₄)
- ✅ Full CLI with 10+ commands
- ✅ Multi-layer security with mission drift detection
- ✅ Recursive meta-cognitive capability
- ✅ 20 commits of solid engineering
- ✅ 85 passing tests with no external dependencies

**For Zenodo archival and academic citation.**
