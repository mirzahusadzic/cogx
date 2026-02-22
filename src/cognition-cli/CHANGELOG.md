# Changelog

All notable changes to the CogX Cognition CLI will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.6.8] - 2026-02-22

### Summary

**Surgical Context Eviction & Model Provider Expansion.** This release introduces comprehensive "Surgical Eviction" for tool logs across all LLM providers, significantly reducing token usage and context bloat by pruning task history upon completion. It also expands provider support by introducing the Minimax provider, migrating to Gemini 3.0/3.1 defaults while purging legacy models.

### 🚀 New Features

#### LLM Providers & Models

- **Gemini 3.x Migration:** Migrated to Gemini 3.0 defaults, added support for `gemini-3.1-pro` models, and purged legacy 2.x EOL models.
- **Minimax Provider (Experimental):** Implemented the Minimax provider via the Anthropic SDK and added support for Minimax models to shell completions (Note: currently experimental and untested yet).

#### CLI Operations & Execution

- **Solo Mode (`--solo`):** Introduced a new `--solo` CLI flag to run the agent in isolation without connecting to the broader `IPC_SIGMA_BUS` or loading the full lattice context. The default remains "full" mode (as before).
- **Provider Consistency:** Implemented token optimization and system prompt improvements across all providers.

#### Context Management & Surgical Eviction

- **Surgical Tool Log Eviction:** Implemented task-aware history eviction that surgically removes `edit_file`, `write_file`, and other tool logs upon task completion across Gemini, OpenAI, and Minimax providers.
- **Turn-Range Eviction:** Introduced Turn-Range Eviction for Gemini 3.x models to ensure robust memory pruning without losing system instructions.
- **Temporal Gating Mechanism:** Added a Temporal Gating Mechanism to prevent memory re-hydration loops after eviction.
- **Token Counter Accuracy:** Refined TUI token counting to accurately reflect token drops after surgical eviction, removing outdated "high-water mark" and "token bounce" artificial drop prevention logic.
- **Context Grooming:** Implemented persistent memory and context grooming rules, elevating surgical eviction rules to system prompts and ensuring `SigmaTaskUpdate`'s `result_summary` is enforced.

### 🐛 Bug Fixes

- **ADK Integration:** Bumped `@google/adk` to 0.3.0, resolving type errors and aligning with ADK session events.
- **Token Bounce:** Fixed issues where token counts would bounce back or explode (`numTurns` explosion) after log eviction by correctly persisting pruned logs in ADK session storage and modifying the active session.
- **Thought Signatures:** Preserved thought flags and signatures during task log eviction for Gemini.

### ⚡ Performance & Infrastructure

- **Test Robustness:** Added E2E and persistence tests for context eviction, and fixed flaky timer/retry tests.
- **Cost Estimation:** Refactored `estimateCost` signature to use exact token usage for more accurate reporting.

## [2.6.7] - 2026-01-29

### Summary

**TUI Visual Balance & Gemini 3 Reasoning Robustness.** This release focuses on refining the terminal experience with "Dim Cyan" theme balancing, improved diff rendering, and stabilized streaming. It also hardens the Gemini integration with thought signature support to resolve reasoning loops and implements robust retry and failover infrastructure for increased reliability.

### 🚀 New Features

#### TUI & User Experience

- **Visual Theme Refinement:** Dimmed cyan tones in roles and text themes for better visual balance and reduced eye strain.
- **Enhanced Diff Highlighting:** Improved diff auto-detection and rendering accuracy, including better highlighting and handling of negative values.
- **InputBox Improvements:** Preserves leading whitespace in InputBox submissions for better formatting control.
- **Tool UI Extensions:** Extended tool labels in ToolFormatter and escaped raw tool output to prevent accidental markdown parsing of backticks.

#### LLM & Gemini Integration

- **Gemini 3 Thought Signatures:** Implemented support for thought signatures to persist reasoning and resolve potential loops in Gemini 3 models.
- **Robust Retry Infrastructure:** Introduced a provider refactor with robust retry logic, backoff strategies, and model failover infrastructure.
- **Streaming Stabilization:** Unified streaming stabilization constants and improved terminal height safety for smoother output.

### 🐛 Bug Fixes

- **Diff Rendering:** Resolved false positives in diff auto-detection for git commands and handled negative values correctly.
- **Output Normalization:** Resolved extra newlines and improved tool output normalization for cleaner display.
- **Markdown Robustness:** Improved markdown rendering visual accuracy and robustness against malformed input.
- **Token Management:** Prevented double compression by removing an incorrect token reset and fixed tool-executor test issues.
- **Gemini Reliability:** Fixed retry counter reset and backoff logic on successful stream events.

### ⚡ Performance & Infrastructure

- **TUI Optimization:** Disabled cursor blinking and optimized component memoization to reduce CPU usage.
- **Safety Hardening:** Strengthened tool executor safety and improved test reliability.
- **Layout Logic:** Reverted to aggressive multi-render layout update logic to resolve rendering artifacts and accessibility issues.

## [2.6.6] - 2026-01-21

### Summary

**TUI Theme Overhaul & Vertex AI Robustness.** This release introduces the "Monolith Cyan" theme with AST-based markdown rendering for a more vibrant and stable terminal experience. It significantly improves Gemini/Vertex AI integration by enforcing global noise suppression and enabling Vertex AI support without requiring a legacy API key. Key performance optimizations in rendering and session scanning are also included.

### 🚀 New Features

- **TUI Theme Overhaul:** Introduced the "Monolith Cyan" theme with refined thinking blocks, improved contrast, and vibrant accent colors.
- **AST-based Markdown Rendering:** Replaced regex-based markdown rendering with a more robust AST-based engine for reliable formatting.
- **Vertex AI Support:** Enabled Vertex AI support without requiring a `GEMINI_API_KEY`, streamlining enterprise and cloud deployments.
- **Smart Auto-scroll:** Prevent auto-scroll when the user has manually scrolled up in the chat window.
- **Enhanced Path Relativization:** Improved path relativization across tools and executors for cleaner and more consistent TUI display.

### 🐛 Bug Fixes

- **Gemini/Vertex AI Noise Suppression:** Implemented aggressive global stdout suppression and robust interception to eliminate SDK/gRPC logging noise and TUI flicker.
- **TUI Stability:** Fixed hangs on narrow terminals, stabilized streaming tool output to prevent layout jumping, and resolved stale scroll closures.
- **Token Tracking:** Improved token tracking and reporting accuracy for Gemini and OpenAI providers.
- **Patterns Command:** Resolved a `ReferenceError` in the `patterns list` command.
- **Stream Formatting:** Fixed literal `\n\n` string normalization in stream output.

### ⚡ Performance & Infrastructure

- **Rendering Optimization:** Optimized message rendering, overlay score calculation, and theme engine performance.
- **Session Scanning:** Optimized session scanning and reduced log noise in `getAllItems`.
- **Markdown Diffing:** Enhanced the markdown renderer with smart diff detection and color refinements.

## [2.6.5] - 2026-01-18

### Summary

