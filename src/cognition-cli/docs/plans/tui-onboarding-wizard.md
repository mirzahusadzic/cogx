# TUI Onboarding Wizard - Implementation Plan

## Problem Statement

Currently, onboarding a new repository to Cognition requires:

1. Running `cognition-cli init` (CLI-based)
2. Manually deselecting files (e.g., README.md)
3. Running genesis
4. Only then can the user launch TUI

This creates a chicken-and-egg problem: users want to use LLM (via TUI) to help create documentation, but TUI requires `.open_cognition` to exist first.

## Solution

Integrate the onboarding wizard directly into TUI. On first launch in a new repo (no `.open_cognition`), automatically show an onboarding flow.

## Prerequisites Detection

Before showing the onboarding wizard, validate:

| Prerequisite      | Detection Method                                      | Required For                      |
| ----------------- | ----------------------------------------------------- | --------------------------------- |
| Workbench         | `WORKBENCH_URL` env OR autodetect localhost:8000/8080 | Genesis (AST parsing, embeddings) |
| Workbench API Key | `WORKBENCH_API_KEY` env                               | Workbench authentication          |
| LLM Provider      | `--provider` flag OR default 'claude' + API key       | Doc co-creation (Step 4)          |

## Launch Flow

```
cognition-cli tui
        │
        ▼
┌───────────────────────┐
│ .open_cognition       │
│ exists?               │
└───────────────────────┘
        │
    ┌───┴───┐
    │       │
   YES      NO
    │       │
    ▼       ▼
Normal   Check Prerequisites
  TUI          │
               ▼
        ┌──────────────┐
        │ All OK?      │
        └──────────────┘
               │
           ┌───┴───┐
           │       │
          YES      NO
           │       │
           ▼       ▼
    Onboarding   Error Screen
      Wizard     (guidance)
```

## Onboarding Wizard Steps

### Step 1: Source Selection (Lightweight)

- Auto-detect source directories: `src/`, `lib/`, `packages/`, etc.
- Exclude by default: `node_modules/`, `vendor/`, `.git/`
- User confirms/modifies selection via checkbox UI
- Reuse: `CommandDropdown` pattern from existing TUI

### Step 2: Genesis (Code Index Creation)

- Run genesis on selected sources
- Show progress bar with file count
- Resumable via `GenesisCheckpoint` (already supported)
- Creates `.open_cognition/index/` with structural data

### Step 3: Documentation Discovery

- Scan for existing docs: `README*`, `docs/`, `*.md`, `ARCHITECTURE*`
- Present findings to user
- User selects what to include
- Exclude by default: `CHANGELOG.md`, `LICENSE.md`

### Step 4: LLM Co-Creation (Token-Efficient)

**Critical Insight**: For large repos (Linux kernel scale), we cannot feed raw source files to LLM.

**Strategy**:

- Generate summary using CLI tools:

  ```bash
  # Count files by directory
  ls .open_cognition/index/*.json | sed 's/_/\//g' | cut -d'/' -f2 | sort | uniq -c | sort -rn

  # Total count
  ls .open_cognition/index/*.json | wc -l
  ```

- Feed compact summary to LLM, NOT raw files
- LLM suggests overlay documentation based on structure
- User reviews/edits suggestions

**LLM Context** (~8KB vs 50MB+ raw):

```
This codebase has 44,810 files across 15 major subsystems:
- kernel/ (1,234 files): scheduler, memory management
- drivers/net/ (567 files): network device drivers
- fs/ (892 files): filesystem implementations
Key symbols: schedule(), kmalloc(), vfs_read(), ...
```

### Step 5: Overlay Generation

- Generate O1-O7 overlays from documentation + index
- Show progress indicator
- On completion: transition to normal TUI

## Overlay Progress Display (Design Decision)

**Challenge**: The current `OverlayOrchestrator` uses `@clack/prompts` (spinner, log) and `chalk` for CLI output. These are incompatible with TUI's Ink-based rendering.

### Options Considered

| Option                          | Approach                                          | Pros                      | Cons                                |
| ------------------------------- | ------------------------------------------------- | ------------------------- | ----------------------------------- |
| **A. PTY Spawn**                | Spawn overlay command via PTY, capture raw output | Preserves chalk colors    | Complex parsing, raw terminal codes |
| **B. Event Emitter**            | Refactor overlays to emit events                  | Clean, type-safe          | Major refactoring                   |
| **C. Progress Callbacks**       | Add callback params to orchestrator               | Minimal changes, reusable | Some orchestrator changes           |
| **D. Subprocess + Log Capture** | Spawn as child_process, strip ANSI                | Works with existing code  | Lose color formatting               |

