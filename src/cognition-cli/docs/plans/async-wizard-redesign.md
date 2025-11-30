# Async TUI Wizard Redesign

## Problem Statement

The current TUI onboarding wizard (implemented per `tui-onboarding-wizard.md`) is **synchronous and blocking**:

1. **Hijacks the TUI** - When `onboardingMode && !onboardingComplete`, it renders a completely separate component tree, bypassing the normal TUI
2. **Hours to complete** - For large repos (even cognition-cli), regenerating all overlays takes hours
3. **Dead UI** - User cannot interact with the LLM while processing happens
4. **Not future-proof** - The upcoming UP (watch/update) functionality will need async delta regeneration across the overlay stack

## Solution: TUI as Host

The TUI stays alive at all times. Wizard operations happen **inside** the living TUI:

- Background workers handle heavy processing (genesis, overlay generation)
- Confirmation dialogs (reused as-is) prompt user between steps
- Header swaps branding for status when work is active
- Agent (LLM) can query background task state via a new tool

```
┌─────────────────────────────────────────────────────────────┐
│  ● Regenerating O3 architecture... 67%                      │ ← Header (status mode)
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Chat area (always responsive)                              │
│  User can talk to agent while background work runs          │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐    │
│  │ [!] Genesis complete. Generate O1 overlay? [Y/n]    │    │ ← Confirmation dialog
│  │     Y Allow | N Skip | Esc Cancel                   │    │   (reused component)
│  └─────────────────────────────────────────────────────┘    │
│  > User input area                                          │
├─────────────────────────────────────────────────────────────┤
│  Status bar (shortcuts, session info)                       │
└─────────────────────────────────────────────────────────────┘
```

## Core Architecture

### 0. CLI Output Redesign (PREREQUISITE)

**Problem**: Current `genesis` and `overlay generate` commands use chalk spinners and `@clack/prompts` which output ANSI escape codes, colors, and interactive terminal sequences. This is unparseable garbage for the TUI.

**Solution**: Use existing `--json` flag (or detect when stdout is not a TTY) to output structured JSON progress events.

#### Progress Event Protocol

```typescript
// Shared types for all commands
interface ProgressEvent {
  type: 'start' | 'progress' | 'complete' | 'error' | 'warning';
  timestamp: number; // Unix timestamp ms
  task: 'genesis' | string; // 'genesis' or overlay name like 'O3'
}

interface StartEvent extends ProgressEvent {
  type: 'start';
  total?: number; // Total items to process (if known)
  message: string; // "Starting genesis..." or "Generating O3 overlay..."
}

interface ProgressUpdateEvent extends ProgressEvent {
  type: 'progress';
  current: number; // Current item index
  total: number; // Total items
  percent: number; // 0-100
  message: string; // Current operation: "Processing src/foo.ts"
  file?: string; // Current file being processed
}

interface CompleteEvent extends ProgressEvent {
  type: 'complete';
  duration: number; // Total duration in ms
  stats?: Record<string, number>; // e.g., { files: 234, symbols: 1500 }
}

interface ErrorEvent extends ProgressEvent {
  type: 'error';
  message: string;
  recoverable: boolean; // Can we continue or must abort?
  details?: string; // Stack trace or additional info
}

interface WarningEvent extends ProgressEvent {
  type: 'warning';
  message: string; // "Rate limit approaching", "Skipped file X"
}
```

#### Example Output Stream

```jsonl
{"type":"start","timestamp":1701234567890,"task":"genesis","total":290,"message":"Starting genesis on 290 files..."}
{"type":"progress","timestamp":1701234567900,"task":"genesis","current":1,"total":290,"percent":0,"message":"Processing src/index.ts","file":"src/index.ts"}
{"type":"progress","timestamp":1701234567950,"task":"genesis","current":2,"total":290,"percent":1,"message":"Processing src/commands/init.ts","file":"src/commands/init.ts"}
...
{"type":"warning","timestamp":1701234570000,"task":"genesis","message":"Skipped binary file: assets/logo.png"}
...
{"type":"complete","timestamp":1701234600000,"task":"genesis","duration":32110,"stats":{"files":290,"symbols":4521}}
```

