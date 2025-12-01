# Feature Specification: Interactive Background Task System

**Version:** 1.3.2
**Date:** 2025-12-01
**Status:** Proposal (Extended for Multi-Agent Architecture)
**Author:** Claude Sonnet 4.5 (based on user requirements)
**Reviewer:** Claude Opus 4.5 (v1.1 review: 9/10, approved for Phase 1)
**Amended by:** Claude Opus 4.5 (v1.3: Multi-Agent Cooperative Architecture)
**Clarified by:** User (v1.3.1: Embedding generation in Parent, not Child)
**Extended by:** Claude Opus 4.5 (v1.3.2: Hub-and-Spoke Topology)

---

## Executive Summary

This specification proposes an **Interactive Background Task System** for Cognition CLI that enables slash commands to execute as **headless TUI instances** with bidirectional IPC communication, dynamic permission delegation, and zero-hardcoded workflows. The system reuses existing agent infrastructure (GeminiAgentProvider, ClaudeProvider) and treats markdown files as LLM prompts rather than deterministic workflow definitions, allowing LLMs and users to interact with running tasks without breaking conversation flow.

---

## 1. Problem Statement

### 1.1 Current Limitations

**Problem 1: Broken Conversation Flow**

```
Current State:
User: "Help me onboard this project"
  ↓
Wizard: "Please manually run: /onboard-project"
  ↓
[User context switches to terminal]
  ↓
[Wizard loses context]
```

**Problem 2: Permission Modal Spam**

- Background tasks that need to execute multiple tools trigger permission modals for each operation
- User doesn't understand context ("Why is this asking to write a file?")
- No way to pre-approve safe operations for trusted workflows

**Problem 3: Hardcoded Workflows**

- Slash command logic is imperative code, not declarative
- Adding new commands requires code changes
- Workflows cannot be modified without recompiling
- No clear separation between workflow definition and execution

**Problem 4: No Inter-Process Communication**

- Parent TUI cannot send messages to child processes
- Background tasks cannot ask questions during execution
- No way for main LLM to interact with running slash commands

---

## 2. Solution Architecture

### 2.1 Core Components

```
┌─────────────────────────────────────────────────────────────────┐
│ Main TUI (Parent)                                               │
│ - Primary conversation                                          │
│ - Spawns headless child TUI instances                           │
│ - Handles IPC messaging                                         │
│ - Permission escalations                                        │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       │ IPC (stdin/stdout/stderr)
                       │ JSON-based message protocol
                       │
┌──────────────────────▼──────────────────────────────────────────┐
│ Headless TUI Child (reuses existing agent infrastructure)       │
│ - Reads .md file as LLM prompt (NOT parsed deterministically)   │
│ - Uses GeminiAgentProvider / ClaudeProvider                     │
│ - Permission manifest from frontmatter → ToolGuardian           │
│ - Auto-approves tools within declared scope                     │
│ - Sends IPC messages for input / escalation                     │
│ - All existing tools work immediately (SIGMA, overlays, etc.)   │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Key Principles

1. **Zero Hardcoding**: All workflows and permissions defined in markdown
2. **Bidirectional IPC**: Parent and child can exchange messages
3. **Delegated Permissions**: Each task declares and enforces its own scope
4. **Markdown as LLM Prompt**: `.md` files interpreted by LLM, not parsed deterministically
5. **Infrastructure Reuse**: Leverage existing agent providers, tools, and SIGMA integration
6. **Composability**: Slash commands can call other slash commands

### 2.3 Hub-and-Spoke Topology

The system follows a **Hub-and-Spoke** architecture where the Main TUI acts as the central hub and background tasks are spokes:

```
                              ┌─────────────────────────────────┐
                              │         MAIN TUI (HUB)          │
                              │                                 │
                              │  ┌───────────────────────────┐  │
                              │  │   Full Conversation       │  │
                              │  │   - User messages         │  │
                              │  │   - Hub responses         │  │
                              │  │   - Spoke turns (via IPC) │  │
                              │  └───────────────────────────┘  │
                              │                                 │
                              │  ┌───────────────────────────┐  │
                              │  │   AnalysisQueue           │  │
                              │  │   - Generates embeddings  │  │
                              │  │   - Writes to LanceDB     │  │
                              │  │   - Serial processing     │  │
                              │  └───────────────────────────┘  │
                              │                                 │
                              │  ┌───────────────────────────┐  │
                              │  │   Write Master            │  │
                              │  │   - Only writer to DB     │  │
                              │  │   - No lock contention    │  │
                              │  └───────────────────────────┘  │
                              └──────────────┬──────────────────┘
                                             │
                 ┌───────────────────────────┼───────────────────────────┐
                 │                           │                           │
          ┌──────▼──────┐             ┌──────▼──────┐             ┌──────▼──────┐
          │   SPOKE 1   │             │   SPOKE 2   │             │   SPOKE 3   │
          │  /onboard   │             │  /analyze   │             │  /blast     │
          │             │             │             │             │  -radius    │
          │ Headless    │             │ Headless    │             │ Headless    │
          │ TUI Process │             │ TUI Process │             │ TUI Process │
          │             │             │             │             │             │
          │ Sends:      │             │ Sends:      │             │ Sends:      │
          │ - turns     │             │ - turns     │             │ - turns     │
          │ - progress  │             │ - progress  │             │ - progress  │
          │ - requests  │             │ - requests  │             │ - requests  │
          └─────────────┘             └─────────────┘             └─────────────┘
