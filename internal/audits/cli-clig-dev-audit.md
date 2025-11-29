# Cognition CLI - Best Practices Audit Report

**Audit Date:** 2025-11-26
**Reference:** [clig.dev](https://clig.dev/)
**CLI Version:** 2.5.1

---

## Executive Summary

Cognition-cli has a **solid foundation** with many best practices already implemented:

- TTY detection for colors/emoji
- `NO_COLOR` environment variable support
- Structured error handling with codes and solutions
- JSON output mode for automation
- Global flags (`--no-color`, `--verbose`, `--quiet`)

**Key gaps** to address:

1. ~~Help output lacks examples and "next steps" guidance~~ FIXED
2. ~~No `--dry-run` for destructive operations~~ FIXED (init, genesis, update)
3. ~~Exit codes limited to 0/1 (no granularity)~~ FIXED (0, 2-8, 130)
4. ~~Missing `--no-input` flag for CI/CD~~ FIXED
5. ~~No spelling suggestions for typos~~ FIXED (Commander.js showSuggestionAfterError)
6. Progress indication: @clack/prompts spinners already in use

**Overall Compliance Score: 95/100** (was 90/100)

---

## Compliance Scorecard by Area

| Area | Score | Status | Priority | Change |
|------|-------|--------|----------|--------|
| Help & Documentation | 95% | Excellent | LOW | +35% (examples, typo suggestions, env vars documented) |
| Output Formatting | 85% | Good | LOW | - |
| Error Handling | 90% | Excellent | LOW | +10% (typo suggestions, --debug file logging) |
| Flags & Arguments | 100% | Excellent | LOW | +30% (--json, --no-input, --dry-run, --force, --debug, --resume) |
| Dangerous Operations | 90% | Excellent | LOW | +50% (--dry-run on init/genesis/update, confirmation, --force) |
| Interactivity | 80% | Good | LOW | +25% (isInteractive, --no-input) |
| Configuration | 95% | Excellent | LOW | +10% (config command added) |
| Robustness | 70% | Good | MEDIUM | +20% (--resume for genesis, --debug file logging) |
| Subcommand Consistency | 85% | Good | LOW | - |
| Exit Codes | 90% | Excellent | LOW | +60% (full mapping implemented) |

---

## Detailed Findings

### 1. Help & Documentation (60%)

#### Current State

- **--help** works for all commands via Commander.js
- **--version** implemented (`2.5.1 (Gemini Integration)`)
- Descriptions provided for all commands
- Documentation link in error messages

#### Gaps

| Item | Status | Notes |
|------|--------|-------|
| Examples in --help | Missing | No usage examples shown |
| Common use cases | Missing | No workflow demonstrations |
| "Next steps" suggestions | Missing | After operations complete |
| Spelling suggestions | Missing | Typos show generic error |
| Concise error-time help | Partial | Shows full help, not concise |
| Environment variable docs | Missing | Not documented in --help |

#### Example: Current vs. Ideal

**Current `genesis --help`:**

```
Usage: cognition-cli genesis [options] [sourcePath]

Builds the verifiable skeleton of a codebase (alias: g)

Options:
  -w, --workbench <url>      URL of the egemma workbench
  -p, --project-root <path>  Root directory of the project
  -h, --help                 display help for command
```

**Ideal `genesis --help`:**

```
Builds the verifiable skeleton of a codebase

USAGE:
    cognition genesis [OPTIONS] <sourcePath>

EXAMPLES:
    # Analyze entire src/ directory
    cognition genesis src/

    # Specify custom workbench
    cognition genesis --workbench http://localhost:8001 src/

    # Different project root
    cognition genesis --project-root /path/to/project src/

OPTIONS:
    -w, --workbench <url>      Workbench URL [env: WORKBENCH_URL]
                               (default: http://localhost:8000)
    -p, --project-root <path>  Project root [default: cwd]
    -h, --help                 Show this help

ENVIRONMENT VARIABLES:
    WORKBENCH_URL    Default workbench URL

NEXT STEPS:
    cognition genesis:docs VISION.md   # Add mission documents
    cognition overlay generate         # Generate overlays
    cognition status                   # Check PGC state

LEARN MORE:
    https://mirzahusadzic.github.io/cogx/manual/part-1-foundation/02-genesis
```

---

### 2. Output Formatting (85%)

#### Current State (Excellent)

- TTY detection: `src/utils/terminal-capabilities.ts`
- `NO_COLOR` support: Implemented
- `--no-color` flag: Implemented
- `--no-emoji` flag: Implemented
- JSON output: `--format json`
- Color scheme per overlay type
- Box-drawing character fallback

#### Gaps

| Item | Status | Notes |
|------|--------|-------|
| Progress bars/spinners | Partial | @clack/prompts available but underused |
| Success state communication | Missing | No clear success messages |
| "Next steps" after operations | Missing | Operations end silently |
| Immediate feedback (<100ms) | Needs audit | Network ops may hang |

#### Recommendation

Add progress indication to `genesis`, `genesis:docs`, `overlay generate`:

```typescript
import { spinner } from '@clack/prompts';

const s = spinner();
s.start('Scanning files...');
// ... work ...
s.message('Parsing AST for src/core/pgc/manager.ts (12/47)');
// ... work ...
s.stop('Genesis complete! Processed 47 files in 2.3s');

console.log('\nNext steps:');
console.log('  cognition overlay generate structural_patterns');
console.log('  cognition patterns analyze');
```

---

### 3. Error Handling (80%)

#### Current State (Good)

- Custom `CognitionError` class with:
  - Error codes (COG-E001, COG-E301, etc.)
  - User-friendly titles
  - Actionable solution suggestions
  - Documentation links
- Error code schema documented
- Stack traces in verbose mode only
- Bug report link for unexpected errors

#### Gaps

| Item | Status | Notes |
|------|--------|-------|
| Error at END of output | Partial | Some operations dump mid-stream |
| Debug log to file | Missing | --verbose shows inline, no file |
| Pre-populated bug URLs | Missing | Could include error code in URL |

#### Example: Current Error (Good)

```
✗ Error [COG-E301]: Workspace Not Found

No .open_cognition directory found in '/path' or parent directories.

Possible Solutions:
  • Run "cognition-cli init" to create a new workspace
  • Navigate to an existing project directory
  • Use --project-root to specify workspace location

📖 https://mirzahusadzic.github.io/cogx/manual/part-1-foundation/01-initializing-pgc
```

#### Recommendation

Add pre-populated bug report URLs:

```typescript
// In ErrorCodes.INTERNAL_ERROR
`https://github.com/mirzahusadzic/cogx/issues/new?title=Bug:%20${encodeURIComponent(context)}&body=${encodeURIComponent(template)}`
```

---

### 4. Flags & Arguments (70%)

#### Current State

- Global flags: `--no-color`, `--no-emoji`, `--format`, `--verbose`, `--quiet`, `--version`
- Short forms: `-v`, `-q`, `-p`, `-w`, `-f`, `-l`
- Commander.js handles flag parsing

#### Gap Analysis

| Standard Flag | Present | Notes |
|---------------|---------|-------|
| `-h, --help` | Yes | Via Commander |
| `-v, --verbose` | Yes | Global |
| `-q, --quiet` | Yes | Global |
| `-d, --debug` | No | Missing (verbose serves similar purpose) |
| `-f, --force` | No | Missing for destructive ops |
| `-n, --dry-run` | No | Missing |
| `--json` | Partial | Requires `--format json` |
| `--no-input` | No | Missing (critical for CI/CD) |
| `--version` | Yes | Global |

#### Recommendations

1. Add `--json` as shorthand for `--format json`
2. Add `--no-input` to disable all prompts
3. Add `-d, --debug` distinct from verbose (debug=developer info, verbose=more detail)
4. Add `-f, --force` for operations that need confirmation

---

### 5. Dangerous Operations (40%)

#### Current State

- `genesis --force` does NOT exist (rebuilds implicitly)
- No confirmation prompts for destructive actions
- No `--dry-run` mode
- `init` overwrites existing workspace without warning

#### Critical Gaps

| Operation | Confirmation | Dry-run | Force Flag |
|-----------|--------------|---------|------------|
| `init` | No | No | No |
| `genesis` (rebuild) | No | No | No |
| `update` | No | No | No |
| `migrate:lance` | No | No | No |

#### Recommendations

```typescript
// For init command
if (fs.existsSync('.open_cognition') && process.stdin.isTTY && !options.force) {
  const { confirm } = await prompts({
    type: 'confirm',
    name: 'confirm',
    message: 'Workspace already exists. Reinitialize? (destructive)',
    initial: false
  });
  if (!confirm) process.exit(0);
}

// Add --dry-run to genesis
if (options.dryRun) {
  console.log('Dry run - files that would be processed:');
  files.forEach(f => console.log(`  ${f}`));
  process.exit(0);
}
```

---

### 6. Interactivity (55%)

#### Current State

- TUI command provides interactive interface
- Setup wizard (`wizard`) is interactive
- Uses @clack/prompts for some interactions

#### Gaps

| Item | Status | Notes |
|------|--------|-------|
| `--no-input` flag | Missing | Critical for CI/CD |
| TTY check before prompts | Partial | Some commands may prompt in pipes |
| Password echo disabled | N/A | No password inputs currently |
| Clear escape instructions | Missing | TUI exit not obvious |

#### Recommendations

```typescript
// Global flag
program.option('--no-input', 'Disable all interactive prompts (for CI/CD)');

// Check before any prompt
function safePrompt(options: PromptOptions) {
  if (!process.stdin.isTTY || process.env.COGNITION_NO_INPUT === '1') {
    throw ErrorCodes.MISSING_ARGUMENT(options.name + ' (use flag in non-interactive mode)');
  }
  return prompts(options);
}
```

---

### 7. Configuration (85%)

#### Current State (Good)

- **User config**: `~/.cognition-cli/settings.json` (already exists!)
- Environment variables via dotenv
- WORKBENCH_URL environment variable
- Command flags override env vars
- Documented precedence in `src/llm/llm-config.ts`

#### Current Precedence (Documented)

1. CLI flags (highest priority)
2. Environment variables
3. `~/.cognition-cli/settings.json` (persistent user settings)
4. Default values in config.ts

#### What's Stored in User Config

- `dual_use_acknowledgment` - Security mandate acceptance
- `llm.defaultProvider` - Preferred LLM (claude/gemini)
- `llm.providers.*.defaultModel` - Default models per provider

#### Gap Analysis

| Item | Status | Notes |
|------|--------|-------|
| XDG Base Directory | No | Uses `~/.cognition-cli/` (acceptable alternative) |
| User config | YES | `~/.cognition-cli/settings.json` |
| Precedence documented | Partial | In code, not in --help |
| Secrets in env vars | Risk | API keys in env vars |

#### Recommendations

1. Document precedence in `--help` output
2. Consider moving API keys to `~/.cognition-cli/credentials.json` (not env vars)
3. Add `cognition config` command to view/edit settings

---

### 8. Robustness (50%)

#### Current State

- Lazy imports for faster startup
- Retry logic for 429 errors (5 retries, 3s max delay)
- Rate limiting configuration
- Graceful SIGINT/SIGTERM in watch command

#### Gaps

| Item | Status | Notes |
|------|--------|-------|
| Output within 100ms | Needs audit | Network calls may delay |
| Network timeouts | Partial | Some endpoints may hang |
| Resume after failure | No | Must restart from scratch |
| Idempotent operations | Partial | `genesis` rebuilds fully |
| Parallel output management | Unknown | Needs testing |

#### Recommendations

```typescript
// Immediate feedback before network
console.error('Connecting to workbench at ' + url + '...');
const response = await fetch(url, { timeout: 10000 }); // Add timeout

// Resume support
const progressFile = '.open_cognition/.genesis-progress';
if (fs.existsSync(progressFile)) {
  console.log('Resuming from previous run...');
  const progress = JSON.parse(fs.readFileSync(progressFile, 'utf8'));
  // Skip completed files
}
```

---

### 9. Subcommand Consistency (85%)

#### Current State (Good)

- Consistent naming: `security *`, `workflow *`, `proofs *`
- Shared flags across related commands
- Verb-noun pattern: `overlay generate`, `genesis:docs`
- Aliases for common commands (`g`, `i`, `q`, `w`, `l`)

#### Minor Issues

- Mixed patterns: `genesis:docs` (colon) vs `overlay generate` (space)
- `blast-radius` exists both as standalone and under `security`

---

### 10. Exit Codes (30%)

#### Current State

- 0 = Success
- 1 = Any error

#### clig.dev Recommendation

Different exit codes for different failure types allow scripts to respond appropriately.

#### Recommended Exit Codes

| Code | Meaning | Use Case |
|------|---------|----------|
| 0 | Success | Normal completion |
| 1 | General error | Catch-all |
| 2 | Missing required arguments | `COG-E001` |
| 3 | Invalid configuration | `COG-E002`, `COG-E003` |
| 4 | PGC not initialized | `COG-E301` |
| 5 | Workbench connection failed | `COG-E201` |
| 6 | API request failed | `COG-E202` |
| 7 | Permission denied | `COG-E101` |
| 8 | Internal error | `COG-E401` |
| 130 | Interrupted (Ctrl-C) | SIGINT |

#### Implementation

```typescript
// Map error codes to exit codes
const EXIT_CODES: Record<string, number> = {
  'COG-E001': 2,
  'COG-E002': 3,
  'COG-E003': 3,
  'COG-E101': 7,
  'COG-E201': 5,
  'COG-E202': 6,
  'COG-E301': 4,
  'COG-E302': 4,
  'COG-E401': 8,
};

process.on('uncaughtException', (error) => {
  if (error instanceof CognitionError) {
    console.error(formatError(error, verbose));
    process.exit(EXIT_CODES[error.code] || 1);
  }
  process.exit(1);
});
```

---

## Priority Matrix

### High Impact, Low Effort (Quick Wins)

1. Add `--json` shorthand flag
2. Add `--no-input` flag
3. Implement exit code mapping
4. Add examples to --help
5. Add "next steps" after operations

### High Impact, Medium Effort

6. Add `--dry-run` to destructive commands
7. Add confirmation prompts for dangerous ops
8. Add progress spinners to long operations
9. Implement spelling suggestions for typos

### Medium Impact, Low Effort

10. Document env vars in --help
11. Add immediate feedback before network calls
12. Pre-populate bug report URLs

### Medium Impact, Medium Effort

13. Add resume support for interrupted operations
14. Add `cognition config` command to view/edit user settings
15. Add `--debug` flag distinct from `--verbose`

---

## Quick Wins Implementation Checklist

### Phase 1: Immediate (1-2 days) - COMPLETED 2025-11-26

- [x] Add `--json` shorthand: `program.option('--json', 'Shorthand for --format json')`
- [x] Add `--no-input` global flag
- [x] Map error codes to exit codes (0, 2-8, 130)
- [x] Add examples to top 5 commands: `init`, `genesis`, `query`, `tui`, `status`
- [x] Add "next steps" to `init`, `genesis` output

### Phase 2: Short-term (3-5 days) - COMPLETED 2025-11-26

- [x] Add `--dry-run` to `init`
- [x] Add confirmation prompts to `init` (when .open_cognition exists)
- [x] Add `--force` flag to `init` for CI/CD bypass
- [x] Add `--dry-run` to `genesis`, `update`
- [x] Implement typo suggestions (Commander.js built-in `showSuggestionAfterError`)
- [ ] Add progress spinners to `genesis`, `genesis:docs`, `overlay generate` (already has spinners via @clack/prompts)

### Phase 3: Medium-term (1-2 weeks) - COMPLETED 2025-11-26

- [x] Add resume support for `genesis` (`--resume` flag, progress tracking)
- [x] Add `cognition config` command to view/edit `~/.cognition-cli/settings.json`
- [x] Add `--debug` flag with file logging (writes to `.open_cognition/debug-*.log`)
- [x] Document all environment variables in help (comprehensive categorized list)

---

## Files Modified

| File | Changes | Status |
|------|---------|--------|
| `src/cli.ts` | Add global flags (`--json`, `--no-input`, `--debug`), examples, exit codes, SIGINT handler, env vars help | DONE |
| `src/utils/errors.ts` | Add exit code mapping, `getExitCode()`, `NON_INTERACTIVE_MISSING_FLAG` | DONE |
| `src/utils/help-formatter.ts` | **NEW** - `addExamples()`, `addEnvVars()`, `addLearnMore()`, `addAllEnvVars()` | DONE |
| `src/utils/debug-logger.ts` | **NEW** - Debug file logging utility (`debugLog()`, `debugTimer()`, etc.) | DONE |
| `src/utils/terminal-capabilities.ts` | Add `isInteractive()` helper | DONE |
| `src/commands/init.ts` | Add `--dry-run`, `--force`, confirmation prompt, next steps | DONE |
| `src/commands/genesis.ts` | Add next steps, `--dry-run`, `--resume`, debug logging, progress tracking | DONE |
| `src/commands/update.ts` | Add `--dry-run` support | DONE |
| `src/commands/status.ts` | Add examples to help | DONE |
| `src/cli.ts` | Enable `showSuggestionAfterError` for typo suggestions | DONE |
| `src/commands/config.ts` | **NEW** - `config` command for settings management | DONE |

---

## Conclusion

Cognition-cli has a strong foundation with good error handling, TTY detection, and output formatting. The main areas needing improvement are:

1. **Help system** - Add examples, environment variable docs, and next steps
2. **Dangerous operations** - Add confirmations and dry-run mode
3. **CI/CD support** - Add `--no-input` flag
4. **Exit codes** - Map to failure types for scripting

The quick wins in Phase 1 can be implemented in 1-2 days and will significantly improve user experience. Phase 2 addresses safety and feedback, while Phase 3 focuses on robustness.

**Recommended order of implementation:**

1. `--no-input` flag (enables CI/CD usage)
2. Exit code mapping (enables scripted error handling)
3. Examples in --help (improves discoverability)
4. Progress spinners (improves perceived performance)
5. `--dry-run` and confirmations (improves safety)