#### Implementation Changes

| File                                | Change                                                 |
| ----------------------------------- | ------------------------------------------------------ |
| `src/commands/genesis.ts`           | Use `--json` flag, emit JSON events instead of spinner |
| `src/commands/genesis-docs.ts`      | Use `--json` flag, emit JSON events instead of spinner |
| `src/commands/overlay.ts`           | Use `--json` flag, emit JSON events instead of spinner |
| `src/core/orchestrators/genesis.ts` | Add progress callback, remove direct console output    |
| `src/core/orchestrators/overlay.ts` | Add progress callback, remove direct console output    |
| `src/utils/progress-protocol.ts`    | NEW: Shared types and emit helpers                     |

#### Backward Compatibility

- Default behavior (TTY detected): Pretty output with chalk/spinners (unchanged)
- `--json` flag: JSON lines to stdout
- Non-TTY detected: Auto-switch to JSON (for subprocess usage)

```typescript
// In command handler
const isInteractive = process.stdout.isTTY && !options.json;

if (isInteractive) {
  // Use existing chalk/clack output
  spinner.start('Processing...');
} else {
  // Emit JSON events
  emitProgress({ type: 'start', task: 'genesis', ... });
}
```

#### TUI Consumption

```typescript
// BackgroundTaskManager.ts
const proc = spawn('cognition-cli', ['genesis', '--json']);

proc.stdout.on('data', (chunk) => {
  const lines = chunk.toString().split('\n').filter(Boolean);
  for (const line of lines) {
    try {
      const event: ProgressEvent = JSON.parse(line);
      this.handleProgressEvent(event);
    } catch {
      // Ignore non-JSON output (shouldn't happen with --json)
    }
  }
});

private handleProgressEvent(event: ProgressEvent) {
  switch (event.type) {
    case 'progress':
      this.updateTask(event.task, {
        progress: event.percent,
        message: event.message,
      });
      break;
    case 'complete':
      this.completeTask(event.task, event.stats);
      break;
    case 'error':
      this.failTask(event.task, event.message, event.recoverable);
      break;
  }
}
```

---

### 1. Background Task Manager

Central state manager for all background operations.

```typescript
// src/tui/services/BackgroundTaskManager.ts

interface BackgroundTask {
  id: string;
  type: 'genesis' | 'overlay';
  overlay?: string; // O1, O2, etc. (if type === 'overlay')
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress?: number; // 0-100 if available
  message?: string; // Current operation description
  startedAt: Date;
  completedAt?: Date;
  error?: string;
}

interface BackgroundTaskManager {
  // State
  tasks: BackgroundTask[];
  activeTask: BackgroundTask | null;

  // Operations
  startGenesis(sourceDirs: string[]): Promise<void>;
  startOverlay(overlayType: string): Promise<void>;
  cancelTask(taskId: string): void;

  // Subscriptions
  onTaskUpdate(callback: (task: BackgroundTask) => void): () => void;
  onTaskComplete(callback: (task: BackgroundTask) => void): () => void;
}
```

**Implementation**: Subprocess-based (matches existing genesis pattern)

- Spawn child process for each operation
- Parse stdout for progress updates
- Process isolation - crashes don't kill TUI
- Natural fit for CLI tooling

### 2. Agent Tool: `get_background_tasks`

Gives the LLM agent awareness of background operations.

```typescript
// Tool definition for agent SDK
{
  name: 'get_background_tasks',
  description: 'Query status of background operations (genesis, overlay generation, file watching)',
  input_schema: {
    type: 'object',
    properties: {
      filter: {
        type: 'string',
        enum: ['all', 'active', 'completed', 'failed'],
        default: 'all'
      }
    }
  }
}

// Tool response shape
interface BackgroundTasksResponse {
  tasks: BackgroundTask[];
  summary: {
    total: number;
    active: number;
    completed: number;
    failed: number;
  };
  // Future: watch state, dirty files, coherence info
}
```