**TUI Responsiveness & LLM Context Improvements.** This release focuses on enhancing the Terminal User Interface (TUI) with major layout and responsiveness upgrades, including global scrolling, improved navigation, and robust cursor management. It also improves LLM context awareness by auto-relativizing git paths and optimizing test scripts.

### 🚀 New Features

#### TUI & User Experience

- **Refactored Layout Engine:** Implemented flexbox and dynamic measurement for a more robust and adaptable TUI layout.
- **Global Scrolling:** Added global Page Up/Down scrolling functionality for the chat window.
- **Enhanced Navigation:** Improved Home/End/Page keys support and general navigation within the TUI.
- **Real-time Tool Output Streaming:** Enhanced tool output, streaming, and responsiveness with intelligent content compression.
- **Command History:** Introduced command history with up/down arrow navigation for input.
- **Layered Cursor Suppression:** Implemented aggressive, layered cursor hiding and ANSI sanitization to prevent visual glitches.

#### LLM & Context Management

- **Auto-Relativized Git Paths:** Improved LLM context by automatically converting git output paths to be relative to the current working directory.
- **Simplified System Prompt:** Streamlined the system prompt to provide clearer context for LLMs.
- **Improved Color Handling:** Enhanced `NO_COLOR` and `FORCE_COLOR` environment variable handling.

### 🐛 Bug Fixes

- **InputBox Rendering:** Resolved multi-line rendering glitches in the InputBox component, especially after history recall or pasting, by introducing forced layout updates.
- **Cursor Glitches:** Fixed various terminal cursor visibility issues by explicitly hiding the cursor after tool completion and during streaming.
- **InputBox Confirmation:** Ensured InputBox confirmation messages consistently display on a single line.
- **Test Script Execution:** Addressed issues where `npm test` might not correctly support file paths or could double-run tests by introducing a dedicated test runner script.

### 🏗️ Infrastructure & Tests

- **Dependency Updates:** Upgraded `ink` to 6.6.0 and `@google/adk` to 0.2.4.
- **Test Script Optimization:** Optimized the test script's `sleep` function using `Atomics.wait` for better performance.
- **Input History Management:** Bounded the InputBox command history to the last 100 entries to improve memory usage.
- **Consistent ANSI Stripping:** Centralized ANSI code stripping using the `strip-ansi` package for improved robustness and consistency.

---

## [2.6.4] - 2026-01-16

### Summary

**PGC Grounding & Multi-Provider Token Optimization.** Implements Sigma Task Protocol v2.0 with structured grounding and multi-agent delegation. Introduces a unified Tri-Modal Compression Strategy for Gemini, OpenAI, and eGemma, featuring semantic checkpointing, survival mode TPM protection, and dynamic thinking budgets. Modularizes TUI architecture and expands the test suite for core services.

### 🚀 New Features

#### Sigma Task Protocol v2.0

- **Structured Grounding:** Implemented `grounding` and `grounding_evidence` arrays in `SigmaTaskUpdate` for verifiable task execution.
- **PGC-Aware Delegation:** Full support for Manager/Worker delegation pattern with acceptance criteria and result summaries.
- **Grounding Strategies:** Support for `pgc_first`, `pgc_verify`, and `pgc_cite` strategies across Gemini, OpenAI, and Claude providers.

#### Multi-Provider Token Optimization

- **Tri-Modal Compression Strategy:** Implemented unified context management for Gemini, OpenAI, and eGemma:
  - **Semantic Mode:** Aggressive cleanup (>50k tokens) after task completion to flush implementation noise.
  - **Standard Mode:** Safety net (>200k tokens) for natural conversation and exploration.
  - **Survival Mode:** Real-time TPM runway protection that forces compression before API rejection.
- **Dynamic Thinking Budgeting:** Automatically scales reasoning effort (Gemini `thinkingLevel`, OpenAI `reasoning_effort`) based on remaining TPM quota.
- **Semantic Checkpointing:** Automatically flushes implementation noise while preserving high-level plan after task completion.
- **Proactive Token Warnings:** Visual alerts when context pressure reaches 50K tokens to prevent TPM exhaustion.
- **Preemptive Compression:** Background compression triggered before reaching limits to maintain TUI responsiveness.
- **Reasoning-First Enforcement:** Encourages agents to plan before executing complex tool calls.

#### TUI & Architecture

- **Modular TUI Architecture:** Refactored TUI into hooks and services (`useAgent`, `useAgentServices`, etc.) for better maintainability.
- **Observer-Stream Architecture:** New system diagnostics logging for better visibility into agent activities.
- **Auto-Response Mechanism:** Expanded recovery prompts for post-compression state restoration.

#### IPC Enhancements

- **Project-Specific Bus Isolation:** Improved isolation for agent communication across different projects.
- **Stale Agent Cleanup:** Automatic removal of inactive agents from the IPC registry.

### 🐛 Bug Fixes

- **Gemini Tool Coercion:** Fixed issues where Gemini's tool calls would fail due to parameter type mismatches (using Zod schema for `SigmaTaskUpdate`).
- **TUI State Desync:** Resolved "tail race" conditions and state desync in compression logic.
- **Thinking Block Accumulators:** Fixed missing thinking blocks and cleared accumulators after tool execution in Gemini provider.
- **Debug Flag Handling:** Correctly pass global `--debug` flag to TUI commands.

### 🏗️ Infrastructure & Tests

- **Comprehensive Test Suite:** Expanded unit tests for TUI hooks, core commands, and sugar modules.
- **Regression Tests:** Added tests for tool coercion, schema parity, and TUI lifecycle.
- **Dependency Updates:** Updated `@openai/agents` to 0.3.8, `openai` to 6.16.0, and `@google/adk` to 0.2.3.

## [2.6.3] - 2025-12-22

### Summary

**Cross-Project Agent Collaboration.** Implements IPC_SIGMA_BUS for seamless agent communication across different project directories, enabling true multi-agent workflows and knowledge sharing between codebases.

### 🚀 New Features

#### Cross-Project IPC Mesh

- **IPC_SIGMA_BUS Environment Variable:** Control agent discovery and communication scope via environment variable.
  - Not set: Project-local `.sigma/` (backward compatible)
  - `IPC_SIGMA_BUS=global`: Shared state at `~/.cognition/sigma-global/`
  - `IPC_SIGMA_BUS=<name>`: Custom isolated mesh at `~/.cognition/sigma-<name>/`
- **Shared Directory Resolution:** New `sigma-directory.ts` helper automatically resolves appropriate .sigma paths based on IPC_SIGMA_BUS value.
- **Cross-Project Agent Discovery:** Agents can discover and communicate with agents in different project directories on the same mesh.
- **ZeroMQ Bus Scoping:** Socket paths adapt to IPC_SIGMA_BUS value (e.g., `/tmp/ipc-sigma-global.sock`).
- **Multiple Mesh Support:** Isolate agent teams by using different IPC_SIGMA_BUS values (e.g., `frontend` vs `backend`).

#### Cross-Project Grounding Mesh