```

#### Hub Responsibilities (Main TUI)

| Responsibility          | Description                                                 |
| ----------------------- | ----------------------------------------------------------- |
| **Conversation Owner**  | Contains ALL conversation history (user + hub + all spokes) |
| **User Interface**      | Displays messages, handles input, shows progress            |
| **Write Master**        | Only process that writes to LanceDB (zero contention)       |
| **Embedding Generator** | AnalysisQueue generates embeddings for all turns            |
| **Orchestrator**        | Spawns spokes, routes messages, handles escalations         |
| **Permission Arbiter**  | Handles escalated permission requests from spokes           |

#### Spoke Responsibilities (Background Tasks)

| Responsibility         | Description                                       |
| ---------------------- | ------------------------------------------------- |
| **Task Execution**     | Runs the slash command workflow autonomously      |
| **Tool Usage**         | Executes tools within declared permission scope   |
| **Turn Generation**    | Produces conversation turns, sends to hub via IPC |
| **Escalation**         | Requests permission for dangerous operations      |
| **Progress Reporting** | Sends status updates to hub                       |

#### Information Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ SPOKE (Child Process)                                                       │
│                                                                             │
│  1. Execute task (CPU-intensive analysis, tool calls)                       │
│  2. Generate conversation turn                                              │
│  3. Send via IPC: { type: 'analysis_result', turn: {...} }                  │
│                                                                             │
│  ⚠️  Does NOT generate embeddings (delegated to hub)                        │
│  ⚠️  Does NOT write to LanceDB (delegated to hub)                           │
└──────────────────────────────────┬──────────────────────────────────────────┘
                                   │ IPC (lightweight JSON, no embeddings)
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ HUB (Main TUI Process)                                                      │
│                                                                             │
│  1. Receive turn via IPC                                                    │
│  2. Add to conversation history                                             │
│  3. Display to user                                                         │
│  4. Push to AnalysisQueue                                                   │
│  5. AnalysisQueue generates embedding                                       │
│  6. AnalysisQueue writes to LanceDB (serial, no locks)                      │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Why Hub-and-Spoke?

| Alternative                | Problem                                               | Hub-and-Spoke Solution             |
| -------------------------- | ----------------------------------------------------- | ---------------------------------- |
| **Peer-to-Peer**           | Write contention, complex coordination                | Hub serializes all writes          |
| **Shared Memory**          | Node.js single-threaded, can't share across processes | IPC message passing                |
| **Direct DB Access**       | Lock contention, corruption risk                      | Single writer (hub)                |
| **Distributed Embeddings** | Duplicate work, large IPC payloads                    | Centralized in hub's AnalysisQueue |

#### Scaling Properties

- **Horizontal**: Spawn more spokes for parallel analysis
- **Vertical**: Hub's AnalysisQueue handles embedding load
- **Memory**: Spokes are lightweight (no embedding infrastructure)
- **Latency**: IPC is lightweight (just turns, no vectors)

This topology enables the system to scale to many concurrent background tasks without locking complexity or write contention.

---

## 3. Technical Design

### 3.1 Markdown-Driven Workflow Definition

Each slash command is a markdown file with:

1. **YAML frontmatter** declaring permissions (parsed by system)
2. **Markdown body** as LLM prompt (interpreted by agent, NOT parsed)

```markdown
---
# .claude/commands/onboard-project.md
permissions:
  tools: [read_file, write_file, bash, genesis:docs]
  autoApproveRisks: [safe, moderate]
  paths: [docs/**, .open_cognition/**]
  canEscalate: true
  description: 'Creates strategic documentation'
  model: gemini-2.0-flash-exp # Optional: override model for this task
---

# Onboard New Project

The markdown body below is passed to the LLM as a prompt.
The LLM interprets it naturally - we do NOT parse numbered lists,
code blocks, or other structures deterministically.

## Your Task

Help the user document their project by:

1. Asking what their project is called
2. Understanding the problem it solves
3. Capturing their core principles
4. Generating a VISION.md file

## VISION.md Template Example

\`\`\`markdown

# [Project Name]

> _[One sentence essence]_
> ...
> \`\`\`
```

### 3.2 Permission Manifest Schema

```typescript
interface PermissionManifest {
  /** Tools this command can use (supports wildcards) */
  tools: string[];

  /** Risk levels that can be auto-approved */
  autoApproveRisks: ('safe' | 'moderate' | 'dangerous' | 'critical')[];

  /** File path patterns allowed (glob syntax) */
  paths?: string[];

  /** Can escalate risky operations to parent? */
  canEscalate: boolean;

  /** Human-readable description */
  description?: string;

  /** Optional: Override model for this background task */
  model?: 'gemini-2.0-flash-exp' | 'claude-sonnet-4-5' | 'claude-opus-4-5';

  /** Optional: Max tokens budget for this task */
  maxTokens?: number;

  /** Optional: Should this task count against main session quota? */
  shareQuota?: boolean;
}
```

### 3.3 IPC Message Protocol

**Parent → Child (stdin):**

```typescript
type ParentMessage =
  | { type: 'response'; requestId: string; data: string }
  | { type: 'cancel' }
  | { type: 'permission_grant'; toolName: string; approved: boolean };
