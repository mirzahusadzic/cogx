# Cognition CLI TUI

Interactive terminal UI with Claude integration.

## Usage

```bash
# Launch TUI (overlays only)
cognition-cli tui

# Launch with Claude session
cognition-cli tui --session-id <uuid>

# Custom workbench URL
cognition-cli tui --workbench http://localhost:8000
```

## Layout

```
┌──────────────────────────────────────────────────┐
│ O1:✓590 | O2:✓234 | O3:○ | O4:✓89 | O5:✓12 | ... │ <- Overlay status bar
├──────────────────────────────────────────────────┤
│                                                  │
│ Claude Session (streaming output)                │ <- Main panel
│                                                  │
│ ● Analyzing O2 security items...                 │
│                                                  │
│ I found 234 security items.                      │
│                                                  │
│ ◆ Use Read tool on O2/CVE.yaml?                  │
│   [y/n]: _                                       │
│                                                  │
├──────────────────────────────────────────────────┤
│ [Tab] Focus Claude | [Ctrl+C] Quit | abc123      │ <- Status bar
└──────────────────────────────────────────────────┘
```

## Controls

- **Tab** - Toggle focus to Claude panel (send input to Claude)
- **Ctrl+C** - Quit TUI
- When focused: All input goes to Claude PTY (including y/n for tool approvals)

## Features

- ✅ Real-time overlay status
- ✅ Streaming Claude output (via PTY)
- ✅ Tool approval prompts work
- ✅ No flickering (ink handles rendering)
- ✅ Clean vertical layout

## Architecture

- **ink** - React for CLIs (rendering)
- **node-pty** - Pseudo-terminal for Claude session
- **Components**:
  - `OverlaysBar` - Top status bar
  - `ClaudePanel` - Main streaming output
  - `StatusBar` - Bottom help text
- **Hooks**:
  - `useClaude` - PTY management
  - `useOverlays` - Data loading

## Next Steps

- [ ] Add command input field
- [ ] Lattice query execution
- [ ] Results panel
- [ ] Claude command shortcuts (/ask, /quest-start, etc.)