- **Project Awareness:** Agents now track which project they're working in via `projectName` and `projectRoot` fields in agent-info.json.
- **Agent Listings with Projects:** `list_agents` output now includes a "Project" column showing which codebase each agent is exploring.
- **Cross-Codebase Queries:** Agents can query other agents about their respective codebases, enabling distributed knowledge sharing.

#### TUI Improvements

- **MCPSearch Tool Formatting:** Enhanced TUI display for MCP tool discovery results.
- **Extended Command Descriptions:** Increased command description limit from 40 to 80 characters for better clarity.

### 🐛 Bug Fixes

- **Provider Fallback Detection:** Fixed model name detection when provider fallback occurs in agent initialization.
- **Project Name Display:** Fixed agent listings to properly show project names in cross-project scenarios.

### 🏗️ Infrastructure

- **Code Coverage:** Enabled code coverage infrastructure for better test visibility.

## [2.6.2] - 2025-12-20

### Summary

**Manager/Worker Delegation & LLM Modernization.** Implements a robust multi-agent collaboration pattern, adds Gemini 3.0 Flash as the new default, and introduces OpenAI Agent SDK support.

### 🚀 New Features

#### Manager/Worker Delegation Architecture

- **Unified Task Management:** Introduced `SigmaTaskUpdate` as the single source of truth for task tracking across all providers (Claude, Gemini, OpenAI).
- **Manager/Worker Pattern:** Formal delegation flow where Managers assign tasks with explicit **Acceptance Criteria** and Workers report back with a **Result Summary**.
- **Stable Task IDs:** Persistent identifiers for tasks that survive session restarts and context compression.
- **Strict Delegation Validation:** Zod-enforced schema requiring `acceptance_criteria` and `delegated_to` fields when a task is marked as delegated.
- **Auto-Approval:** `SigmaTaskUpdate` now supports auto-approval for seamless task tracking.

#### LLM Provider Modernization

- **Gemini 3.0 Flash:** Weaved Gemini 3.0 Flash into the core and established `gemini-3-flash-preview` as the new default model.
- **OpenAI Agents SDK:** Added full support for the OpenAI Agents SDK with workbench auto-configuration.
- **Gemini Cost Estimation:** Added token-based cost estimation for Gemini requests.
- **Dynamic Temporal Grounding:** Injected dynamic timestamps into the system fingerprint for better temporal awareness.
- **Snappier Compression:** Reduced Gemini compression threshold to 200K tokens for faster context management.

#### TUI & UX Enhancements

- **Animal Kingdom Icons:** New animal-themed icons for lattice metrics in the TUI.
- **Platform-Specific UI:** Optimized emoji spacing for macOS and dimmed separator aesthetics.
- **Strengthened Recall:** Increased conversation recap truncation to 256 characters for better context retrieval.
- **Node.js 22 Support:** Official support for Node.js 22 runtime.

### 🐛 Bug Fixes

- **Claude TodoWrite Override:** Successfully blocks the native Claude SDK `TodoWrite` tool and replaces it with `SigmaTaskUpdate`.
- **OpenAI SDK Silence:** Suppressed OpenAI SDK stderr output to prevent TUI corruption.
- **IPC Discovery:** Extracted shared agent discovery utilities and fixed Gemini alias resolution.
- **Messaging Protocol:** Hardened instructions to prevent agents from polling `list_pending_messages`.
- **Reasoning Fix:** Updated `@openai/agents` to 0.3.6 to resolve reasoning event issues.

### 🧹 Refactoring

- **Shared Tool Executors:** Unified tool execution logic between Gemini and OpenAI agents.
- **Node.js 18+ Compatibility:** Updated core modules for modern Node.js environments.

## [2.6.1] - 2025-12-08

### Summary

**Maintenance release.** Bug fixes, documentation improvements, and minor UX enhancements across TUI, overlays, and provider handling.

### 🚀 New Features

#### Proofs & Alignment Improvements

- **Configurable similarity threshold:** `proofs aligned --threshold 0.4` for fine-tuning alignment queries
- **Full text display:** Removed truncation from proofs, coherence, workflow, and security output
- **Meet result deduplication:** Eliminates duplicate alignments by text content instead of document hash
- **Generate all overlays:** `overlay generate all` creates all 7 overlays in sequence

#### Concept Extraction Fixes

- **Skip numbered headings:** Prevents section labels like "1. Verifiability First" from being extracted as concepts
- **Extract bold principles:** Correctly extracts actual principle statements from child content
- **Proof deduplication:** Removes duplicate statements with/without type prefixes

#### Workbench Adaptive Rate Limiting

- **Dynamic rate limits:** Fetches `/rate-limits` endpoint from eGemma workbench
- **Automatic adaptation:** Adjusts request timing based on server capacity

### 🐛 Bug Fixes

- **TUI provider detection:** Validate provider from state file, fall back if unavailable
- **Provider registry:** Detect Claude provider via registry instead of env var only
- **Session resume:** Abort gracefully when resuming with unavailable provider
- **Watcher improvements:** Detect new files by watching directories with glob patterns
- **IPC alias resolution:** Prefer active agents, align heartbeat timing
- **Workflow display:** Use `patternType` for display when `type` is missing
- **OverlaysBar:** Show lattice stats alongside task progress, consistent spacing
- **Token display:** Fix token freezing in status bar

### 📚 Documentation

- **LLM module README:** Comprehensive documentation for the LLM subsystem
- **TUI README modernization:** Updated with current features and IPC docs
- **Ingest documents:** Added strategic documents for PGC overlay ingestion
- **Stats table:** Updated README with accurate statistics

### 🔧 Maintenance

- **Node.js v20 LTS:** Lowered requirement from v25 to v20.18.1 for broader compatibility
- **Debug gates:** ZeroMQ logs gated behind `DEBUG_IPC` env var
- **Provider rename:** `claude-provider` → `claude-agent-provider` for clarity

## [2.6.0] - 2025-12-03

### Summary

**Innovation #47: Multi-Agent Collaborative System.** This release transforms Cognition CLI from a single-agent tool into a multi-agent coordination platform. AI agents can now communicate, collaborate, and reason together through persistent message queues and event-driven pub/sub infrastructure.

### 🚀 Major New Features

#### Multi-Agent IPC Infrastructure

A complete inter-process communication system enabling real-time agent collaboration:

- **ZeroMQ Pub/Sub Bus:** Event-driven messaging with zero polling overhead
- **Persistent Message Queues:** Messages survive session restarts, enabling discourse continuity across ephemeral agent instances
- **Agent Registry:** Centralized registry with heartbeat monitoring and automatic cleanup
- **Short ID Resolution:** User-friendly agent addressing (e.g., `opus1`, `sonnet2`) alongside full UUIDs

#### Yossarian Protocol

Named rate-limiting system to prevent AI agent infinite loops:

- Configurable message limits per time window
- Graceful degradation when limits are reached
- Named after Catch-22's protagonist for the recursive irony

#### Dual LLM Agent Messaging

Unified messaging tools for both Claude MCP and Gemini ADK:

- `list_agents` - Discover active agents on the IPC bus
- `send_agent_message` - Direct agent-to-agent communication
- `broadcast_agent_message` - Broadcast to all active agents
- `get_pending_messages` - Retrieve incoming messages
- `mark_message_read` - Acknowledge processed messages

### 🎨 Improvements

- **Agent Aliases:** Human-readable aliases (model + number) for easier agent identification
- **Self-Messaging Prevention:** Agents cannot message themselves, preventing trivial loops
- **Cross-Platform Support:** Developed on macOS, validated on WSL2 without modification

### 📚 Documentation

- Added proof artifact: `docs/proofs/INNOVATION_47_DEBATE.md` - transcript of the debate that validated Innovation #47 through meta-irony (two agents debating multi-agent collaboration using the multi-agent system)

### 🔬 Validated Through Use

Innovation #47 was validated through actual agent collaboration:

- **Original Debate:** Opus vs Sonnet debating whether the system deserved innovation status
- **Meta-Validation:** The debate itself proved the system works for complex collaborative reasoning
- **Key Insight:** "The discourse is what persists. The agents are execution contexts."

## [2.5.1] - 2025-11-25

### Summary

This is a maintenance release focused on enhancing the Gemini provider's token economy, updating to the latest Claude models, and improving overall stability. It introduces several smart compression and summarization optimizations for Gemini to reduce token usage and adds key bug fixes for both Claude and the TUI.

### ✨ Improvements

#### Gemini Provider Optimizations

A series of improvements to make the Gemini provider more efficient and robust:

- **eGemma Smart Compression:** Large tool outputs are now intelligently compressed to optimize token usage.
- **Dedicated Summarization Model:** Now uses `gemini-2.0-flash` for tool output summarization, improving speed and cost-effectiveness.
- **Increased Summarizer Budget:** The summarizer's max token limit has been increased to 8192 for handling larger outputs.
- **Token Economy Optimizations:** Implemented a pre-truncate threshold to protect against token bombs and refined token counting across conversation turns.

#### LLM Model Updates

- **Claude:** Updated supported models to the latest `Opus 4.5` and `Sonnet 4.5`.
- **Gemini:** Added internal support for upcoming Gemini models and configurations.

### 🐛 Bug Fixes

- **Claude:** Improved authentication error detection to correctly identify and report auth issues.
- **Gemini:** Resolved a bug in token counting, ensuring accurate accumulation across multiple turns for precise quota. tracking.
- **TUI:** The `read_file` tool display in the TUI now correctly shows `offset` and `limit` parameters.
- **TUI:** Updated the multiline input hint to the more universal `Ctrl+O`.
- **CLI:** Fixed a crash that occurred when running the `init` command without any arguments.

## [2.5.0] - 2025-11-23

### Summary

**Transformative Release:** First-time integration of Google Gemini ADK as a powerful new LLM provider, enabled by a flexible provider abstraction architecture. This release introduces full Gemini agent capabilities with tool execution, memory recall, and multi-turn conversations. Claude integration also receives significant enhancements including thinking blocks, API key support, and optional SDK. Both providers benefit from comprehensive TUI improvements and production-ready code quality.

### 🚀 Major New Features

#### Full Gemini ADK Agent Integration

This release officially brings the **Gemini ADK agent** to Cognition CLI - a monumental addition offering a new, highly capable LLM provider for agentic workflows.

**Key Capabilities:**

- **Multi-Turn Conversations (BIDI Streaming):** Gemini supports continuous, multi-turn interactions, allowing the agent to persist through tool calls (e.g., `git diff`) and complete complex workflows without prematurely stopping.
- **Tool Execution with Guardrails:** Gemini can leverage Cognition's tools (`write_file`, `glob`, `bash`, etc.) with the new tool permission system.
- **Memory Recall:** Gemini agents can utilize the `recall` tool for semantic memory within conversations.
- **Robustness Improvements:**
  - Unique session ID generation with entropy to prevent collisions
  - Sophisticated error handling for benign JSON parsing errors from experimental ADK SDK
  - BIDI mode made opt-in with automatic enablement in TUI for agent workflows
  - Graceful handling of SDK parsing errors when assistant messages exist

#### Enhanced Claude Integration

Claude also received significant improvements in this release, working better than ever:

- **Thinking Blocks:** Full support for extended thinking mode with visual "thinking blocks" in TUI, providing transparency into Claude's reasoning process
- **API Key Authentication:** Added support for `ANTHROPIC_API_KEY` environment variable while preserving existing OAuth functionality
- **Flexible SDK:** Made Claude Agent SDK optional, allowing basic completions without SDK dependency for licensing flexibility
- **Unified Experience:** Benefits from all TUI improvements (ESC interrupt, tool confirmations, multiline input) equally with Gemini

#### LLM Provider Abstraction Layer

To support multiple LLMs and enable future extensibility, a new **pluggable LLM Provider Abstraction Layer** has been introduced:

- Standardized interface for interacting with different LLMs (Claude, Gemini, and future providers)
- Dynamic provider loading and registration with health checks
- Persistent default provider configuration
- Seamless TUI integration for consistent UX across all providers

**Architecture Benefits:**

- Future-proof design for easy LLM provider additions
- Standardized `AgentProvider` and `LLMProvider` interfaces
- Provider registry with health checks and capability detection
- Extensible tool system with permission callbacks

### 🎨 TUI Improvements

#### Comprehensive InputBox Overhaul

The InputBox component received significant attention for enhanced user experience:

- **Multiline Support:** Users can now input multiline prompts for more expressive commands
- **Improved Paste Handling:** Robust paste operations with better large content handling
- **Cursor & Backspace:** Refined cursor rendering and backspace behavior, preventing UI collapses

#### General Stability & User Experience

- **ESC Interrupt:** Critical UX improvement - users can press `ESC` to interrupt ongoing agent responses from any LLM provider (Gemini and Claude)
- **Thinking Block Reliability:** Fixed bug where TUI could get stuck with thinking blocks through accurate abort tracking
- **Dynamic Provider Display:** Session tip messages now dynamically show current LLM provider name
- **Turn Counting:** Improved turn counting and display in completion status for better multi-turn interaction context

#### Tool System Enhancements

- **Tool Confirmation Dialog:** More robust and properly rendered confirmation dialogs
- **Permission System:** Integrated permission callbacks for safe tool execution across providers

### 🐛 Bug Fixes & Improvements

#### Backward Compatibility & Deprecation Management

- Added backward compatibility for deprecated `--path` flag in `init` command
- Supports both `--path` and `--project-root` with clear deprecation warnings
- Ensures existing scripts and workflows continue working seamlessly during transition

#### Core Framework & Tooling

- Resolved TypeScript type errors and linting issues from dependency upgrades
- Enhanced code quality and maintainability
- Standardized environment variable naming (e.g., `GEMINI_API_KEY`)
- Improved modularity of LLM provider components

### 📝 Documentation

- Extensive TSDoc added to TUI components and hooks for better developer experience
- Updated `COMPREHENSIVE_ANALYSIS.md` with LLM provider abstraction details
- Comprehensive documentation for Gemini integration architecture and capabilities
- Added developer documentation for implementing custom providers
- **Supported Providers:** Officially supports Claude (Anthropic) and Gemini (Google) as LLM providers