```

**Child → Parent (stdout):**

```typescript
type ChildMessage =
  | { type: 'progress'; message: string; percent: number }
  | { type: 'request_input'; requestId: string; prompt: string }
  | {
      type: 'request_permission';
      tool: string;
      input: unknown;
      riskLevel: string;
    }
  | { type: 'complete'; result: unknown }
  | { type: 'error'; message: string };
```

**Child → Parent (stderr):**

Stderr is reserved for **structured logging and debugging only**:

```typescript
type StderrLog =
  | {
      level: 'debug' | 'info' | 'warn' | 'error';
      message: string;
      timestamp: string;
      context?: Record<string, unknown>;
    }
  | {
      level: 'trace';
      operation: string;
      duration: number;
      metadata?: Record<string, unknown>;
    };
```

**Why separate stderr:**

- Stdout carries IPC protocol messages (must be parseable JSON)
- Stderr carries logs (can be consumed by monitoring, ignored by parent, or piped to file)
- Parent can choose to display, suppress, or log stderr separately
- Enables debugging without breaking IPC protocol

### 3.4 Context Sharing (with Session Isolation)

Background tasks inherit context from the parent session while maintaining **write isolation** to prevent file conflicts:

```typescript
interface TaskContext {
  /** Parent's anchor ID (READ-ONLY access to parent state) */
  parentAnchorId: string;

  /** Unique ID for this task (WRITE isolation) */
  taskAnchorId: string; // e.g., `{parentAnchorId}-task-{timestamp}`

  /** Link to SIGMA session for memory recall (shared LanceDB, read-safe) */
  sigmaSessionId?: string;

  /** Files already read in main session (avoid re-reading) */
  inheritedFiles?: string[];

  /** Compressed summary of parent conversation */
  parentSessionSummary?: string;

  /** Working directory context */
  cwd: string;

  /** User preferences from parent session */
  preferences?: Record<string, unknown>;
}
```

**Session File Isolation:**

```
.sigma/
├── conversations.lance        ← Shared (LanceDB concurrent-read safe)
├── overlays.lance             ← Shared (read-only for tasks)
├── {parentAnchorId}.state.json    ← Parent writes only
└── {parentAnchorId}-task-{id}.state.json  ← Task writes only
```

**Why isolation matters:**

- `SessionStateStore` writes to `.sigma/{anchorId}.state.json`
- Without isolation, parent and child would corrupt each other's state
- LanceDB supports concurrent reads, but state files need per-agent isolation

This allows background tasks to:

- Access conversation memory via SIGMA (concurrent-read safe)
- Understand what files have already been discussed
- Reference earlier decisions without re-asking
- Maintain consistent behavior with parent session
- **Write to isolated state files (no race conditions)**

### 3.5 Write Coordination: Parent as Write Master

**Problem:** Multiple background agents (headless processes) cannot share the `AnalysisQueue` memory object. They _do_ share LanceDB files on disk, creating potential write contention.

**Solution:** Background tasks post analysis results back to Parent via IPC. Parent acts as the single **Write Master**.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Child (Headless)                                                            │
│ 1. Runs analysis (CPU-intensive)                                            │
│ 2. Generates conversation turn/message                                      │
│ 3. Sends IPC: { type: 'analysis_result', turn: {...} }                      │
└──────────────────────────────┬──────────────────────────────────────────────┘
                               │ IPC (lightweight - no embeddings)
                               ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ Parent (TUI) - Write Master                                                 │
│ 1. Receives turn via IPC                                                    │
│ 2. Pushes turn into AnalysisQueue                                           │
│ 3. AnalysisQueue generates embeddings & writes to LanceDB                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

**IPC Message Type:**

```typescript
type ChildMessage =
  | { type: 'progress'; message: string; percent: number }
  | { type: 'request_input'; requestId: string; prompt: string }
  | {
      type: 'request_permission';
      tool: string;
      input: unknown;
      riskLevel: string;
    }
  | { type: 'analysis_result'; turn: ConversationTurn } // NEW - Parent's AnalysisQueue will embed it
  | { type: 'complete'; result: unknown }
  | { type: 'error'; message: string };
