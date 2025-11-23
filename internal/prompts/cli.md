# 🎯 Task: Audit & Improve cognition-cli Interface Against Modern CLI Best Practices

## 📋 Background

You're improving **cognition-cli** - a seven-overlay knowledge graph CLI tool with dual-lattice architecture. Study the complete guide at **https://clig.dev/** and audit the codebase against those principles.

## 🔍 Current State (Reference)

**Commands:** `init`, `genesis`, `genesis:docs`, `watch`, `status`, `update`, `overlay generate`, `tui`, `pr-analyze`, `security blast-radius`, `patterns`, `concepts`, `coherence`, `query`, `audit`, `wizard`

**Key Features:**
- Interactive TUI with Claude/Gemini integration
- Real-time file watching with dirty state tracking
- JSON output support for automation
- Interactive setup wizard
- Multi-overlay knowledge extraction

## 📊 Audit Areas (Priority Order)

### 1. Help & Documentation ⭐⭐⭐ (CRITICAL)

**Audit:**
- Does `--help` work for ALL commands and subcommands?
- Is help extensive (examples, all flags, common use cases)?
- Is error-time help concise (brief + "run --help for more")?
- Do missing required args show helpful examples?
- Are there spelling suggestions for typos (`geneis` → `genesis`)?
- Is there a `--version` flag?

**Improve:**
```bash
# GOOD example structure
$ cognition genesis --help
Build code knowledge graph from source files

USAGE:
    cognition genesis [OPTIONS] <path>

EXAMPLES:
    # Analyze entire src/ directory
    cognition genesis src/

    # Force rebuild of existing graph
    cognition genesis --force src/

    # Only analyze TypeScript files
    cognition genesis --include "**/*.ts" src/

OPTIONS:
    -f, --force              Rebuild even if cache exists
    -i, --include <pattern>  File pattern to include
    -e, --exclude <pattern>  File pattern to exclude
    --json                   Output results as JSON
    -h, --help              Show this help

LEARN MORE:
    docs/guides/01_Structural_Analysis.md
    https://github.com/mirzahusadzic/cogx
```

### 2. Output Formatting ⭐⭐⭐ (CRITICAL)

**Audit:**
- Is TTY detection used? (color/animation only in interactive terminals)
- Does `NO_COLOR` environment variable work?
- Is there a `--no-color` flag?
- Do long operations show progress bars/spinners?
- Is success state clearly communicated?
- Are next steps suggested after operations?

**Improve:**
```typescript
// Example: Progress indication for genesis
✓ Scanning files... (47 found)
⠋ Parsing AST for src/core/pgc/manager.ts (12/47)
⠋ Generating embeddings... (batch 3/8)
✓ Genesis complete! Processed 47 files in 2.3s

📊 Results:
   - 711 structural patterns extracted
   - 23 managers, 232 utilities found
   - Graph stored in .open_cognition/

💡 Next steps:
   cognition overlay generate structural_patterns
   cognition patterns analyze
```

### 3. Error Handling ⭐⭐⭐ (CRITICAL)

**Audit:**
- Are errors human-readable (not just stack traces)?
- Do errors suggest fixes?
- Is error info placed at the END of output (where eyes focus)?
- Are unexpected errors logged to files instead of dumped to terminal?
- Do errors include bug-reporting links for unexpected failures?

**Improve:**
```bash
# BAD
Error: ENOENT: no such file or directory, open '.open_cognition/pgc/index.json'

# GOOD
❌ PGC not initialized in this directory

The .open_cognition/ directory doesn't exist yet.

💡 Run this first:
   cognition init

📚 Learn more: https://github.com/mirzahusadzic/cogx#quick-start
```

### 4. Flags & Arguments ⭐⭐ (HIGH)

**Audit:**
- Do ALL flags have both short (`-h`) and long (`--help`) forms?
- Are standard flag names used?
  - `-h/--help`, `-d/--debug`, `-f/--force`, `-n/--dry-run`
  - `-q/--quiet`, `--version`, `--json`, `--no-input`
- Can flags appear before OR after subcommands?
- Are dangerous operations protected with confirmations?

**Improve:**
```typescript
// Standard flags across ALL commands
--help, -h          Show help
--json              JSON output
--no-color          Disable colors
--debug, -d         Show debug output
--quiet, -q         Suppress non-essential output
--dry-run, -n       Preview changes without executing
--no-input          Disable prompts (for CI/CD)
```

### 5. Dangerous Operations ⭐⭐ (HIGH)

**Audit:**
- Do destructive commands require confirmation?
- Is there a `--dry-run` mode?
- Can confirmations be bypassed for scripts (`--force`, `--confirm="name"`)?

**Improve:**
```bash
$ cognition genesis --force src/

⚠️  Force rebuild will DELETE existing graph data

This will remove:
  .open_cognition/pgc/overlays/
  .open_cognition/pgc/genesis/

Type the directory name to confirm: src/
```

### 6. Interactivity ⭐⭐ (HIGH)

**Audit:**
- Are prompts skipped when stdin is not a TTY?
- Is there a `--no-input` flag to disable ALL prompts?
- Do missing args prompt interactively (with flag alternative)?
- Are passwords never echoed?

