# Event-Driven PGC Architecture for Multi-Agent Coordination

## Vision

The PGC isn't just a static knowledge graph - it's a **live, event-driven coordination system** for multiple AI agents working simultaneously on the same codebase.

## The Core Insight

Instead of scanning files for changes, we **listen to the filesystem** and maintain a **live dirty state**. This becomes the **event source** for:

1. Instant status checks
2. Incremental updates
3. **Multi-agent coordination** (the killer feature)

---

## Architecture

### Component 1: File System Watcher (Event Source)

**Purpose**: Emit `change_event` when source files are modified

````typescript
interface ChangeEvent {
  type: 'modified' | 'created' | 'deleted';
  path: string;
  timestamp: number;
  hash?: string;
}
```text

**Implementation**:

```bash
# Start watcher daemon
cognition-cli watch [--daemon]

# Watches all files in PGC index
# On change → emit event → update dirty_state.json
```text

**Technology Options**:

- Native `fs.watch()` (Node.js built-in)
- `chokidar` library (more reliable cross-platform)

---

### Component 2: Dirty State Tracker

**Purpose**: Maintain live record of files out of sync with PGC

**File**: `.open_cognition/dirty_state.json`

```json
{
  "last_updated": "2024-10-24T10:30:00Z",
  "dirty_files": [
    {
      "path": "src/core/config.ts",
      "tracked_hash": "a1b2c3d4...",
      "current_hash": "e5f6g7h8...",
      "detected_at": "2024-10-24T10:29:45Z",
      "change_type": "modified"
    },
    {
      "path": "src/utils/helper.ts",
      "tracked_hash": "i9j0k1l2...",
      "current_hash": "m3n4o5p6...",
      "detected_at": "2024-10-24T10:30:00Z",
      "change_type": "modified"
    }
  ],
  "untracked_files": [
    {
      "path": "src/new-feature.ts",
      "current_hash": "q7r8s9t0...",
      "detected_at": "2024-10-24T10:28:30Z"
    }
  ]
}
```text

**Operations**:

- **On change event**: Add file to dirty list
- **On update**: Remove file from dirty list
- **On status**: Read dirty list (instant!)

---

### Component 3: Status Command (Instant Read)

**Purpose**: Show coherence state by reading dirty_state.json

```bash
cognition-cli status
# Reads dirty_state.json (< 10ms)
# No file scanning needed!
```text

**Output**:

```text
PGC Status: INCOHERENT

Dirty Files (2):
  ✗ src/core/config.ts (modified 45s ago)
  ✗ src/utils/helper.ts (modified 30s ago)

Untracked Files (1):
  + src/new-feature.ts (created 2m ago)

Run 'cognition-cli update' to sync
```text

---

### Component 4: Update Function with Delta Calculation

**Purpose**: Sync PGC + calculate impact on other agents

```typescript
interface UpdateResult {
  updatedFiles: string[];
  blastRadius: BlastRadiusInfo;
  delta: ContextDisturbanceScore;
}

interface ContextDisturbanceScore {
  // For each active agent
  [agentId: string]: {
    score: number; // 0.0 to 1.0
    threshold: number; // Delta_crit
    action: 'continue' | 'pause_and_resync';
    affectedSymbols: string[];
  };
}
```text

**Algorithm**:

```typescript
async function update(options: UpdateOptions): Promise<UpdateResult> {
  // 1. Read dirty_state.json
  const dirtyFiles = await readDirtyState();

  // 2. For each dirty file:
  //    - Re-parse
  //    - Update PGC (objects, index, reverse_deps)
  //    - Calculate blast radius

  // 3. Calculate Delta for all active agents:
  //    - Get each agent's current context (symbols they're using)
  //    - Calculate overlap with blast radius
  //    - Score = (overlap / context_size)

  // 4. Emit coordination events:
  //    - For agents with Delta > Delta_crit:
  //      → Emit 'pause_and_resync' event

  // 5. Clear dirty_state.json

  return {
    updatedFiles,
    blastRadius,
    delta,
  };
}
```text

---

### Component 5: in-mem-fs (High-Speed Cache)

**Purpose**: Fast, in-memory representation of PGC for agent tasks

**Structure**:

```typescript
interface InMemoryFS {
  // Core PGC structures loaded into memory
  index: Map<string, IndexData>;
  objects: Map<string, Buffer>;
  reverseDeps: Map<string, ReverseDepsData>;

  // Overlay caches
  structuralPatterns: Map<string, PatternMetadata>;
  lineagePatterns: Map<string, LineageData>;

  // Live state
  dirtyFiles: Set<string>;

