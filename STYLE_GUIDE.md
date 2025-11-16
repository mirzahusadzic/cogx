# Cognition CLI Style Guide

This document defines the style guidelines for Cognition CLI development to ensure consistency across all commands and contributions.

## Command Structure

### Naming Conventions

**Primary Commands** (verb-based):
- Use imperative verbs: `init`, `query`, `generate`, `list`
- Single word when possible: `status`, `watch`, `update`
- Hyphenated for multi-word: `blast-radius`

**Subcommands** (space separator):
- Primary commands with variants: `overlay generate`, `overlay list`
- Grouped by category: `security attacks`, `workflow patterns`

**Command Variants** (colon separator):
- Related but distinct operations: `genesis:docs`, `audit:transformations`
- Use sparingly - prefer subcommands for new features

**Examples**:
```bash
# ✓ Good
cognition-cli init
cognition-cli overlay generate structural_patterns
cognition-cli security attacks
cognition-cli genesis:docs

# ✗ Avoid
cognition-cli initialize-workspace
cognition-cli generate-overlay-structural-patterns
cognition-cli get-security-attacks
```

### Command Aliases

Short aliases for frequently used commands:
- `w` → `wizard`
- `q` → `query`
- `s` → `status`
- `i` → `init`
- `g` → `genesis`
- `l` → `lattice`

Always document aliases in help text:
```typescript
.command('wizard')
.alias('w')
.description('🧙 Interactive wizard (alias: w)')
```

## Option Flags

### Naming

**Flag Format**:
- Long form: `--kebab-case` (always)
- Short form: `-x` (single letter, common flags only)

**Common Flags** (use consistently):
```
-h, --help                Show help
-v, --verbose             Verbose output
-q, --quiet               Quiet mode (errors only)
-p, --project-root <path> Project root directory
-f, --format <type>       Output format
-l, --limit <number>      Limit results
-w, --workbench <url>     Workbench URL
```

**Boolean Flags**:
- Use presence: `--verbose` (not `--verbose=true`)
- Use negation: `--no-color` (not `--disable-color`)
- Default to false: `--force`, `--dry-run`

**Examples**:
```bash
# ✓ Good
--project-root /path/to/project
--no-color
--format json
--limit 50

# ✗ Avoid
--projectRoot
--disable-colors
--output-format=json
--max-results=50
```

### Required vs Optional

- Required arguments: `<argument>`
- Optional arguments: `[argument]`
- Provide sensible defaults when possible

```typescript
// ✓ Good
.command('query <question>')
.option('-d, --depth <level>', 'Depth of dependency traversal', '0')

// ✗ Avoid
.command('query [question]') // Should be required
.option('--depth <level>') // Missing default
```

## Output Styling

### Color Palette

**Semantic Colors** (use chalk):
```typescript
import chalk from 'chalk';

// Status
chalk.green('✓ Success')
chalk.red('✗ Error')
chalk.yellow('⚠ Warning')
chalk.blue('ℹ Info')

// Emphasis
chalk.bold('Important')
chalk.dim('Secondary info')
chalk.cyan('Values and data')

// Overlays (consistent!)
O1: chalk.blue       // Structural
O2: chalk.red        // Security
O3: chalk.yellow     // Lineage
O4: chalk.magenta    // Mission
O5: chalk.cyan       // Operational
O6: chalk.green      // Mathematical
O7: chalk.white      // Coherence
```

**Accessibility**:
- Always use symbols + text (not color alone): `✓ PASS` not just green `PASS`
- Support `--no-color` flag
- Test with color blindness simulators

### Emoji Usage

**When to Use**:
- Command prefixes: `🧙 wizard`, `🖥️ tui`, `🤔 ask`
- Status indicators: `✓`, `✗`, `⚠️`, `ℹ️`
- Concept headers: `📦`, `🔍`, `💡`

**When NOT to Use**:
- In tables or lists (use symbols: ✓ ✗)
- In error messages (use text: "Error")
- Excessively (1-2 per output max)

**Fallbacks**:
- Support `--no-emoji` flag
- Provide ASCII alternatives: `[OK]`, `[X]`, `[!]`

**Examples**:
```typescript
// ✓ Good
emoji('✓', '[OK]') + ' Success'
emoji('📖', 'Docs:') + ' https://...'

// ✗ Overuse
console.log('🎉 Success! 🚀 Your PGC is ready! 🎊');
```

### Typography

**Bold**:
- Section headers
- Emphasized commands
- Important values

