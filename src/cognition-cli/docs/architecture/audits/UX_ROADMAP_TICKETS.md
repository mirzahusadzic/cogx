# UX Improvement Roadmap - Implementation Tickets

This document contains actionable tickets ready to be created as GitHub Issues for improving Cognition Σ CLI/TUI user experience.

**Related**: See [UX_ANALYSIS_REPORT.md](./UX_ANALYSIS_REPORT.md) for comprehensive analysis.

---

## Phase 1: Critical Fixes (Priority: IMMEDIATE)

### Ticket 1: Add Global Accessibility Flags (`--no-color`, `--no-emoji`)

**Label**: `enhancement`, `accessibility`, `priority:high`
**Effort**: 2-4 hours
**Assignee**: TBD

**Description**:
Add global accessibility flags to support users with color blindness, screen readers, and CI/CD environments where colors/emojis cause issues.

**Acceptance Criteria**:

- [ ] Add `--no-color` flag to program in `cli.ts`
- [ ] Add `--no-emoji` flag to program in `cli.ts`
- [ ] Respect `NO_COLOR` environment variable (standard: <https://no-color.org/>)
- [ ] Update `formatter.ts` to check flags before applying colors/emojis
- [ ] Test in CI environment (GitHub Actions) to verify plain output
- [ ] Test by piping output to file: `cognition-cli status > output.txt` should have no ANSI codes
- [ ] Update README with accessibility section

**Implementation Details**:

```typescript
// cli.ts
program
  .option(
    '--no-color',
    'Disable colored output (also respects NO_COLOR env var)'
  )
  .option('--no-emoji', 'Disable emoji in output')
  .hook('preAction', (thisCommand) => {
    const opts = thisCommand.optsWithGlobals();
    process.env.COGNITION_NO_COLOR = opts.color === false ? '1' : '0';
    process.env.COGNITION_NO_EMOJI = opts.emoji === false ? '1' : '0';
  });

// formatter.ts
function useColor(): boolean {
  if (process.env.NO_COLOR) return false;
  if (process.env.COGNITION_NO_COLOR === '1') return false;
  if (!process.stdout.isTTY) return false;
  return true;
}
```

**Files to modify**:

- `src/cognition-cli/src/cli.ts` (add flags)
- `src/cognition-cli/src/utils/formatter.ts` (add color/emoji detection)
- `src/cognition-cli/README.md` (document flags)

**Testing**:

```bash
# Test color disabled
NO_COLOR=1 cognition-cli status
cognition-cli status --no-color

# Test emoji disabled
cognition-cli wizard --no-emoji

# Test piped output
cognition-cli status > output.txt
cat output.txt  # Should be plain text
```

---

### Ticket 2: Standardize Error Handling with CognitionError Class

**Label**: `enhancement`, `dx`, `priority:high`
**Effort**: 1 day
**Assignee**: TBD

**Description**:
Create a standardized error handling system with user-friendly messages, suggested solutions, error codes, and optional stack traces.

**Acceptance Criteria**:

- [ ] Create `CognitionError` class in `src/utils/errors.ts`
- [ ] Create `formatError()` function in `src/utils/error-formatter.ts`
- [ ] Add global error handler in `cli.ts`
- [ ] Update all commands to use `CognitionError` instead of raw `throw new Error()`
- [ ] Define error codes (COG-E001, COG-E002, etc.) with documentation
- [ ] Add `--verbose` flag support to show stack traces
- [ ] Test error display with and without `--verbose`

**Error Code Schema**:

- `COG-E0xx`: User input errors (invalid arguments, missing files)
- `COG-E1xx`: System errors (permissions, disk space)
- `COG-E2xx`: Network errors (API failures, timeouts)
- `COG-E3xx`: PGC errors (workspace not found, corruption)
- `COG-E4xx`: Internal errors (bugs, unexpected conditions)

**Implementation Details**:
See code examples in [UX_ANALYSIS_REPORT.md](./UX_ANALYSIS_REPORT.md#example-1-improved-error-handling)

**Files to create**:

- `src/cognition-cli/src/utils/errors.ts` (CognitionError class)
- `src/cognition-cli/src/utils/error-formatter.ts` (formatting logic)
- `docs/ERROR_CODES.md` (error reference)

**Files to modify**:

- `src/cognition-cli/src/cli.ts` (global error handler)
- All command files in `src/commands/` (replace error throwing)

**Testing**:

```bash
# Test user error
cognition-cli query  # Missing argument
# Should show: COG-E001 with solutions

# Test workspace error
cd /tmp && cognition-cli status
# Should show: COG-E301 with init suggestion

# Test verbose mode
cognition-cli lattice "invalid syntax" --verbose
# Should show stack trace
```

---

### Ticket 3: Add `--json` Output Mode to All Query Commands

**Label**: `enhancement`, `power-users`, `priority:high`
**Effort**: 4-6 hours
**Assignee**: TBD

**Description**:
Enable JSON output for all read/query commands to support scripting and automation.

**Acceptance Criteria**:

- [ ] Add `--json` flag to commands: `query`, `ask`, `patterns`, `concepts`, `security`, `workflow`, `proofs`, `audit`
- [ ] Ensure consistent JSON schema across all commands
- [ ] Disable colors/emojis when `--json` is used
- [ ] Output valid JSON (test with `jq`)
- [ ] Document JSON schemas in README or separate doc
- [ ] Add examples to command help text

**Commands to Update**:

1. `query` (already has `--lineage`, add `--json`)
2. `ask`
3. `patterns find-similar`
4. `patterns compare`
5. `patterns analyze`
6. `concepts list`
7. `concepts search`
8. `coherence check`
9. `security` subcommands (attacks, coverage-gaps, etc.)
10. `workflow` subcommands
11. `proofs` subcommands
12. `audit:transformations`
13. `audit:docs`

**JSON Schema Example**:

```typescript
// For query command
{
  "query": "authentication flow",
  "results": [
    {
      "id": "abc123...",
      "type": "function",
      "name": "authenticateUser",
      "file": "src/auth/index.ts",
      "line": 42,
      "similarity": 0.87
    }
  ],
  "metadata": {
    "count": 5,
    "depth": 0,
    "timestamp": "2025-11-15T10:30:00.000Z"
  }
}
```

**Files to modify**:

- All command files listed above
- Update `.action()` handlers to check for `--json` flag
- Create `src/utils/json-formatter.ts` for consistent formatting

**Testing**:

```bash
# Test JSON output
cognition-cli query "auth" --json | jq '.results[0].name'

# Test piping
cognition-cli security list --json | \
  jq -r '.items[] | select(.severity=="critical") | .text'
```

---

### Ticket 4: Standardize Logging (Unify on @clack/prompts)

**Label**: `refactor`, `consistency`, `priority:medium`
**Effort**: 4-6 hours
**Assignee**: TBD

**Description**:
Replace all `console.log`, `console.error` calls with @clack/prompts `log.*` functions for consistent output styling.

**Acceptance Criteria**:

- [ ] Audit all command files for `console.log` / `console.error` usage
- [ ] Replace with `log.info`, `log.error`, `log.warn`, `log.step`, `log.success`
- [ ] Ensure `--json` mode bypasses @clack formatting
- [ ] Add ESLint rule to prevent future `console.*` usage
- [ ] Test all commands for consistent styling

**Current State**:

- **351 occurrences** of `console.log/error/warn` in `src/commands/`
- Mixed usage of @clack/prompts and console.\* in same files

**Migration Pattern**:

```typescript
// Before
console.log('Starting operation...');
console.error('Operation failed:', error);

// After
import { log } from '@clack/prompts';

log.info('Starting operation...');
log.error('Operation failed:', error.message);
```

**Special Cases**:

- `console.log()` for `--json` output is OK (only use case)
- `console.error()` for error handler is OK (catches @clack failures)

**Files to modify**:

- All files in `src/commands/`
- `.eslintrc.js` (add no-console rule)

**ESLint Rule**:

```javascript
// .eslintrc.js
rules: {
  'no-console': ['error', { allow: [] }],  // Strict: no console.* allowed
}
```

**Testing**:

- Run all commands and verify consistent styling
- Check that `--json` mode still works (no @clack output)

---

## Phase 2: Polish (Priority: HIGH)

### Ticket 5: Add Progress Bars for Batch Operations

**Label**: `enhancement`, `ux`, `priority:high`
**Effort**: 4-6 hours
**Assignee**: TBD

**Description**:
Add progress bars with file counts and ETAs for long-running batch operations.

**Acceptance Criteria**:

- [ ] Add progress bar to `genesis` command (file processing)
- [ ] Add progress bar to `overlay generate` command (concept extraction)
- [ ] Add progress bar to `migrate:lance` command (migration)
- [ ] Show count: "Processing files... (127/543) 23%"
- [ ] Show ETA for operations >30s: "ETA: 1m 30s"
- [ ] Support Ctrl+C cancellation with cleanup message
- [ ] Test with large codebase (1000+ files)

**Implementation**:

```typescript
import { progress } from '@clack/prompts';

async function processManyFiles(files: string[]) {
  const bar = progress('Processing files');
  bar.start();

  for (let i = 0; i < files.length; i++) {
    await processFile(files[i]);
    const percent = (i + 1) / files.length;
    bar.update(percent, `${i + 1}/${files.length} files`);
  }

  bar.stop('All files processed');
}
```

**Files to modify**:

- `src/commands/genesis.ts`
- `src/commands/overlay/generate.ts`
- `src/commands/migrate-to-lance.ts`

**Testing**:

```bash
# Test progress bar
cognition-cli genesis src/

# Test cancellation
cognition-cli overlay generate structural_patterns
# Press Ctrl+C during processing
# Should show: "⚠️ Operation cancelled. Partial results saved."
```

---

### Ticket 6: Enhance Help Text with Examples for All Commands

**Label**: `documentation`, `ux`, `priority:high`
**Effort**: 1 day
**Assignee**: TBD

**Description**:
Add comprehensive help text to all commands including examples, use cases, and links to documentation.

**Acceptance Criteria**:

- [ ] Add examples to ALL 40+ commands using `.addHelpText('after', ...)`
- [ ] Include 2-3 examples per command
- [ ] Add "See also" section with related commands
- [ ] Link to online documentation
- [ ] Add troubleshooting hints where relevant
- [ ] Test `--help` output for readability

**Template**:

```typescript
.addHelpText('after', `
${chalk.bold('Examples:')}
  ${chalk.dim('# Description of what this does')}
  ${chalk.cyan('$ cognition-cli command --option value')}

  ${chalk.dim('# Another use case')}
  ${chalk.cyan('$ cognition-cli command --other-option')}

${chalk.bold('How it works:')}
  Brief explanation of what the command does and when to use it.

${chalk.bold('See also:')}
  ${chalk.cyan('cognition-cli related-command')}  - Related functionality

${chalk.dim('📖 Docs: https://mirzahusadzic.github.io/cogx/manual/...')}
`)
```

**Priority Commands** (highest usage):

1. `wizard`
2. `init`
3. `genesis`
4. `query`
5. `status`
6. `overlay generate`
7. `lattice`
8. `security` subcommands

**Files to modify**:

- All command files in `src/commands/`
- `src/cli.ts` (main command definitions)

**Testing**:

```bash
# Test help text
cognition-cli query --help
cognition-cli lattice --help
cognition-cli security attacks --help
```

---

### Ticket 7: Implement Tab Completion (Bash/Zsh/Fish)

**Label**: `enhancement`, `power-users`, `priority:medium`
**Effort**: 1-2 days
**Assignee**: TBD

**Description**:
Add shell completion for commands, subcommands, and context-aware option values.

**Acceptance Criteria**:

- [ ] Install and configure completion library (tabtab or omelette)
- [ ] Generate completion scripts for bash, zsh, fish
- [ ] Support command completion (all 40+ commands)
- [ ] Support subcommand completion (security, workflow, proofs, etc.)
- [ ] Support option completion (--project-root, --format, etc.)
- [ ] Context-aware completion:
  - Overlay names after `overlay generate` (suggest: structural_patterns, security_guidelines, etc.)
  - File paths for `-p` flag
  - Format types for `--format` (suggest: table, json, summary)
- [ ] Add installation command: `cognition-cli completion install --shell bash`
- [ ] Document setup in README
- [ ] Test on bash, zsh, fish

**Installation Flow**:

```bash
$ cognition-cli completion install --shell zsh
✓ Completion script installed to ~/.zshrc
ℹ️ Restart your shell or run: source ~/.zshrc

$ cognition-cli [TAB]
ask           genesis       query         wizard
audit         init          security      ...

$ cognition-cli security [TAB]
attacks       boundaries    cves          mandate
coherence     coverage-gaps list          query

$ cognition-cli overlay generate [TAB]
structural_patterns    security_guidelines    lineage_patterns
mission_concepts       operational_patterns   mathematical_proofs
strategic_coherence
```

**Files to create**:

- `src/commands/completion.ts` (completion command)
- `src/utils/completion-generator.ts` (script generator)
- `.completions/` (generated scripts directory)

**Files to modify**:

- `src/cli.ts` (add completion command)
- `package.json` (add tabtab dependency)
- `README.md` (document setup)

**Library Choice**:
Use [tabtab](https://github.com/npm/tabtab) (maintained by npm team, supports bash/zsh/fish)

**Testing**:

```bash
# Test installation
cognition-cli completion install --shell bash

# Test completions
cognition-cli [TAB][TAB]
cognition-cli overlay generate [TAB][TAB]
```

---

### Ticket 8: Add Statistics to Success Messages

**Label**: `enhancement`, `ux`, `priority:medium`
**Effort**: 2-3 hours
**Assignee**: TBD

**Description**:
Enhance success messages with operation statistics (files processed, time taken, nodes created, etc.).

**Acceptance Criteria**:

- [ ] Track operation timing for all long-running commands
- [ ] Show statistics after completion:
  - Files processed
  - Nodes/edges created
  - Time elapsed
  - Coherence score (where relevant)
- [ ] Add "Next steps" suggestions consistently
- [ ] Test with various commands

**Before/After**:

```typescript
// Before
outro(chalk.green('✓ PGC initialized'));

// After
const stats = {
  filesProcessed: 127,
  nodesCreated: 543,
  edgesCreated: 891,
  timeElapsed: 3.2,
  coherenceScore: 0.87,
};

outro(
  chalk.green(
    `✓ PGC initialized\n` +
      `  Processed ${stats.filesProcessed} files in ${stats.timeElapsed}s\n` +
      `  Created ${stats.nodesCreated} nodes, ${stats.edgesCreated} edges\n` +
      `  Coherence score: ${stats.coherenceScore}`
  )
);

log.info(
  chalk.dim('\n💡 Next: cognition-cli overlay generate structural_patterns')
);
```

**Commands to Update**:

1. `init`
2. `genesis`
3. `genesis:docs`
4. `overlay generate`
5. `update`
6. `migrate:lance`

**Files to modify**:

- All command files listed above
- Create `src/utils/stats-tracker.ts` for timing utilities

**Testing**:

```bash
# Test stats display
cognition-cli genesis src/
# Should show: "✓ Processed 127 files in 3.2s"

cognition-cli overlay generate structural_patterns
# Should show: "✓ Created 543 patterns in 8.1s"
```

---

### Ticket 9: Add Elapsed Time and ETA Display

**Label**: `enhancement`, `ux`, `priority:medium`
**Effort**: 3-4 hours
**Assignee**: TBD

**Description**:
Show elapsed time for completed operations and ETAs for long-running operations.

**Acceptance Criteria**:

- [ ] Show elapsed time for operations >5s
- [ ] Show ETA for operations >30s
- [ ] Format durations nicely (3m 42s, not 222000ms)
- [ ] Update spinner messages with progress: "Processing... (30/100) ETA: 2m 15s"
- [ ] Test with slow operations (large codebase)

**Implementation**:

```typescript
// src/utils/time-formatter.ts
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
}

export function calculateETA(
  processed: number,
  total: number,
  startTime: number
): number {
  const elapsed = Date.now() - startTime;
  const rate = processed / elapsed;
  const remaining = total - processed;
  return remaining / rate;
}

// Usage in command
const start = Date.now();
for (let i = 0; i < files.length; i++) {
  await processFile(files[i]);
  if (i % 10 === 0) {
    // Update every 10 files
    const eta = calculateETA(i, files.length, start);
    spinner.message = `Processing (${i}/${files.length}) ETA: ${formatDuration(eta)}`;
  }
}
spinner.stop(
  chalk.green(`✓ Completed in ${formatDuration(Date.now() - start)}`)
);
```

**Files to create**:

- `src/utils/time-formatter.ts`

**Files to modify**:

- `src/commands/genesis.ts`
- `src/commands/overlay/generate.ts`
- `src/commands/migrate-to-lance.ts`

**Testing**:

```bash
# Test ETA (may need large codebase)
cognition-cli genesis large-project/
# Should show: "Processing (120/500) ETA: 3m 15s"
```

---

## Phase 3: Delight (Priority: MEDIUM)

### Ticket 10: Add `--plain` Mode for Screen Readers

**Label**: `accessibility`, `enhancement`, `priority:medium`
**Effort**: 4-6 hours
**Assignee**: TBD

**Description**:
Add plain-text output mode that works well with screen readers and accessibility tools.

**Acceptance Criteria**:

- [ ] Add `--plain` flag to disable boxes, colors, and emojis
- [ ] Replace box-drawing characters with simple headers
- [ ] Replace emojis with text labels
- [ ] Ensure output reads well linearly (no columns/tables)
- [ ] Test with macOS VoiceOver
- [ ] Test with NVDA (Windows) if possible
- [ ] Document in README accessibility section

**Before/After**:

```
# Before (fancy)
┌───────────────────────────────────┐
│ abc123 [O2]                       │
│ Type    : attack_vector           │
│ Text    : SQL injection...        │
│ severity: critical                │
└───────────────────────────────────┘

# After (--plain)
=== Item abc123 (Overlay: O2) ===
Type: attack_vector
Text: SQL injection via unsanitized user input
Severity: critical
```

**Implementation**:

```typescript
// formatter.ts
export function formatItemPlain(item: OverlayItem): string {
  const lines = [];
  lines.push(
    `=== Item ${truncateHash(item.id)} (Overlay: ${extractOverlayType(item.id)}) ===`
  );

  if (item.metadata.type) {
    lines.push(`Type: ${item.metadata.type}`);
  }

  lines.push(`Text: ${cleanText(item.metadata.text)}`);

  for (const [key, value] of Object.entries(item.metadata)) {
    if (!['text', 'type'].includes(key)) {
      lines.push(`${key}: ${value}`);
    }
  }

  return lines.join('\n');
}
```

**Files to modify**:

- `src/cli.ts` (add --plain flag)
- `src/utils/formatter.ts` (add plain formatters)
- All command files (check --plain flag)

**Testing**:

```bash
# Test plain mode
cognition-cli status --plain
cognition-cli lattice "O2" --plain

# Test with screen reader
# macOS: Enable VoiceOver (Cmd+F5), navigate output
```

---

### Ticket 11: Create CLI Style Guide Document

**Label**: `documentation`, `dx`, `priority:medium`
**Effort**: 3-4 hours
**Assignee**: TBD

**Description**:
Document the CLI design system, style guidelines, and best practices for contributors.

**Acceptance Criteria**:

- [ ] Create `STYLE_GUIDE.md` in root
- [ ] Document color palette and usage
- [ ] Document emoji usage guidelines
- [ ] Document command naming conventions
- [ ] Document option flag patterns
- [ ] Document error handling standards
- [ ] Document exit codes
- [ ] Add examples of good/bad patterns

**Sections**:

1. **Command Structure**
   - Naming conventions (verb-noun vs noun-verb)
   - Subcommand patterns (space vs colon)
   - When to use sugar commands

2. **Option Flags**
   - Naming (kebab-case, short forms)
   - Boolean flags (presence vs value)
   - Required vs optional
   - Common flags (-p, -v, -h)

3. **Output Styling**
   - Color palette (when to use each color)
   - Emoji usage (sparingly, meaningfully)
   - Box-drawing characters
   - Typography (bold, dim, etc.)

4. **Error Handling**
   - CognitionError usage
   - Error codes
   - Solution suggestions
   - Exit codes

5. **Logging**
   - Use @clack/prompts exclusively
   - When to use log.info vs log.step
   - JSON output mode

6. **Interactive Elements**
   - When to use wizard
   - Prompt best practices
   - Validation patterns

**Files to create**:

- `STYLE_GUIDE.md`

**Files to modify**:

- `CONTRIBUTING.md` (link to style guide)

---

### Ticket 12: Add Command Aliases (w, q, s, etc.)

**Label**: `enhancement`, `power-users`, `priority:low`
**Effort**: 1-2 hours
**Assignee**: TBD

**Description**:
Add short command aliases for frequently used commands to reduce typing.

**Acceptance Criteria**:

- [ ] Add aliases using Commander.js `.alias()` method
- [ ] Document aliases in help text
- [ ] Add aliases to README command reference
- [ ] Test all aliases

**Proposed Aliases**:
| Command | Alias | Reason |
|---------|-------|--------|
| `wizard` | `w` | Most common first-run command |
| `query` | `q` | Frequently used |
| `status` | `s` | Quick coherence check |
| `init` | `i` | Common operation |
| `overlay` | `o` | Shorter for overlay operations |
| `genesis` | `g` | Code ingestion |
| `lattice` | `l` | Algebra queries |

**Implementation**:

```typescript
// cli.ts
program
  .command('wizard')
  .alias('w')
  .description('🧙 Interactive wizard (alias: w)');

program
  .command('query <question>')
  .alias('q')
  .description('Query the PGC (alias: q)');
```

**Files to modify**:

- `src/cli.ts` (add `.alias()` calls)
- `README.md` (document aliases)

**Testing**:

```bash
# Test aliases
cognition-cli w  # Should run wizard
cognition-cli q "auth"  # Should run query
cognition-cli s  # Should run status
```

---

### Ticket 13: Implement Config File Support (.cognitionrc)

**Label**: `enhancement`, `power-users`, `priority:low`
**Effort**: 1 day
**Assignee**: TBD

**Description**:
Add support for user/project configuration file to set defaults and preferences.

**Acceptance Criteria**:

- [ ] Support config file formats: `.cognitionrc.json`, `.cognitionrc.yml`, `cognition.config.js`
- [ ] Search locations: project root, home directory
- [ ] Configurable options:
  - `workbench.url`
  - `workbench.apiKey`
  - `defaults.format` (table, json, etc.)
  - `defaults.limit`
  - `defaults.verbose`
  - `overlays.preferred` (which to show by default)
- [ ] CLI flags override config file
- [ ] Add `--config` flag to specify custom config file path
- [ ] Validate config schema
- [ ] Document in README

**Config File Example**:

```yaml
# .cognitionrc.yml

workbench:
  url: http://localhost:8000
  apiKey: ${WORKBENCH_API_KEY} # Supports env var interpolation

defaults:
  format: table
  limit: 50
  verbose: false
  projectRoot: ~/projects/my-app

overlays:
  preferred:
    - O1 # Structural
    - O2 # Security
    - O4 # Mission

output:
  noColor: false
  noEmoji: false
  plain: false
```

**Implementation**:
Use [cosmiconfig](https://github.com/davidtheclark/cosmiconfig) for config file loading:

```typescript
// src/utils/config.ts
import { cosmiconfig } from 'cosmiconfig';
import { z } from 'zod';

const ConfigSchema = z.object({
  workbench: z
    .object({
      url: z.string().url(),
      apiKey: z.string().optional(),
    })
    .optional(),
  defaults: z
    .object({
      format: z.enum(['table', 'json', 'summary']).optional(),
      limit: z.number().optional(),
      verbose: z.boolean().optional(),
      projectRoot: z.string().optional(),
    })
    .optional(),
  overlays: z
    .object({
      preferred: z.array(z.string()).optional(),
    })
    .optional(),
  output: z
    .object({
      noColor: z.boolean().optional(),
      noEmoji: z.boolean().optional(),
      plain: z.boolean().optional(),
    })
    .optional(),
});

export async function loadConfig(): Promise<Config> {
  const explorer = cosmiconfig('cognition');
  const result = await explorer.search();

  if (!result) {
    return {}; // No config found, use defaults
  }

  // Validate schema
  return ConfigSchema.parse(result.config);
}
```

**Files to create**:

- `src/utils/config.ts` (config loader)
- `.cognitionrc.example.yml` (example config)

**Files to modify**:

- `src/cli.ts` (load config before parsing)
- `package.json` (add cosmiconfig dependency)
- `README.md` (document config)

**Testing**:

```bash
# Test config loading
echo "defaults:\n  limit: 100" > .cognitionrc.yml
cognition-cli query "auth"
# Should use limit: 100 by default

# Test CLI override
cognition-cli query "auth" --limit 10
# Should use limit: 10 (CLI overrides config)
```

---

### Ticket 14: Terminal Compatibility Testing & Fixes

**Label**: `testing`, `compatibility`, `priority:low`
**Effort**: 1 day
**Assignee**: TBD

**Description**:
Test CLI on all major terminals and add graceful degradation for unsupported features.

**Acceptance Criteria**:

- [ ] Test on macOS: iTerm2, Terminal.app
- [ ] Test on Windows: Windows Terminal, PowerShell, cmd.exe
- [ ] Test on Linux: GNOME Terminal, Konsole, Alacritty, kitty
- [ ] Test in SSH sessions (tmux, screen)
- [ ] Test in CI environments (GitHub Actions, GitLab CI)
- [ ] Fix any rendering issues
- [ ] Add `--simple` mode for basic terminals
- [ ] Detect Unicode support and degrade gracefully
- [ ] Document tested terminals in README

**Test Matrix**:
| Terminal | OS | Box Chars | Emojis | Colors | Result |
|----------|----|-----------| -------|--------|--------|
| iTerm2 | macOS | ✓ | ✓ | ✓ | PASS |
| Terminal.app | macOS | ✓ | ✓ | ✓ | PASS |
| Windows Terminal | Windows | ? | ? | ? | TBD |
| PowerShell | Windows | ? | ? | ? | TBD |
| cmd.exe | Windows | ? | ? | ? | TBD |
| GNOME Terminal | Linux | ? | ? | ? | TBD |
| Alacritty | Linux | ? | ? | ? | TBD |
| tmux | All | ? | ? | ? | TBD |
| GitHub Actions | CI | ✗ | ✗ | ✗ | Plain mode |

**Implementation**:

```typescript
// src/utils/terminal-capabilities.ts
export function detectTerminalCapabilities() {
  return {
    supportsUnicode:
      process.env.LANG?.includes('UTF-8') || process.platform === 'darwin',
    supportsColor: process.stdout.isTTY && !process.env.NO_COLOR,
    supportsBoxDrawing: process.env.TERM !== 'dumb',
    columns: process.stdout.columns || 80,
  };
}

// Graceful degradation
const caps = detectTerminalCapabilities();
const boxChars = caps.supportsBoxDrawing
  ? { topLeft: '┌', horizontal: '─', topRight: '┐' }
  : { topLeft: '+', horizontal: '-', topRight: '+' };
```

**Files to create**:

- `src/utils/terminal-capabilities.ts`
- `docs/TESTED_TERMINALS.md` (test results)

**Files to modify**:

- `src/utils/formatter.ts` (use capability detection)

**Testing Checklist**:

- [ ] Box characters render correctly
- [ ] Emojis display (or fallback to text)
- [ ] Colors work (or disabled gracefully)
- [ ] Width detection works
- [ ] Piped output has no ANSI codes
- [ ] CI environment produces clean output

---

## Phase 4: Innovation (Priority: LOW)

### Ticket 15: Add ASCII Dependency Graph Visualization

**Label**: `feature`, `visualization`, `priority:low`
**Effort**: 2-3 days
**Assignee**: TBD

**Description**:
Add ASCII art visualization of dependency graphs and lattice structures.

**Acceptance Criteria**:

- [ ] Create `cognition-cli visualize deps <symbol>` command
- [ ] Render dependency tree as ASCII art
- [ ] Support depth limiting
- [ ] Color-code by overlay type
- [ ] Support horizontal and vertical layouts
- [ ] Export as image (optional, using playwright/puppeteer)

**Example Output**:

```
UserService
├─ AuthService [O2]
│  ├─ TokenManager [O2]
│  │  └─ JWTLib [external]
│  └─ Database [O1]
├─ Logger [O5]
└─ ConfigService [O1]
   └─ EnvLoader [O1]

Dependencies: 7 total, 3 overlays
```

**Libraries**:

- [archy](https://github.com/substack/node-archy) for tree rendering
- Or implement custom using box-drawing characters

**Files to create**:

- `src/commands/visualize.ts`
- `src/utils/tree-renderer.ts`

**Testing**:

```bash
cognition-cli visualize deps UserService
cognition-cli visualize deps UserService --depth 2
cognition-cli visualize lattice "O1 - O2"  # Show diff as tree
```

---

### Ticket 16: Natural Language Command Parsing (AI-Powered)

**Label**: `feature`, `ai`, `priority:low`
**Effort**: 1 week
**Assignee**: TBD

**Description**:
Add natural language interface for commands using Claude/LLM to parse intent.

**Acceptance Criteria**:

- [ ] Add `cognition-cli nl "<natural language query>"` command
- [ ] Parse user intent and map to CLI commands
- [ ] Show suggested command before execution
- [ ] Ask for confirmation
- [ ] Support multi-step workflows
- [ ] Learn from user corrections

**Example Usage**:

```bash
$ cognition-cli nl "show me security issues"
ℹ️ Interpreting: show me security issues

💡 Suggested command:
   cognition-cli security list --format table

? Execute this command? (Y/n) y

[Executes: cognition-cli security list --format table]

$ cognition-cli nl "find functions similar to authenticateUser"
💡 Suggested command:
   cognition-cli patterns find-similar authenticateUser

? Execute this command? (Y/n) y
```

**Implementation**:
Use Claude API to parse natural language:

```typescript
// src/commands/nl.ts
async function parseNaturalLanguage(query: string): Promise<string> {
  const prompt = `
You are a CLI command interpreter for Cognition Σ.

Available commands:
- cognition-cli query <question>
- cognition-cli security list
- cognition-cli patterns find-similar <symbol>
- [full command reference]

User query: "${query}"

Output only the CLI command to execute, nothing else.
`;

  const response = await callClaude(prompt);
  return response.trim();
}
```

**Files to create**:

- `src/commands/nl.ts` (natural language command)
- `src/utils/intent-parser.ts` (LLM integration)

**Testing**:

```bash
cognition-cli nl "what security vulnerabilities do we have?"
cognition-cli nl "find all code related to authentication"
cognition-cli nl "check if mission and code are aligned"
```

---

## Summary & Prioritization

### Must-Have (Phase 1): 1-2 days

- ✅ Accessibility flags (--no-color, --no-emoji)
- ✅ Standardized error handling (CognitionError)
- ✅ JSON output for all commands
- ✅ Unified logging (@clack/prompts)

### Should-Have (Phase 2): 1 week

- ✅ Progress bars with ETAs
- ✅ Comprehensive help text
- ✅ Tab completion
- ✅ Statistics in success messages

### Nice-to-Have (Phase 3): 2 weeks

- ✅ Plain mode for screen readers
- ✅ Style guide documentation
- ✅ Command aliases
- ✅ Config file support
- ✅ Terminal compatibility testing

### Future (Phase 4): 1+ month

- ⭐ ASCII visualizations
- ⭐ Natural language parsing
- ⭐ Interactive TUI enhancements
- ⭐ Collaboration features

---

## Getting Started

**For Contributors**:

1. Pick a ticket from Phase 1 (Critical Fixes)
2. Read the full description and acceptance criteria
3. Review code examples in UX_ANALYSIS_REPORT.md
4. Create a branch: `ux/ticket-<number>-<short-name>`
5. Implement, test, and open PR
6. Reference this roadmap in PR description

**For Project Maintainers**:

1. Create GitHub Issues from these tickets
2. Apply labels (enhancement, accessibility, priority:high, etc.)
3. Assign to milestones (v2.4.0, v2.5.0, etc.)
4. Link to UX_ANALYSIS_REPORT.md for full context

---

**Total Estimated Effort**:

- Phase 1: 2-3 days (critical)
- Phase 2: 1 week (high priority)
- Phase 3: 2 weeks (polish)
- Phase 4: 1+ month (innovation)

**Full UX Overhaul**: ~4-6 weeks total
