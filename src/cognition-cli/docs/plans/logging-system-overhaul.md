# Logging System Overhaul: From Console to Observer-Stream

## 1. Problem Statement

The current implementation of `src/sigma`, `src/ipc`, and `src/tui` uses standard `console.log`, `console.error`, and `console.warn` for diagnostic output. Because the TUI (React/Ink) manages the terminal screen buffer, these direct `console.*` calls cause:

- **Visual Artifacts:** Overwriting the UI layout.
- **Buffer Contention:** Flickering and "ghost" logs that disappear on UI refresh.
- **Loss of Diagnostics:** No persistent record of background operations (Lattice transforms, IPC messaging).

## 2. Proposed Architecture: Shadow-Bus Evolution

Instead of creating a new logging library, we will evolve the existing `src/utils/debug-logger.ts` to implement the Observer-Stream pattern. This preserves the existing 70+ `debugLog` calls while adding real-time TUI awareness.

### 2.1 The Evolved `debug-logger.ts`

The utility will be upgraded with an `EventEmitter` to broadcast logs as they happen.

```typescript
// Proposed Enhancement
export const logEmitter = new EventEmitter();

export function debugLog(message: string, data?: any) {
  // 1. Existing file-based logging (if --debug is on)
  // 2. Broadcast to Emitter
  logEmitter.emit('log', {
    timestamp: Date.now(),
    level: 'info',
    message,
    data,
  });
}
```

### 2.2 Subsystem Decoupling

- **Sigma/IPC/TUI:** Replace all direct `console.*` with `debugLog` or a new `systemLog` wrapper.
- **The "Silent" Shift:** By importing the existing utility, we ensure that logs are both persisted to `.open_cognition/debug-*.log` (for post-mortems) and available for real-time display.
- **TUI (The Sink):** The TUI subscribes to `logEmitter`. It filters and routes messages to:
  - **Status Bar:** Brief "info" updates.
  - **Error Overlays:** Critical "error" messages.
  - **Debug Console:** Full stream (optional toggle).

## 3. Implementation Roadmap

1. **Core Evolution:** Add `EventEmitter` to `src/utils/debug-logger.ts` and add `systemLog` / `logEmitter`.
2. **IPC Migration:** Update `src/ipc/BusCoordinator.ts` and related files to use `debugLog`.
3. **Sigma Migration:** Update `src/sigma/context-injector.ts` and other key services.
4. **TUI Log Sink:** Create a hook or component in the TUI to listen to `logEmitter` and update the UI state.

## 4. Design Benefits

- **Zero-Flicker TUI:** The UI remains stable.
- **Minimal Churn:** No massive renames; we reuse existing infrastructure.
- **Searchable History:** All logs are persisted to disk for "black box" post-mortem analysis.
- **Testability:** Unit tests can verify system behavior by asserting on log emissions via the emitter.