```

**Benefits:**

| Aspect           | Without Write Master                 | With Write Master                         |
| ---------------- | ------------------------------------ | ----------------------------------------- |
| Write Contention | Multiple processes fight for LanceDB | Zero - only Parent writes                 |
| Locking          | Complex file locks needed            | None needed                               |
| IPC Overhead     | N/A                                  | Lightweight (no embeddings in transit)    |
| Embedding        | Each child duplicates embedding work | Centralized in Parent's AnalysisQueue     |
| Scalability      | Limited by lock contention           | Analysis distributed, commits centralized |
| Consistency      | Risk of corruption                   | Guaranteed serial writes                  |

**Key Insight (from Gemini 3 Pro Preview):**

> The Parent TUI acts as the **Write Master** for the session's memory. Analysis work (CPU-intensive) is distributed to child processes, but embedding generation and commit to LanceDB are centralized in the Parent's AnalysisQueue. This pattern is common in distributed databases (leader-follower replication).

**Why not send embeddings via IPC?**

- Embeddings are large (768-1536 dimensions)
- Parent's AnalysisQueue already has embedding infrastructure
- Keeps IPC lightweight (just conversation turns)
- Avoids duplicate embedding work across children

This architecture scales to many concurrent background tasks without any locking complexity.

### 3.6 Permission Guardian

```typescript
class ToolGuardian {
  /**
   * Check if tool can be executed in given context.
   * Uses permissions from markdown frontmatter - NO HARDCODING.
   */
  async checkPermission(
    tool: string,
    input: unknown,
    context: ExecutionContext
  ): Promise<PermissionResult> {
    // 1. Check if tool in allowed list
    // 2. Compute risk level (O2 security layer)
    // 3. Check if can auto-approve based on risk
    // 4. Check path restrictions for file operations
    // 5. Escalate to parent if needed and allowed
  }
}
```

### 3.6 Interactive Task Manager

```typescript
class InteractiveTaskManager extends BackgroundTaskManager {
  /**
   * Start slash command as headless TUI background task.
   * Spawns: cognition-cli tui --headless --command <commandName>
   */
  async startInteractiveTask(
    commandName: string,
    context: TaskContext
  ): Promise<string> {
    // 1. Read .claude/commands/{commandName}.md
    // 2. Parse permissions from frontmatter
    // 3. Prepare TaskContext (SIGMA session, inherited files, etc.)
    // 4. Spawn headless TUI: `cognition-cli tui --headless --command ${commandName}`
    // 5. Pipe stdin/stdout/stderr for IPC
    // 6. Initialize ToolGuardian with parsed permissions
    // 7. Pass markdown body to agent as system prompt
    // 8. Handle IPC messages
    // 9. Return task ID for tracking
  }

  /**
   * Send response to child task waiting for input
   */
  async respondToTask(
    taskId: string,
    requestId: string,
    response: string
  ): Promise<void>;

  /**
   * Handle permission escalation from child
   */
  async handleEscalation(
    taskId: string,
    request: EscalationRequest
  ): Promise<boolean>;
}
```

---

## 4. Use Cases

### 4.1 Onboarding Wizard (Interactive)

```
User: "Help me onboard"
  ↓
TUI: Starting /onboard-project as background task...
  ↓
Task reads: .claude/commands/onboard-project.md
Task parses: { tools: [write_file], autoApprove: [safe, moderate] }
  ↓
Task sends: { type: 'request_input', prompt: "What is your project called?" }
  ↓
Main LLM receives prompt
Main LLM asks user (or infers from context)
Main LLM responds: "CogX CLI"
  ↓
Task receives response, continues workflow
Task wants: write_file("docs/VISION.md")
Guardian checks: ✓ moderate risk, ✓ in allowed paths
Task auto-approves (no modal!)
  ↓
