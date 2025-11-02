# Cognition CLI TUI Roadmap

## Current State ✅

We have a working TUI with:

- 🎨 Candy overlay status bar (🏗️🛡️🌳🎯⚙️📐🧭)
- 💬 Claude Agent SDK integration (chat with Claude)
- 📜 Scrollable conversation panel with arrow keys
- 🔧 Tool execution indicators with colorized diffs
- ⚡ Spinner for thinking state
- 🎯 Auto-permission approval for tools

## Vision: Make it Useful for Cognition CLI

The TUI should be a **command center** for cognition-cli operations, not just a chat interface.

---

## Phase 1: Enhanced Overlay Interaction 🎯

### 1.1 Clickable/Selectable Overlays

**Goal:** Make overlays interactive, not just status indicators

**Features:**

- Select overlay with number keys (1-7) or arrow navigation
- Show detailed overlay info in a sidebar/panel:
  - Last updated timestamp
  - Item count with breakdown
  - Sample entries (top 5 items)
  - Quick actions: regenerate, clear, export

**UI Layout:**

```
┌─────────────────────────────────────────────────────────────┐
│ 🏗️ ✓590 | 🛡️ ✓74 | 🌳 ✓265 | ...      ⚡ COGNITION CLI        │
├─────────────────────┬───────────────────────────────────────┤
│ Claude Chat         │ 🏗️ Structural Patterns                │
│ (main panel)        │ ─────────────────────                 │
│                     │ • 590 embeddings                      │
│                     │ • Last updated: 2m ago                │
│                     │ • Top items:                          │
│                     │   - WorkspaceManager                  │
│                     │   - OverlayRegistry                   │
│                     │   - ... (3 more)                      │
│                     │                                       │
│                     │ [R] Regenerate [E] Export [C] Clear   │
└─────────────────────┴───────────────────────────────────────┘
```

### 1.2 Overlay Actions

- `R` - Regenerate selected overlay
- `E` - Export to file
- `C` - Clear overlay data
- `V` - View full list in pager
- `Q` - Query overlay (semantic search)

---

## Phase 2: Lattice Query Integration 🔍

### 2.1 Quick Query Mode

**Goal:** Query lattice directly from TUI without leaving

**Features:**

- `/query <text>` - Run semantic search across overlays
- `/find <symbol>` - Find code symbols
- `/relate <item1> <item2>` - Show relationships
- `/context <file>` - Get contextual embeddings

**UI:**

```text
> /query authentication flow
🔍 Searching across all overlays...

Results (12 found):
📊 O4: Mission Concepts
  1. "User authentication and authorization" (0.95)
  2. "OAuth2 flow implementation" (0.89)

🏗️ O1: Structural Patterns
  3. AuthService.authenticate() (0.87)
  4. TokenManager.validate() (0.85)

[Enter] View details  [↑↓] Navigate  [Esc] Back
```

### 2.2 Inline Context

- Show related items when discussing code
- Auto-suggest relevant overlays based on conversation
- Link overlay items in chat (clickable references)

---

## Phase 3: Workflow Shortcuts ⚡

### 3.1 Slash Commands

Make common operations instant:

```
/init              - Initialize new workspace
/gen <overlay>     - Generate specific overlay
/gen all           - Generate all overlays
/status            - Show detailed overlay status
/clean             - Clean stale data
/export <overlay>  - Export overlay to JSON
/import <file>     - Import overlay data
/sync              - Sync with workbench
/quest <name>      - Run a quest workflow
/proof <theorem>   - Validate mathematical proof
```

### 3.2 Interactive Workflows

- **Quest Mode**: Step-by-step guided workflows

  ```text
  > /quest onboarding

  🎯 Quest: New Developer Onboarding
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Step 1/5: Generate structural patterns
  [ ] Generate O1: Structural Patterns

  Press [Enter] to start...
  ```

- **Proof Validation**: Interactive theorem proving

  ```text
  > /proof "commutative property of overlay composition"

  📐 Theorem: O(f ∘ g) = O(g ∘ f)

  Checking axioms...
  ✓ Axiom 1: Identity preservation
  ✓ Axiom 2: Associativity
  ⚠ Lemma 3: Requires additional context

  [S] Show proof tree  [E] Edit assumptions
  ```

---

## Phase 4: Visual Enhancements 🎨

### 4.1 Better Overlay Visualization

- **Progress bars** for generation status
- **Sparklines** for historical data
- **Heat maps** for overlay coverage
- **Dependency graphs** (ASCII art)

### 4.2 Split View Modes

Toggle between layouts:

- **Chat mode**: Full-screen conversation (current)
- **Dashboard mode**: Overlays + stats + chat
- **Query mode**: Results + preview + filters
- **Diff mode**: Compare overlay versions

### 4.3 Color Themes

- Dark mode (current)
- Light mode
- High contrast
- Colorblind-friendly palettes

---

## Phase 5: Data Exploration 📊

### 5.1 Overlay Browser

Navigate through overlay data like a file tree:

```
🌳 O3: Lineage Patterns (265 items)
├─ src/
│  ├─ core/
│  │  ├─ workspace-manager.ts → 15 dependencies
│  │  │  ├─ imports: fs, path, OverlayRegistry
│  │  │  └─ used by: cli.ts, commands/init.ts
│  │  └─ overlay-registry.ts → 8 dependencies
│  └─ commands/
│     └─ overlay.ts → 12 dependencies
└─ tests/
   └─ ...

[Enter] Expand  [→] Show details  [/] Search
```