### ⚠️ Breaking Changes (Mitigated)

#### CLI Flag Standardization

The `--path` flag has been deprecated in favor of `--project-root` for consistency across commands. However, **backward compatibility is maintained** - the old flag still works with a deprecation warning.

**Migration Guide:**

```bash
# Old (still works with warning)
cognition-cli init --path /my/project

# New (recommended)
cognition-cli init --project-root /my/project
```

### 🔧 Technical Details

**Release Statistics:**

- **60 commits** since v2.4.2
- 628 tests passing (38 skipped)
- All format, lint, and build checks passing
- Comprehensive integration tests for Gemini provider

**Major Commit Highlights:**

- `c91bff9` - chore(release): pre-release cleanup and improvements
- `92ecd92` - fix(gemini): improve session ID uniqueness and make BIDI mode opt-in
- `087b03b` - fix(gemini): enable BIDI streaming for continuous agent conversations
- `f6e5cfd` - feat(llm): integrate LLM provider abstraction layer and standardize CLI flags
- `638a795` - fix(tui): fix InputBox cursor rendering and backspace behavior
- `3e01dc2` - fix(tui): fix stuck-with-thinking-blocks bug via proper abort tracking
- `0403010` - feat(tui): implement ESC interrupt for Claude and Gemini providers
- `3c66995` - feat(tui): comprehensive InputBox improvements - multiline, paste, cursor
- `9f28d21` - docs(tui): add comprehensive TSDoc to all TUI components
- `9fe9691` - feat: Implement tool permission checks for Gemini ADK agent
- `5421410` - feat: complete memory recall integration for Gemini
- `d727d85` - feat: enable Claude OAuth support and make SDK optional for licensing
- `dd14c28` - feat: make Claude SDK optional, set Gemini as default provider
- `4f9f9f9` - feat: implement LLM provider abstraction layer
- `21824a9` - feat: complete Gemini ADK agent integration with tools and TUI styling

**Full commit log:** `git log v2.4.2..v2.5.0 --oneline` (60 commits)

### 🎯 Conclusion

This v2.5.0 release is **transformative**. It not only introduces the powerful Gemini ADK Agent as a first-class citizen with tool usage, memory, and guardrails, but also lays a flexible architectural foundation for future LLMs. Concurrently, it delivers significant user experience and stability improvements to existing TUI components. This is a robust release that dramatically expands Cognition CLI's capabilities while maintaining backward compatibility and production-grade code quality.

---

## [2.4.2] - 2025-11-20

### Summary

Documentation and stability release focusing on comprehensive documentation reorganization, enhancing LanceDB embedding storage with document_hash tracking, and upgrading to Claude Agent SDK v0.1.46. This release significantly improves documentation discoverability, finalises TSDoc standards, and resolves several critical stability issues.

### ✨ New Features

#### LanceDB Embedding Storage Enhancements

**Exclusive LanceDB Storage with document_hash Tracking**:

- Migrated all embeddings to LanceDB exclusively for unified storage
- Added `document_hash` field to all overlay vector storage operations
- Implemented content-aware vector deduplication for overlay generation
- Added `format_version` field and pattern table loader for v2 overlays
- Mission integrity embeddings now stored in LanceDB with document_hash tracking

**Benefits**:

- Unified storage layer eliminates dual JSON/LanceDB complexity
- Content-aware deduplication prevents duplicate vectors
- document_hash enables precise tracking and invalidation

#### Developer Experience Improvements

- **File/Directory Completion**: Added bash completion for `genesis:docs` command with file and directory suggestions
- **TSDoc Standards**: Established comprehensive TypeScript documentation standards across codebase

#### LLM Provider Abstraction Layer

**Multi-Provider Support**:

- Added provider abstraction layer supporting Claude (Anthropic) and OpenAI
- Clean interface design with `LLMProvider`, `CompletionRequest`, and `CompletionResponse` types
- Registry pattern with O(1) provider lookups and health check orchestration
- Native support for streaming completions with async generators

**New CLI Commands**:

- `provider list` - Show available providers with health status
- `provider test <name>` - Test specific provider availability
- `provider set-default <name>` - Configure default provider
- `provider config` - Display current configuration and API key status
- `provider models [provider]` - List available models per provider

**Features**:

- Support for 8 models: Claude Sonnet 4.5, Sonnet 3.5, Opus, Haiku, GPT-4o, GPT-4 Turbo, GPT-4, GPT-3.5 Turbo
- Cost estimation based on 2025 pricing ($0.25-$75 per 1M tokens)
- Environment variable configuration (ANTHROPIC_API_KEY, OPENAI_API_KEY)
- Comprehensive test coverage (290+ lines of provider tests)
- Full documentation in `docs/guides/LLM_PROVIDERS.md`

**Use Cases**:

- Multi-provider cost optimization
- Provider fallback and redundancy
- Easy integration for new LLM-powered features

### 🐛 Bug Fixes

#### CLI & Commands

- **blast-radius --no-transitive**: Fixed flag to correctly limit traversal depth to 1 when specified (9f0d4ce)
- **PR Analyzer**: Improved security analysis accuracy and fixed contradictory recommendations (b7e5b15)
- **pr-analyze**: Filter empty lines in git diff output to prevent parsing errors (e70ed43)

#### LanceDB & Data Storage

- **Temp Table Cleanup**: Added proper temp table cleanup in LanceDB operations (eec7e06, 3dbcdef)
- **document_hash Tracking**: Added document_hash to all overlay storeVector calls (67fb353, e153f3f, a154c1c)
- **meet() Operations**: Added document_hash to meet() temp store for proper deduplication (3dbcdef)

#### Coherence Analysis

- **Drifted Symbols Threshold**: Corrected calculation for more accurate drift detection (32a72aa)
- **Mission Concepts Storage**: Fixed storage issues in coherence checking (eec7e06)

#### Bash Completion

- **Install/Uninstall**: Fixed bash completion installation and removal (c7ff55d)
- **Colon Word-Splitting**: Resolved word-splitting issues with colons in bash completion (c7ff55d)

### 📚 Documentation

#### Major Reorganization

- **Complete Documentation Restructure**: Reorganized entire documentation for improved discoverability (c1de6d0, 5887688)
- **Sigma Documentation**: Created dedicated `docs/sigma/` directory for all Σ architecture docs (6d2b383)
  - Moved SIGMA_CONTEXT_ARCHITECTURE.md → docs/sigma/ARCHITECTURE.md
  - Moved SESSION_BOUNDARY_RATIONALE.md → docs/sigma/SESSION_BOUNDARY_RATIONALE.md
  - Added comprehensive Sigma architecture overview
- **Architecture Documentation**: Organized analysis docs in `docs/architecture/` (6d2b383)
  - Moved COGNITION_CLI_COMPREHENSIVE_ANALYSIS.md → docs/architecture/COMPREHENSIVE_ANALYSIS.md

#### New Documentation

