# ADR-005: React-Based TUI with Ink

**Date**: 2025  
**Status**: Accepted  
**Deciders**: Core team

## Context

The Cognition CLI needed an interactive Terminal User Interface (TUI) for the Sigma system (infinite context AI conversations). Requirements:

1. **Real-time visualization** - Overlay stats, lattice metrics, token tracking
2. **Rich interactions** - Keyboard shortcuts, mouse support, text input
3. **Component composability** - Reusable UI elements (status bar, overlays bar, chat panel)
4. **State management** - Complex async operations (compression, turn analysis, session management)
5. **High FPS rendering** - Smooth updates without flicker
6. **Developer experience** - Familiar patterns for faster iteration

Traditional terminal libraries (blessed, blessed-contrib, curses) use imperative APIs that become unwieldy for stateful, interactive UIs. We needed a declarative framework that could handle complex state while maintaining performance.

## Decision

We chose **Ink (React for CLIs)** as the TUI framework:

**Stack:**

- **ink@6.4.0** - Core rendering engine
- **react@19.2.0** - Component lifecycle and hooks
- **ink-text-input@6.0.0** - Terminal text input component
- **@inkjs/ui@2.0.0** - Pre-built UI components (Spinner, etc.)

**Architecture:**

- Declarative React components with JSX
- Flexbox-based layout (`<Box flexDirection="row" gap={1}>`)
- Hook-based state management (`useState`, `useRef`, `useMemo`)
- `useInput()` for keyboard/mouse handling
- Custom hooks for complex logic (`useClaudeAgent`, `useCompression`, `useSessionManager`)

**Code Reference:**

- TUI entry point: `src/tui/index.tsx`
- Components: `src/tui/components/`
- Hooks: `src/tui/hooks/`

## Alternatives Considered

### Option 1: blessed (Low-Level Terminal Library)

- **Pros**: Mature, full-featured, low-level control, widely used
- **Cons**:
  - Imperative API (manual element manipulation)
  - No component model (no reusability)
  - Event-driven architecture (callback hell for complex state)
  - No built-in state management
  - Steep learning curve
- **Why rejected**: Too low-level; would require building component abstraction ourselves

### Option 2: blessed-contrib (Dashboard Widgets for blessed)

- **Pros**: Pre-built charts/dashboards, good for monitoring tools
- **Cons**:
  - Built on blessed (inherits imperatives API)
  - Widget-focused (not general-purpose UI)
  - Limited composability
  - Still requires manual state synchronization
- **Why rejected**: Not suited for interactive conversational UI

### Option 3: ncurses / node-ncurses

- **Pros**: C library standard, extremely performant
- **Cons**:
  - C bindings (FFI complexity)
  - Very low-level (manual cursor positioning, color codes)
  - No JavaScript abstractions
  - Platform compatibility issues
- **Why rejected**: Too low-level, poor developer experience

### Option 4: Charm (Bubble Tea - Go TUI Framework)

- **Pros**: Modern, composable, Elm-inspired architecture
- **Cons**:
  - Go language (would require separate binary)
  - IPC complexity (TypeScript CLI → Go TUI)
  - No JavaScript ecosystem integration
  - Additional build step
- **Why rejected**: Language barrier incompatible with TypeScript codebase

### Option 5: Raw ANSI Escape Codes

- **Pros**: Maximum control, zero dependencies
- **Cons**:
  - Extremely low-level (manual cursor, color, clear operations)
  - Platform differences (Windows vs. Unix)
  - No abstractions (would build Ink ourselves)
  - Mouse tracking manual implementation
- **Why rejected**: Reinventing the wheel; too much infrastructure overhead

## Rationale

Ink was chosen because it uniquely combines familiar patterns with terminal-native features:

### 1. React Paradigm (Familiar Developer Experience)

```typescript
// src/tui/components/StatusBar.tsx
export const StatusBar: React.FC<StatusBarProps> = ({
  sessionId,
  focused,
  tokenCount,
  compressionThreshold = 120000,
}) => {
  return (
    <Box borderTop borderColor="#30363d" paddingX={1} width="100%">
      <Text color="#8b949e">{buildStatusText()}</Text>
    </Box>
  );
};
```

**Benefits:**

- JSX declarative syntax (describe UI, not imperative steps)
- Component composition (reusable UI building blocks)
- Props for data flow (parent → child)

### 2. Hook-Based State Management

```typescript
// Complex async state in React hooks
const [messages, setMessages] = useState<ClaudeMessage[]>([]);
const [isThinking, setIsThinking] = useState(false);
const tokenCounter = useTokenCount();
const compression = useCompression({ tokenCount, ... });
const sessionManager = useSessionManager({ ... });
```

**Benefits:**

- Encapsulated state logic (hooks abstract complexity)
- No global state management needed (useState + useRef sufficient)
- `useRef` for stable references (prevent re-render loops)
- `useMemo` for performance (cached computations)

### 3. Flexbox Layout (Responsive Terminal UI)

```typescript
<Box
  flexDirection="row"
  justifyContent="space-between"
  width="100%"
  gap={1}
>
  <Text color="#58a6ff">{sigmaStats.nodes ?? 0} nodes 🕸️</Text>
  <Text color="#79c0ff">{sigmaStats.edges ?? 0} edges 🔗</Text>
</Box>
```

