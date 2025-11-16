# Cognition CLI TUI Roadmap

## Current State ✅

We have a working TUI with SIGMA infinite context:

- 🎨 Candy overlay status bar (🏗️🛡️🌳🎯⚙️📐🧭)
- 💬 Claude Agent SDK integration with SIGMA compression
- 📜 Scrollable conversation panel with arrow keys
- 🔧 Tool execution indicators with colorized diffs
- ⚡ Spinner for thinking state
- 🎯 Auto-permission approval for tools
- 🧠 **SIGMA**: 7-dimensional turn analysis, 30-50x compression, infinite context

## Vision: SIGMA Mission Control

The TUI should be **Mission Control** for project development—providing real-time coherence monitoring, project lattice integration, and quest-based workflows. Not just a chat interface, but an intelligent development dashboard.

---

## Phase 1: Coherence Dashboard 🎯 (High Impact, Medium Effort)

### Why This First?

- Builds on existing SIGMA analysis (turn-by-turn overlay tracking)
- Immediate value: "Am I building what I intended?"
- Teaches users to think in overlays before introducing quests
- Low risk, high visibility

### 1.1 Real-Time Coherence Monitoring

**Goal:** Show live alignment between conversation and project mission

**Features:**

```
┌─ SIGMA Mission Control ────────────────────────────┐
│ Session: implement-oauth2 (2h 15m)                 │
│ Coherence: ████████░░ 8.2/10 (Good)                │
│                                                     │
│ Active Overlays:                                   │
│ O1 Structural  █████████░ 9  ✓ High alignment     │
│ O2 Security    ████████░░ 8  ✓ On track           │
│ O4 Mission     ██████░░░░ 6  ⚠ Review VISION.md   │
│                                                     │
│ Context: 47 turns | 3 paradigm shifts | 12 important
│ Drift Alert: None                                  │
│ Next Compression: 35.2K tokens remaining           │
│                                                     │
│ [Ctrl+H] History  [Ctrl+C] Coherence  [Ctrl+M] Mission│
└─────────────────────────────────────────────────────┘
```

**Implementation:**

- Display overlay scores from last N turns (moving average)
- Alert when overlay scores drop below threshold (e.g., O4 < 5)
- Show paradigm shift count and compression status
- Toggle coherence panel: `Ctrl+C`

### 1.2 Coherence History View

**Keyboard shortcut:** `Ctrl+H`

Show recent turn classifications:

```
Coherence History (Last 20 turns)
═══════════════════════════════════════

Turn 42: "Let's add token rotation" ⭐ Paradigm Shift
  O1: 9 | O2: 9 | O4: 8 | O5: 7 → Importance: 9.2

Turn 43: "That's a good idea" ▫ Routine
  O1: 1 | O2: 0 | O4: 2 → Importance: 1.8

Turn 44: "Implement TokenRotationService" ⚡ Important
  O1: 8 | O2: 7 | O4: 6 | O5: 8 → Importance: 7.5

[↑↓] Navigate  [Enter] Show full analysis  [Esc] Close
```

### 1.3 Quick Coherence Actions

- **Re-align suggestion:** When O4 drops, suggest reviewing mission docs
- **Shortcuts:**
  - `Ctrl+M` - Open mission document (VISION.md, MISSION.md)
  - `Ctrl+R` - Show re-alignment suggestions
  - `Ctrl+D` - Show drift analysis (low-scoring recent turns)

---

## Phase 2: Project Lattice Integration 🔍 (Medium Impact, Low Effort)

### Why This Second?

- Quick wins after coherence monitoring
- Makes project knowledge actionable during conversation
- Prepares mental model for quest workflows

### 2.1 Background Project Monitoring

**Goal:** Proactive suggestions based on conversation + project lattice

**Features:**

```
You: Let's update the JWT expiry logic

💡 Project Context Detected:
  📊 O2 Security: "Token expiry should be 15min (SECURITY.md:42)"
  🏗️ O1 Structural: TokenManager.setExpiry() (src/auth/token.ts:67)
  🎯 O4 Mission: "Security-first design" (VISION.md:12)

🔧 Suggested Actions:
  [1] Open SECURITY.md section on tokens
  [2] View TokenManager implementation
  [3] Show related security tests

Press number to execute, or continue typing...
```

**Implementation:**

- Monitor conversation for code/architecture keywords
- Query project lattice (O1-O7) in background
- Surface relevant knowledge non-intrusively
- Clickable shortcuts (1-9) for quick actions