**Dim/Gray**:
- Secondary information
- Metadata (timestamps, file paths)
- Hints and tips

**Examples**:
```typescript
console.log(chalk.bold('\nNext steps:'));
console.log('  • Run queries: ' + chalk.cyan('cognition-cli query'));
console.log(chalk.dim('  Last updated: 2025-11-15'));
```

## Error Handling

### CognitionError Class

**Always use CognitionError** (not generic Error):

```typescript
import { CognitionError, ErrorCodes } from './utils/errors.js';

// ✓ Good - Specific error with solutions
throw ErrorCodes.WORKSPACE_NOT_FOUND(searchPath);

// ✓ Good - Custom error
throw new CognitionError(
  'COG-E123',
  'Clear Title',
  'Detailed explanation of what went wrong',
  [
    'Suggested solution 1',
    'Suggested solution 2',
  ],
  'https://docs.link'
);

// ✗ Avoid - Generic error
throw new Error('Workspace not found');
```

### Error Code Schema

```
COG-E0xx: User input errors
COG-E1xx: System errors (permissions, disk)
COG-E2xx: Network errors (API, timeouts)
COG-E3xx: PGC errors (workspace issues)
COG-E4xx: Internal errors (bugs)
```

### Error Messages

**Structure**:
1. **Title**: Short, user-friendly (< 50 chars)
2. **Message**: Detailed explanation
3. **Solutions**: 2-4 actionable steps
4. **Docs Link**: Troubleshooting documentation
5. **Cause**: Original error (verbose mode only)

**Tone**:
- Clear and concise
- Action-oriented ("Run X" not "You could try running X")
- Blame-free (no "you forgot" or "you did wrong")
- Helpful (suggest solutions, not just problems)

**Examples**:
```typescript
// ✓ Good
'No .open_cognition directory found'
'Run "cognition-cli init" to create a new workspace'

// ✗ Avoid
'You forgot to initialize the workspace'
'Please make sure you have run init first'
```

## Logging

### Use @clack/prompts Exclusively

**Standard logging**:
```typescript
import { log, spinner, intro, outro } from '@clack/prompts';

log.info('Starting operation...');
log.warn('This will delete data');
log.error('Operation failed');
log.success('✓ Complete');
log.step('Step 1 of 3');
```

**Spinners**:
```typescript
const s = spinner();
s.start('Processing files...');
// ... work ...
s.stop(chalk.green('✓ Complete'));
```

**Framing**:
```typescript
intro(chalk.bold('🧙 PGC Setup Wizard'));
// ... wizard steps ...
outro(chalk.green('✓ Setup complete!'));
```

**JSON Mode Exception**:
```typescript
// ONLY use console.log for JSON output
if (options.json) {
  console.log(JSON.stringify(result));
} else {
  log.info('Result:');
  // ... formatted output ...
}
```

### Never Use console.*

**Forbidden** (except JSON output):
```typescript
// ✗ Avoid
console.log('Starting...');
console.error('Failed');
console.warn('Warning');

// ✓ Use instead
import { log } from '@clack/prompts';
log.info('Starting...');
log.error('Failed');
log.warn('Warning');
```

## Exit Codes

### Standard Codes

```
0: Success
1: User error (bad input, file not found)
2: System error (permission denied, network)
3: Internal error (bug, unexpected condition)
130: SIGINT (Ctrl+C)
```

### Usage

```typescript
// Success
process.exit(0);

// User error
throw ErrorCodes.INVALID_ARGUMENT('--limit', 'abc', 'number');
// (handler exits with 1)

// Graceful SIGINT
process.on('SIGINT', () => {
  log.warn('\n⚠️ Operation cancelled');
  process.exit(130);
});
```

## Progress Feedback

### Spinners

For indeterminate operations:
```typescript
const s = spinner();
s.start('Connecting to workbench...');
const result = await fetchData();
s.stop(chalk.green('✓ Connected'));
```

### Progress Bars

For batch operations with known count:
```typescript
import { progress } from '@clack/prompts';

const bar = progress('Processing files');
bar.start();
for (let i = 0; i < files.length; i++) {
  await processFile(files[i]);
  bar.update((i + 1) / files.length, `${i + 1}/${files.length}`);
}
bar.stop('✓ All files processed');
```

### Time Estimates

Show for operations > 30s:
```typescript
import { formatProgress, Timer } from './utils/time-formatter.js';

const timer = new Timer();
timer.start();

for (let i = 0; i < items.length; i++) {
  const msg = formatProgress(i, items.length, timer.startTime, 'Processing');
  spinner.message = msg;
}
```