### 5.2 Relationship Viewer

Visualize connections between items:

```
WorkspaceManager
  │
  ├─ imports ──→ OverlayRegistry
  │              │
  │              ├─ imports ──→ EmbeddingManager
  │              └─ imports ──→ VectorStore
  │
  ├─ calls ────→ initWorkspace()
  └─ used by ──→ cli.ts
                 commands/init.ts
```

---

## Phase 6: Intelligence Layer 🧠

### 6.1 Smart Suggestions

Based on conversation context:

```
> How do I add a new overlay?

💡 Related:
  • O5: operational_patterns/adding-overlays.md
  • O1: OverlayRegistry.register()
  • O4: "Extending the overlay system"

🔧 Suggested Actions:
  [1] View overlay template
  [2] Generate boilerplate
  [3] Run example implementation
```

### 6.2 Context-Aware Commands

TUI learns from usage:

```
> generate embeddings for new files

🤖 I noticed you just added 3 new TypeScript files.
   Should I:
   [1] Generate O1 (structural) for new files only
   [2] Regenerate O1 for entire project
   [3] Update O3 (lineage) to include new imports

   [A] All of the above
```

### 6.3 Health Monitoring

Proactive issue detection:

```
⚠️ Warnings (2):
  • O7: Strategic Coherence not generated (low coverage)
  • O3: Lineage patterns outdated (7 days old)

🔄 Suggestions:
  • Run /gen O7 to improve semantic alignment
  • Run /gen O3 to update dependency graph
```

---

## Phase 7: Collaboration Features 🤝

### 7.1 Session Sharing

- Export TUI session as shareable link
- Resume conversation on different machine
- Share specific overlay queries/results

### 7.2 Multi-User Awareness

- Show who else is working in the workspace
- Real-time overlay update notifications
- Collaborative query sessions

---

## Phase 8: Performance & Polish ⚡

### 8.1 Performance

- Lazy load overlay data
- Cache frequently accessed items
- Debounce scroll updates
- Virtual scrolling for large results

### 8.2 Keyboard Shortcuts

- `Ctrl+P` - Command palette
- `Ctrl+O` - Quick overlay switcher
- `Ctrl+F` - Search in conversation
- `Ctrl+K` - Quick query
- `Ctrl+/` - Show all shortcuts
- `Esc` - Cancel/back

### 8.3 Accessibility

- Screen reader support
- Keyboard-only navigation
- Resize handling
- Copy/paste support

---

## Priority Order

**MVP (Ship first):**

1. Slash commands for common operations (/gen, /status, /query)
2. Clickable overlay selection (show detailed info)
3. Better tool output formatting
4. Query integration (/query, /find)

**Phase 2 (Near-term):** 5. Workflow shortcuts (/quest, /proof) 6. Split view modes 7. Overlay browser/explorer 8. Smart suggestions

**Phase 3 (Future):** 9. Visual enhancements (graphs, charts) 10. Collaboration features 11. Advanced intelligence layer

---

## Technical Decisions

### State Management

- Keep using React hooks for local state
- Add context for global TUI state (selected overlay, mode, etc.)
- Consider zustand for complex state if needed

### Component Architecture

```text
src/tui/
├── components/
│   ├── OverlaysBar.tsx        (existing)
│   ├── ClaudePanel.tsx        (existing)
│   ├── OverlayDetail.tsx      (new - detailed overlay view)
│   ├── QueryResults.tsx       (new - lattice query results)
│   ├── CommandPalette.tsx     (new - Ctrl+P fuzzy finder)
│   └── SplitView.tsx          (new - layout manager)
├── hooks/
│   ├── useClaudeAgent.ts      (existing)
│   ├── useOverlays.ts         (existing)
│   ├── useLatticeQuery.ts     (new - query integration)
│   ├── useCommands.ts         (new - slash command parser)
│   └── useKeyboard.ts         (new - global shortcuts)
└── modes/
    ├── ChatMode.tsx           (current default)
    ├── DashboardMode.tsx      (new - overview)
    ├── QueryMode.tsx          (new - search/explore)
    └── DiffMode.tsx           (new - comparison)
```

### Data Flow

```text
User Input
    ↓
Command Parser (/query, /gen, etc.)
    ↓
    ├─→ Claude Agent (chat)
    ├─→ Lattice Query (semantic search)
    ├─→ Overlay Manager (CRUD operations)
    └─→ Workflow Engine (quests, proofs)
    ↓
Update UI State
    ↓
Render Components
```

---

## Success Metrics

The TUI is "useful" when:

1. ✅ Users can query overlays without leaving the TUI
2. ✅ Common operations (gen, status, clean) are 1-2 keystrokes
3. ✅ Overlay data is explorable and actionable
4. ✅ Claude integration enhances (not replaces) overlay interaction
5. ✅ Users prefer TUI over separate CLI commands for workflow tasks

---

## Notes

- Keep it **fast**: No operation should block for >2s
- Keep it **simple**: Vim-like UX (powerful but learnable)
- Keep it **beautiful**: Polish matters for adoption
- Keep it **smart**: Context-aware, not just reactive

**The goal:** Make cognition-cli TUI the primary interface for working with the Cognitive Code Graph, not just a chat wrapper.