### 2.2 Quick Lattice Queries

**Slash commands:**

```
/ask <query>              - Query project lattice (existing command)
/coherence check          - Show current file coherence with mission
/mission show <concept>   - Show relevant mission principles
/find <symbol>            - Find code symbols in O1
/deps <file>              - Show dependencies from O3
/security <topic>         - Query O2 security guidelines
```

**Example interaction:**

```
You: /ask what is our auth strategy

🔍 Querying project lattice...

📊 Results from .open_cognition/:

O4 Mission Concepts (2 matches):
  • "OAuth2 with JWT tokens" (similarity: 0.92)
  • "15-minute access tokens, 7-day refresh" (similarity: 0.87)

O1 Structural Patterns (3 matches):
  • AuthService.authenticate() - implements OAuth2 flow
  • TokenManager.issueTokens() - generates JWT pairs
  • RefreshTokenStore - manages refresh token lifecycle

O2 Security Guidelines (1 match):
  • "httpOnly cookies for refresh tokens" (SECURITY.md:67)
```

### 2.3 File-Aware Context

When editing/discussing specific files:

```
🔍 Detected: Discussing src/auth/jwt.ts

📊 Project Knowledge:
  O1: JWT token generation & validation
  O2: Security critical - handles authentication
  O3: Used by 12 other modules
  O7: Coherence score: 8.5/10 with mission

💡 Related:
  • SECURITY.md: Token best practices
  • src/auth/refresh.ts: Related implementation
  • tests/auth/jwt.test.ts: Existing test coverage
```

---

## Phase 3: Operational Lattice (Quest Workflows) ⚡ (High Impact, High Effort)

### Why This Third?

- Requires coherence metrics to be meaningful
- Benefits from users already thinking in overlays
- Big payoff: quest-based development workflow

### 3.1 Quest Lifecycle Management

**Goal:** Track implementation work as structured quests with validation

**Quest States:**

- **Genesis:** Quest starts, branch created, initial coherence baseline
- **Transform:** Active development with coherence monitoring
- **Sacred Pause:** Validation checkpoints (tests, coherence review)
- **Complete:** Quest finishes, cPOW generated, wisdom extracted

**Command:**

```bash
# Start a quest
cognition-cli tui --quest "implement-oauth2-auth"

# Or start within TUI
/quest start implement-oauth2-auth
```

**UI:**

```
┌─ Quest: implement-oauth2-auth ──────────────────────┐
│ Status: 🔄 Transform (Active Development)           │
│ Duration: 4h 23m                                    │
│ Branch: feature/oauth2-auth                         │
│                                                     │
│ Progress: ████░░░░░░ 40%                            │
│ Milestones:                                         │
│   ✓ Design architecture                            │
│   → Implement core logic (current)                 │
│   ○ Write tests                                    │
│   ○ Integration testing                            │
│   ○ Documentation                                  │
│                                                     │
│ Coherence Tracking:                                │
│   O1 Structural: 9.1 avg (trending up ↗)          │
│   O2 Security:   8.5 avg (stable)                 │
│   O4 Mission:    7.8 avg (watch ⚠)                │
│                                                     │
│ Sacred Pause Available:                            │
│   ⚠ 15 architectural changes since last pause      │
│   💡 Suggested: Run tests & review coherence       │
│                                                     │
│ [Ctrl+Q] Quest details  [Ctrl+P] Sacred Pause      │
└─────────────────────────────────────────────────────┘
```

### 3.2 Sacred Pauses (Validation Checkpoints)

**Goal:** Automated validation prompts at strategic points

**Trigger conditions:**

- N architectural changes (e.g., 15 turns with O1 > 7)
- Coherence drop detected (any overlay < 5)
- Time-based (e.g., every 30 minutes)
- Manual: `Ctrl+P` or `/pause`

**Sacred Pause UI:**

```
🔔 Sacred Pause Suggested
═══════════════════════════════════════

You've made 15 architectural changes.
Time to validate your work.

Validation Checklist:
  [ ] Run unit tests
  [ ] Run integration tests
  [ ] Review coherence report
  [ ] Check security guidelines compliance
  [ ] Update documentation

Oracle Validation:
  🤖 I'll validate these aspects:
    • Coherence alignment with mission
    • Test coverage for new code
    • Security best practices adherence

[Enter] Start validation  [S] Skip  [C] Customize
```

### 3.3 Quest Completion & cPOW

**Goal:** Generate cryptographic Proof-of-Work for completed quests

**On quest completion:**