**Benefits:**

- No manual positioning (flexbox auto-layout)
- Responsive to terminal size (`stdout.rows`, `stdout.columns`)
- Gap, padding, margin work like CSS

### 4. Input Handling (Keyboard + Mouse)

```typescript
useInput(
  (input, key) => {
    if (key.ctrl && input === 'c') {
      process.kill(-process.pid, 'SIGKILL');
    } else if (key.tab) {
      setFocused((prev) => !prev);
    } else if (input === 'i' && !focused) {
      setShowInfoPanel((prev) => !prev);
    }
  },
  { isActive: true }
);
```

**Benefits:**

- Declarative keyboard handling (no event listener management)
- Key modifiers (`key.ctrl`, `key.shift`, `key.meta`)
- Arrow keys, Page Up/Down built-in

### 5. Performance Optimizations

```typescript
// 120 FPS rendering without flicker
render(<CognitionTUI {...options} />, {
  patchConsole: true,  // Prevent console.log from breaking UI
  maxFps: 120,         // Smooth updates
});

// Memoized rendering (prevent recomputation)
const allLines = useMemo(() => {
  return messages.flatMap(msg => processMessageLines(msg));
}, [messages, streamingPaste]);
```

**Benefits:**

- High FPS prevents flickering
- Memoization avoids unnecessary work
- Console patching prevents output mixing

## Consequences

### Positive

- **Familiar patterns** - React developers productive immediately
- **Component reusability** - StatusBar, OverlaysBar, ClaudePanel composable
- **Complex state** - Hooks abstract async compression, session management
- **High performance** - 120 FPS rendering, memoization prevents re-renders
- **Rich interactions** - Mouse tracking, keyboard shortcuts, text input
- **Maintainability** - Declarative code easier to reason about than imperative

### Negative

- **Bundle size** - React + Ink adds ~2-3 MB (acceptable for CLI tool)
- **Framework dependency** - Tied to Ink release cycle (currently v6.4.0)
- **React learning curve** - Developers unfamiliar with React must learn hooks
- **Limited terminal support** - Some features require modern terminals (mouse tracking)

### Neutral

- **Re-render performance** - Must use `useMemo`/`useCallback` carefully to avoid loops
- **Error handling** - React error boundaries needed for graceful failures
- **Testing complexity** - Component testing requires Ink test renderer

## Evidence

### Code Implementation

- TUI entry: `src/tui/index.tsx:1-500`
- Components:
  - `src/tui/components/OverlaysBar.tsx`
  - `src/tui/components/StatusBar.tsx`
  - `src/tui/components/ClaudePanelAgent.tsx`
- Hooks:
  - `src/tui/hooks/useClaudeAgent.ts:51-400`
  - `src/tui/hooks/compression/useCompression.ts`
  - `src/tui/hooks/session/useSessionManager.ts`
- CLI integration: `src/cli.ts:192-230`, `src/commands/tui.ts:18-78`

### Dependencies

From `package.json`:

```json
{
  "dependencies": {
    "ink": "^6.4.0",
    "react": "^19.2.0",
    "ink-text-input": "^6.0.0",
    "@inkjs/ui": "^2.0.0"
  }
}
```

### Documentation

- TUI architecture: `src/tui/README.md:134-139`
- Technology stack explanation
- Dual-lattice visualization design

### Performance Characteristics

From `index.tsx:59-68`:

```typescript
const chatAreaHeight = useMemo(() => {
  const terminalHeight = stdout?.rows || 24;
  const inputAndDropdownHeight = isDropdownVisible ? 9 : 1;
  const reservedHeight = 3 + inputAndDropdownHeight + 5;
  return Math.max(5, terminalHeight - reservedHeight);
}, [stdout?.rows, isDropdownVisible]);
```

Dynamic layout responds to terminal resize in real-time.

## Notes

**Why Not Just Use Console Logs?**

The Sigma system requires real-time visualization of:

- Token count approaching 120K threshold
- Turn analysis queue processing
- Overlay scores (O1-O7)
- Lattice statistics (nodes, edges, paradigm shifts)

Console logs are linear and ephemeral—TUI provides persistent, structured visualization.

**Alternative Considered: Web-Based UI**

A browser-based UI (Electron, web server) was considered but rejected because:

- Violates CLI-first philosophy
- Adds complexity (HTTP server, bundler)
- Breaks SSH/remote workflows
- Terminal is the natural environment for developers

**Performance Comparison:**

| Framework | Bundle Size | FPS | Flexbox | Hooks     | Mouse |
| --------- | ----------- | --- | ------- | --------- | ----- |
| Ink       | ~2.5 MB     | 120 | ✓       | ✓ (React) | ✓     |
| blessed   | ~200 KB     | ~30 | ✗       | ✗         | ✓     |
| ncurses   | ~50 KB      | ~60 | ✗       | ✗         | ✗     |

Ink trades bundle size for developer experience and feature richness.

**Future Enhancements:**

- Split panes (multiple conversations)
- Inline rendering of file diffs
- Graph visualization (dependency trees)
- Color themes (user-configurable)

**Related Decisions:**

- ADR-006 (Compression) - TUI displays compression progress
- ADR-008 (Session Continuity) - TUI handles session transitions
- ADR-009 (Quest System) - TUI could visualize quest workflows