### Recommended: Phased Approach

**Phase 1 (MVP)**: Option D - Subprocess + Log Capture

```typescript
// In TUI wizard step
const [logs, setLogs] = useState<string[]>([]);
const [error, setError] = useState<string | null>(null);

const proc = spawn('cognition-cli', [
  'overlay',
  'generate',
  '--type',
  'structural_patterns',
]);

proc.stdout.on('data', (data) => {
  const line = stripAnsi(data.toString());
  setLogs((prev) => [...prev.slice(-20), line]); // Keep last 20 lines
});

proc.stderr.on('data', (data) => {
  setError(stripAnsi(data.toString()));
});

proc.on('exit', (code) => {
  if (code === 0) onComplete();
  else setError(`Overlay generation failed (exit code ${code})`);
});
```

```tsx
// Render in TUI
<Box
  flexDirection="column"
  borderStyle="round"
  borderColor={error ? 'red' : 'cyan'}
>
  <Text bold>Step 5/5: Generating Overlays</Text>
  <Box height={10} flexDirection="column" overflow="hidden">
    {logs.map((line, i) => (
      <Text key={i} dimColor>
        {line}
      </Text>
    ))}
  </Box>
  {error && <Text color="red">{error}</Text>}
</Box>
```

**Phase 2 (Polish)**: Option C - Progress Callbacks

Add optional callback to `OverlayOrchestrator.run()`:

```typescript
// overlay.ts
interface OverlayProgress {
  phase: 'init' | 'processing' | 'embedding' | 'verifying' | 'complete' | 'error';
  overlayType: string;
  message: string;
  current?: number;
  total?: number;
  error?: Error;
}

async run(
  overlayType: string,
  options: RunOptions,
  onProgress?: (progress: OverlayProgress) => void
) {
  onProgress?.({ phase: 'init', overlayType, message: 'Starting...' });

  // Replace spinner.start() with:
  onProgress?.({ phase: 'processing', overlayType, message: 'Connecting to workbench...' });

  // Replace log.info() with:
  onProgress?.({
    phase: 'processing',
    overlayType,
    message: `Processing ${file}`,
    current: i,
    total: files.length
  });

  // On error:
  onProgress?.({ phase: 'error', overlayType, message: 'Failed', error: err });
}
```

Then in TUI:

```tsx
const [progress, setProgress] = useState<OverlayProgress | null>(null);

// Call orchestrator directly (no subprocess)
const orchestrator = await OverlayOrchestrator.create(projectRoot);
await orchestrator.run('structural_patterns', { force: false }, setProgress);

// Render
<Box
  borderStyle="round"
  borderColor={progress?.phase === 'error' ? 'red' : 'cyan'}
>
  <Text bold>Generating: {progress?.overlayType}</Text>
  <Text>{progress?.message}</Text>
  {progress?.total && (
    <ProgressBar current={progress.current} total={progress.total} />
  )}
</Box>;
```

### Error Handling Strategy

| Error Type                  | Display                    | Recovery                            |
| --------------------------- | -------------------------- | ----------------------------------- |
| Workbench connection failed | Red banner + retry button  | [R] Retry, [S] Skip this overlay    |
| Rate limit hit              | Yellow warning + auto-wait | Show countdown, auto-resume         |
| Embedding failed for file   | Log warning, continue      | Skip file, log to summary           |
| Critical failure            | Red banner + exit          | [Esc] Exit wizard, can resume later |

### UI Mockup: Overlay Generation with Errors

```
┌──────────────────────────────────────────────────────────────┐
│  Step 5/5: Generating Overlays                                │
│                                                              │
│  [✓] O1: Structural patterns (complete)                      │
│  [►] O2: Lineage patterns                                     │
│      ████████░░░░░░░░░░░░ 40% (156/390 symbols)              │
│      Processing: src/auth/AuthHandler.ts                      │
│  [ ] O3: Mission concepts                                     │
│  [ ] O7: Strategic coherence                                  │
│                                                              │
│  ⚠️  Warning: Rate limit approaching, slowing down...         │
│                                                              │
│  [Esc] Cancel (can resume later)                             │
└──────────────────────────────────────────────────────────────┘
```