**Future expansion** (same tool, growing scope):

- Watch/dirty state: "Files changed in `src/services/`, overlays O3 and O5 may need updates"
- Coherence detection: "These 3 files form a coherent change set"
- Update suggestions: "Delta detected, regeneration recommended for O2, O4"

### 3. Header Status Display

Modify `OverlaysBar.tsx` to swap content based on active work.

```typescript
// OverlaysBar.tsx

interface OverlaysBarProps {
  sigmaStats?: SigmaStats;
  activeTask?: BackgroundTask | null;  // NEW
}

export const OverlaysBar: React.FC<OverlaysBarProps> = ({ sigmaStats, activeTask }) => {
  return (
    <Box paddingX={1} borderBottom borderColor="#30363d" flexDirection="row" justifyContent="space-between" width="100%">
      {/* Left side: Lattice stats (unchanged) */}
      <Box flexDirection="row" gap={1}>
        {/* ... existing stats ... */}
      </Box>

      {/* Right side: Status OR Branding */}
      <Box>
        {activeTask ? (
          // Active work: show status
          <Text color="yellow">
            ● {activeTask.type === 'genesis' ? 'Genesis' : activeTask.overlay}: {activeTask.message || 'Processing...'} {activeTask.progress ? `${activeTask.progress}%` : ''}
          </Text>
        ) : (
          // Idle: show branding
          <Text bold color="cyan">
            COGNITION Σ CLI v{VERSION} 🧠
          </Text>
        )}
      </Box>
    </Box>
  );
};
```

### 4. Wizard Flow (Reusing Confirmation Dialog)

The wizard is NOT a separate component. It's a state machine that triggers confirmation dialogs.

```typescript
// src/tui/hooks/useOnboardingWizard.ts

type WizardStep =
  | 'detect' // Check if onboarding needed
  | 'confirm-genesis' // Ask to start genesis
  | 'genesis' // Genesis running in background
  | 'confirm-o1' // Ask to generate O1
  | 'o1' // O1 running
  | 'confirm-o2' // ... and so on
  | 'complete';

interface WizardState {
  step: WizardStep;
  sourceDirs?: string[];
  completedOverlays: string[];
  skippedOverlays: string[];
}

function useOnboardingWizard(taskManager: BackgroundTaskManager) {
  const [state, setState] = useState<WizardState>({
    step: 'detect',
    completedOverlays: [],
    skippedOverlays: [],
  });
  const { requestConfirmation } = useToolConfirmation(); // Reuse existing hook!

  // When a task completes, trigger next confirmation
  useEffect(() => {
    const unsubscribe = taskManager.onTaskComplete((task) => {
      if (task.status === 'completed') {
        advanceToNextStep(task);
      }
    });
    return unsubscribe;
  }, [taskManager]);

  const advanceToNextStep = async (completedTask: BackgroundTask) => {
    // Determine next overlay to generate
    const nextOverlay = getNextOverlay(state.completedOverlays);

    if (nextOverlay) {
      // Show confirmation dialog (REUSED!)
      const result = await requestConfirmation({
        toolName: `Generate ${nextOverlay}`,
        input: `${nextOverlay} overlay`,
        riskLevel: 'low',
        reason: `${completedTask.overlay || 'Genesis'} complete. Generate ${nextOverlay}?`,
      });

      if (result === 'allow') {
        taskManager.startOverlay(nextOverlay);
        setState((s) => ({ ...s, step: nextOverlay.toLowerCase() }));
      } else {
        setState((s) => ({
          ...s,
          skippedOverlays: [...s.skippedOverlays, nextOverlay],
          step:
            'confirm-' + getNextOverlay([...s.completedOverlays, nextOverlay]),
        }));
      }
    } else {
      setState((s) => ({ ...s, step: 'complete' }));
    }
  };

  return { state, startWizard };
}
```