Task completes, returns to main conversation
```

### 4.2 PR Analysis (Read-Only)

```markdown
---
# .claude/commands/pr-analyze.md
permissions:
  tools: [read_file, grep, glob, bash]
  autoApproveRisks: [safe]
  paths: [**/*]  # Can read anything
  canEscalate: false  # Never needs escalation (read-only)
---
```

```
User: "Analyze this PR"
  ↓
TUI: Starting /pr-analyze as background task...
  ↓
Task runs git diff, reads files, computes impact
All operations are 'safe' (read-only)
All auto-approved (no modals)
  ↓
Task returns: { filesChanged: 5, o1Impact: [...], o3Impact: [...] }
Main LLM integrates results into conversation
```

### 4.3 Blast Radius (Safe Query)

```markdown
---
# .claude/commands/blast-radius.md
permissions:
  tools: [read_file, grep, glob]
  autoApproveRisks: [safe]
  canEscalate: false
---
```

```
During conversation about refactoring:
  ↓
LLM: "Let me check blast radius..."
LLM internally executes: /blast-radius handleUserInput
  ↓
Task runs, all tools auto-approved
Returns impact graph
  ↓
LLM: "Changing handleUserInput affects 12 files. Here's the breakdown..."
```

---

## 5. Implementation Plan

**Total Timeline:**

- **Phase 1-4 (Core):** 8-12 weeks (revised based on Opus feedback)
- **Phase 5-6 (Multi-Agent):** 5-7 weeks additional (FUTURE, after Phase 4 stable)

### 5.1 Phase 1: MVP - Headless TUI + IPC (2-3 weeks)

**Goal:** Proof of concept with basic IPC communication

**Files to modify:**

- `src/tui/services/BackgroundTaskManager.ts` → Add stdin pipe, message handlers
- `src/utils/ipc-protocol.ts` → Define message types, serialization
- `src/tui/index.ts` → Add `--headless` mode support

**New files:**

- `src/tui/modes/headless.ts` → Headless TUI entry point

**Deliverables:**

- Parent spawns: `cognition-cli tui --headless --command /onboard-project`
- Child sends structured JSON output via stdout
- Basic input request/response works
- Child can complete and return results

**Success Metric:** Run a simple slash command end-to-end in background

### 5.2 Phase 2: Permission System (2 weeks)

**Goal:** Delegated tool approvals based on frontmatter

**New files:**

- `src/core/permissions/manifest-parser.ts` → Parse YAML frontmatter
- `src/core/permissions/tool-guardian.ts` → Permission checking logic
- `src/core/permissions/types.ts` → TypeScript interfaces

**Files to modify:**

- `src/tui/hooks/useAgent.ts` → Integrate ToolGuardian with existing `onCanUseTool` callback
- `src/llm/providers/gemini-adk-tools.ts` → Wire ToolGuardian into tool definitions
- `src/llm/providers/claude-provider.ts` → Wire ToolGuardian into Claude tool execution

**Deliverables:**

- Parse permission manifest from markdown frontmatter
- Apply path restrictions and risk thresholds
- Auto-approve safe/moderate operations (no modals!)
- Escalation protocol for dangerous operations

**Success Metric:** `/onboard-project` auto-approves file writes in `docs/**`

### 5.3 Phase 3: Context Sharing + Polish (2-3 weeks)

**Goal:** Seamless integration with parent session

**New files:**

- `src/core/context/task-context.ts` → TaskContext interface and serialization

**Files to modify:**

- `src/tui/services/BackgroundTaskManager.ts` → Pass SIGMA session ID to child
- `src/tui/components/StatusBar.tsx` → Display background task status
- `src/tui/hooks/useOnboardingWizard.ts` → Use interactive tasks instead of prompts

**Deliverables:**

- SIGMA context inheritance (child can recall parent conversation)
- TUI status display for background tasks
- Graceful cancellation and error recovery
- Wizard spawns `/onboard-project` automatically (no manual handoff!)

**Success Metric:** Onboarding wizard works without breaking conversation flow

### 5.4 Phase 4: Production Hardening (2-3 weeks)

**Goal:** Reliability, testing, documentation

**Tasks:**

- Comprehensive test suite for IPC protocol
- Timeout handling and resource limits
- Error recovery (child crashes don't break parent)
- Logging and debugging infrastructure
- User documentation and examples
- Migration guide for existing slash commands

**Success Metric:** System is production-ready and documented

### 5.5 Phase 5: Agent Registry & Discovery (2-3 weeks) — FUTURE

**Goal:** Enable multiple specialized agents to cooperate

**New files:**

- `src/core/agents/AgentRegistry.ts` → Agent registration and discovery
- `src/core/agents/AgentHandle.ts` → Communication handle for remote agents
- `src/core/agents/types.ts` → Agent capability declarations

**Architecture:**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    SHARED LANCEDB INFRASTRUCTURE                             │
│  .sigma/                                                                     │
│  ├── conversations.lance   ← shared read (concurrent safe)                  │
│  ├── overlays.lance        ← shared read                                    │
│  └── agents/               ← per-agent state (isolated writes)              │
│       ├── tui-main.state.json                                               │
│       ├── sigma-worker.state.json                                           │
│       └── pgc-analyzer.state.json                                           │
└─────────────────────────────────────────────────────────────────────────────┘
         ▲                    ▲                    ▲
         │ read/write         │ read/write         │ read-only
    ┌────┴────┐          ┌────┴────┐          ┌────┴────┐
    │   TUI   │◄────────►│  SIGMA  │◄────────►│   PGC   │
    │  Agent  │   IPC    │  Agent  │   IPC    │  Agent  │
    │(user IO)│          │(memory) │          │(overlays)│
    └─────────┘          └─────────┘          └─────────┘
```

**Interface:**

```typescript
interface AgentRegistry {
  /** Register an agent with its capabilities */
  register(agentId: string, capabilities: AgentCapability[]): void;

  /** Find an agent that provides a capability */
  query(capability: string): AgentHandle | null;

  /** Broadcast message to all agents */
  broadcast(message: AgentMessage): void;

  /** List all registered agents */
  list(): AgentInfo[];
}

interface AgentCapability {
  name: string; // e.g., 'conversation-memory', 'project-structure', 'coherence'
  version: string;
  methods: string[]; // e.g., ['recall', 'search', 'embed']
}

