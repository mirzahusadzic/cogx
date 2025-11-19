# Task: Phase 1 - Foundational Developer Experience Fixes

## Context

The Cognition Σ CLI has undergone a comprehensive DX audit (see DX_AUDIT_REPORT.md on branch claude/dx-audit-cognition-01JUNuFCkuMPV4gfb6dxMWUQ). The audit identified 5 critical issues blocking new contributors from having a smooth onboarding experience.

Your mission: Implement Phase 1 foundational fixes to unlock developer productivity. These are the highest-impact, lowest-effort improvements that will transform the first-time contributor experience from frustrating to delightful.

Total estimated effort: 4-5 hours
Phase 1: Understand the Current State (30 min)
Experience the Pain Points

    Simulate fresh clone experience:
        Read the DX audit report to understand what breaks
        Examine the current tsconfig.json - what's the vitest/globals issue?
        Check package.json engines field vs .github/workflows/*.yml - spot the version mismatch
        List what's missing: .vscode/, .env.example, pre-commit hooks

    Explore existing patterns:
        How does the project currently handle TypeScript config?
        Are there any existing test-specific configurations?
        What npm scripts already exist in package.json?
        Is there any tooling infrastructure to build upon?

    Read the documentation:
        Review CONTRIBUTING.md (397 lines) - what does it say about setup?
        Check README.md - what's the documented Node.js requirement?
        Look at the 21-chapter manual - are there setup instructions?

Deliverable: Mental model of the current DX gaps and why they exist.
Phase 2: Explore the Architecture (20 min)
Understand the Build System

    TypeScript configuration:
        Find all tsconfig*.json files in the repo
        Understand the inheritance chain
        Identify where test configuration should live
        Note: The issue is that vitest/globals types are in main config but should be test-only

    Package ecosystem:
        What Node.js versions does the codebase actually use? (Check CI, package.json, docs)
        What's the team's preferred LTS version?
        Are there any Node.js-specific features that constrain version choice?

    Development workflow:
        What scripts do developers run daily? (npm run dev, npm test, etc.)
        Where would pre-commit hooks fit in?
        What quality checks should run automatically?

Deliverable: Understanding of where each fix needs to be applied and why.
Phase 3: Research Best Practices (25 min)
VSCode Integration Standards

    Recommended extensions:
        What extensions would help Cognition Σ developers? (ESLint, Prettier, Vitest, etc.)
        Check what's already configured in ESLint/Prettier configs
        Look at similar TypeScript CLI projects - what do they recommend?

    Debug configurations:
        How do you debug a CLI tool in VSCode? (tsx, breakpoints, args)
        How do you debug Vitest tests?
        What launch configurations would be most useful?

    Workspace settings:
        What should auto-format on save?
        What should be excluded from file watchers?
        What TypeScript version should VSCode use?

Pre-commit Hook Standards

    What should run on commit?
        Linting? (ESLint already configured)
        Formatting? (Prettier already configured)
        Type checking? (TypeScript strict mode)
        Tests? (Too slow for pre-commit)

    Tooling options:
        Husky for Git hooks
        lint-staged for running on changed files only
        What's the minimal friction setup?

Deliverable: Clear vision of what "world-class" looks like for each fix.
Phase 4: Plan the Fixes (20 min)
Break Down the Work

For each of the 5 critical issues, plan:

    🚨 Build Fails on Fresh Clone
        What files need changes? (tsconfig.json, new tsconfig.test.json)
        What's the inheritance strategy?
        How to ensure build still works after the fix?

    ⚠️ Node.js Version Mismatch
        Which is the source of truth? (Recommend: align to CI version)
        What files need updates? (package.json, CONTRIBUTING.md, README.md)
        Should there be a version check script?

    🔧 No VSCode Integration
        What files to create? (.vscode/extensions.json, settings.json, launch.json, tasks.json)
        What extensions are must-haves vs nice-to-haves?
        How to document the setup in CONTRIBUTING.md?

    📝 No .env.example
        What environment variables does the codebase use?
        Grep for process.env. to find all references
        What should have defaults vs require explicit setting?

    🪝 No Pre-commit Hooks
        What's the minimal setup? (Husky + lint-staged)
        What commands should run? (lint, format, typecheck on staged files)
        How to document the setup?

Deliverable: Step-by-step implementation plan for all 5 fixes.
Phase 5: Implement the Fixes (2-3 hours)
Fix 1: Build Fails on Fresh Clone (30 min)

    Create [object Object] that extends [object Object] and adds [object Object]
    Update [object Object] to remove [object Object] from main config
    Update [object Object] to use the test-specific tsconfig
    Test: Run [object Object] on a clean install - should succeed
    Test: Run [object Object] - should still work

Fix 2: Node.js Version Mismatch (5 min)

    Decide on canonical version (recommend: 20.x LTS to match CI)
    Update [object Object] engines field
    Update [object Object] prerequisites
    Update [object Object] setup instructions
    Ensure [object Object] aligns

Fix 3: VSCode Integration (1-2 hours)

    Create [object Object] with recommended extensions
    Create [object Object] with workspace settings
    Create [object Object] with debug configurations (CLI + tests)
    Create [object Object] with build/test/watch tasks
    Test: Open project in VSCode, verify recommendations appear
    Test: Run debug configurations, verify breakpoints work
    Document in [object Object] under "IDE Setup"

Fix 4: .env.example Template (30 min)

    Search codebase for [object Object] usage
    Identify all environment variables
    Create [object Object] with documented variables
    Add sensible defaults where applicable
    Update [object Object] to mention environment setup
    Update [object Object] with environment configuration

Fix 5: Pre-commit Hooks (1 hour)

    Install Husky: [object Object]
    Install lint-staged: [object Object]
    Add [object Object] script to [object Object]
    Configure [object Object] with lint + format + typecheck
    Run [object Object] to set up hooks
    Test: Make a change, commit - hooks should run
    Document in [object Object] under "Git Workflow"

Deliverable: All 5 fixes implemented and tested.
Phase 6: Validate the Improvements (30 min)
Simulate New Contributor Experience

    Fresh clone test:
        Run through the onboarding flow yourself
        Time: git clone → npm install → npm run build → npm test
        Verify: Should complete without errors
        Note: New time to first success (should be <5 minutes)

    VSCode test:
        Close and reopen VSCode
        Verify: Extension recommendations appear
        Verify: Debugger works (set breakpoint in CLI, run debug config)
        Verify: Tasks work (run build task)

    Pre-commit test:
        Make intentional formatting mistake
        Try to commit
        Verify: Hooks catch the issue and auto-fix

    Documentation test:
        Read CONTRIBUTING.md as if you're a new contributor
        Are all new features documented?
        Are setup steps clear?

Deliverable: Confirmation that all 5 fixes work as intended.
Phase 7: Document the Changes (20 min)
Update Documentation

    CONTRIBUTING.md:
        Add "IDE Setup" section if missing
        Document VSCode configuration
        Explain pre-commit hooks
        Update setup instructions with environment variables

    README.md:
        Update Node.js version requirement
        Mention .env.example for configuration
        Add note about VSCode integration

    Create IMPLEMENTATION_NOTES.md:
        Summarize what was fixed
        Explain technical decisions (why tsconfig.test.json, why Node 25, etc.)
        Note any trade-offs or limitations
        Provide before/after metrics

Deliverable: Clear documentation of changes for PR reviewers.
Deliverable Format
Implementation Summary

## Phase 1 Foundational DX Fixes - Implementation Summary

## Changes Made

### 1. 🚨 Fixed Build on Fresh Clone

- **Problem:** TypeScript couldn't find `vitest/globals` types
- **Solution:** Created `tsconfig.test.json` for test-specific config
- **Impact:** Build now succeeds on fresh clone without errors
- **Files changed:** `tsconfig.json`, `tsconfig.test.json`, `vitest.config.ts`

### 2. ⚠️ Fixed Node.js Version Mismatch

- **Problem:** package.json said 25.x, CI used 20.x, docs said "20.x or later"
- **Solution:** Aligned all to Node.js 20.x LTS
- **Impact:** Clear, consistent version requirement across docs and config
- **Files changed:** `package.json`, `README.md`, `CONTRIBUTING.md`

[... continue for all 5 fixes ...]

## Before vs After

**Before:**

- ❌ Build fails on fresh clone
- ❌ Confusing version requirements
- ❌ No IDE support
- ❌ Missing environment setup
- ❌ No automated quality checks

**After:**

- ✅ Clean build on first try
- ✅ Clear Node.js 20.x requirement
- ✅ VSCode fully configured with debugger
- ✅ .env.example with documented variables
- ✅ Pre-commit hooks enforce quality

## Metrics

- **Onboarding time:** ~15-20min → **~5min**
- **Setup friction:** High → **Low**
- **DX Score:** 7.2/10 → **~8.0/10** (Phase 1 complete)

## Testing Performed

- [x] Fresh clone test (clean install → build → test)
- [x] VSCode integration test (extensions, debugger, tasks)
- [x] Pre-commit hooks test (formatting, linting, type checking)
- [x] Documentation accuracy test (follow CONTRIBUTING.md)

## Next Steps

Phase 2: Documentation improvements (12 hours)
Phase 3: Tooling optimization (2 days)
Phase 4: Advanced DX features (2 weeks)

Success Criteria

✅ All 5 critical issues fixed and tested
✅ Build succeeds on fresh clone
✅ VSCode integration working (debugger, tasks, extensions)
✅ Pre-commit hooks enforcing quality
✅ Documentation updated (CONTRIBUTING.md, README.md)
✅ Before/after metrics documented
✅ Changes ready for PR (clean commit, tested, documented)
Final Mission

Put yourself in the shoes of a new contributor who just found Cognition Σ:

They're excited about the verifiable AI-human symbiosis architecture. They want to contribute. They run git clone, then npm install, then npm run build...

What happens next?

With your Phase 1 fixes:

    ✅ The build succeeds (no more vitest/globals error)
    ✅ They open VSCode and see helpful extension recommendations
    ✅ They can set a breakpoint and debug the CLI with one click
    ✅ They copy .env.example to .env and know exactly what to configure
    ✅ When they commit, hooks automatically format and check their code

Your fixes transformed their experience from frustration to delight. That's the power of Phase 1. 🚀
