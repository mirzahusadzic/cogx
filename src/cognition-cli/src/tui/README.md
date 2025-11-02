# Cognition CLI - Interactive TUI

## Vision: Cognitive Computing Framework

Cognition CLI is a **cognitive computing framework** that integrates structured
knowledge systems with AI reasoning. It's built on the principle that AI should
be **one layer** in a larger cognitive architecture, not the sole centerpiece.

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

### Core Architecture

The framework consists of three primary layers:

1. **Knowledge Layer**: Structured overlays (O1-O7) representing different
   cognitive dimensions
   - O1: Structural Patterns - System architecture and design patterns
   - O2: Security Guidelines - Security principles and best practices
   - O3: Lineage Patterns - Dependencies and historical evolution
   - O4: Mission Concepts - Goals, objectives, and success criteria
   - O5: Operational Patterns - Workflows and process automation
   - O6: Mathematical Proofs - Formal verification and correctness
   - O7: Strategic Coherence - Long-term planning and consistency

2. **Relationship Layer**: Entity lattice for tracking dependencies, relationships,
   and semantic connections across the knowledge graph

3. **Reasoning Layer**: AI integration via Claude Code SDK, providing natural
   language understanding and generation capabilities

### Integration with Claude Code

This TUI integrates with **Claude Code via the official Agent SDK**, using Claude
as the reasoning component within our cognitive framework. This is a
**complementary** approach, not competitive:

- **We leverage**: Anthropic's world-class language model and reasoning capabilities
- **We add**: Structured knowledge graphs providing domain-specific intelligence
- **We demonstrate**: How AI + structured knowledge creates more coherent interactions

### Research Goals

Our research explores:

1. **Natural Language Command Compilation (Planned - L1 Query Entity Deconstructor)**
   - Translating natural language queries to structured CLI commands
   - Semantic caching to reduce redundant processing
   - Entity-aware query understanding

2. **Relevance-Based Context Management (Planned - Context Sampling Sigma)**
   - Intelligent context selection based on semantic relevance vs token limits
   - Overlay-aware context understanding what information is actually important
   - Dynamic context reconstruction from knowledge graphs
   - Estimated 2-3x reduction in token usage while maintaining coherence

### Why This Matters

Traditional AI interactions are **stateless** - each conversation starts fresh or
carries linear context. Our approach makes interactions **stateful** through
structured knowledge:

- **Overlays** provide multi-dimensional understanding
- **Lattice** tracks relationships and dependencies
- **AI reasoning** operates on this structured foundation

This creates more coherent, context-aware interactions while using fewer tokens -
benefiting both users (lower costs) and providers (reduced compute).

## Current Features (88 Total)

The interactive TUI demonstrates these principles with:

- Real-time overlay status visualization (O1-O7 with emoji icons)
- Conversation with Claude via official Agent SDK
- Token usage tracking with 200K context limit monitoring
- Mouse/trackpad scrolling with auto-focus
- Keyboard shortcuts (ESC ESC to clear, ESC to interrupt)
- Colorized diff display for code changes
- Error boundaries for stable development
- Hot reload support for rapid iteration

See the main commit for the complete 88-feature list organized by category.

## Features

- ✅ Real-time overlay status with visual indicators
- ✅ Streaming Claude output via Agent SDK
- ✅ Auto-approve tool execution
- ✅ Token usage tracking (input + output + cache)
- ✅ Mouse/trackpad scrolling
- ✅ Keyboard shortcuts and interrupt support
- ✅ No flickering (optimized rendering)
- ✅ Clean vertical layout

## Architecture

- **ink** - React for CLIs (rendering)
- **@anthropic-ai/claude-agent-sdk** - Official Claude integration
- **Components**:
  - `OverlaysBar` - Top status bar with overlay indicators
  - `ClaudePanelAgent` - Scrollable conversation panel
  - `InputBox` - Message input with ESC shortcuts
  - `StatusBar` - Bottom bar with token tracking
- **Hooks**:
  - `useClaudeAgent` - SDK message streaming and tool handling
  - `useOverlays` - Overlay data loading from registry
  - `useMouse` - stdin event interception for scrolling

## Future Vision

### Phase 1: Natural Language Query Interface

Implement L1 query entity deconstructor to translate natural language to CLI
commands:

```text
User: "What's the coherence state of the auth module?"
System: Translates to: cognition-cli ask --entity auth --overlay O7
System: Executes command, returns structured result + Claude refinement
```

### Phase 2: Context Sampling Sigma

Implement intelligent context management that:

- Monitors token usage approaching limits
- Uses overlay structure to determine relevance
- Reconstructs context from knowledge graph vs linear history
- Enables "infinite" context feel while optimizing token usage

### Phase 3: Integration Feedback

Share findings with Anthropic to potentially integrate these concepts into Claude
Code 2.0, benefiting the entire AI-assisted development ecosystem.

## Collaboration

We believe this research advances the field of AI-assisted development. We're
using Anthropic's Claude Agent SDK properly and respectfully, and we're excited
to share our findings with the community.

**Contact**: <mirza.husadzic@proton.me>

If you're from Anthropic and interested in discussing this research, we'd love to
collaborate on making AI + structured knowledge systems more accessible to
developers.

---

**Note**: This is active research exploring cognitive computing architectures. The
TUI serves as a demonstration platform for these concepts. Claude Code remains an
excellent tool for general AI-assisted development - this framework addresses the
specific domain of cognitive computing with structured knowledge systems.