```
🎉 Quest Complete: implement-oauth2-auth
═══════════════════════════════════════

Summary:
  Duration: 6h 42m
  Turns: 127 (23 paradigm shifts, 68 important)
  Coherence: 8.7/10 average
  Files changed: 12 files, +850 -120 lines

Generating Proof-of-Work (cPOW)...
✓ Cryptographic hash: sha256:a7f9e3...
✓ Quest metadata signed
✓ Wisdom patterns extracted (3 reusable patterns)

Quest Artifacts:
  📄 .cogx/quests/implement-oauth2-auth.cpow
  📊 Coherence report saved
  💡 Wisdom patterns saved to library

Would you like to:
  [1] Create PR with quest summary
  [2] Export quest as .cogx package
  [3] Archive quest and continue
```

### 3.4 Wisdom Pattern Extraction

**Goal:** Extract reusable patterns from high-coherence quests

**After quest completion:**

```
💡 Wisdom Patterns Detected
═══════════════════════════════════════

Pattern 1: "Security-first API design"
  From turns: 12, 24, 45, 67
  Coherence: 9.2/10 (O2: 9.5, O4: 8.9)
  Reusability: High

  Key insights:
    • Always validate tokens before processing
    • Use httpOnly cookies for sensitive data
    • Implement rate limiting early

  [S] Save to pattern library
  [V] View full pattern
  [N] Next pattern

Saved patterns can be reused via:
  /pattern apply security-first-api
```

---

## Phase 4: Enhanced Overlay Interaction 🎨 (Medium Impact, Medium Effort)

### 4.1 Clickable/Selectable Overlays

**Goal:** Make overlays interactive, not just status indicators

Press `1-7` to select overlay, show details in sidebar:

```
┌─────────────────────┬───────────────────────────────┐
│ Claude Chat         │ 🏗️ O1: Structural (Selected) │
│ (main panel)        │ ─────────────────────────────│
│                     │ Project: 590 embeddings      │
│                     │ Conversation: 47 turns       │
│                     │ Coherence: 8.9/10 ✓          │
│                     │                              │
│                     │ Recent high-scoring turns:   │
│                     │ • Turn 42: Architecture      │
│                     │   redesign (9.2)             │
│                     │ • Turn 38: Component split   │
│                     │   (8.7)                      │
│                     │                              │
│                     │ [R] Regenerate [E] Export    │
└─────────────────────┴───────────────────────────────┘
```

### 4.2 Overlay Actions

- `R` - Regenerate selected overlay
- `E` - Export conversation analysis to file
- `V` - View full turn history for this overlay
- `Q` - Query this overlay specifically
- `C` - Compare project vs conversation overlay

---

## Phase 5: Visual Enhancements & Split Views 🎨

### 5.1 View Modes

Toggle with `Ctrl+V`:

- **Chat Mode** (current): Full-screen conversation
- **Dashboard Mode**: Overlays + coherence + chat (60/40 split)
- **Quest Mode**: Quest status + milestones + chat
- **Diff Mode**: Compare before/after compression

### 5.2 Better Visualization

- **Progress bars** for generation status
- **Sparklines** for coherence trends over time
- **Heat maps** for overlay coverage
- **Quest timeline** showing milestones

### 5.3 Keyboard Shortcuts

Core shortcuts:

- `Ctrl+C` - Toggle coherence panel
- `Ctrl+H` - Show coherence history
- `Ctrl+M` - Open mission document
- `Ctrl+Q` - Toggle quest panel
- `Ctrl+P` - Sacred pause (validation checkpoint)
- `Ctrl+V` - Cycle view modes
- `Ctrl+K` - Command palette (fuzzy search all commands)
- `Ctrl+/` - Show all shortcuts

---

## Phase 6: Intelligence Layer 🧠

### 6.1 Smart Suggestions

Context-aware suggestions based on conversation + lattice:

```
💡 Detected Pattern: Adding authentication logic

Based on your quest and project lattice:

Suggestions:
  • Review O2 security guidelines for auth (3 relevant docs)
  • Consider TokenManager pattern from similar implementation
  • Run security tests after making changes

Coherence Alert:
  • Your O4 mission score is dropping (6.2 → 5.8)
  • Consider: Does this align with "security-first" principle?
```

### 6.2 Drift Detection & Alerts

Proactive warnings:

```
⚠️ Coherence Drift Detected

Last 5 turns have O4 (Mission) scores < 5:
  Turn 67: 4.2 - "Add quick workaround"
  Turn 68: 3.8 - "Skip validation for now"
  Turn 69: 4.5 - "We'll fix it later"

💡 Recommendation:
  Review VISION.md principles before continuing.
  This pattern suggests deviation from project values.

[R] Review mission  [C] Continue anyway  [P] Pause
```

---

## Priority Order

### Sprint 1: Coherence Dashboard (Ship First) 🎯

1. Real-time coherence monitoring in status bar
2. `Ctrl+C` - Toggle coherence panel
3. `Ctrl+H` - Coherence history view
4. Drift alerts when overlay scores drop
5. Re-alignment suggestions (`Ctrl+M` to open mission docs)

**Success criteria:** Users can see "am I on track?" at a glance

### Sprint 2: Project Lattice Integration 🔍

1. Background project monitoring (auto-suggest relevant docs)
2. `/ask`, `/find`, `/deps` slash commands
3. File-aware context (show project knowledge for current file)
4. Quick action shortcuts (1-9 to execute suggestions)

**Success criteria:** Project knowledge surfaces automatically during conversation

### Sprint 3: Operational Quests ⚡

1. `/quest start` - Quest lifecycle management
2. Quest status panel (`Ctrl+Q`)
3. Sacred Pause validation checkpoints (`Ctrl+P`)
4. Quest completion with cPOW generation
5. Wisdom pattern extraction

**Success criteria:** Users track complex work as quests with validation gates

### Future Sprints

- Enhanced overlay interaction (clickable, detailed views)
- Visual enhancements (split views, sparklines, heatmaps)
- Intelligence layer (proactive suggestions, learning from usage)
- Advanced quest features (pattern library, .cogx packages)

---

## Technical Architecture

### Component Structure

```
src/tui/
├── components/
│   ├── OverlaysBar.tsx           (existing - enhance with coherence)
│   ├── ClaudePanel.tsx           (existing)
│   ├── CoherencePanel.tsx        (new - coherence dashboard)
│   ├── QuestPanel.tsx            (new - quest management)
│   ├── LatticeContext.tsx        (new - project knowledge sidebar)
│   └── CommandPalette.tsx        (new - Ctrl+K fuzzy finder)
├── hooks/
│   ├── useClaudeAgent.ts         (existing - already has SIGMA)
│   ├── useCoherence.ts           (new - coherence monitoring)
│   ├── useQuest.ts               (new - quest lifecycle)
│   ├── useLatticeQuery.ts        (new - project lattice queries)
│   └── useKeyboard.ts            (new - global shortcuts)
└── modes/
    ├── ChatMode.tsx              (current default)
    ├── DashboardMode.tsx         (new - coherence + overlays + chat)
    ├── QuestMode.tsx             (new - quest tracking + chat)
    └── DiffMode.tsx              (new - before/after comparison)
```

### Data Flow

```
User Input (conversation or command)
    ↓
SIGMA Analysis (existing)
  • Generate embeddings
  • Score overlays O1-O7
  • Classify: paradigm shift / important / routine
    ↓
    ├─→ Coherence Monitor (new)
    │     • Track moving average
    │     • Detect drift
    │     • Trigger alerts
    │
    ├─→ Quest Manager (new)
    │     • Update quest progress
    │     • Check sacred pause conditions
    │     • Track milestone completion
    │
    └─→ Lattice Query (new)
          • Background project monitoring
          • Auto-suggest relevant knowledge
          • Respond to slash commands
    ↓
Update UI State
    ↓
Render (CoherencePanel, QuestPanel, LatticeContext)
```

---

## Success Metrics

The TUI is "Mission Control" when:

1. ✅ Users can see real-time alignment with project mission (coherence scores)
2. ✅ Drift is detected early and users are prompted to re-align
3. ✅ Project knowledge surfaces automatically during conversation
4. ✅ Complex work is tracked as quests with validation gates
5. ✅ Users prefer TUI over separate CLI commands for development workflow

---

## Design Principles

- **Fast**: No operation blocks for >2s
- **Intelligent**: Proactive, not just reactive
- **Non-intrusive**: Suggestions, not interruptions
- **Transparent**: Show why coherence scores change
- **Empowering**: Users control workflow, TUI provides insight

**The Goal:** Transform Cognition CLI TUI from a chat interface into Mission Control—where developers monitor coherence, track quests, and leverage project knowledge in real-time.

---

**Status**: Phase 1 (Coherence Dashboard) - Ready to implement
**Last Updated**: November 5, 2025
**Next Milestone**: Ship real-time coherence monitoring