**Key insight**: We literally reuse `useToolConfirmation()` and `ToolConfirmationModal`. Same component, same position, same keyboard handling. Just different content.

### 5. Overlay Generation Sequence

```
genesis → O1 (structural) → O2 (lineage) → O3 (architecture) → O4 (paradigm) → O5 (quest) → O6 (mission) → O7 (strategy)
```

Each step:

1. Previous task completes
2. Confirmation dialog appears: "Generate Ox? [Y/n]"
3. User confirms → task starts in background
4. TUI stays responsive throughout

### 6. Integration Points

```typescript
// src/tui/index.tsx - Main TUI

const CognitionTUI: React.FC<CognitionTUIProps> = (props) => {
  // Existing hooks
  const { confirmationState, requestConfirmation, allow, deny } = useToolConfirmation();
  const { loading, messages, isThinking } = useAgent({ /* ... */ });

  // NEW: Background task management
  const taskManager = useBackgroundTaskManager();
  const { activeTask } = taskManager;

  // NEW: Wizard flow (uses taskManager + requestConfirmation)
  const wizard = useOnboardingWizard(taskManager, requestConfirmation);

  // NEW: Register agent tool
  useEffect(() => {
    registerTool('get_background_tasks', () => ({
      tasks: taskManager.tasks,
      summary: {
        total: taskManager.tasks.length,
        active: taskManager.tasks.filter(t => t.status === 'running').length,
        completed: taskManager.tasks.filter(t => t.status === 'completed').length,
        failed: taskManager.tasks.filter(t => t.status === 'failed').length,
      }
    }));
  }, [taskManager.tasks]);

  return (
    <ThemeProvider theme={customTheme}>
      <Box flexDirection="column" width="100%" height="100%">
        {/* Header - now with activeTask */}
        <OverlaysBar sigmaStats={sigmaStats} activeTask={activeTask} />

        {/* Chat area - ALWAYS rendered, never hijacked */}
        <Box height={chatAreaHeight} overflow="hidden">
          <ClaudePanelAgent messages={messages} isThinking={isThinking} />
        </Box>

        {/* Input area - confirmation modal rendered here when needed */}
        <InputBox confirmationState={confirmationState} /* ... */ />

        {/* Status bar */}
        <StatusBar /* ... */ />
      </Box>
    </ThemeProvider>
  );
};
```

## Files to Change

### Delete (current wizard - to be replaced)

| File                                                  | Reason                  |
| ----------------------------------------------------- | ----------------------- |
| `src/tui/components/wizard/OnboardingWizard.tsx`      | Hijacks TUI             |
| `src/tui/components/wizard/SourceSelectionStep.tsx`   | Part of blocking wizard |
| `src/tui/components/wizard/GenesisProgressStep.tsx`   | Part of blocking wizard |
| `src/tui/components/wizard/DocDiscoveryStep.tsx`      | Part of blocking wizard |
| `src/tui/components/wizard/LLMCoCreationStep.tsx`     | Part of blocking wizard |
| `src/tui/components/wizard/OverlayGenerationStep.tsx` | Part of blocking wizard |
| `src/tui/components/wizard/index.ts`                  | Barrel export           |

### Create (new async system)

| File                                        | Purpose                                      |
| ------------------------------------------- | -------------------------------------------- |
| `src/utils/progress-protocol.ts`            | Shared progress event types and emit helpers |
| `src/tui/services/BackgroundTaskManager.ts` | Task state + subprocess spawning             |
| `src/tui/hooks/useBackgroundTaskManager.ts` | React hook wrapper                           |
| `src/tui/hooks/useOnboardingWizard.ts`      | Wizard state machine                         |
| `src/tui/tools/getBackgroundTasks.ts`       | Agent tool definition                        |