  // Event emitter for changes
  on(event: 'change', handler: (e: ChangeEvent) => void): void;
  on(event: 'delta_threshold_exceeded', handler: (e: DeltaEvent) => void): void;
}
```text

**Usage**:

```typescript
// Agent 1 starts task
const memfs = await InMemoryFS.load(pgcRoot);

// Agent 1 reads context
const context = await memfs.getSymbols(['Config', 'ToolRegistry']);

// Agent 2 starts task (shares same memfs)
// Agent 2 modifies Config

// Event fired → Delta calculated
// Agent 1's Delta > threshold → paused & resynced
```text

---

### Component 6: Multi-Agent Coordination Layer

**Purpose**: Coordinate multiple agents working on same codebase

**Workflow**:

```text
Agent 1 (Task: Refactor Config)
  ├─ Loads in-mem-fs
  ├─ Subscribes to change events
  └─ Working on: Config, ToolRegistry

Agent 2 (Task: Add new tool)
  ├─ Shares same in-mem-fs
  ├─ Subscribes to change events
  └─ Working on: ToolRegistry, BaseTool

Agent 1 modifies Config:
  → change_event fired
  → Update Function calculates Delta:
      - Agent 2's context overlaps with Config (via ToolRegistry)
      - Delta(Agent 2) = 0.85 > Delta_crit (0.7)
      - Action: PAUSE Agent 2

Agent 2 receives pause_and_resync event:
  → Saves current state
  → Reloads context from updated PGC
  → Resumes with fresh knowledge
```text

**Configuration**:

```typescript
interface CoordinationConfig {
  deltaCrit: number; // Default: 0.7
  resyncStrategy: 'pause' | 'notify' | 'auto';
  contextWindow: number; // How many symbols to track
}
```text

---

## Implementation Plan (2-3 hours)

### Hour 1: File Watcher + Dirty State

- [ ] Implement file watcher using `chokidar`
- [ ] Create `dirty_state.json` structure
- [ ] Build event emitter for change events
- [ ] Test: Modify file → see dirty_state update

### Hour 2: Status + Update

- [ ] Status command reads dirty_state (instant!)
- [ ] Update command processes dirty files
- [ ] Calculate blast radius from reverse_deps
- [ ] Clear dirty_state after update
- [ ] Test: Full workflow

### Hour 3: Delta Calculation Foundation

- [ ] Design Delta calculation algorithm
- [ ] Implement context overlap scoring
- [ ] Create agent coordination event types
- [ ] Document multi-agent workflow
- [ ] Test: Simulate 2 agents

---

## Files to Create

```text
src/
├── commands/
│   ├── watch.ts          (new - start file watcher)
│   ├── status.ts         (new - read dirty_state)
│   └── update.ts         (new - sync + calculate delta)
├── core/
│   ├── watcher/
│   │   ├── file-watcher.ts      (new - fs.watch wrapper)
│   │   ├── dirty-state.ts       (new - manage dirty_state.json)
│   │   └── change-emitter.ts    (new - event bus)
│   ├── coordination/
│   │   ├── delta-calculator.ts  (new - Delta calculation)
│   │   ├── agent-registry.ts    (new - track active agents)
│   │   └── coordinator.ts       (new - orchestrate pauses)
│   └── in-mem-fs/
│       ├── memory-fs.ts         (new - in-memory PGC)
│       └── cache-manager.ts     (new - cache strategies)
└── types/
    ├── coordination.ts   (new - Delta, events)
    └── watcher.ts        (new - ChangeEvent, DirtyState)
```text

---

## Benefits

✅ **Instant status** (< 10ms - just read JSON)
✅ **Event-driven updates** (no polling/scanning)
✅ **Multi-agent coordination** (prevent conflicts)
✅ **Quantifiable impact** (Delta score)
✅ **Scalable** (handles 100+ files efficiently)
✅ **Foundation for in-mem-fs** (fast agent operations)

---

## The Beautiful Part

Once this works, **multiple AI agents can work on the same codebase simultaneously** without stepping on each other's toes:

```bash
# Terminal 1: Agent 1 working on feature A
cognition-cli agent run --task="refactor Config class"

# Terminal 2: Agent 2 working on feature B
cognition-cli agent run --task="add new logging tool"

# They share in-mem-fs
# When Agent 1 changes Config (used by logging tool):
#   → Delta calculated
#   → Agent 2 automatically paused & resynced
#   → No conflicts, coherent collaboration

# This is the foundation for:
# - Agentic swarms
# - Parallel development
# - Cognitive Proof of Work (CPoW)
```text

This is **the coordination layer for the multi-agent future.** 🚀

---

**Next Step**: Start with file watcher + dirty_state (Hour 1)
````