```
┌──────────────────────────────────────────────────────────────┐
│  Step 5/5: Generating Overlays                                │
│                                                              │
│  [✓] O1: Structural patterns (complete)                      │
│  [✗] O2: Lineage patterns (failed)                           │
│                                                              │
│  ┌─ Error ─────────────────────────────────────────────────┐ │
│  │ Workbench connection lost after 156 symbols.            │ │
│  │ Partial progress saved. Can resume later.               │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                              │
│  [R] Retry O2  [S] Skip O2  [Esc] Exit                       │
└──────────────────────────────────────────────────────────────┘
```

## Implementation Progress

| Step                           | Status | Notes                                                                            |
| ------------------------------ | ------ | -------------------------------------------------------------------------------- |
| 1. Extract workbench detection | DONE   | Created `src/utils/workbench-detect.ts`, updated wizard.ts                       |
| 2. LLM provider check          | DONE   | Added `detectLLMProvider()`, `checkPrerequisites()`                              |
| 3. Modify tui.ts entry point   | DONE   | Prerequisites check, onboardingMode flag passed to TUI                           |
| 4. OnboardingWizard component  | DONE   | Created `src/tui/components/wizard/OnboardingWizard.tsx` with step state machine |
| 5. Source selection step       | DONE   | Created `SourceSelectionStep.tsx`, reuses `detectSources()` from CLI             |
| 6. Genesis progress step       | DONE   | Created `GenesisProgressStep.tsx`, subprocess + log capture approach             |
| 7. Doc discovery step          | DONE   | Created `DocDiscoveryStep.tsx`, reuses `detectSources()` docs detection          |
| 8. LLM co-creation step        | DONE   | Created `LLMCoCreationStep.tsx`, overlay selection UI (MVP)                      |
| 9. Overlay generation step     | DONE   | Created `OverlayGenerationStep.tsx`, sequential overlay generation               |
| 10. TUI conditional rendering  | DONE   | Added `onboardingComplete` state and wizard rendering in `index.tsx`             |

## Implementation Tasks

### Phase 1: Prerequisites & Entry Point

1. ~~Extract `autodetectWorkbench()` from `wizard.ts` to shared util~~ DONE
   - Created `src/utils/workbench-detect.ts` with:
     - `checkWorkbenchHealth()` - validate URL health
     - `autodetectWorkbench()` - probe common ports
     - `detectWorkbench()` - combined detection with env vars
   - Updated `wizard.ts` to import from shared util
2. ~~Add `checkLLMProvider()` helper function~~ DONE
   - Added to `src/utils/workbench-detect.ts`:
     - `detectLLMProvider()` - check ANTHROPIC_API_KEY / GEMINI_API_KEY
     - `checkPrerequisites()` - combined workbench + LLM check
   - Returns structured result with error messages
3. ~~Modify `tui.ts:114-119`~~ DONE
   - Instead of `process.exit(1)`, check prerequisites
   - If prerequisites met, set `onboardingMode = true`
   - Pass `onboardingMode` to `startTUI()`
   - Added `onboardingMode` prop to `CognitionTUIProps` interface

### Phase 2: OnboardingWizard Component

4. Create `src/tui/components/OnboardingWizard.tsx`
   - Reuse `Box` pattern from `ToolConfirmationModal`
   - State machine for wizard steps
5. Add conditional rendering in `CognitionTUI`:

   ```tsx
   if (onboardingMode) {
     return <OnboardingWizard onComplete={() => setOnboardingMode(false)} />;
   }
   ```

### Phase 3: Wizard Step Components

6. `SourceSelectionStep` - checkbox list (reuse `CommandDropdown`)
7. `GenesisProgressStep` - progress bar + file counter
8. `DocDiscoveryStep` - checkbox list for docs
9. `LLMCoCreationStep` - chat interface for doc generation
10. `OverlayGenerationStep` - progress + transition

## File Changes

### Phase 1 (MVP)