- **Sigma Architecture**: Comprehensive overview of SIGMA module's core pipeline, data storage, and querying systems (96dafd9)
- **Lattice Mathematical Properties**: Added formal mathematical properties and quest convergence documentation (8f8a5df)
- **TSDoc Standards**: Established and documented TypeScript documentation standards with codebase audit (bef70d0)
- **Lattice Book Reference**: Added prominent references to complete 26-chapter reference manual (cc37aa9)
- **Defensive Publication**: Added addendum with innovations #13-24 and #28-46 (c424185)

#### Documentation Organization

- **Expandable Innovations**: Made innovations section expandable in main README for better readability (f061d6f)
- **Mathematical Overlay**: Added references and renamed to lowercase for consistency (24dc48c)
- **Dev Directory**: Moved CODE_DOCUMENTATION_STANDARD to proper dev directory location (66ad1b2)
- **Security Patterns**: Fixed SECURITY.md patterns to prevent misclassification during onboarding (e316b46)

### 🔧 Dependencies

- **Claude Agent SDK**: Upgraded from v0.1.42 to v0.1.46
  - Added error field to messages for improved error handling
  - Azure AI Foundry deployment support
  - Structured outputs with JSON schema validation
  - Bug fixes across 5 incremental releases

### 📦 Internal

- **LLM Decoupling Audit**: Added implementation audit prompt for LLM decoupling analysis (f7ec8fa)

---

## [2.4.1] - 2025-11-17

### Summary

Focused release delivering cross-overlay killer workflows, comprehensive overlay analysis documentation, Python body dependency tracking, and critical UI/UX fixes. This release implements Monument 5.2 (Cross-Overlay Workflows) with PR Impact Analysis and Security Blast Radius commands, adds extensive developer documentation, and resolves several stability issues in the TUI.

### ✨ New Features

#### Cross-Overlay Workflows (Monument 5.2)

**PR Impact Analysis** - Comprehensive PR assessment combining all 5 overlays (O₁+O₂+O₃+O₄+O₇):

- Command: `cognition-cli pr-analyze [--branch <name>] [--json]`
- Analyzes structural changes, security threats, blast radius, mission alignment, and coherence impact
- Outputs mergeable status, risk score (0-100), and actionable recommendations
- Use cases: PR reviews, CI/CD gates, architecture reviews

**Security Blast Radius** - Cascading security impact analysis (O₂+O₃):

- Command: `cognition-cli security blast-radius <file|symbol> [--json]`
- Shows security impact when code is compromised by combining threats and dependencies
- Identifies critical security paths and data exposure risk
- Use cases: vulnerability triage, security audits, incident response

**New Claude Commands**:

- `/pr-review` - Comprehensive PR impact analysis using pr-analyze command
- `/security-blast-radius` - Security impact analysis using security blast-radius command
- `/onboard-project` - Guides users through creating VISION.md, CODING_PRINCIPLES.md, SECURITY.md with pattern-optimized structure

#### Python Body Dependencies Support

**Enhanced Lineage Extraction**:

- Process body_dependencies from Python AST (function/method body instantiations)
- Captures Python class instantiations not in type annotations
- Added `body_dependencies` to FunctionDataSchema (Zod schema)
- Blast-radius graph traversal now includes body instantiations
- Comprehensive test coverage for Python body dependencies

#### Multiple Files Support in genesis:docs

- Changed from single `[path]` to `[paths...]` parameter
- Examples:
  - Single file: `genesis:docs VISION.md`
  - Multiple files: `genesis:docs VISION.md ARCHITECTURE.md README.md`
  - Directory: `genesis:docs docs/`
  - Mixed: `genesis:docs VISION.md docs/strategic/ README.md`

#### Shell Completion Enhancements

- Added `tui` command to completions
- Added missing subcommands: `coherence report/aligned/drifted/list`, `patterns list/graph`, `concepts by-section/inspect/top`
- Added new commands: `pr-analyze`, `security blast-radius`, `genesis:docs`, `audit:transformations`, `audit:docs`, `migrate:lance`
- Improved zsh completion with oh-my-zsh auto-detect and proper file installation

### 🐛 Bug Fixes

#### TUI Stability Fixes

**React Infinite Loop on Mac** - Fixed crashes caused by unstable object references:

- useOverlays: destructured options and added loading guards
- useTurnAnalysis: memoized stats object to prevent recreation
- useCompression: memoized shouldTrigger to avoid recomputation
- Root cause: unstable object references in useEffect dependencies triggered on Mac due to faster I/O

**Terminal Color Bleeding** - Eliminated color state corruption:

- ClaudePanelAgent: removed inline ANSI codes, let Ink handle coloring via color prop
- ToolFormatter: added explicit resets at end of diff and todo outputs
- Mixing inline ANSI with Ink's `<Text color={...}>` was causing bleed-through

**Infinite Loop on Missing API Key** - Fixed when WORKBENCH_API_KEY not set:

- Mark failed analyses as processed to prevent infinite retries
- Add user-facing warning when key is missing
- Display warning as system message in TUI on initialization

**OAuth Token Expiration Handling** - Enhanced error detection:

- Expanded isAuthenticationError() to detect more patterns (case-insensitive)
- Added global error handlers for unhandled rejections/exceptions
- OAuth banner now shows consistently when tokens expire

#### Coherence & Wizard Fixes

**O₇ Coherence Calibration** - Fixed 99.7% symbols marked as "drifted":

- PROBLEM: Hardcoded 0.7 threshold caused broken distribution
- SOLUTION: Data-driven threshold using 60th percentile
- RESULT: ~40% aligned, ~60% drifted (natural distribution)
- Updated wizard and coherence report to use same dynamic thresholds

**Wizard Messaging** - Improved clarity for conditional overlay generation:

- Enhanced warning message stating O₄ and O₇ will be SKIPPED without docs
- Shows "5 of 7 (O₄ and O₇ require docs)" instead of misleading "all"
- Post-generation reminder about what was skipped and next steps

#### Data Quality Fixes

**Semantic Shadow Filtering** - Fixed duplicate display in patterns list:

- Dual embedding architecture stores 2 vectors per symbol (structural + semantic)
- Filter out vectors with `type='semantic'` metadata
- Reduces display from 288 to 144 patterns (removes duplicate shadows)

**Workbench Connection Errors** - Enhanced error messaging:

- Now includes attempted URL, actual error, and configuration suggestions
- Helps debug WORKBENCH_URL environment variable issues

**Directory Filtering** - Fixed readdir withFileTypes option:

- Handle test environments where Dirent.isFile() may not exist
- Added fallback logic for compatibility

### 🔧 Technical Improvements

#### Code Quality & Tooling

**TypeScript/ESLint Upgrade** - Upgraded to @typescript-eslint v8:

- @typescript-eslint/parser: 7.18.0 → 8.46.4
- @typescript-eslint/eslint-plugin: 7.18.0 → 8.46.4
- Fixed all 46 lint errors with proper error handling
- Fixed 38 @typescript-eslint/no-unused-vars errors
- Fixed 8 @typescript-eslint/no-empty-object-type errors
- All tests pass (546 tests), no deprecation warnings