interface AgentHandle {
  agentId: string;
  capabilities: AgentCapability[];
  request<T>(message: AgentMessage): Promise<T>;
  subscribe(eventType: string, callback: (event: AgentEvent) => void): void;
}
```

**Deliverables:**

- Agent registration on spawn
- Capability-based discovery
- Request/response IPC between agents
- Event subscription for async notifications

**Success Metric:** TUI agent can query SIGMA agent for context without direct coupling

### 5.6 Phase 6: Specialized Agent Types (3-4 weeks) — FUTURE

**Goal:** Define and implement specialized agents for massive codebases

**Agent Specializations:**

| Agent         | Role                            | Memory | Overlay Focus                |
| ------------- | ------------------------------- | ------ | ---------------------------- |
| **TUI**       | User interaction, streaming     | Low    | None (delegates)             |
| **SIGMA**     | Conversation memory, recall     | Medium | O1-O7 conversation           |
| **PGC**       | Project structure, dependencies | High   | O1 (Structure), O3 (Lineage) |
| **Security**  | CVE tracking, threat models     | Medium | O2 (Security)                |
| **Coherence** | Real-time drift detection       | Medium | O7 (Coherence scores)        |
| **Genesis**   | Overlay regeneration            | Burst  | All (on-demand)              |

**New files:**

- `src/agents/specialized/SigmaAgent.ts` → Conversation memory specialist
- `src/agents/specialized/PGCAgent.ts` → Project structure specialist
- `src/agents/specialized/CoherenceAgent.ts` → Drift detection specialist
- `src/agents/base/SpecializedAgent.ts` → Base class for specialized agents

**Example: SIGMA Agent**

```typescript
class SigmaAgent extends SpecializedAgent {
  capabilities = [
    {
      name: 'conversation-memory',
      version: '1.0',
      methods: ['recall', 'search', 'embed'],
    },
  ];