## Success Messages

### Include Statistics

```typescript
// ✓ Good
outro(chalk.green(
  `✓ Processed 127 files in 3.2s\n` +
  `  Created 543 nodes, 891 edges\n` +
  `  Coherence score: 0.87`
));

// ✗ Minimal
outro('Done');
```

### Show Next Steps

```typescript
log.info(chalk.bold('\nNext steps:'));
log.info('  • Run queries: ' + chalk.cyan('cognition-cli query "auth"'));
log.info('  • Watch for changes: ' + chalk.cyan('cognition-cli watch'));
log.info('  • View guides: ' + chalk.cyan('cognition-cli guide'));
```

## Help Text

### Structure

```typescript
program
  .command('query <question>')
  .description('Query the PGC knowledge graph')
  .option('-p, --project-root <path>', 'Project root', process.cwd())
  .option('-d, --depth <level>', 'Dependency depth (0=direct)', '0')
  .option('--json', 'Output as JSON')
  .addHelpText('after', `
${chalk.bold('Examples:')}
  ${chalk.dim('# Basic query')}
  ${chalk.cyan('$ cognition-cli query "authentication"')}

  ${chalk.dim('# With dependency traversal')}
  ${chalk.cyan('$ cognition-cli query "database" --depth 2')}

  ${chalk.dim('# JSON output for scripting')}
  ${chalk.cyan('$ cognition-cli query "API" --json | jq')}

${chalk.bold('How it works:')}
  Searches the PGC knowledge graph and returns relevant code
  symbols with their relationships and metadata.

${chalk.bold('See also:')}
  ${chalk.cyan('cognition-cli lattice')} - Boolean algebra queries
  ${chalk.cyan('cognition-cli ask')} - AI-synthesized answers

${chalk.dim('📖 Docs: https://mirzahusadzic.github.io/cogx/manual/')}
  `)
  .action(queryAction);
```

### Required Elements

1. **Description**: Clear, one-line summary
2. **Examples**: 2-3 real-world examples
3. **How it works**: Brief explanation
4. **See also**: Related commands
5. **Docs link**: Full documentation URL

## Testing

### What to Test

**Required**:
- All error paths (throw correct CognitionError)
- JSON output format (valid JSON schema)
- Help text rendering (no broken links)
- Accessibility flags (--no-color, --no-emoji work)

**Recommended**:
- Success paths (happy flow)
- Edge cases (empty input, large data)
- Terminal compatibility (at least 3 terminals)

### Example Test

```typescript
describe('query command', () => {
  it('throws WORKSPACE_NOT_FOUND when PGC missing', async () => {
    await expect(queryCommand('test', { projectRoot: '/tmp' }))
      .rejects
      .toThrow(CognitionError);
  });

  it('outputs valid JSON in --json mode', async () => {
    process.env.COGNITION_FORMAT = 'json';
    const output = await captureOutput(() => queryCommand('test'));
    expect(() => JSON.parse(output)).not.toThrow();
  });
});
```

## Deprecation

### How to Deprecate

1. Add warning in current version
2. Document replacement in help text
3. Remove in next major version

```typescript
// v2.3.0 - Add deprecation warning
.command('old-command')
.action(() => {
  log.warn(chalk.yellow('⚠️ This command is deprecated'));
  log.warn('Use ' + chalk.cyan('new-command') + ' instead');
  log.warn('Will be removed in v3.0.0');
  // ... still execute old behavior ...
});

// v3.0.0 - Remove command
```

## Pull Request Checklist

Before submitting:
- [ ] Follows naming conventions (commands, flags)
- [ ] Uses CognitionError for all errors
- [ ] Uses @clack/prompts for logging (not console.*)
- [ ] Includes help text with examples
- [ ] Supports `--json`, `--no-color`, `--verbose` flags
- [ ] Has tests for error cases
- [ ] Updates CHANGELOG.md
- [ ] Links to this style guide in PR description

## Resources

- [Commander.js Docs](https://github.com/tj/commander.js)
- [@clack/prompts Docs](https://github.com/natemoo-re/clack)
- [Chalk Docs](https://github.com/chalk/chalk)
- [NO_COLOR Standard](https://no-color.org/)
- [CLI Guidelines](https://clig.dev/)

---

**Questions?** Open an issue or ask in discussions.
**Suggestions?** PRs welcome to improve this guide!