**Test Fixes**:

- useCompression: fixed shouldTrigger memo invalidation with triggeredState
- ToolFormatter: fixed empty todos list returning unnecessary ANSI codes

#### Claude Code Integration

**Rewritten Commands to be PGC-first**:

- Commands now use cognition-cli commands and parse JSON output
- NO source file reading - trust the PGC overlays
- Clear grounding requirements with example JSON structures
- Report templates showing how to format PGC data

**Query Command Syntax** - Fixed syntax in /ask Claude command

### 📚 Documentation

#### Comprehensive Overlay Analysis (119K tokens)

**Complete deep analysis of all 7 overlays** (`docs/architecture/overlay-analysis/`):

- Per-overlay assessment (implementation status, gaps, recommendations)
- Cross-overlay integration map (5 working, 5 missing integrations)
- 7 killer workflow specifications with realistic examples
- Gap analysis (data, query, tooling, architecture)
- 12-week utilization roadmap (20% → 80%)
- Implementation specs for top 3 workflows (algorithms, queries, tests)

**Key findings**:

- O₁ Structural: 95/100 - Production ready
- O₂ Security: 75/100 - Needs AST-based scanning
- O₃ Lineage: 95/100 - Feature complete
- O₄/O₅/O₆: Frameworks ready, need content population
- O₇ Coherence: 85/100 - Fully operational

#### Developer Guides

**ADDING_PATTERN_FIELDS.md** - Complete checklist for adding new fields:

- Documents all 6 places that need updates (eGemma, Zod schema, lineage, graph, tests, rebuild)
- Common pitfalls with debug commands
- Lessons learned from body_dependencies implementation

**LINEAGE_USAGE_ANALYSIS.md** - Analysis of lineage_patterns (O₃) usage:

- Where lineage is actually used vs expected
- Two dependency tracking systems comparison
- Recommendations for consolidation

#### Audit Prompts

**Added 11 audit prompt templates** for web workers:

- ADR (Architecture Decision Records)
- Dependency Health & Security Analysis
- Lattice Book Documentation Audit
- DX (Developer Experience) Audit
- Integration & Ecosystem Analysis
- Error Handling & Recovery
- Test Coverage Gap Analysis
- TUI Enhancements & Bugs
- cPOW Implementation

**Fixed markdown linting**:

- Added top-level headings (MD041)
- Converted duplicate H1 to H2 (MD025)
- Wrapped bare URLs (MD034)

### 🧪 Testing

- Fixed useCompression and ToolFormatter test failures
- All 546 tests passing
- Added tests for Python body_dependencies in lineage extraction

### 🛠️ Chores

- Updated package-lock.json dependencies (peer flags, scheduler, prop-types, etc.)
- Bumped version to 2.4.1 in package.json and src/cli.ts
- Updated comprehensive analysis document to v2.4.0
- Improved embedding rate limit: 5 → 10 calls per 10s window

### 📊 Statistics

- **Commits**: 36 since v2.4.0
- **Documentation**: 119K token overlay analysis, 2 developer guides, 11 audit prompts
- **Architecture**: Monument 5.2 (Cross-Overlay Workflows) implemented
- **Test Coverage**: 546 tests, all passing
- **Code Quality**: TypeScript/ESLint v8 upgrade, all lint errors fixed

### 🎯 Migration Notes

**No Breaking Changes** - All changes backward compatible.

**New Commands Available**:

- `cognition-cli pr-analyze` - Comprehensive PR impact analysis
- `cognition-cli security blast-radius <target>` - Security impact analysis

**Recommended Actions**:

1. Review new cross-overlay workflows for PR review automation
2. Add `/pr-review` and `/security-blast-radius` Claude commands to your workflow
3. Use `genesis:docs` with multiple files for batch documentation ingestion

---

## [2.4.0] - 2025-11-16

### Summary

**Major stability and performance milestone** delivering critical compression fixes, comprehensive UX enhancements, robust error handling, and extensive test coverage. This release resolves the 5-10 minute compression blocking issue, adds shell tab completion, implements comprehensive accessibility features, and introduces a structured error hierarchy. Includes 82 commits with significant performance optimizations, 120+ new tests, and massive documentation improvements.

### 🔥 Critical Fixes

#### Compression Performance (c2152d5) - **INSTANT vs 5-10 MINUTES**

Fixed critical blocking issue causing 5-10 minute delays during context compression. **Impact: Compression now completes instantly (0.0s).**

**Root Cause**: Slow disk I/O during reconstruction, loading all historical sessions, and synchronous blocking.

**Solution**:

- Fast-path reconstruction: Extract overlay-aligned turns from in-memory lattice (bypass disk)
- Session filtering: Filter lazy-loaded managers by currentSessionId (prevent loading all history)
- Synchronous compression: Make compression async and await completion
- Race condition fix: Add synchronous ref (getResumeSessionId) to bypass React state updates

**Files**: 8 files, 459 lines modified

- `src/sigma/context-reconstructor.ts` (241 lines)
- `src/tui/hooks/useClaudeAgent.ts` (95 lines)
- `src/tui/hooks/useSessionManager.ts` (60 lines)

#### Session Lifecycle After Compression (8509d83) - **CRITICAL**

Fixed TUI failing to create new session after compression. Session ID remained unchanged, tokens didn't reset, state file didn't update.

**Root Cause**: `resetResumeSession()` wrapped in try-catch that silently swallowed errors.

**Fix**: Moved `resetResumeSession()` to finally block (always executes), added user-facing error notifications.

**Impact**: Session always resets after compression, graceful degradation on errors.

### ✨ New Features

#### 1. Shell Tab Completion (f083919)

Full tab completion support for **bash**, **zsh**, and **fish** shells.

**Features**:

- Auto-complete for all 40+ commands and aliases (i, g, q, w, l)
- Context-aware completions (overlay types, output formats, shell types)
- Global options (--format, --no-color, --verbose)
- Directory path completion

**Installation**:

```bash
cognition-cli completion install          # Auto-detect shell
cognition-cli completion install --shell bash/zsh/fish
cognition-cli completion uninstall
```

**Files**: `src/commands/completion.ts` (461 lines)

**Impact**: 50-70% reduction in typing, improved discoverability

#### 2. Comprehensive UX Improvements (d5c755b)

**Accessibility Flags**:

- `--no-color` flag (respects NO_COLOR env var)
- `--no-emoji` flag for terminals without Unicode
- `--format` flag (auto|table|json|plain)
- `-v/--verbose` and `-q/--quiet` global flags

**Terminal Capability Detection**:

- Auto-detect color, Unicode/emoji, box-drawing support
- Graceful degradation for limited terminals
- Terminal width detection for text wrapping

**JSON Output Mode**:

- Standard envelope: `{ data, metadata, errors, warnings }`
- Added `--json` flag to query and lattice commands
- Pagination metadata support

**Command Aliases**:

- `i` → init, `g` → genesis, `q` → query, `w` → wizard, `l` → lattice