  async handleRequest(message: AgentMessage): Promise<AgentResponse> {
    switch (message.method) {
      case 'recall':
        return this.recallContext(message.params.query, message.params.k);
      case 'search':
        return this.semanticSearch(message.params.embedding);
      case 'embed':
        return this.generateEmbedding(message.params.text);
    }
  }
}
```

**Massive Codebase Benefits:**

- **Millions of files**: PGC agent pre-indexes AST, TUI stays responsive
- **Parallel analysis**: Multiple specialized agents work concurrently
- **Memory efficiency**: Each agent loads only its domain
- **Horizontal scaling**: Spawn more agents for larger repos

**Deliverables:**

- SIGMA agent (conversation memory)
- PGC agent (project structure)
- Coherence agent (drift detection)
- Agent lifecycle management (spawn, health check, terminate)

**Success Metric:** 1M+ file repo analyzed without TUI becoming unresponsive

---

## 5.7 Backward Compatibility & Migration

### Current Slash Commands (Without Frontmatter)

Existing slash commands in `.claude/commands/*.md` that lack frontmatter will:

1. **Continue working unchanged** - Run in parent TUI (current behavior)
2. **Optionally migrate** when ready - Add frontmatter to enable background execution

### Migration Path

**Step 1: Identify candidates**

```bash
# Find slash commands without frontmatter
for file in .claude/commands/*.md; do
  if ! head -1 "$file" | grep -q '^---$'; then
    echo "$file (no frontmatter)"
  fi
done
```

**Step 2: Add minimal frontmatter**

```markdown
---
permissions:
  tools: [read_file, grep, glob] # Start conservative
  autoApproveRisks: [safe]
  canEscalate: true # Allow escalation during migration
---

# Existing Command Content

...
```

**Step 3: Test in background mode**

```bash
cognition-cli tui --headless --command /my-command
```

**Step 4: Expand permissions**

Monitor which tools are escalated, add to `tools` list:

```yaml
permissions:
  tools: [read_file, grep, glob, bash] # Added bash after observing usage
  autoApproveRisks: [safe, moderate] # Gradually increase trust
```

### Fallback Behavior

If a slash command is invoked with `--headless` but lacks frontmatter:

```typescript
// Default permission manifest for commands without frontmatter
const DEFAULT_PERMISSIONS: PermissionManifest = {
  tools: [], // No tools allowed
  autoApproveRisks: [],
  canEscalate: true, // Escalate everything to user
  description: 'Legacy command (no frontmatter)',
};
```

This ensures:

- Legacy commands don't break
- Security-by-default (explicit opt-in for tools)
- Clear signal to add frontmatter

---

## 6. Success Criteria

### 6.1 Functional Requirements

- ✅ Main TUI can spawn slash commands as background tasks
- ✅ Background tasks can send `request_input` messages
- ✅ Main LLM or user can respond to requests
- ✅ Permissions are parsed from markdown frontmatter
- ✅ Safe operations auto-approve (no modals)
- ✅ Dangerous operations escalate to user
- ✅ Workflows execute without hardcoded logic
- ✅ Adding new slash command = just create `.md` file

### 6.2 Non-Functional Requirements

- **Performance**: IPC latency < 50ms
- **Reliability**: Task crashes don't crash main TUI
- **Security**: Permission violations are caught and logged
- **Extensibility**: System has zero knowledge of specific commands
- **Debuggability**: All IPC messages logged with context

---

## 7. Future Enhancements

### 7.1 Coherence Integration (Post-MVP)

Once interactive tasks work, integrate with file watcher and overlay regeneration:

```
User edits file
  ↓
File watcher detects change
  ↓
Spawn background task: /analyze-coherence-impact
  ↓
Task regenerates affected overlays
Task recomputes coherence score
  ↓
Main TUI shows:
  "⚠️ Coherence: 0.82 → 0.67 (-0.15)
   Reason: 3 O3 lineage breaks in auth module"
```

### 7.2 Command Composition

Allow slash commands to invoke other slash commands:

```markdown
---
# .claude/commands/full-analysis.md
permissions:
  tools: [execute_command]
  commands: [blast-radius, pr-analyze, coherence]
---

# Full Impact Analysis

Run comprehensive checks:

- /blast-radius ${symbol}
- /pr-analyze --branch ${branch}
- /coherence report
```

---

## 8. Open Questions

1. **Timeout Handling**: How long should parent wait for child response before timeout?
2. **Resource Limits**: Should we limit concurrent background tasks?
3. **Cancellation**: How should user cancel a running background task mid-execution?
4. **Error Recovery**: If child crashes, how should parent handle partial results?
5. **Logging**: Where should IPC messages be logged for debugging?
6. **Model Selection**: Should background tasks use a cheaper/faster model by default?
7. **Parallel Execution**: Can multiple slash commands run concurrently? How do they interact?
8. **Persistence**: If main TUI crashes, can background tasks resume?
9. **Testing**: How do we test IPC behavior in CI without spawning actual processes?

   **Proposed Solution:**
   - **Mock IPC Layer**: Create `MockIPCTransport` that simulates stdin/stdout without actual process spawning
   - **In-Process Headless Mode**: Add `--headless --test-mode` flag that runs headless TUI in same process with message interception
   - **Integration Tests**: Use actual process spawning in CI (slower but validates real behavior)

   ```typescript
   // Example: Mock IPC for unit tests
   class MockIPCTransport implements IPCTransport {
     send(message: ParentMessage): void {
       /* queue message */
     }
     receive(): ChildMessage | null {
       /* return from queue */
     }
   }

   // Example: In-process headless for integration tests
   class InProcessHeadlessAgent {
     constructor(private onMessage: (msg: ChildMessage) => void) {}
     sendToParent(msg: ChildMessage) {
       this.onMessage(msg);
     }
   }
   ```

---

## 9. Risks & Mitigations

| Risk                           | Impact                   | Mitigation                                  |
| ------------------------------ | ------------------------ | ------------------------------------------- |
| IPC protocol complexity        | High dev time            | Use proven protocol (JSON lines)            |
| Permission bypass              | Security issue           | Comprehensive test suite for guardian       |
| Child process hangs            | Poor UX                  | Implement timeouts, force-kill              |
| Headless TUI resource usage    | Memory/CPU overhead      | Monitor resource usage, optimize spawn time |
| Context inheritance complexity | Bugs, state leaks        | Clear separation, immutable context passing |
| Backward compatibility         | Breaks existing commands | Gradual migration, support both modes       |

---

## 10. Alternatives Considered

### 10.1 Direct Function Calls (Rejected)

**Reason**: No process isolation, shared state causes issues

### 10.2 Headless TUI Instance (SELECTED)

**Reason**: Best balance of complexity vs. functionality

**Why this approach wins:**

- Reuses battle-tested agent infrastructure (no new parser)
- All existing tools work immediately (SIGMA, overlays, genesis, etc.)
- Full LLM capabilities in background tasks
- Maintains flexibility (LLM interprets markdown naturally)
- IPC protocol handles communication cleanly

**Trade-offs:**

- Slightly higher resource usage per task (acceptable for CLI tool)
- Requires careful context inheritance design
- Need `--headless` mode implementation

**Revised from v1.0:** Originally rejected due to concerns about resource usage and complexity. Opus review highlighted that the benefits (infrastructure reuse, no custom parser) outweigh the modest resource cost for a CLI tool.

### 10.3 REST API (Rejected)

**Reason**: Overkill for local IPC, adds network overhead

### 10.4 Custom Workflow Parser (Rejected)

**Reason**: Too brittle, reinvents the wheel

This was the approach in v1.0 of this spec. It proposed:

- Deterministically parsing markdown (numbered lists → questions, code blocks → commands)
- Custom workflow executor
- New tool execution infrastructure

**Why it was rejected (Opus feedback):**

- Markdown is for humans, not machines (edge cases abound)
- LLM already interprets markdown naturally
- Would need to reimplement all existing tool support
- More development time, less flexible outcome

### 10.5 Shared Executors (Partial Adoption)

**Reason**: Good for simple cases, but doesn't support interactive workflows

---

## Appendix A: Example Markdown Files

See `../../.claude/commands/onboard-project.md` for full example.

---

## Revision History

### Version 1.3.2 (2025-12-01)

**Added:** Section 2.3 Hub-and-Spoke Topology

**Changes:**

- Added comprehensive Hub-and-Spoke architecture section
- Defined Hub responsibilities (Conversation Owner, Write Master, Orchestrator, etc.)
- Defined Spoke responsibilities (Task Execution, Turn Generation, Escalation, etc.)
- Added Information Flow diagram
- Added "Why Hub-and-Spoke?" comparison table
- Added Scaling Properties

**Rationale:** Solidify the core architectural pattern as a first-class design principle.

### Version 1.3.1 (2025-12-01)

**Clarification:** Embedding generation happens in Parent, not Child

**Change:**

- Section 3.5 IPC message updated: Child sends `turn: ConversationTurn`, NOT `embedding: number[]`
- Parent's AnalysisQueue generates embeddings (avoids sending large vectors via IPC)
- Added "Why not send embeddings via IPC?" rationale

**Rationale:** Embeddings are large (768-1536 dimensions). Sending them via IPC is wasteful when Parent's AnalysisQueue already has embedding infrastructure. Keeps IPC lightweight.

### Version 1.3 (2025-12-01)

**Amended by:** Claude Opus 4.5 (Multi-Agent Cooperative Architecture)

**Major Changes:**

1. **Section 3.4 Context Sharing AMENDED** - Added session isolation to prevent file conflicts
   - Child tasks use unique `taskAnchorId` for writes
   - Parent state accessed read-only
   - LanceDB shared (concurrent-read safe)

2. **Added Section 3.5: Write Coordination (Parent as Write Master)**
   - Child processes post analysis results via IPC
   - Parent queues writes to LanceDB (single writer)
   - Zero locking complexity, distributed analysis
   - Key insight from Gemini 3 Pro Preview review

3. **Added Phase 5: Agent Registry & Discovery** (Section 5.6)
   - `AgentRegistry` for agent registration and capability-based discovery
   - `AgentHandle` for IPC between agents
   - Event subscription for async notifications

4. **Added Phase 6: Specialized Agent Types** (Section 5.6)
   - Defined 6 agent specializations (TUI, SIGMA, PGC, Security, Coherence, Genesis)
   - Memory efficiency via domain specialization
   - Horizontal scaling for million-file repositories

5. **Updated Timeline** - Split into Core (8-12 weeks) and Multi-Agent (5-7 weeks future)

6. **Renumbered Section 5.5 → 5.7** (Backward Compatibility)

**Rationale:** Isolated sessions naturally extend to multi-agent cooperation. This enables:

- Specialized agents for massive codebases (1M+ files)
- Parallel overlay analysis without blocking TUI
- Memory efficiency via domain partitioning
- Foundation for "agent mesh" architecture

**Status:** Extended specification. Phase 1-4 unchanged and ready for implementation. Phase 5-6 are FUTURE roadmap items contingent on Phase 4 stability.

---

### Version 1.2 (2025-12-01)

**Reviewed by:** Claude Opus 4.5 (addressed 4 minor concerns from v1.1 review)

**Changes:**

1. **IPC stderr usage defined** (Section 3.3) - Structured logging on stderr, IPC protocol on stdout
2. **Fixed file paths** (Section 5.2) - Changed `src/agents/base/ToolExecutor.ts` → `src/tui/hooks/useAgent.ts`, `src/llm/providers/*`
3. **Added Section 5.5: Backward Compatibility & Migration** - Migration path for commands without frontmatter, fallback behavior
4. **Expanded Open Question #9** - Testing strategy with mock IPC layer, in-process headless mode, integration tests

**Status:** All v1.1 minor concerns addressed. Ready for implementation.

### Version 1.1 (2025-12-01)

**Reviewed by:** Claude Opus 4.5

**Major Changes:**

1. **Architecture shift:** Changed from custom workflow parser to headless TUI instances
2. **Markdown interpretation:** Clarified that markdown body is LLM prompt, not parsed deterministically
3. **Added sections:**
   - 3.4 Context Sharing (TaskContext interface)
   - Model selection in Permission Manifest
4. **Removed sections:**
   - 3.4 Workflow Parser (deterministic parsing approach)
5. **Updated Implementation Plan:**
   - Removed Phase 3 (Workflow Parser)
   - Revised timeline: 4 weeks → 8-12 weeks
   - Added Phase 4 (Production Hardening)
6. **Updated Alternatives:**
   - Changed 10.2 from "Rejected" to "SELECTED"
   - Added 10.4 Custom Workflow Parser (Rejected)
7. **Added Open Questions:** Model selection, parallel execution, persistence, testing

**Rationale:** Opus review identified that custom workflow parsing was brittle and reinvented the wheel. Headless TUI approach reuses existing infrastructure while maintaining flexibility.

### Version 1.0 (2025-12-01)

**Author:** Claude Sonnet 4.5

Initial specification with custom workflow parser approach.

---

**END OF SPECIFICATION**
