# Task: TUI Enhancement, Bug Fixes & PGC Integration

## Context

You are working on the Cognition Σ CLI - a sophisticated TypeScript/Node.js tool that builds verifiable knowledge graphs of codebases. The TUI (Terminal User Interface) is the primary interactive interface, built with React Ink.

Working Directory: ~/src/cogx/src/cognition-cli
Known Issues (User Reports)

Users have reported several pain points:

    Copy-paste is broken - When typing text and then pasting, the content gets mixed/corrupted
    Single-line input has issues - Input handling breaks in certain scenarios
    File watcher doesn't track new files - Only monitors existing files, misses newly created ones
    TUI feels disconnected from PGC - No visibility into coherence scores, quest progress, overlay health, or file watcher status

What Is the PGC?

The Project Grounded Context (PGC) is the core knowledge graph system with:

    Seven Overlays (O1-O7): Structural, Security, Lineage, Mission, Operational, Mathematical, Coherence
    Coherence System: Detects semantic drift between code and documentation
    Quest System: Tracks development tasks and goals
    File Watchers: Monitors changes to trigger re-analysis

The TUI should be a window into this living system, but currently it's mostly disconnected.
Phase 1: Exploration & Understanding (60 min)
Understand the TUI Architecture

Your mission: Explore and map out how the TUI currently works.

    Read the documentation first:
        Start with docs/architecture/ - understand the overall system
        Look for TUI-specific documentation
        Read any ADRs (Architecture Decision Records) related to TUI

    Explore the TUI codebase:
        Where is the TUI entry point? (src/tui/?)
        What is the component structure?
        What hooks exist? (src/tui/hooks/?)
        How is state managed?
        What React Ink patterns are used?

    Understand input handling:
        Find where keyboard input is processed
        How is text input managed?
        Are there custom input components or using Ink's built-in?
        What is the state flow for user input?

    Map the current PGC integration:
        Does the TUI currently interact with PGC at all?
        Which PGC systems are accessible from TUI?
        Are there any existing hooks or utilities for PGC access?

Deliverable: Write a brief architecture summary - how the TUI is structured, what you found.
Phase 2: Bug Investigation (45 min)
Investigate the Reported Bugs

Your mission: Don't just fix - understand WHY these bugs exist.
Bug 1: Copy-Paste Corruption

    Find the input handling code

    Understand the flow: What happens when user types? What happens when they paste?

    Hypothesize: Why might paste events cause corruption?
        Is input handled character-by-character?
        Are there race conditions?
        Is React state batching causing issues?
        Is this an Ink limitation or our code?

    Reproduce if possible: Can you trace through the code and see where it would break?

Bug 2: Single-Line Input Issues

    What are the "certain scenarios"?
        Long lines?
        Special characters?
        Terminal width boundaries?
        Cursor positioning edge cases?

    Find the input component and understand its constraints

    Identify the failure modes

Bug 3: File Watcher Not Tracking New Files

    Locate the file watcher implementation
        What library is used? (chokidar? fs.watch? custom?)
        Where is it initialized?
        What paths/patterns are being watched?

    Why would it miss new files?
        Is it watching specific files instead of directories?
        Is the glob pattern too restrictive?
        Is there a watcher restart issue?

    What is the intended behavior?
        Should it watch recursively?
        Should it auto-detect new files in watched directories?
        How should it trigger PGC re-ingestion?

Deliverable: Root cause analysis for each bug - not just symptoms, but WHY.
Phase 3: PGC Integration Discovery (45 min)
Understand What's Possible

Your mission: Explore the PGC APIs and understand what COULD be integrated into the TUI.

    Explore the coherence system (src/core/coherence/):
        How is coherence calculated?
        What APIs are available?
        Can you get real-time coherence scores?
        What does "drift" mean and how is it detected?

    Explore the quest system (src/core/quest/):
        How are quests created and tracked?
        What is the quest data model?
        Can you query active quests?
        Is there a progress/completion model?

    Explore the file watcher system:
        Beyond fixing the bug, what status info is available?
        Can you get a list of watched files?
        Can you get recent change events?
        Is there a watcher health/status API?

    Explore the overlay system (src/core/overlays/):
        What are the O1-O7 overlays?
        Can you query overlay statistics (node counts, embeddings, etc.)?
        Is there a centralized overlay manager?
        How often are overlays updated?