**Improve:**
```typescript
// Check for TTY before prompting
if (process.stdin.isTTY && !flags.noInput) {
  const answer = await prompt('Enter workbench URL:');
} else {
  throw new Error('--workbench-url required in non-interactive mode');
}
```

### 7. Configuration Management ⭐

**Audit:**
- Is XDG Base Directory spec followed (`~/.config/cognition-cli/`)?
- Is precedence clear: Flags > Env Vars > Project Config > User Config?
- Does the tool ask before modifying external configs?
- Are secrets NEVER in environment variables?

**Improve:**
```bash
# Configuration precedence (highest to lowest):
1. Command flags:     cognition --workbench-url=http://localhost:8000
2. Environment vars:  WORKBENCH_URL=http://localhost:8000
3. Project config:    .cognition/config.toml
4. User config:       ~/.config/cognition-cli/config.toml
5. System config:     /etc/cognition-cli/config.toml
```

### 8. Robustness & Performance ⭐

**Audit:**
- Do long operations output within 100ms?
- Are there network timeouts?
- Can operations resume after failure?
- Are operations idempotent?
- Do parallel operations show clean progress (not interleaved)?

**Improve:**
```typescript
// Immediate feedback
console.error('Connecting to workbench at http://localhost:8000...');
// (then make request)

// Resume support
if (fs.existsSync('.cognition/.genesis-progress')) {
  console.log('📝 Resuming from previous run...');
}
```

### 9. Subcommand Consistency ⭐

**Audit:**
- Do related subcommands use identical flag names?
- Is output formatting consistent?
- Are naming patterns clear (`overlay generate`, `patterns list`)?

### 10. Exit Codes ⭐

**Audit:**
- Does success return 0?
- Do different failure types map to different exit codes?
- Can scripts detect failure types?

**Improve:**
```typescript
// Exit code mapping
0   - Success
1   - General error
2   - Missing required arguments
3   - Invalid configuration
4   - PGC not initialized
5   - Workbench connection failed
130 - Interrupted (Ctrl-C)
```

## 🛠️ Implementation Plan

### Phase 1: Audit (1-2 days)
1. Read entire clig.dev guide: https://clig.dev/
2. Create audit spreadsheet with all commands × all criteria
3. Test each command manually
4. Document current behavior vs. best practices
5. Prioritize improvements by impact × effort

### Phase 2: Quick Wins (2-3 days)
1. Add missing `--version` flag
2. Implement `NO_COLOR` / `--no-color` support
3. Add TTY detection for colors/animation
4. Improve error messages with suggestions
5. Add `--dry-run` to destructive commands

### Phase 3: Help System (3-4 days)
1. Rewrite all `--help` output with examples
2. Add spelling suggestions for typos
3. Implement concise error-time help
4. Add "next steps" suggestions after operations
5. Document all environment variables in help

### Phase 4: Progress & UX (2-3 days)
1. Add progress bars for `genesis`, `overlay generate`
2. Show immediate feedback (<100ms) for network ops
3. Improve success messages with state info
4. Add operation timing to output

### Phase 5: Robustness (2-3 days)
1. Add resume support for interrupted operations
2. Implement proper timeout handling
3. Add `--no-input` flag support everywhere
4. Improve Ctrl-C handling

## 📝 Deliverables

1. **Audit Report** (Markdown)
   - Command-by-command compliance scorecard
   - Priority matrix (impact vs. effort)
   - Before/after examples

2. **Implementation PRs** (Git)
   - Separate PR per phase
   - Tests for new behavior
   - Updated documentation

3. **Updated Docs**
   - Command reference with new examples
   - Environment variable documentation
   - Exit code mapping guide

## ✅ Success Criteria

- [ ] ALL commands have extensive `--help` with examples
- [ ] Error messages suggest fixes (not just dump traces)
- [ ] Long operations show progress indicators
- [ ] Colors respect `NO_COLOR` and `--no-color`
- [ ] Dangerous ops require confirmation or `--dry-run`
- [ ] Missing args prompt OR show helpful error
- [ ] `--no-input` flag works for CI/CD
- [ ] Exit codes map to failure types
- [ ] Standard flags (`-h`, `-d`, `-q`, `-f`, `--json`) everywhere
- [ ] Operations provide "next steps" guidance

## 📚 Resources

- **clig.dev guide**: https://clig.dev/
- **cognition-cli repo**: https://github.com/mirzahusadzic/cogx/tree/main/src/cognition-cli
- **Current README**: Study command reference and workflows
- **TUI code**: `src/tui/` for interactive patterns
- **CLI commands**: `src/cli/commands/` for current implementation

## 💡 Key Principles to Remember

1. **Human-first**: Optimize for direct human use, not just scripts
2. **Helpful errors**: Every error should teach, not just fail
3. **Discoverable**: Users should be able to guess their way forward
4. **Robust**: Feel stable even when things go wrong
5. **Empathetic**: Show you understand user problems
6. **Consistent**: Follow conventions so patterns are learnable
7. **Conversational**: Think of multi-invocation dialogue
8. **No surprises**: Respect user control and expectations

---

**Questions? Issues? Blockers?**
Reach out with specific examples from the codebase. Good luck! 🚀