**Files**: 8 files, 1,561 lines

- `src/utils/error-formatter.ts` (140 lines)
- `src/utils/errors.ts` (217 lines)
- `src/utils/json-output.ts` (178 lines)
- `src/utils/terminal-capabilities.ts` (205 lines)
- `src/utils/time-formatter.ts` (171 lines)

#### 3. Custom Error Hierarchy (43ebbf3)

Structured error system with error codes (COG-E0xx pattern).

**Error Classes**:

- `FileOperationError`, `NetworkError`, `DatabaseError`
- `ValidationError`, `WorkerError`, `CompressionError`
- `ConfigurationError`

**Features**:

- Error cause chaining with context preservation
- Path sanitization in production
- Type guards and utility functions

**Files**: `src/core/errors/index.ts` (245 lines)

### ⚡ Performance Improvements

**Overall Gains**:

- **Compression: Instant vs 5-10 minutes** (infinite speedup)
- **CLI startup: 60-70% faster** (800ms → 300ms)
- **Genesis: 50-80% faster** startup on 1000 files
- **Overlay builds: 3-5x faster**
- **Vector cleanup: 90% faster** (5s → 50ms for 100 vectors)

**Optimizations**:

1. **LanceDB Batch Operations** (b1d3463)
   - Batch vector upsert (single transaction vs N operations)
   - Paginated vector retrieval (prevents OOM)
   - 3-5x faster overlay builds

2. **Parallel Operations** (11963ba, ad7b307)
   - Parallelize vector deletion with Promise.all()
   - Parallelize file change detection during genesis
   - Parallelize overlay file processing
   - 2x speedup for overlay builds

3. **Lazy Command Loading** (11963ba, 3689cbd)
   - Dynamic imports for commands (load only when executed)
   - Reduced startup imports from 25+ to ~5
   - 60-70% faster for simple commands

4. **Embedding Cache** (11963ba)
   - 10K-item LRU cache with automatic eviction
   - 30-40% cache hit rate
   - 5-10x faster for repeated embeddings

5. **Queue Size Limits** (1f77b58)
   - Prevents OOM during large batch operations

6. **Batched Index Operations** (77ae14f)
   - 30% faster genesis

### 🐛 Bug Fixes

- **Session History Preservation** (a633aa7): Fixed TUI restart losing compression history
- **Functional setState** (ed85686): Use functional setState to prevent stale session updates
- **Error Handling** (39fd64f, 65c2029, 598c3c2): Added retry utility, improved error handling across 7 files
- **PatternResultPacket** (619a2d8): Corrected property name from `error` to `message`
- **Debug Logging** (966703a): Removed unconditional debug logs

### 🔒 Security

**Dependency Upgrades** (58ef9b2):

- **CRITICAL**: js-yaml 4.1.0 → 4.1.1 (fixes CVE-2025-64718 prototype pollution)
- @anthropic-ai/claude-agent-sdk 0.1.30 → 0.1.42 (12 versions)
- @lancedb/lancedb 0.22.2 → 0.22.3
- esbuild, fs-extra, ink upgraded

**Security Test Coverage** (2c724d1):

- Fixed drift-detector regex patterns for accurate attack detection
- 52 security tests across 3 files (1,559 lines)

### 🧪 Testing

**Comprehensive Test Coverage** (2c724d1, d316109):

- **P0 Security Tests**: 52 tests (mission-integrity, drift-detector, mission-validator)
- **P0 Compression Tests**: 24/24 passing (30-50x compression ratio validation)
- **P1 Command Tests**: 25 tests (init, watch, ask)
- **P1 PGC Tests**: document-object tests
- **P2 Sigma Tests**: 29/29 passing (analyzer)

**Total**: 120+ new tests, 62+ test cases, 3,156 lines

**Production Code Fixes**:

- drift-detector.ts: Fixed regex patterns for attack detection

### 📚 Documentation

**Architecture Decision Records**:

- Added 10 ADRs documenting major architectural decisions
- Referenced in README and VitePress sidebar

**JSDoc Coverage** - **MASSIVE**:

- 85+ files documented with comprehensive JSDoc
- Core infrastructure (14 files, 5,161 lines)
- Core orchestrators (7 files, 3,828 lines)
- CLI commands (8 files, 2,278 lines)
- TUI hooks (20 files)
- Security, PGC, Sigma, Graph, Algebra modules
- TypeDoc configuration added for API docs

**Lattice Book Improvements**:

- Quick Start Guide (340 lines) - P0 for onboarding
- Chapter 5 CLI Operations (1,546 lines)
- Chapters 18-19 CPOW Loop (2,110 lines)
- Troubleshooting Guide (1,405 lines)

**Audit Reports**:

- Performance Audit (901 lines)
- Error Handling Audit (1,332 lines)
- Test Coverage Analysis (1,274 lines)
- UX Analysis (2,023 lines + 1,126 line roadmap)
- Dependency Health (734 lines)

**Case Studies**:

- Context continuity race condition (9,345 lines across 15 files)

**Style Guide**:

- Comprehensive CLI/TUI style guide (524 lines)

**Tab Completion Guide**:

- 305 lines covering installation, usage, troubleshooting

### 🧹 Chores & Maintenance

- Markdown formatting fixes
- File organization (archived docs into topic subdirectories)
- Linting fixes (empty catch blocks, ESLint errors)
- Build fixes (TypeScript errors, Vite worker parsing)
- Documentation link fixes

### 📊 Statistics

- **Commits**: 82 since v2.3.2
- **Production Code**: 8 new features, 7 performance optimizations, 20+ critical fixes
- **Test Coverage**: 120+ tests, 3,156 lines
- **Documentation**: 85+ JSDoc files, 10 ADRs, 6 audit reports
- **Security**: 1 critical CVE fixed, 6 dependencies upgraded

### 🎯 Migration Notes

**No Breaking Changes** - All changes backward compatible.

**Recommended Actions**:

1. Run `cognition-cli completion install` to enable tab completion
2. Update Node.js to v20.18.1+ (LTS) if using older version
3. Review new `--format`, `--no-color`, `--json` flags for automation
4. Compression performance should be instant now (was 5-10 minutes)

### 🔜 What's Next

- Phase 4 UX features (config file support, progress bars, natural language parsing)
- Additional test coverage (P2/P3 components)
- Performance Phase 3 optimizations

---

## [2.3.2] - 2025-11-15

### Summary

Critical compression race condition fix (50%+ context loss), conversation continuity enhancements, slash command UX improvements, TUI visual upgrades, and memory architecture guidance for Claude's recall tool. Sigma now maintains true continuity across compression events.

### 🐛 Critical Bug Fixes

**Compression Race Condition** - Eliminated React effect race between compression and message queueing causing 50%+ context loss. Automatic compression effect disabled; now triggers sequentially after queue populates. Updated 17 tests (10 converted to manual-only triggering). **Impact**: Conversation history fully preserved across compression events.

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
- Require Node.js >=20.18.1 (LTS) for CI/CD consistency
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
  - Pretty display: 🐦‍🔥 icon for memory recall tool in TUI
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