| File                                                  | Change                                                                     |
| ----------------------------------------------------- | -------------------------------------------------------------------------- |
| `src/commands/tui.ts`                                 | Remove `process.exit(1)`, add prerequisite checking, pass `onboardingMode` |
| `src/tui/index.tsx`                                   | Add conditional rendering for wizard vs normal TUI                         |
| `src/tui/components/OnboardingWizard.tsx`             | NEW: Main wizard container                                                 |
| `src/tui/components/wizard/SourceSelectionStep.tsx`   | NEW: Step 1 UI                                                             |
| `src/tui/components/wizard/GenesisProgressStep.tsx`   | NEW: Step 2 UI                                                             |
| `src/tui/components/wizard/DocDiscoveryStep.tsx`      | NEW: Step 3 UI                                                             |
| `src/tui/components/wizard/LLMCoCreationStep.tsx`     | NEW: Step 4 UI                                                             |
| `src/tui/components/wizard/OverlayGenerationStep.tsx` | NEW: Step 5 UI (subprocess + log capture)                                  |
| `src/utils/workbench-detect.ts`                       | NEW: Extracted from wizard.ts                                              |

### Phase 2 (Polish - Progress Callbacks)

| File                                                  | Change                                                               |
| ----------------------------------------------------- | -------------------------------------------------------------------- |
| `src/core/orchestrators/overlay.ts`                   | Add optional `onProgress` callback to `run()` method                 |
| `src/core/orchestrators/genesis.ts`                   | Add optional `onProgress` callback to `executeBottomUpAggregation()` |
| `src/tui/components/wizard/OverlayGenerationStep.tsx` | Refactor to use callbacks instead of subprocess                      |
| `src/tui/components/wizard/GenesisProgressStep.tsx`   | Refactor to use callbacks instead of subprocess                      |

## Reusable Patterns

From existing TUI components:

- `ToolConfirmationModal.tsx`: Box styling, keyboard handling, memoization
- `CommandDropdown.tsx`: Multi-option selection, scroll management
- `useToolConfirmation.ts`: Promise-based hook pattern for wizard steps

## UI Mockups

### Prerequisites Error Screen

```
┌──────────────────────────────────────────────────────────────┐
│  ⚠️  Cannot start onboarding                                  │
│                                                              │
│  Missing prerequisites:                                       │
│  ✗ Workbench not detected                                    │
│    → Set WORKBENCH_URL or start workbench on localhost:8000  │
│                                                              │
│  ✓ LLM Provider: claude (ANTHROPIC_API_KEY set)              │
│                                                              │
│  [Esc] Exit                                                   │
└──────────────────────────────────────────────────────────────┘
```

### Step 1: Source Selection

```
┌──────────────────────────────────────────────────────────────┐
│  Step 1/5: Source Selection                                   │
│                                                              │
│  Detected source directories:                                 │
│  [x] src/                    (234 files)                     │
│  [x] lib/                    (56 files)                      │
│  [ ] vendor/                 (1,234 files) [excluded]        │
│  [ ] node_modules/           (12,456 files) [excluded]       │
│                                                              │
│  [Space] Toggle  [↑↓] Navigate  [Enter] Confirm              │
└──────────────────────────────────────────────────────────────┘
```

### Step 2: Genesis Progress

```
┌──────────────────────────────────────────────────────────────┐
│  Step 2/5: Building Code Index                                │
│                                                              │
│  ████████████░░░░░░░░ 60%                                    │
│  Processing: src/components/Button.tsx                        │
│  (1,234 / 2,056 files)                                       │
│                                                              │
│  [Esc] Cancel (can resume later)                             │
└──────────────────────────────────────────────────────────────┘
```

### Step 4: LLM Co-Creation

```
┌──────────────────────────────────────────────────────────────┐
│  Step 4/5: Documentation Co-Creation                          │
│                                                              │
│  Based on your codebase structure:                            │
│  • 290 files across 12 directories                           │
│  • Key modules: auth, api, components, utils                 │
│                                                              │
│  Suggested overlay documentation:                             │
│  [x] O1: Architecture patterns                                │
│  [x] O2: Security guidelines                                  │
│  [x] O3: Dependency lineage                                   │
│  [ ] O4: Mission concepts (requires VISION.md)               │
│                                                              │
│  [D] Draft with LLM  [S] Skip  [Enter] Continue              │
└──────────────────────────────────────────────────────────────┘
```

## Open Questions

1. Should wizard state persist across TUI restarts? (resume interrupted onboarding)
2. Should we support partial onboarding (e.g., just genesis, skip overlays)?
3. How to handle LLM API failures during co-creation step?

## Success Criteria

- User can run `cognition-cli tui` in any new repo
- Prerequisites are validated automatically
- Onboarding wizard guides through all steps
- After completion, normal TUI loads with full overlay support
- Large repos (50K+ files) handled efficiently via summary-based LLM context