### Modify (CLI output redesign)

| File                                | Change                                                  |
| ----------------------------------- | ------------------------------------------------------- |
| `src/commands/genesis.ts`           | Add `--json` flag, conditional output mode              |
| `src/commands/genesis-docs.ts`      | Add `--json` flag, conditional output mode              |
| `src/commands/overlay.ts`           | Add `--json` flag, conditional output mode              |
| `src/core/orchestrators/genesis.ts` | Add `onProgress` callback, remove direct console output |
| `src/core/orchestrators/overlay.ts` | Add `onProgress` callback, remove direct console output |

### Modify

| File                                 | Change                                                     |
| ------------------------------------ | ---------------------------------------------------------- |
| `src/tui/components/OverlaysBar.tsx` | Add `activeTask` prop, conditional rendering               |
| `src/tui/index.tsx`                  | Remove wizard hijack, integrate task manager + wizard hook |
| `src/commands/tui.ts`                | Remove onboardingMode flag (no longer needed)              |

## Implementation Order

### Phase 0: CLI Output Redesign (PREREQUISITE)

1. **Progress protocol types** - Create `src/utils/progress-protocol.ts` with shared types
2. **Genesis command** - Add `--progress-json` flag, refactor orchestrator for callbacks
3. **Overlay command** - Add `--progress-json` flag, refactor orchestrator for callbacks
4. **Test CLI changes** - Verify JSON output works standalone before TUI integration

### Phase 1: TUI Foundation

5. **BackgroundTaskManager** - Core state + subprocess management (consumes JSON events)
6. **useBackgroundTaskManager** - React hook wrapper
7. **OverlaysBar modification** - Status display swap (branding ↔ status)

### Phase 2: Wizard Flow

8. **useOnboardingWizard** - State machine using existing confirmation dialog
9. **Integration in index.tsx** - Wire everything together
10. **Remove old wizard** - Delete blocking components

### Phase 3: Agent Integration

11. **get_background_tasks tool** - Register with agent SDK
12. **Testing** - End-to-end wizard + agent awareness

### Phase 4: Polish

13. **Error handling** - Retry, skip, cancel flows
14. **UX refinement** - Progress display formatting, edge cases

## Open Questions

1. **Source selection UX** - How does user select source dirs in async model?
   - Option A: Initial dialog before genesis
   - Option B: Default to detected sources, user can re-run with different sources later
   - **Recommendation**: Option B for simplicity. First run uses auto-detection.

2. **Wizard resume** - If user exits mid-wizard, how to resume?
   - Option A: Persist wizard state to `.open_cognition/wizard-state.json`
   - Option B: Re-detect on next launch, skip completed overlays
   - **Recommendation**: Option B. Check which overlays exist, only offer missing ones.

3. **Concurrent overlays** - Should we allow multiple overlays generating at once?
   - For MVP: No. Sequential is simpler, avoids resource contention.
   - Future: Could parallelize independent overlays (O1, O3 don't depend on each other).

## Success Criteria

### Phase 0: CLI Output

- [x] `src/utils/progress-protocol.ts` created with types and helpers
- [x] `cognition-cli genesis --json` outputs JSON lines
- [x] `cognition-cli genesis:docs --json` outputs JSON lines
- [x] `cognition-cli overlay generate --json` outputs JSON lines
- [x] Interactive mode (TTY) still works with chalk/spinners
- [x] Non-TTY auto-detects and uses JSON output

### Phase 1-4: TUI Async Wizard

- [ ] TUI stays responsive during all background operations
- [ ] User can chat with agent while overlays generate
- [ ] Agent can query background task status via tool
- [ ] Wizard uses existing confirmation dialog (no new modal code)
- [ ] Header shows status when processing, branding when idle
- [ ] Works for large repos (hours-long operations)
- [ ] Foundation ready for UP (watch/update) functionality
