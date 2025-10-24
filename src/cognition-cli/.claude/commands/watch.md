# Watch File System Events

Monitor file changes in real-time and maintain PGC coherence state through event-driven tracking.

## Purpose

The file watcher is the **Event Source** for the PGC's event-driven architecture. It enables:

1. **Instant coherence checks** - Know immediately which files are dirty
2. **Incremental updates** - Update only changed files, not the entire codebase
3. **Multi-agent coordination** - Foundation for calculating context disturbance (Delta) when multiple agents work simultaneously
4. **Live state tracking** - Maintains `.open_cognition/dirty_state.json` automatically

## Command

```bash
cognition-cli watch [options]
```

### Options

- `--untracked` - Also watch for new untracked files (default: false)
- `--debounce <ms>` - Debounce delay in milliseconds (default: 300)
- `--verbose` - Show detailed change events including file hashes

## How It Works

### Monument 1: Event Source Architecture

```
┌─────────────────────────────────┐
│  File System (projectRoot/src)  │
└───────────┬─────────────────────┘
            │ fs.watch via chokidar
            ▼
┌─────────────────────────────────┐
│      FileWatcher                │
│  - Watches indexed files        │
│  - Detects changes              │
│  - Computes hashes              │
│  - Emits change events          │
└───────────┬─────────────────────┘
            │
            ▼
┌─────────────────────────────────┐
│   DirtyStateManager             │
│   Updates dirty_state.json      │
└─────────────────────────────────┘
```

### Dirty State File

Location: `.open_cognition/dirty_state.json`

Structure:
```json
{
  "last_updated": "2025-10-24T05:48:44.082Z",
  "dirty_files": [
    {
      "path": "src/core/config.ts",
      "tracked_hash": "a1b2c3d4...",
      "current_hash": "e5f6g7h8...",
      "detected_at": "2025-10-24T05:48:44.081Z",
      "change_type": "modified"
    }
  ],
  "untracked_files": [
    {
      "path": "src/new-feature.ts",
      "current_hash": "i9j0k1l2...",
      "detected_at": "2025-10-24T05:48:30.000Z"
    }
  ]
}
```

## Usage Patterns

### 1. Development Workflow

Run the watcher in a separate terminal during active development:

```bash
# Terminal 1: Start watcher
cognition-cli watch --verbose

# Terminal 2: Make changes
vim src/core/config.ts

# Terminal 1 output:
# ✗ src/core/config.ts (hash: e5f6g7h8)
# Detected change: src/core/config.ts
```

### 2. Background Daemon (Future)

```bash
# Start as background daemon
cognition-cli watch --daemon

# Continues running in background
# Updates dirty_state.json automatically
```

## What This Enables

### Instant Status Checks (Monument 2)

Instead of scanning all files:
```bash
cognition-cli status  # < 10ms - just reads dirty_state.json
```

### Incremental Updates (Monument 2)

Process only changed files:
```bash
cognition-cli update  # Only updates dirty files
```

### Multi-Agent Coordination (Monument 5)

When multiple AI agents work simultaneously:

```typescript
// Agent 1 modifies Config
// → change_event fired
// → Update Function calculates Delta
// → Agent 2's context overlap detected
// → Delta(Agent 2) > Delta_crit
// → Agent 2 paused & resynced
```

## Implementation Details

### Files Created

- `src/core/types/watcher.ts` - Type definitions
- `src/core/watcher/dirty-state.ts` - DirtyStateManager
- `src/core/watcher/file-watcher.ts` - FileWatcher class
- `src/commands/watch.ts` - CLI command

### Key Features

**Debouncing**: Rapid changes to the same file are batched (default: 300ms)

**Smart Watching**: Only watches files in PGC index (no wasted resources)

**Ignored Patterns**: Skips node_modules, .git, dist, build, etc.

**Event Emitter**: Extends EventEmitter for extensibility
```typescript
watcher.on('change', (event: ChangeEvent) => {
  // Custom handlers
});
```

**Hash-based Detection**: Uses same SHA-256 hashing as ObjectStore
```typescript
const currentHash = this.objectStore.computeHash(content);
if (currentHash !== indexData.content_hash) {
  // Mark as dirty
}
```

## Next Monuments

This is **Monument 1** of the event-driven architecture:

- ✅ **Monument 1**: Event Source (file watcher + dirty state)
- ⏳ **Monument 2**: Status & Update commands
- ⏳ **Monument 3**: Context Sampling (Sigma)
- ⏳ **Monument 4**: Field of View (FoV) measurement
- ⏳ **Monument 5**: Multi-agent coordination with Delta calculation

## Notes

- Currently uses JSON for dirty_state (simple, human-readable)
- Future: Migrate to LanceDB for lock-free concurrent access
- Watcher must be running for dirty_state to update
- Can manually inspect dirty_state.json at any time
- Safe to interrupt with Ctrl+C (graceful shutdown)

## Example Session

```bash
$ cognition-cli watch --verbose
🔭 Starting File Watcher
Project: /Users/user/src/my-project
PGC: /Users/user/src/my-project/.open_cognition

Starting file watcher for 59 files...
File watcher ready
✓ Watcher ready
Press Ctrl+C to stop

Watching for changes...

# User edits file
✗ src/core/config.ts (hash: e5f6g7h8)
Detected change: src/core/config.ts

# User creates new file
+ src/utils/helper.ts (hash: m3n4o5p6)
Detected new file: src/utils/helper.ts

^C
Stopping watcher...
✓ Watcher stopped
```

## Grounding

- File hashes are computed using ObjectStore.computeHash() (SHA-256)
- Only watches files present in `.open_cognition/index/`
- Change detection is hash-based, not timestamp-based
- All state is persisted to `.open_cognition/dirty_state.json`
- Foundation for CogX blueprint's Update Function (U) and Delta calculation