Deliverable: Document the PGC API surface - what's available for TUI integration.
Phase 4: Design the Enhanced TUI (60 min)
Envision the Ideal Experience

Your mission: Design (don't implement yet) a TUI that makes the PGC visible and alive.

    What should a user SEE?
        Real-time coherence score and drift alerts?
        Active quests with progress indicators?
        File watcher status (X files watched, recent changes)?
        Overlay health dashboard (O1-O7 node counts, last updated)?

    How should it be laid out?
        Single-column? Two-column? Dashboard-style?
        What's always visible vs. togglable?
        How to avoid overwhelming the user?

    What interactions make sense?
        Can user drill into drifted nodes?
        Can they see quest details on demand?
        Can they trigger manual coherence checks?
        Can they pause/resume file watching?

    What are the technical constraints?
        Terminal size limitations
        Ink rendering performance
        API polling frequency (don't spam LanceDB)
        React state management complexity

Deliverable: A design document with ASCII mockups of the proposed TUI layout.
Phase 5: Implementation Plan (30 min)
Create a Phased Roadmap

Your mission: Prioritize the work into achievable phases.

Phase 0: Bug Fixes (Must do first)

    Fix copy-paste
    Fix single-line input
    Fix file watcher new file detection

Phase 1: Essential Integrations (High value, lower complexity)

    What's the #1 most valuable PGC integration?
    What's the easiest to implement?
    What has the best effort-to-impact ratio?

Phase 2: Enhanced Integrations (Medium complexity)

    Next tier of features
    More complex UI components
    Deeper PGC interactions

Phase 3: Advanced Features (Nice to have)

    Polish and refinement
    Advanced interactions
    Edge case handling

Deliverable: A prioritized implementation roadmap with effort estimates.
Phase 6: Implementation (As Time Allows)
Build the Enhanced TUI

Your mission: Implement the fixes and integrations following your plan.

Guidelines:

    Start with Phase 0 (bug fixes) - these are critical
    Follow existing code patterns and conventions
    Use TypeScript strictly (no any types)
    Add error handling for all async operations
    Keep polling/refresh intervals reasonable
    Test each change before moving to the next

You decide:

    Which patterns to use
    How to structure components
    What hooks to create
    How to manage state

Remember:

    The codebase has existing patterns - follow them
    React Ink has specific best practices - respect them
    Performance matters - don't spam APIs
    The user experience is paramount - put yourself in their shoes

Phase 7: Documentation & Handoff (30 min)
Document What You Learned and Built

Create: docs/architecture/audits/TUI_ENHANCEMENT_REPORT.md

Include:

    Architecture Findings
        How the TUI is structured
        Existing patterns you discovered
        Key insights about React Ink usage

    Bug Analysis
        Root cause for each bug
        How you fixed it
        Why the fix works

    PGC Integration Strategy
        What you integrated
        Why you chose those integrations
        How they work (architecture)

    User Experience Improvements
        Before/after comparison
        What value users gain
        Future enhancement opportunities

    Implementation Details
        Files created/modified
        Key technical decisions
        Testing performed
        Known limitations

    Next Steps
        What remains to be done
        Recommendations for future work
        Technical debt introduced (if any)

Success Criteria

✅ You deeply understand the TUI architecture (not just surface-level)
✅ You discovered the root causes of bugs (not just symptoms)
✅ You explored PGC capabilities (know what's possible)
✅ You designed a thoughtful enhancement (user-centered)
✅ You implemented fixes and features (working code)
✅ You documented your journey (knowledge transfer)
Your Mission

Put yourself in the shoes of a user:

You are a developer using Cognition Σ to understand a complex codebase. You launch the TUI hoping for insight into your project's health.

    Can you see if your code is drifting from your documentation? (Coherence)
    Can you track the tasks you're working on? (Quests)
    Can you tell if changes are being detected? (File watcher)
    Can you understand the health of your knowledge graph? (Overlays)

Right now, the answer to all of these is "no" or "barely."

Your job is to change that. Make the TUI a living dashboard into the PGC - a window into the cognitive state of their codebase.

Don't just fix bugs. Build empathy. Build insight. Build trust.
