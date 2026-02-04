# Comprehensive Analysis: Cognition CLI Repository

## Executive Summary

**Cognition CLI** is a sophisticated, production-grade TypeScript/Node.js command-line tool that builds and maintains a "Grounded Context Pool" (PGC) — a verifiable, content-addressable knowledge graph of codebases. It represents the reference implementation of the CogX Architectural Blueprint, designed to enable AI-assisted development grounded in cryptographic truth rather than statistical approximation.

**At a Glance:**

- **Current Version:** 2.6.7 (January 29, 2026)
- **Production Lines:** ~100,135 TypeScript (excl. tests), ~147,145 total
- **Test Coverage:** ~92% across 165 test files
- **Architecture:** 7 cognitive overlays (O₁-O₇), dual-lattice Σ system, ZeroMQ agent messaging
- **License:** AGPL-3.0-or-later

_See [Summary Statistics](#summary-statistics) for detailed metrics._

---

## 1. What Is This Project?

### Core Concept

Cognition CLI transforms unstructured source code into a **rich, queryable, and verifiably-grounded knowledge graph**. The problem it solves is fundamental:

**The Core Problem:** Modern LLMs are powerful pattern-matchers but lack deep, verifiable understanding of project architecture. They:

- Generate high-confidence hallucinations (plausible but architecturally unsound code)
- Suggest broken refactorings that break distant, unseen dependencies
- Cannot reason about system-level impact of changes
- Operate with limited context windows and no understanding of the intricate dependency lattice

### The Solution

The Cognition CLI creates a persistent "digital brain" for your project — the **Grounded Context Pool (PGC)** — stored in a `.open_cognition` directory. This is a content-addressable, immutable knowledge structure that:

- Provides cryptographically-verified, auditable facts about your codebase
- Enables AI agents to reason about code with genuine architectural awareness
- Creates a reflexive nervous system that detects changes and heals itself
- Implements the Goal → Transform → Oracle cycle for trustworthy knowledge

### Core Philosophy

The project embodies the principle of **verifiable symbiotic AI**: partnering human architects with AI agents that can be trusted because they're grounded in cryptographic truth, not just statistical approximation.

---

## 2. Architecture and Main Components

### The Four Pillars of the PGC

The knowledge graph is built on four fundamental pillars, all stored in `.open_cognition/`:

#### **1. Object Store** (`objects/`)

- **Role:** The Immutable Memory
- **Mechanism:** Content-addressable storage (like Git's) using SHA-256 hashes
- **Purpose:** Stores every unique piece of knowledge (code, ASTs, structural data)
- **Property:** Cannot be altered — immutable and deduplicated

#### **2. Transform Log** (`transforms/`)

- **Role:** The Auditable Thought Process
- **Mechanism:** Immutable, append-only log of every operation
- **Purpose:** Records how knowledge was created and transformed
- **Property:** Perfect, verifiable history of derivations

#### **3. Index** (`index/`)

- **Role:** The Conscious Mind / Table of Contents
- **Mechanism:** Human-readable mapping from file paths to content hashes
- **Purpose:** Fast lookup of current, valid content in the Object Store
- **Property:** Always points to current, verified state

#### **4. Reverse Dependencies** (`reverse_deps/`)

- **Role:** The Reflexive Nervous System
- **Mechanism:** O(1) reverse-lookup index
- **Purpose:** Enable instantaneous dependency traversal and impact analysis
- **Property:** Enables "blast radius" calculations

### The Sigma Dual-Lattice Architecture (v2.0.0)

**Innovation #39-46** — The breakthrough that enables **infinite context** for AI conversations.

While the PGC (`.open_cognition/`) provides a lattice for **project knowledge**, Sigma adds a parallel lattice for **conversation knowledge** (`.sigma/`). These two lattices work together through **Meet (∧)** operations to create true infinite context.

#### **The Dual Lattice**

```
Project Lattice (PGC)          Conversation Lattice (Sigma)
.open_cognition/          ∧    .sigma/
├── objects/                   ├── objects/          (conversation turns)
├── transforms/                ├── overlays/
├── index/                     │   ├── O1/           (structural patterns)
├── reverse_deps/              │   ├── O2/           (security discussions)
└── overlays/ (O₁-O₇)          │   ├── O3/           (conversational flow)
                               │   ├── O4/           (mission concepts)
                               │   ├── O5/           (operational patterns)
                               │   ├── O6/           (mathematical concepts)
                               │   └── O7/           (coherence scores)
                               ├── index/            (conversation state)
                               └── message_queue/    (agent-to-agent messages)
                                   └── {agent-id}/   (per-agent queues)
```

#### **How Sigma Solves the Context Window Problem**

**The Problem with Standard LLM Sessions:**

- Compression is lossy
- No true memory across sessions

**Sigma's Solution:**

1. **Proactive Compression**
   - Uses intelligent importance formula: `novelty × 5 + max(alignment_O1..O7) × 0.5`
   - Preserves high-signal turns, discards noise
   - **Tri-Modal Strategy:** Semantic (>50k), Standard (>200k), and Survival (TPM-driven) modes.

2. **Dynamic Thinking Budgeting**
   - Automatically scales reasoning effort (`thinkingLevel`, `reasoning_effort`) based on remaining TPM quota.

3. **Session Lifecycle Management**

   ```
   Session N: 0K → 200K → INTELLIGENT COMPRESSION
                             ↓
   Session N+1: <20K → 200K → COMPRESSION
                                ↓
   Session N+2: <20K → ... (infinite chain)
   ```

4. **High-Fidelity Memory Recall**
   - Specialized persona with temporal re-ranking
   - Multi-overlay search across O₁-O₇
   - 5-retry exponential backoff for API errors
   - Preserves technical details (file names, function names, decisions)

5. **Real-Time Conversation Indexing**
   - Every turn indexed across 7 dimensions (O₁-O₇)
   - Novelty scoring for each turn
   - Importance calculation for compression decisions
   - Lattice statistics (nodes, edges, shifts)

6. **Periodic Overlay Persistence**
   - Auto-flush every 5 turns
   - Cleanup on exit preventing data loss
   - Overlays remain in memory across SDK sessions

7. **Session Forwarding**
   - Automatic chain management via `.sigma/{id}.state.json`
   - User always uses original session ID
   - Sigma manages internal session resurrection

#### **The Interactive TUI**

Sigma includes a production-ready terminal user interface built with **Ink** (React for terminals):

**Features:**

- ✅ **Live Lattice Visualization** — Real-time overlay counts (O1-O7)
- ✅ **Token Tracking** — Exact count with 200K compression threshold
- ✅ **Tri-Modal Status** — Visual indication of Semantic/Standard/Survival mode
- ✅ **Reasoning Progress** — Thinking blocks and dynamic budget visualization
- ✅ **Lattice Statistics** — Nodes, edges, context shifts
- ✅ **Importance Scoring** — Novelty + alignment per turn
- ✅ **Toggle Info Panel** — Detailed overlay breakdown
- ✅ **Scroll History** — Navigate previous messages
- ✅ **Persistent UI State** — Resume where you left off

**Why the TUI Matters:**

The TUI provides **radical transparency**:

- See exactly how many tokens you're using
- Watch the lattice grow in real-time as you chat
- Understand which overlays are being activated
- Know when compression will trigger (Semantic vs Standard)
- Monitor real-time TPM runway and thinking budgets
- Trust the system through visibility

**Example TUI Output:**

```
Tokens: 57.5K / 200K [MODE: SEMANTIC]
Lattice: 10 nodes, 9 edges, 1 shift
Budget: Medium (75k TPM remaining)
Novelty: 0.53 | Importance: 5.2
O₁: 0.0  O₂: 3.4  O₃: 3.2  O₄: 0.0  O₅: 5.0  O₆: —  O₇: —
```

### Supporting Faculties

#### **LanceVectorStore** (Semantic Intelligence)

- Uses **LanceDB**, an embedded high-performance vector database
- Stores 768-dimensional vector embeddings of code patterns
- Enables structural similarity searches beyond exact matching
- Allows finding architecturally similar components across the codebase

#### **Overlays** (Layered Understanding)

Seven specialized analytical layers that enrich the core knowledge graph:

| Overlay              | Identifier | Purpose                     | Content                                        |
| -------------------- | ---------- | --------------------------- | ---------------------------------------------- |
| Structural Patterns  | O₁         | Code artifacts & structure  | Function/class embeddings, architectural roles |
| Security Guidelines  | O₂         | Threat models & mitigations | Attack vectors, CVEs, vulnerabilities          |
| Lineage Patterns     | O₃         | Dependency tracking         | Import relationships, call chains              |
| Mission Concepts     | O₄         | Strategic concepts          | Principles, values, mission alignment          |
| Operational Patterns | O₅         | Workflow patterns           | Processes, quests, sacred sequences            |
| Mathematical Proofs  | O₆         | Formal verification         | Theorems, lemmas, axioms                       |
| Strategic Coherence  | O₇         | Cross-layer synthesis       | Alignment metrics, drift detection             |

### LLM Provider Abstraction Layer

The `src/llm` module provides a crucial abstraction layer for interacting with various Large Language Models (LLMs), standardizing the interface for different providers (Claude, Gemini, OpenAI/local). This enables the Cognition CLI to leverage advanced AI capabilities for tasks like semantic Q&A and code generation without tightly coupling to specific LLM vendor APIs.

**Key Components:**

- **`initializeProviders()`**: Initializes and registers available LLM providers, dynamically loading them based on configuration and API key availability.
- **`registry`**: A central component for managing and retrieving configured LLM providers.
- **`complete()`**: A convenience function for making non-streaming text completion requests using the default or a specified provider and model.
- **`streamComplete()`**: A convenience function for streaming text completions, yielding chunks of text as they are generated by the LLM.
- **`LLMProvider`**: An interface that all LLM provider implementations must adhere to, ensuring a consistent API for completion requests.
- **`AgentProvider`**: An extension of `LLMProvider` for models that support more advanced agentic capabilities, including the Gemini Agent Provider and OpenAI Agent Provider.
- **OpenAI Agent Provider**: Support for OpenAI API and OpenAI-compatible endpoints (e.g., local models via eGemma workbench). Auto-configures from workbench when local chat models (gpt-oss-20b, etc.) are available.
- **Pluggable Architecture**: New LLM providers can be added by implementing the `LLMProvider` interface and registering them, enhancing the system's extensibility.

### Multi-Agent Collaborative System

A pub/sub messaging infrastructure enabling multiple AI agents to collaborate asynchronously. Built on ZeroMQ for event-driven communication without polling.

#### **Architecture**

```
┌─────────────────────────────────────────────────────────────┐
│                    ZeroMQ Message Bus                       │
│          ipc:///tmp/cognition-bus.sock                      │
│   Topics: agent.*, code.*, arch.*, task.*                   │
└─────────────────────────────────────────────────────────────┘
         ↑                    ↑                    ↑
    ┌────┴────┐         ┌────┴────┐         ┌────┴────┐
    │ Agent 1 │         │ Agent 2 │         │ Agent N │
    └─────────┘         └─────────┘         └─────────┘
         ↓                    ↓                    ↓
    MessageQueue        MessageQueue        MessageQueue
    .sigma/message_queue/{agent-id}/
```

#### **Core Components**

| Component               | Purpose                                                                      |
| ----------------------- | ---------------------------------------------------------------------------- |
| **ZeroMQBus**           | Pub/sub message bus with topic-based routing and wildcard subscriptions      |
| **BusCoordinator**      | Bus lifecycle management, Bus Master election (first agent binds)            |
| **MessageQueue**        | Persistent storage in `.sigma/message_queue/{agent-id}/`, O(1) pending count |
| **MessageQueueMonitor** | Background subscriber, filters by recipient, event-driven updates            |
| **MessagePublisher**    | High-level API: `sendTo()`, `broadcast()`, `notifyTaskComplete()`            |
| **AgentRegistry**       | Heartbeat monitoring, alias system (`opus1`, `sonnet2`), collision detection |

#### **Agent Messaging Tools**

Both Claude (MCP) and Gemini (ADK) have access to 5 tools:

| Tool                      | Purpose                                  |
| ------------------------- | ---------------------------------------- |
| `list_agents`             | Discover active agents and their aliases |
| `send_agent_message`      | Send message to specific agent           |
| `broadcast_agent_message` | Broadcast to all agents                  |
| `list_pending_messages`   | List pending messages                    |
| `mark_message_read`       | Update status (read/injected/dismissed)  |

### Fractal Lattice: Cross-Project Mesh Architecture

Introduced in v2.6.3, this architecture enables agents to collaborate across different repositories and projects through a shared communication mesh.

#### **The IPC_SIGMA_BUS Protocol**

The scope of the multi-agent mesh is controlled via the `IPC_SIGMA_BUS` environment variable:

- **Local (Unset)**: Standard isolation where the agent lives within the local `.sigma/` directory.
- **Global (`global`)**: Connects agents to a shared global bus at `~/.cognition/sigma-global/`.
- **Named Mesh (`<name>`)**: Creates a specific "Team Mesh" (e.g., `IPC_SIGMA_BUS=project-x`) for targeted collaboration across multiple codebases.

#### **Key Mesh Capabilities**

- **Context Sharding**: Instead of one agent trying to ingest every codebase (hitting context limits), agents query specialized "Gardener" agents of other repositories via `query_agent()`.
- **Fractal Scalability**: Enables a recursive hierarchy of specialized Grounded Context Pools (PGCs) connected by a high-speed semantic negotiation layer.
- **Active Negotiation**: When an interface changes, agents negotiate the impact across project boundaries before build failures occur.

### Manager/Worker Delegation Architecture (Sigma Task Protocol v2.0)

Updated in v2.6.4, this protocol leverages a unified `SigmaTaskUpdate` tool to enable verifiable, grounded multi-agent collaboration.

#### **Core Concept**

Agents use a formal **Manager/Worker pattern** with cryptographic grounding:

- **Managers** break complex goals into discrete tasks with explicit **Acceptance Criteria** and **Grounding Strategies**.
- **Workers** receive assignments, execute them, and report a **Result Summary** with **Grounding Evidence**.
- **Structured Grounding**: Parallel `grounding` and `grounding_evidence` arrays ensure that task execution is backed by PGC citations and overlay analysis.

#### **The Delegation Schema**

The `SigmaTaskUpdate` tool uses a strict schema to ensure accountability:

```typescript
{
  todos: [
    {
      id: string;                   // Stable ID for tracking
      status: "delegated";          // Explicit delegation state
      delegated_to: "agent-alias";  // Target worker ID
      acceptance_criteria: string[]; // Verifiable success conditions
    }
  ],
  grounding: [
    {
      id: string;
      strategy: "pgc_first" | "pgc_verify" | "pgc_cite";
    }
  ]
}
```

#### **The Collaboration Loop**

1. **Task Assignment**: Manager creates a task with `status: "delegated"` and sends an IPC `task_assignment` message.
2. **Worker Execution**: Worker acknowledges, executes, and tracks its own sub-tasks using its own lattice.
3. **Verification**: Worker sends `task_completion` message with a `result_summary`.
4. **Finalization**: Manager verifies result against criteria and marks task `completed`.

This architecture ensures that multi-agent work is observable, persistent (survives compression), and verifiable.

#### **Auto-Response & Rate Limiting**

- Messages trigger automatic agent responses (disable with `--no-auto-response`)
- **Yossarian Protocol**: Max 5 auto-responses/minute to prevent infinite loops
- When limit hit, requires user input to continue

#### **Session Management**

- **Anchor ID format**: `tui-<model>-<timestamp>` (e.g., `tui-sonnet45-1733239823`)
- Enables tab completion by model: `tui-s<tab>` finds sonnet sessions
- Provider/model persisted in `.sigma/{id}.state.json` for session resume

#### **Example Workflow**

```
User → Sonnet: "Implement auth feature"
  → Sonnet implements, sends to Gemini: "Please review"
    → Gemini reviews, responds: "Approved" or "Needs changes"
  → Sonnet receives feedback, iterates
```

### Core Orchestrators

#### **GenesisOrchestrator**

- Executes the "genesis" process that builds the foundational knowledge graph
- Implements multi-phase bottom-up aggregation strategy
- Coordinates with miners to extract structural data

#### **StructuralMiner**

- Three-layer hierarchical extraction strategy:
  1. **Layer 1:** Deterministic AST parsing (native TypeScript/JavaScript or remote via eGemma)
  2. **Layer 2:** Specialized Language Model (SLM) extraction
  3. **Layer 3:** General LLM fallback (with fidelity labeling)
- Ensures maximum verifiability by prioritizing deterministic methods

#### **WorkbenchClient**

- Gateway to external eGemma workbench for advanced language processing
- Handles AST parsing for multiple languages
- Provides embedding generation and semantic analysis
- Implements rate limiting and request queueing

### The PGCManager

Central orchestrator that manages:

- Index operations
- Object store access
- Transform log maintenance
- Reverse dependency tracking
- Overlay management
- Embedding request delegation

---

## 3. Key Features and Functionality

### Core Commands

#### **Lifecycle Management**

- `init` — Initialize a new PGC in a project
- `genesis [sourcePath]` — Build the verifiable skeleton by parsing all source files
- `watch` — Real-time file monitoring for incremental updates
- `status` — Check if PGC matches code (< 10ms coherence check)
- `update` — Incrementally sync PGC with code changes

#### **Pattern Analysis** (O₁)

- `patterns find-similar <symbol>` — Vector similarity search for structurally similar code
- `patterns compare <symbol1> <symbol2>` — Compare architectural signatures
- `patterns analyze` — Distribution of architectural roles across codebase
- `patterns inspect <symbol>` — Detailed inspection of a symbol
- `patterns graph <symbol>` — Visualize dependency tree

#### **Query & Search**

- `ask <question>` — Semantic Q&A with multi-overlay search and answer synthesis
  - Four-stage pipeline: query deconstruction (SLM) → vector search → answer synthesis (LLM) → optional save
  - Intelligent cache using SHA256 hash of question for instant retrieval (0.0s vs 2.2s)
  - Cached Q&A stored in `.open_cognition/knowledge/qa/*.md` with frontmatter metadata
  - Searches across all overlays (O₁-O₇) using lattice algebra for comprehensive answers
- `query <question>` — Traverse the dependency graph with optional lineage tracing
- `audit:transformations <filePath>` — Verify transformation history integrity
- `audit:docs` — Validate document integrity in PGC

#### **Overlay Management**

- `overlay generate <type>` — Generate specialized overlays (structural_patterns, lineage_patterns, etc.)
- Supports `--force` for regeneration and `--skip-gc` for branch switching

#### **Impact Analysis**

- `blast-radius` — Calculate impact of changes (which symbols would be affected)
- Integrated with watch/status for rapid feedback

#### **Advanced Features**

- `lattice <query>` — Boolean algebra operations across overlays (set operations, filtering, semantic search)
- Sugar commands for intuitive access to each overlay
- `security list/query/cves` — Security-focused analysis
- `coherence analyze` — Mission alignment measurement
- `concepts extract` — Extract and analyze mission concepts

### The Monument Pattern (Real-time Synchronization)

The three-monument architecture implements an event-driven, self-healing system:

1. **Monument 1: Event Source** (`watch` command)
   - Real-time file monitoring
   - Maintains `dirty_state.json` of changed files

2. **Monument 2: Instant Coherence Check** (`status` command)
   - Checks if PGC matches code in < 10ms
   - Calculates blast radius
   - Provides exit codes for CI/CD integration

3. **Monument 3: Incremental Sync** (`update` command)
   - Re-processes only changed files
   - Updates objects/transforms/index
   - Clears dirty state

**Complete Feedback Loop:**

```
watch → dirty_state.json → status → update → coherence restored ♻️
```

---

## 4. Technologies and Frameworks

### Core Technology Stack

#### **Language & Runtime**

- **TypeScript** v5.3.3 — Type-safe implementation
- **Node.js** v22.x or later — Runtime environment
- **CLI Framework:** Commander.js (v12) — Command parsing and routing

#### **Code Analysis**

- **Native AST Parsers:** TypeScript/JavaScript built-in parsers
- **Remote Parsing:** Python parsing via eGemma workbench
- **MultiLanguage Support:** TypeScript, JavaScript, Python, Java, Rust, Go

#### **Vector & Semantic Analysis**

- **LanceDB** (v0.22.2) — Embedded vector database for similarity search
- **768-dimensional embeddings** for structural and semantic patterns
- **Cosine similarity** for pattern matching

#### **External Services**

- **eGemma Workbench** (optional but recommended)
  - AST parsing for multiple languages
  - Embedding generation
  - Structured semantic extraction
  - Rate-limited HTTP API with queueing

#### **File System & Storage**

- **fs-extra** — Enhanced file operations
- **proper-lockfile** — File locking for concurrent safety
- **Content-addressable storage** using SHA-256 hashing

#### **Inter-Process Communication**

- **ZeroMQ** (zeromq ^6.5.0) — High-performance pub/sub message bus for agent-to-agent communication
- **IPC Socket** — ipc:///tmp/cognition-bus.sock for local agent coordination
- **Topic-based routing** — Wildcard subscriptions (code._, agent._, arch._, task._)

#### **Data Processing**

- **Zod** (v3.22.4) — Runtime type validation and schema definition
- **Unified/Remark** — Markdown parsing and AST processing
- **JS-YAML** — YAML parsing for configuration
- **Chokidar** (v4) — Cross-platform file watching

#### **Concurrency & Performance**

- **Workerpool** (v10) — Thread pool for parallel processing
- **Worker threads** for AST parsing and embedding generation
- **Request queueing** with rate limiting

#### **UI/UX**

- **Ink** (v5.x) — React-based terminal UI framework for interactive TUI
- **Chalk** (v5.6.2) — Colored terminal output
- **Clack/prompts** — Interactive command-line prompts
- **Markdown rendering** with formatted help guides
- **React hooks** — useState, useEffect for TUI state management

#### **Development & Documentation**

- **VitePress** — Modern documentation site generation
- **Vitest** — Unit testing framework
- **ESLint/Prettier** — Code quality and formatting

### External Dependencies

| Package             | Version | Purpose                 |
| ------------------- | ------- | ----------------------- |
| commander           | 12.0.0  | CLI framework           |
| lancedb             | 0.22.2  | Vector database         |
| ink                 | 5.x     | React-based terminal UI |
| chalk               | 5.6.2   | Terminal colors         |
| chokidar            | 4.0.3   | File watching           |
| zod                 | 3.22.4  | Type validation         |
| workerpool          | 10.0.0  | Thread pool             |
| fs-extra            | 11.2.0  | File operations         |
| esbuild             | 0.25.11 | Worker bundling         |
| anthropic           | latest  | Claude SDK for Sigma    |
| google-generativeai | latest  | Gemini SDK for Sigma    |
| @openai/agents      | ^0.3.4  | OpenAI Agents SDK       |
| zeromq              | ^6.5.0  | Agent messaging bus     |

---

## 5. Unique and Interesting Aspects

### 1. **Cryptographic Grounding**

The system uses **content-addressable storage with SHA-256 hashing** to ensure:

- Every piece of knowledge is cryptographically verified
- Impossible to silently corrupt data (hash verification fails)
- Perfect provenance trails (complete chain of derivation)
- "Did this happen?" becomes mathematically answerable

### 2. **The Fidelity Labeling System**

Every extracted piece of knowledge includes a `fidelity` score:

- **1.0 (Cryptographic Truth):** Deterministic AST parsing
- **0.85 (High Confidence):** Specialized Language Model
- **0.70 (Educated Guess):** General LLM fallback

This transparency about uncertainty is fundamental to verifiable AI.

### 3. **Multi-Layer Mining Strategy**

Three-layer waterfall approach ensures maximum verifiability:

1. Try deterministic AST parsing first
2. Fall back to specialized SLM
3. Use general LLM as last resort

Each layer is traceable and labeled with fidelity.

### 4. **The Lattice Algebra System**

A complete Boolean algebra implementation across 7 overlays enabling:

- Set operations: `O1 ∩ O2` (intersection), `O1 ∪ O2` (union)
- Tag filtering: `O2[critical]`, `O4[mission-alignment]`
- Semantic search: `O4 ~ "verification"`
- Query composition: Complex multi-overlay reasoning

This is "SQL for your codebase's semantic structure."

### 5. **Self-Aware Architecture**

The system is capable of analyzing itself:

- **AI-Grounded Architecture Analysis** document generated by running cognition-cli on itself
- Zero hallucinations — every claim backed by PGC data
- 100% reproducible analysis
- Meta-cognitive loop: cognition-cli analyzing itself using its own tools

### 6. **Security-First Design**

Includes comprehensive security overlays:

- **Dual-Use Mandate** documentation acknowledging weaponization risks
- **Mission Integrity Validation** prevents malicious mission injection
- **Security Coherence Metrics** track alignment with security principles
- **Drift Detection** for identifying security-relevant deviations

Explicit acknowledgment that the system could be weaponized for ideological conformity enforcement — and recommends safeguards.

### 7. **Cognitive Prosthetics Vision**

Extends to human memory preservation:

- Same architecture that understands code can preserve human memory
- Content-addressable memories with cryptographic verification
- Protection against false memories
- Application to dementia, Alzheimer's, traumatic brain injury treatment

### 8. **Monument Pattern**

Event-driven, self-healing architecture:

- Watch detects changes
- Status checks coherence in < 10ms
- Update heals incrementally
- Complete feedback loop for real-time synchronization

### 9. **Sigma: Infinite Context Without Compromise**

**The first LLM wrapper to solve context limits through lattice-based compression:**

- **Proactive Compression**
- **<20K Fresh Starts**
- **~140K Usable Runway** per session
- **Intelligent Preservation** via `novelty × 5 + max(alignment_O1..O7) × 0.5`
- **Multi-Overlay Indexing** of every conversation turn across 7 dimensions
- **Verifiable Memory Recall** with temporal re-ranking and multi-overlay search
- **Session Resurrection** through automatic forwarding chain
- **Radical Transparency** via live TUI

This is **not RAG or summarization** — it's a true dual-lattice architecture where conversation knowledge has the same mathematical rigor as project knowledge.

### 10. **Interactive TUI: Transparency Over Opacity**

Built with **Ink** (React for terminals), the TUI demonstrates radical transparency:

**Real-time Visibility:**

- Exact token count
- Live lattice statistics (nodes, edges, context shifts)
- Per-turn novelty and importance scores
- Overlay activation patterns (O₁-O₇ alignment)
- Compression threshold warnings

**Why It Matters:**

- Users can **trust** what they can **see**
- Catches Anthropic's compression before it happens
- Enables informed decisions about session management
- Proves the lattice is working in real-time

### 11. **Comprehensive Documentation**

- 25+ markdown documents covering every aspect
- 900+ pages of "Foundation Manual"
- Architecture specifications (CPOW, Multi-Overlay)
- Guides for each command
- Research papers and theoretical foundations

### 12. **First Human-AI Grounded Collaboration**

Document: `07_AI_Grounded_Architecture_Analysis.md`

- First architecture analysis generated through pure grounded AI reasoning
- Zero hallucinations — every claim backed by PGC data
- 100% reproducible
- No source files read during analysis — reasoned purely from metadata

### 13. **Multi-Agent Collaborative System** (Innovation #47)

ZeroMQ-based pub/sub messaging enabling agent-to-agent collaboration. See [Multi-Agent Collaborative System](#multi-agent-collaborative-system) for architecture details.

Key capabilities:

- **Fractal Lattice Mesh** — Cross-project communication via `IPC_SIGMA_BUS` (#48)
- **Persistent message queues** surviving session restarts
- **Auto-response flow** with rate limiting (Yossarian Protocol)
- **Agent registry** with aliases (`opus1`, `sonnet2`) and collision detection
- **Code review, task distribution**, and expert consultation workflows

---

## 6. The .open_cognition Directory Structure

This is the "digital brain" of your project, a content-addressable knowledge graph:

### Directory Hierarchy

```
.open_cognition/
├── metadata.json                    # Version & status metadata
├── .gitignore                       # Ignore objects, transforms (but track index, overlays)
│
├── objects/                         # Object Store - The Immutable Memory
│   ├── 0d/
│   │   ├── 21c926b21f3ce4d...      # Content-addressed structural data (7.1KB)
│   │   └── dc0396f945c8e01...      # AST information
│   ├── 61/
│   │   └── 6bd55adbcaee2d...       # Function signatures (863B)
│   ├── 92/
│   │   └── 8a260f5e9b071...        # Class definitions (2.6KB)
│   └── [155 hash directories]      # Total: 155 unique objects
│
├── transforms/                      # Transform Log - Auditable History
│   ├── [84 transform records]       # Immutable operation log
│   └── Each: source hash, operation, target hash, timestamp
│
├── index/                           # Index - The Conscious Mind
│   ├── src/
│   │   ├── cli.ts.json             # Maps to current object hash
│   │   ├── commands/
│   │   │   ├── patterns.ts.json
│   │   │   ├── genesis.ts.json
│   │   │   └── [19 more files]
│   │   ├── core/
│   │   │   ├── pgc/
│   │   │   ├── orchestrators/
│   │   │   ├── overlays/
│   │   │   └── [more subdirectories]
│   │   └── [102 total index entries]
│   └── Maps file paths to verified object hashes
│
├── reverse_deps/                    # Reverse Dependencies - Nervous System
│   ├── [143 reverse dependency files]
│   ├── Each: lists which symbols depend on this symbol
│   └── Enables O(1) impact analysis
│
├── overlays/                        # Overlays - Specialized Senses
│   ├── structural_patterns/
│   │   ├── manifest.json           # Manifest of all patterns
│   │   ├── src/cli.ts#QueryCommandOptions.json
│   │   ├── src/core/analyzers/...
│   │   └── [Pattern embeddings & metadata]
│   │
│   ├── security_guidelines/
│   │   ├── [4 YAML security files]
│   │   └── Threat models, attack vectors, mitigations
│   │
│   ├── operational_patterns/
│   │   ├── [4 YAML operational files]
│   │   └── Workflow patterns, processes
│   │
│   ├── mission_concepts/
│   │   ├── [6 YAML concept files]
│   │   └── Mission principles, strategic concepts
│   │
│   ├── lineage/
│   │   ├── [8 overlay files]
│   │   └── Dependency relationship embeddings
│   │
│   ├── patterns.lancedb/           # Vector Database (LanceDB)
│   │   ├── [8 files including index]
│   │   └── High-performance vector similarity search
│   │
│   └── [Other overlays - mathematical-proofs, strategic-coherence, etc.]
│
├── logs/                            # Operational Logs
│   └── [Execution traces and diagnostics]
│
├── mission_integrity/              # Security - Mission Validation
│   └── [Prevents malicious mission injection]
│
└── security/                        # Transparency & Audit Trail
    └── transparency.jsonl           # Append-only log of mission loads and operations
```

### Key Characteristics

- **Total Objects:** 155 unique content-addressed pieces of knowledge
- **Total Transforms:** 84 immutable operation records
- **Total Index Entries:** 102 file mappings
- **Total Reverse Deps:** 143 dependency reverse-lookup entries
- **Vector DB:** 8 LanceDB index files for semantic search
- **Overlays:** Multiple YAML/JSON layers for specialized analysis
- **Total Size:** Efficiently compressed due to content deduplication

### How It Works

1. **When you run `genesis`:**
   - StructuralMiner parses source files → creates StructuralData objects
   - Each piece of data is hashed → stored in `objects/`
   - Hash recorded in `index/` with file path
   - Transform recorded in `transforms/` (audit trail)
   - Dependencies analyzed → `reverse_deps/` updated

2. **When you run `watch` + `status` + `update`:**
   - Watch detects file changes → `dirty_state.json`
   - Status reads dirty_state → < 10ms coherence check
   - Update re-parses changed files → new objects/transforms
   - Index updated → dirty state cleared

3. **When you generate overlays:**
   - Overlay generators read core knowledge
   - Create specialized embeddings and metadata
   - Store in overlay-specific directories
   - Register in LanceDB for vector similarity

---

## 7. Overall Philosophy and Approach

### Core Tenets

#### **1. Verifiable Truth Over Statistical Approximation**

- Cryptographically grounded (SHA-256 content addressing)
- Immutable audit trails (Transform Log)
- Fidelity labeling for uncertainty
- Zero-trust architecture: everything verified by Oracles

#### **2. Human-AI Symbiosis**

- Humans understand the domain and values
- AI understands structure and patterns
- Together they reason about code with grounded truth
- Partnership, not replacement

#### **3. Radical Transparency**

- All operations logged and auditable
- Every fidelity score explained
- Mission documents and principles explicit
- Drift detection against stated values

#### **4. Dual-Use Awareness**

- System could enforce conformity (for good or ill)
- Acknowledges this explicitly (DUAL_USE_MANDATE.md)
- Users responsible for ethical deployment
- Recommends safeguards (mission integrity validation)

#### **5. Layered Extraction**

- Deterministic methods first (AST parsing)
- Specialized models second (SLM)
- General models last resort (LLM)
- Each layer labeled with confidence

#### **6. Composable Overlays**

- 7 cognitive dimensions (O₁-O₇)
- Each independent but interconnected
- Boolean algebra across layers
- Extensible for new domain-specific overlays

#### **7. Reflexive Self-Healing**

- Monument pattern enables continuous synchronization
- Detects its own incoherence (status check)
- Heals itself incrementally (update)
- No human intervention required for steady state

### Research & Vision

The project serves as a research platform for:

- **Verifiable AI Code Assistance:** Grounding AI responses in cryptographic truth
- **Architectural Reasoning:** Enabling AI reasoning about code at system-wide levels
- **Cognitive Prosthetics:** Extending to human memory preservation
- **Mission-Driven Development:** Aligning code with stated principles
- **Formal Verification:** Mathematical proofs for correctness

### The Promise

> "When biological memory fails, verifiable external memory can preserve identity, consciousness, and human dignity."

The same architecture that understands code can preserve human identity through memory loss. This vision extends beyond software development into healthcare and human preservation.

---

## Summary Statistics

| Metric                     | Value                      |
| -------------------------- | -------------------------- |
| **Total TypeScript Lines** | **~147,145** (incl. tests) |
| Production Code Lines      | ~100,135 (excl. tests)     |
| Test Code Lines            | ~47,010 (165 test files)   |
| Total Source Files         | 419 (254 prod + 165 test)  |

### Lines of Code by Module

| Module        | LOC         | Files   | % of Prod | Description                   |
| ------------- | ----------- | ------- | --------- | ----------------------------- |
| **core/**     | 35,368      | 84      | 35.3%     | PGC, overlays, orchestrators  |
| **tui/**      | 19,839      | 66      | 19.8%     | React Ink terminal interface  |
| **commands/** | 15,265      | 31      | 15.2%     | CLI command implementations   |
| **sigma/**    | 10,714      | 31      | 10.7%     | Infinite context dual-lattice |
| **llm/**      | 9,212       | 14      | 9.2%      | LLM provider abstraction      |
| **ipc/**      | 4,369       | 12      | 4.4%      | ZeroMQ agent messaging        |
| **utils/**    | 3,696       | 14      | 3.7%      | Errors, formatting, helpers   |
| **root**      | 1,672       | 2       | 1.7%      | cli.ts, config.ts             |
| **Total**     | **100,135** | **254** | **100%**  |                               |

### Core Module Breakdown

| Submodule      | LOC   | Description                         |
| -------------- | ----- | ----------------------------------- |
| overlays/      | 8,132 | 7 cognitive overlays (O₁-O₇)        |
| orchestrators/ | 5,665 | Genesis, miners, workers            |
| pgc/           | 4,808 | Object store, index, transforms     |
| analyzers/     | 3,651 | Concept, strategy, workflow         |
| security/      | 3,299 | Mission validation, security config |
| algebra/       | 1,948 | Lattice operations, query parser    |
| types/         | 1,443 | Type definitions                    |
| graph/         | 1,239 | Dependency graph types              |
| transforms/    | 940   | Genesis document transforms         |
| quest/         | 775   | Operations log                      |
| watcher/       | 680   | File system monitoring              |
| query/         | 531   | Query engine                        |
| parsers/       | 518   | Markdown parser                     |
| services/      | 327   | Embedding service                   |
| errors/        | 238   | Error handling                      |
| config/        | 123   | Mission sections config             |

### TUI Module Breakdown

| Submodule   | LOC    | Description                            |
| ----------- | ------ | -------------------------------------- |
| hooks/      | 11,608 | Modular React hooks (agent, task, etc) |
| components/ | 3,592  | UI components (Ink/React)              |
| services/   | 805    | Background services and diagnostics    |
| commands/   | 433    | TUI command loader                     |
| tools/      | 1,091  | Custom TUI tools                       |
| utils/      | 1,145  | TUI-specific utilities                 |
| context/    | 183    | TUI React context providers            |

### Other Metrics

| Metric                | Value                              |
| --------------------- | ---------------------------------- |
| Total Dependencies    | 54 npm packages (31 prod + 23 dev) |
| Documentation Pages   | 30+                                |
| Manual Chapters       | 22 (+ appendix)                    |
| Cognitive Overlays    | 7 (O₁-O₇)                          |
| Supported Languages   | 3 (TS/JS/Python)                   |
| Core Commands         | 40+ (with tab completion)          |
| Test Files            | 165 (comprehensive coverage)       |
| Test Coverage         | ~92% (security, compression, UX)   |
| Current Version       | 2.6.7 (January 29, 2026)           |
| License               | AGPL-3.0-or-later                  |
| Zenodo DOI            | 10.5281/zenodo.18012832            |
| Innovations Published | 49 (defensive patent publication)  |

---

## Version History & Changelog

### Version 2.6.7 (Current - TUI Visual Balance & Gemini 3 Reasoning)

**Summary:** Refines the terminal experience with "Dim Cyan" theme balancing and hardens Gemini integration with thought signature support and robust retry infrastructure.

**New Features:**

- **TUI Visual Theme Refinement** — Dimmed cyan tones for better visual balance and reduced eye strain.
- **Gemini 3 Thought Signatures** — Support for persisting reasoning to resolve potential loops in Gemini 3 models.
- **Robust Retry Infrastructure** — Introduced a provider refactor with robust retry logic and failover infrastructure.
- **Enhanced Diff Highlighting** — Improved diff auto-detection and rendering accuracy in the TUI.

### Version 2.6.6 (TUI Theme Overhaul & Vertex AI Robustness)

**Summary:** Introduces the "Monolith Cyan" theme and significantly improves Gemini/Vertex AI integration with global noise suppression.

**New Features:**

- **Monolith Cyan Theme** — A vibrant TUI theme with refined thinking blocks and improved contrast.
- **AST-based Markdown Rendering** — Replaced regex-based rendering with a robust AST engine.
- **Vertex AI Support** — Streamlined enterprise deployments without requiring a legacy API key.
- **Smart Auto-scroll** — Prevents scroll jumps when the user has manually scrolled up.

### Version 2.6.5 (TUI Responsiveness & LLM Context)

**Summary:** Major layout and responsiveness upgrades for the TUI and improved LLM context awareness via path relativization.

**New Features:**

- **Refactored Layout Engine** — Dynamic measurement and flexbox-based TUI layout.
- **Global Scrolling** — Page Up/Down support for the chat window.
- **Auto-Relativized Git Paths** — Automatically converts git output paths to be relative to the CWD for better LLM context.
- **Command History** — Up/down arrow navigation for input history in the TUI.

### Version 2.6.4 (PGC Grounding & Multi-Provider Token Optimization)

**Summary:** Implements Sigma Task Protocol v2.0 with structured grounding and unified Tri-Modal Compression Strategy for Gemini, OpenAI, and eGemma.

**New Features:**

- **Sigma Task Protocol v2.0** — Verifiable task execution via `grounding` and `grounding_evidence` arrays.
- **Tri-Modal Compression Strategy** — Unified context management (Semantic, Standard, Survival) for proactive TPM protection.
- **Dynamic Thinking Budgeting** — Automatically scales reasoning effort based on remaining TPM quota.
- **Modular TUI Architecture** — Refactored into hooks and services with new system diagnostics.
- **Project-Specific Bus Isolation** — Improved isolation for agent communication across different projects.

### Version 2.6.3 (Cross-Project Agent Collaboration)

**Summary:** Introduces a fractal lattice mesh architecture for cross-project agent collaboration.

**New Features:**

- **Context Sharding** — Agents can now query specialized "Gardener" agents of other repositories via `query_agent()`.
- **Active Negotiation** — When an interface changes, agents negotiate the impact across project boundaries before build failures occur.
- **Team Meshes** — `IPC_SIGMA_BUS` enables isolated communication channels for specific project groups.

### Version 2.6.1 (Multi-Agent Collaborative System)

**Summary:** 27 commits (Dec 1-3, 2025) adding agent-to-agent communication infrastructure.

**New Features:**

- **ZeroMQ Pub/Sub** — Event-driven message bus (`ipc:///tmp/cognition-bus.sock`) with topic routing
- **Persistent Message Queues** — Messages stored in `.sigma/message_queue/{agent-id}/`
- **Agent Messaging Tools** — 5 MCP/ADK tools: `list_agents`, `send_agent_message`, `broadcast_agent_message`, `list_pending_messages`, `mark_message_read`
- **Auto-Response System** — Automatic agent turns with Yossarian Protocol (max 5/min rate limit)
- **Agent Registry** — Heartbeat monitoring, aliases (`opus1`, `sonnet2`), collision detection
- **Session Anchor IDs** — New format `tui-<model>-<timestamp>` for tab completion

**UX Improvements:**

- Shell completions for `--provider`, `--model`, TUI flags
- Dimmed startup messages, `DEBUG_IPC=1` for troubleshooting
- Event-driven TUI updates (replaced polling)

**Bug Fixes:**

- Gemini schema fix (`.default()` → `.optional()`)
- Self-exclusion logic in agent messaging
- Missing `getMessageQueue` parameter for Gemini

**Breaking Changes:**

- Removed 5 slash commands replaced by MCP tools: `/send`, `/pending`, `/inject`, `/inject-all`, `/dismiss`

### Version 2.5.1 (Gemini Integration)

**Summary:** 82 commits from v2.3.2 delivering critical compression performance fix, comprehensive UX enhancements, robust error handling, and extensive test coverage. This is a major stability and performance milestone resolving the 5-10 minute compression blocking issue.

**1. Critical Performance Fix (c2152d5) - INSTANT vs 5-10 MINUTES**

- **Compression Performance** - GAME CHANGER
  - Fixed critical blocking issue causing 5-10 minute delays during context compression
  - **Impact:** Compression now completes **instantly (0.0s)** instead of 5-10 minutes
  - Root causes identified:
    - Slow disk I/O during reconstruction
    - Loading all historical sessions instead of current only
    - Synchronous blocking during compression
  - **Solution implemented:**
    - Fast-path reconstruction: Extract overlay-aligned turns from in-memory lattice (bypass disk)
    - Session filtering: Filter lazy-loaded managers by currentSessionId
    - Synchronous compression: Make compression async and await completion
    - Race condition fix: Add synchronous ref (getResumeSessionId) to bypass React state updates
  - **Files modified:** 8 files, 459 lines
    - `src/sigma/context-reconstructor.ts` (241 lines)
    - `src/tui/hooks/useClaudeAgent.ts` (95 lines)
    - `src/tui/hooks/useSessionManager.ts` (60 lines)

**2. Critical Session Fix (8509d83)**

- **Session Lifecycle After Compression** - CRITICAL
  - Fixed TUI failing to create new session after compression
  - Symptoms: Session ID remained unchanged, tokens didn't reset, state file didn't update
  - Root cause: `resetResumeSession()` wrapped in try-catch that silently swallowed errors
  - **Fix:** Moved `resetResumeSession()` to finally block (always executes)
  - Added user-facing error notifications for graceful degradation
  - **Impact:** Session always resets after compression, no more stuck sessions

**3. Shell Tab Completion (f083919)**

- **Full tab completion support** for bash, zsh, and fish shells
- Features:
  - Auto-complete for all 40+ commands and aliases (i, g, q, w, l)
  - Context-aware completions (overlay types, output formats, shell types)
  - Global options (--format, --no-color, --verbose)
  - Directory path completion
- Installation:

  ```bash
  cognition-cli completion install          # Auto-detect shell
  cognition-cli completion install --shell bash/zsh/fish
  cognition-cli completion uninstall
  ```

- **Files:** `src/commands/completion.ts` (461 lines)
- **Impact:** 50-70% reduction in typing, improved command discoverability

**4. Comprehensive UX Improvements (d5c755b)**

- **Accessibility Flags:**
  - `--no-color` flag (respects NO_COLOR env var)
  - `--no-emoji` flag for terminals without Unicode
  - `--format` flag (auto|table|json|plain)
  - `-v/--verbose` and `-q/--quiet` global flags
- **Terminal Capability Detection:**
  - Auto-detect color, Unicode/emoji, box-drawing support
  - Graceful degradation for limited terminals
  - Terminal width detection for text wrapping
- **JSON Output Mode:**
  - Standard envelope: `{ data, metadata, errors, warnings }`
  - Added `--json` flag to query and lattice commands
  - Pagination metadata support
- **Command Aliases:**
  - `i` → init, `g` → genesis, `q` → query, `w` → wizard, `l` → lattice
- **Files:** 8 files, 1,561 lines
  - `src/utils/error-formatter.ts` (140 lines)
  - `src/utils/errors.ts` (217 lines)
  - `src/utils/json-output.ts` (178 lines)
  - `src/utils/terminal-capabilities.ts` (205 lines)

**5. Custom Error Hierarchy (Multiple commits)**

- **Structured error types** with recovery suggestions
- Error classes:
  - `PGCError` - Base error class
  - `ValidationError` - Input validation failures
  - `NotFoundError` - Resource not found
  - `ConfigurationError` - Config issues
  - `FileSystemError` - File operations
  - `NetworkError` - Network failures
- **Error codes** for programmatic handling
- **Recovery suggestions** in error messages
- **Graceful degradation** throughout codebase

**6. Comprehensive Testing (120+ new tests)**

- **Security tests:** CVE fixes validation, dependency scanning
- **Compression tests:** Performance benchmarks, reconstruction validation
- **Command tests:** Completion, format flags, error handling
- **Error handling tests:** All error types, recovery paths
- **Integration tests:** End-to-end workflows
- **Files:** 40+ new test files across all modules
- **Coverage:** Increased from ~60% to ~85%

**7. Security Fix**

- **CVE-2025-64718** in js-yaml resolved
- Updated: js-yaml 4.1.0 → 4.1.1
- Automated dependency scanning in CI/CD

**8. Documentation Overhaul**

- **23 dead links fixed** with missing index.md files
- **Comprehensive CHANGELOG.md** with detailed release notes
- **Improved inline documentation** across all modules
- **Architecture Decision Records (ADRs)** documented

**9. Performance Metrics**

- **Compression time:** 5-10 minutes → **0.0s (instant)**
- **LOC:** ~132,153 total (92,033 production + 40,120 tests)
  - Production: 92,033 across 237 files
  - Tests: 40,120 across 129 files
- **Test coverage:** ~85% → **~92%**
- **Commands:** Added tab completion reducing typing by 50-70%

**10. Code Quality**

- All commits: Linted, type-safe, built successfully
- 82 commits with zero breaking changes
- Production-ready error handling throughout
- Graceful degradation for all failure modes

_For previous release history, see [CHANGELOG.md](https://github.com/mirzahusadzic/cogx/blob/main/src/cognition-cli/CHANGELOG.md)._

---

## Conclusion

Cognition CLI is a sophisticated research platform and production tool that reimagines AI-assisted development through verifiable, content-addressed knowledge graphs. **Version 2.6.7** extends production excellence with **TUI visual refinements**, **Gemini 3 reasoning robustness**, and **robust retry infrastructure**, ensuring a stable and professional experience for AI-human symbiosis. This transforms Cognition CLI from a research prototype into a high-reliability distributed nervous system for code.

It combines:

- **Cryptographic grounding** (content-addressable truth)
- **Architectural intelligence** (multi-layer analysis)
- **Human values** (mission alignment)
- **Real-time synchronization** (watch/status/update)
- **Radical transparency** (audit trails + live TUI)
- **Security-first design** (dual-use awareness)
- **Extensible overlays** (7 cognitive dimensions)
- **Infinite context** (Sigma dual-lattice with Tri-Modal compression)
- **Verifiable memory** (conversation indexed like code)
- **Production-ready UX** (tab completion, accessibility, graceful degradation)
- **Multi-agent collaboration** (ZeroMQ pub/sub, persistent queues, auto-response)
- **Structured Delegation** (Manager/Worker pattern with Sigma Task Protocol v2.0)
- **Fractal Mesh Architecture** (Cross-project context sharding and negotiation)

Rather than treating LLMs as magical oracles, it grounds them in verifiable fact, enabling a new generation of AI-powered developer tools that are trustworthy, auditable, and aligned with human values and principles. With its fractal mesh and delegation capabilities, it now enables complex workflows where multiple AI agents collaborate asynchronously across massive, distributed codebases.
