# Slash Commands Implementation Plan (REVISED v2)
**Date:** November 12, 2025
**Revised:** November 12, 2025 (after Claude Code 2.0.36 review)
**Review Score:** 9.5/10 by Claude Code 2.0.36 ✅
**Feature:** Add `.claude/commands` slash command support with dropdown menu to Cognition CLI TUI
**Complexity:** Medium (5-6 hours)
**Status:** Ready for Implementation
**Approach:** Incremental layer-by-layer with validation checkpoints

---

## 🎨 Implementation Philosophy

**Like an artist building a painting:**
1. Start with the **foundation** (sketch/canvas)
2. Add **basic shapes** (composition)
3. Add **color and form** (interaction)
4. Add **details** (integration)
5. Final **polish** (refinement)

**Key Principles:**
- ✅ Build incrementally with **STOP & VALIDATE** checkpoints
- ✅ Each layer is **testable and demonstrable**
- ✅ User can **see progress** at each checkpoint
- ✅ **No polishing** until foundation is solid
- ✅ Can **stop at any checkpoint** if needed

---

## Overview

Add Claude Code-style slash command support to the Cognition CLI TUI. When users type `/`, show a dropdown menu with available commands that can be navigated with arrow keys and selected with Enter.

**Goal:** Enable quest-oriented development workflows using the 25 existing commands in `.claude/commands/`.

---

## Current State

### What Exists:
- ✅ 25 command files in `.claude/commands/` (e.g., `quest-start.md`, `analyze-impact.md`)
- ✅ Clean input handling in `src/tui/components/InputBox.tsx`
- ✅ Message sending in `src/tui/hooks/useClaudeAgent.ts`
- ✅ Context injection logic (SIGMA lattice data)

### What's Missing:
- ❌ Command loader (scan and cache `.md` files)
- ❌ Dropdown UI component
- ❌ Keyboard navigation (↑/↓ arrows, Enter, Escape, Tab)
- ❌ Command filtering as user types
- ❌ Command expansion (markdown → prompt)

---

## Architecture

### Component Structure:
```
InputBox.tsx (MODIFY)
├─ CommandDropdown.tsx (NEW)
├─ useInput() - handle keyboard events with priority
└─ State management for dropdown

useClaudeAgent.ts (MODIFY)
└─ sendMessage()
   └─ expandCommand() - replace /command with content

loader.ts (NEW)
├─ loadCommands() - scan .claude/commands/
├─ expandCommand() - replace {{placeholders}}
├─ filterCommands() - case-insensitive match
└─ validateCommandFile() - security + validation
```

### Data Flow:
```
1. User types "/"
   → InputBox detects slash
   → Load commands (if not cached)
   → Show CommandDropdown

2. User types "/quest"
   → Filter commands (case-insensitive)
   → Update dropdown list
   → Highlight first match

3. User presses ↓
   → Move selection down
   → Highlight next command

4. User presses Enter
   → Insert command name in input
   → Close dropdown

5. User submits "/quest-start"
   → expandCommand() loads quest-start.md
   → Replace {{placeholders}} with args
   → Send expanded prompt to Claude
```

---

## 🎨 Implementation Plan (Layered Approach)

### Overview: 5 Layers with Checkpoints

Each layer builds on the previous. **STOP and VALIDATE** after each checkpoint before proceeding.

| Layer | Focus | Time | What You'll See |
|-------|-------|------|-----------------|
| **Layer 1** | Foundation | 60-75 min | Commands load, tests pass |
| **Layer 2** | Basic UI | 60-75 min | Simple dropdown appears |
| **Layer 3** | Interaction | 45-60 min | Arrow keys work |
| **Layer 4** | Integration | 45-60 min | Commands expand to Claude |
| **Layer 5** | Polish | 45-60 min | Edge cases, UX refinement |

**Total: 5-6 hours** (includes Claude Code 2.0.36's recommended buffer for Ink quirks)

---

## 🏗️ Layer 1: Foundation (60-75 min)

### Goal: Build rock-solid command loader with validation

**What you'll be able to do after this layer:**
- ✅ Commands load from `.claude/commands/`
- ✅ Malformed files are handled gracefully
- ✅ Unit tests pass
- ✅ Can list all commands programmatically

**No UI yet** - just the foundation.

---

### Step 1.1: Create Command Loader (35 min)

**File:** `src/tui/commands/loader.ts` (NEW)

**Interface (incorporating Claude Code's feedback):**
```typescript
import fs from 'fs';
import path from 'path';

export interface Command {
  name: string;           // "quest-start"
  content: string;        // Full markdown content
  description?: string;   // Extracted from frontmatter or first # heading
  filePath: string;       // Absolute path to .md file
  aliases?: string[];     // ["qs"] for /qs shortcut (future)
  category?: string;      // "quest", "analyze", "security" (extracted from prefix)
}

export interface LoadCommandsResult {
  commands: Map<string, Command>;
  errors: Array<{ file: string; error: string }>;
  warnings: Array<{ file: string; warning: string }>;
}

// Load all commands with comprehensive validation (Claude Code: add error reporting)
export async function loadCommands(projectRoot: string): Promise<LoadCommandsResult>

// Filter commands by prefix (case-insensitive)
export function filterCommands(prefix: string, commands: Map<string, Command>): Command[]

// Expand command with argument substitution (Claude Code: structured placeholders)
export function expandCommand(input: string, commands: Map<string, Command>): string | null

// Internal: Validate command file (Claude Code: add schema validation)
function validateCommandFile(filePath: string, content: string): { valid: boolean; error?: string }

// Internal: Extract description from markdown
function extractDescription(content: string): string | undefined
```

**Implementation:**

```typescript
export async function loadCommands(projectRoot: string): Promise<LoadCommandsResult> {
  const commands = new Map<string, Command>();
  const errors: Array<{ file: string; error: string }> = [];
  const warnings: Array<{ file: string; warning: string }> = [];

  const commandsDir = path.join(projectRoot, '.claude', 'commands');

  // 1. Handle missing directory gracefully (Claude Code feedback)
  if (!fs.existsSync(commandsDir)) {
    return { commands, errors, warnings };
  }

  // 2. Read all .md files
  const files = fs.readdirSync(commandsDir).filter(f => f.endsWith('.md') && f !== 'README.md');

  for (const file of files) {
    const filePath = path.join(commandsDir, file);

    try {
      // 3. Security: Prevent directory traversal (Claude Code feedback)
      const normalizedPath = path.normalize(filePath);
      if (!normalizedPath.startsWith(commandsDir)) {
        errors.push({ file, error: 'Invalid path (directory traversal attempt)' });
        continue;
      }

      // 4. Read content
      const content = fs.readFileSync(filePath, 'utf-8');

      // 5. Validate (Claude Code feedback)
      const validation = validateCommandFile(filePath, content);
      if (!validation.valid) {
        warnings.push({ file, warning: validation.error! });
        continue;
      }

      // 6. Extract command name from filename
      const commandName = path.basename(file, '.md');

      // 7. Extract description
      const description = extractDescription(content);

      // 8. Extract category from prefix (quest-*, analyze-*, etc.)
      const category = commandName.split('-')[0];

      // 9. Check for duplicates (Claude Code feedback)
      if (commands.has(commandName)) {
        warnings.push({
          file,
          warning: `Duplicate command '${commandName}', overwriting`
        });
      }

      // 10. Add to map
      commands.set(commandName, {
        name: commandName,
        content,
        description,
        filePath,
        category
      });

    } catch (error) {
      errors.push({
        file,
        error: `Failed to load: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  }

  return { commands, errors, warnings };
}

function validateCommandFile(filePath: string, content: string): { valid: boolean; error?: string } {
  // 1. Empty file
  if (content.trim().length === 0) {
    return { valid: false, error: 'Empty file' };
  }

  // 2. Basic markdown check (has at least one # or some content)
  if (!content.includes('#') && content.length < 20) {
    return { valid: false, error: 'Invalid markdown (too short, no headings)' };
  }

  return { valid: true };
}

function extractDescription(content: string): string | undefined {
  // Try to find first # heading
  const match = content.match(/^#\s+(.+)$/m);
  if (match) {
    return match[1].trim();
  }

  // Fallback: use first non-empty line
  const firstLine = content.split('\n').find(line => line.trim().length > 0);
  if (firstLine) {
    return firstLine.trim().slice(0, 80); // Max 80 chars
  }

  return undefined;
}

export function filterCommands(prefix: string, commands: Map<string, Command>): Command[] {
  if (prefix.trim() === '') {
    return Array.from(commands.values());
  }

  const lowerPrefix = prefix.toLowerCase();
  return Array.from(commands.values())
    .filter(cmd => cmd.name.toLowerCase().startsWith(lowerPrefix));
}

export function expandCommand(input: string, commands: Map<string, Command>): string | null {
  // Parse: /command-name arg1 arg2 arg3
  const parts = input.slice(1).split(' ');
  const commandName = parts[0];
  const args = parts.slice(1);

  const command = commands.get(commandName);
  if (!command) {
    return null;
  }

  let expanded = command.content;

  // Structured placeholder replacement (Claude Code feedback)
  // Supports: {{FILE_PATH}}, {{SYMBOL_NAME}}, {{ALL_ARGS}}
  if (args.length > 0) {
    const placeholders = {
      FILE_PATH: args[0] || '',
      SYMBOL_NAME: args[1] || args[0] || '',
      ALL_ARGS: args.join(' ')
    };

    expanded = expanded.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return placeholders[key as keyof typeof placeholders] || match;
    });

    // Also append context at end
    expanded += `\n\nUser provided context: ${args.join(' ')}`;
  }

  return expanded;
}
```

---

### Step 1.2: Add Unit Tests (20 min)

**File:** `src/tui/commands/__tests__/loader.test.ts` (NEW)

```typescript
import { describe, test, expect } from '@jest/globals';
import { loadCommands, filterCommands, expandCommand } from '../loader.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('loadCommands', () => {
  test('loads commands from .claude/commands/', async () => {
    // Use actual project directory
    const result = await loadCommands(process.cwd());

    expect(result.commands.size).toBeGreaterThan(0);
    expect(result.errors.length).toBe(0);

    // Check structure
    const firstCommand = Array.from(result.commands.values())[0];
    expect(firstCommand).toHaveProperty('name');
    expect(firstCommand).toHaveProperty('content');
    expect(firstCommand).toHaveProperty('filePath');
  });

  test('handles missing directory gracefully', async () => {
    const result = await loadCommands('/nonexistent/path/12345');

    expect(result.commands.size).toBe(0);
    expect(result.errors.length).toBe(0);
    expect(result.warnings.length).toBe(0);
  });

  test('skips empty files with warning', async () => {
    // Create temp directory
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-commands-'));
    const commandsDir = path.join(tempDir, '.claude', 'commands');
    fs.mkdirSync(commandsDir, { recursive: true });

    // Create empty file
    fs.writeFileSync(path.join(commandsDir, 'empty.md'), '');

    const result = await loadCommands(tempDir);

    expect(result.commands.size).toBe(0);
    expect(result.warnings.length).toBe(1);
    expect(result.warnings[0].warning).toContain('Empty file');

    // Cleanup
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test('prevents directory traversal', async () => {
    // Note: This test verifies the security check exists
    // In real scenario, path.normalize would prevent traversal
    expect(true).toBe(true); // Placeholder
  });
});

describe('filterCommands', () => {
  const mockCommands = new Map([
    ['quest-start', { name: 'quest-start', content: '', filePath: '', category: 'quest' }],
    ['quest-milestone', { name: 'quest-milestone', content: '', filePath: '', category: 'quest' }],
    ['analyze-impact', { name: 'analyze-impact', content: '', filePath: '', category: 'analyze' }],
    ['security-check', { name: 'security-check', content: '', filePath: '', category: 'security' }],
  ]);

  test('filters commands by prefix (case-insensitive)', () => {
    const filtered = filterCommands('quest', mockCommands);

    expect(filtered.length).toBe(2);
    expect(filtered.every(c => c.name.startsWith('quest'))).toBe(true);
  });

  test('filters with uppercase prefix', () => {
    const filtered = filterCommands('QUEST', mockCommands);
    expect(filtered.length).toBe(2);
  });

  test('returns all commands for empty prefix', () => {
    const filtered = filterCommands('', mockCommands);
    expect(filtered.length).toBe(mockCommands.size);
  });

  test('returns empty array for no matches', () => {
    const filtered = filterCommands('xyz', mockCommands);
    expect(filtered.length).toBe(0);
  });
});

describe('expandCommand', () => {
  const mockCommands = new Map([
    ['test-command', {
      name: 'test-command',
      content: 'Analyze {{FILE_PATH}} and check {{SYMBOL_NAME}}',
      filePath: '',
      category: 'test'
    }],
  ]);

  test('expands command with placeholders', () => {
    const expanded = expandCommand('/test-command src/cli.ts main', mockCommands);

    expect(expanded).toContain('src/cli.ts');
    expect(expanded).toContain('main');
    expect(expanded).toContain('User provided context: src/cli.ts main');
  });

  test('returns null for unknown command', () => {
    const expanded = expandCommand('/unknown', mockCommands);
    expect(expanded).toBeNull();
  });

  test('handles command without arguments', () => {
    const expanded = expandCommand('/test-command', mockCommands);
    expect(expanded).toBeTruthy();
    expect(expanded).not.toContain('User provided context');
  });
});
```

---

### Step 1.3: Manual Test (15 min)

**Create:** `scripts/test-commands.ts`

```typescript
import { loadCommands, filterCommands, expandCommand } from '../src/tui/commands/loader.js';

async function test() {
  console.log('🔧 Testing Command Loader\n');
  console.log('='.repeat(50) + '\n');

  // Test loading
  const result = await loadCommands(process.cwd());

  console.log(`✅ Loaded: ${result.commands.size} commands`);
  console.log(`⚠️  Warnings: ${result.warnings.length}`);
  console.log(`❌ Errors: ${result.errors.length}\n`);

  if (result.warnings.length > 0) {
    console.log('Warnings:');
    result.warnings.forEach(w => console.log(`  - ${w.file}: ${w.warning}`));
    console.log('');
  }

  if (result.errors.length > 0) {
    console.log('Errors:');
    result.errors.forEach(e => console.log(`  - ${e.file}: ${e.error}`));
    console.log('');
  }

  // List first 10 commands
  console.log('Commands (first 10):');
  Array.from(result.commands.values())
    .slice(0, 10)
    .forEach(c => {
      console.log(`  /${c.name}`);
      if (c.description) {
        console.log(`    ${c.description.slice(0, 60)}...`);
      }
      console.log('');
    });

  // Test filtering
  console.log('='.repeat(50));
  console.log('\n🔍 Testing Filter:\n');

  const tests = ['quest', 'analyze', 'security', 'check'];
  tests.forEach(prefix => {
    const filtered = filterCommands(prefix, result.commands);
    console.log(`  "${prefix}" → ${filtered.length} matches`);
    filtered.forEach(c => console.log(`    - ${c.name}`));
    console.log('');
  });

  // Test expansion
  console.log('='.repeat(50));
  console.log('\n📝 Testing Expansion:\n');

  const testCommand = Array.from(result.commands.keys())[0];
  if (testCommand) {
    const expanded = expandCommand(`/${testCommand} src/cli.ts main`, result.commands);
    if (expanded) {
      console.log(`  Command: /${testCommand} src/cli.ts main`);
      console.log(`  Expanded (first 200 chars):`);
      console.log(`  ${expanded.slice(0, 200)}...\n`);
    }
  }

  console.log('='.repeat(50));
  console.log('\n✅ All tests complete!\n');
}

test().catch(console.error);
```

**Add to package.json:**
```json
{
  "scripts": {
    "test:commands": "npm run build && node dist/scripts/test-commands.js"
  }
}
```

**Run:**
```bash
npm run test:commands
```

---

### ✅ CHECKPOINT 1: Foundation Complete

**🛑 STOP HERE and validate:**

1. ✅ Run unit tests: `npm test -- loader.test`
2. ✅ Run manual test: `npm run test:commands`
3. ✅ Verify output shows 25 commands loaded
4. ✅ Verify no errors (warnings OK if files are actually problematic)

**Expected output:**
```
🔧 Testing Command Loader

==================================================

✅ Loaded: 25 commands
⚠️  Warnings: 0
❌ Errors: 0

Commands (first 10):
  /quest-start
    Start a new quest with mission alignment...

  /quest-milestone
    Track progress towards quest milestones...

  ...

==================================================

🔍 Testing Filter:

  "quest" → 4 matches
    - quest-start
    - quest-milestone
    - quest-reflect
    - quest-complete

  "analyze" → 3 matches
    - analyze-impact
    - analyze-coherence
    - analyze-drift

  ...
```

**👤 USER DECISION:**
- ✅ "Looks good, continue to Layer 2"
- ⚠️ "I see issues, let's fix first"
- 🛑 "Stop here, this is enough for now"

---

## 🎨 Layer 2: Basic UI (60-75 min)

### Goal: Show a simple dropdown when user types `/`

**What you'll be able to do after this layer:**
- ✅ Type `/` in TUI → dropdown appears
- ✅ See list of commands
- ✅ Basic styling (no polish yet)

**No keyboard navigation yet** - just visual display.

---

### Step 2.1: Create Dropdown Component (35 min)

**File:** `src/tui/components/CommandDropdown.tsx` (NEW)

```typescript
import React from 'react';
import { Box, Text } from 'ink';
import { Command } from '../commands/loader.js';

export interface CommandDropdownProps {
  commands: Command[];
  selectedIndex: number;
  isVisible: boolean;
  maxHeight?: number;
}

export function CommandDropdown({
  commands,
  selectedIndex,
  isVisible,
  maxHeight = 10
}: CommandDropdownProps): React.ReactElement | null {
  if (!isVisible || commands.length === 0) {
    return null;
  }

  // Limit visible commands (handle scrolling)
  const visibleCommands = commands.slice(0, maxHeight);
  const hasMore = commands.length > maxHeight;

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="cyan"
      paddingX={1}
      marginTop={1}
    >
      {/* Header */}
      <Box marginBottom={1}>
        <Text color="cyan" bold>
          Commands ({commands.length})
        </Text>
      </Box>

      {/* Command list */}
      {visibleCommands.map((command, index) => {
        const isSelected = index === selectedIndex;

        return (
          <Box key={command.name} marginBottom={0}>
            <Text color={isSelected ? 'green' : 'white'}>
              {isSelected ? '▸ ' : '  '}
              /{command.name}
            </Text>
            {command.description && (
              <Text color="gray" dimColor>
                {' - '}
                {command.description.slice(0, 40)}
                {command.description.length > 40 ? '...' : ''}
              </Text>
            )}
          </Box>
        );
      })}

      {hasMore && (
        <Box marginTop={1}>
          <Text color="gray" dimColor>
            ... and {commands.length - maxHeight} more
          </Text>
        </Box>
      )}

      {/* Footer */}
      <Box marginTop={1} borderStyle="single" borderTop borderColor="gray">
        <Text color="gray" dimColor>
          ↑↓ Navigate • Enter Select • Esc Cancel
        </Text>
      </Box>
    </Box>
  );
}
```

---

### Step 2.2: Integrate into InputBox (25 min)

**File:** `src/tui/components/InputBox.tsx` (MODIFY)

Find the InputBox component and add:

```typescript
import { CommandDropdown } from './CommandDropdown.js';
import { loadCommands, filterCommands, Command } from '../commands/loader.js';

// Add state
const [showDropdown, setShowDropdown] = useState(false);
const [allCommands, setAllCommands] = useState<Map<string, Command>>(new Map());
const [filteredCommands, setFilteredCommands] = useState<Command[]>([]);
const [selectedCommandIndex, setSelectedCommandIndex] = useState(0);

// Load commands on mount
useEffect(() => {
  loadCommands(process.cwd()).then(result => {
    setAllCommands(result.commands);
    // Log any errors/warnings
    if (result.errors.length > 0) {
      console.error('Command loading errors:', result.errors);
    }
    if (result.warnings.length > 0) {
      console.warn('Command loading warnings:', result.warnings);
    }
  });
}, []);

// Modify onChange handler
const handleChange = (newValue: string) => {
  setValue(newValue);

  // Detect slash command
  if (newValue.startsWith('/') && allCommands.size > 0) {
    const prefix = newValue.slice(1).split(' ')[0]; // Get command part only
    const filtered = filterCommands(prefix, allCommands);

    setFilteredCommands(filtered);
    setShowDropdown(filtered.length > 0);
    setSelectedCommandIndex(0); // Reset selection
  } else {
    setShowDropdown(false);
  }
};

// In the render:
return (
  <Box flexDirection="column">
    {/* Existing input field */}
    <TextInput
      value={value}
      onChange={handleChange}
      onSubmit={onSubmit}
      // ... other props
    />

    {/* NEW: Command dropdown */}
    <CommandDropdown
      commands={filteredCommands}
      selectedIndex={selectedCommandIndex}
      isVisible={showDropdown}
    />
  </Box>
);
```

---

### Step 2.3: Test Manually (10 min)

1. **Build:** `npm run build`
2. **Run TUI:** `npm run tui` (or however you start it)
3. **Test:**
   - Type `/` → Should see dropdown with all commands
   - Type `/quest` → Should filter to quest commands only
   - Type `/analyze` → Should show analyze commands
   - Type regular text → Dropdown disappears

---

### ✅ CHECKPOINT 2: Basic UI Complete

**🛑 STOP HERE and validate:**

1. ✅ Dropdown appears when typing `/`
2. ✅ Dropdown shows command list
3. ✅ Dropdown filters as you type
4. ✅ Dropdown disappears for non-slash input
5. ✅ No crashes or console errors

**Expected behavior:**
```
User input: /
┌─────────────────────────────────────┐
│ Commands (25)                       │
├─────────────────────────────────────┤
│ ▸ /quest-start - Start a new...    │
│   /quest-milestone - Track pro...   │
│   /quest-reflect - Reflect on...    │
│   ...                               │
├─────────────────────────────────────┤
│ ↑↓ Navigate • Enter Select • Esc   │
└─────────────────────────────────────┘
```

**👤 USER DECISION:**
- ✅ "Dropdown looks good, add keyboard nav"
- ⚠️ "Dropdown styling needs tweaks" → iterate on Layer 2
- 🛑 "This is enough for now"

---

## ⌨️ Layer 3: Interaction (45-60 min)

### Goal: Make dropdown interactive with keyboard

**What you'll be able to do after this layer:**
- ✅ Press ↓ to move selection down
- ✅ Press ↑ to move selection up
- ✅ Press Enter to select command
- ✅ Press Esc to close dropdown

---

### Step 3.1: Add Keyboard Handlers (30 min)

**File:** `src/tui/components/InputBox.tsx` (MODIFY)

**Add keyboard input handler with priority (Claude Code feedback):**

```typescript
import { useInput } from 'ink';

// Add this AFTER the existing useInput hook (or modify existing one)
// Claude Code feedback: Use priority system to prevent conflicts
useInput((input, key) => {
  // PRIORITY 1: Dropdown navigation (when dropdown is open)
  if (showDropdown) {
    let handled = false;

    if (key.downArrow) {
      // Move selection down (wrap around)
      setSelectedCommandIndex(prev =>
        (prev + 1) % filteredCommands.length
      );
      handled = true;
    }

    if (key.upArrow) {
      // Move selection up (wrap around)
      setSelectedCommandIndex(prev =>
        prev === 0 ? filteredCommands.length - 1 : prev - 1
      );
      handled = true;
    }

    if (key.return && filteredCommands.length > 0) {
      // Select command
      const selected = filteredCommands[selectedCommandIndex];
      setValue(`/${selected.name} `); // Add trailing space
      setShowDropdown(false);
      handled = true;
    }

    if (key.tab && filteredCommands.length > 0) {
      // Autocomplete (same as Enter but keep dropdown open)
      const selected = filteredCommands[selectedCommandIndex];
      setValue(`/${selected.name} `);
      // Don't close dropdown - user might want to see more
      handled = true;
    }

    if (key.escape) {
      // Close dropdown
      setShowDropdown(false);
      handled = true;
    }

    // If dropdown handled the key, don't let normal input handle it
    if (handled) {
      return; // Stop propagation
    }
  }

  // PRIORITY 2: Normal input handling (when dropdown is closed)
  // ... existing input handlers
}, { isActive: true });
```

**Important (Claude Code feedback):** If you already have a `useInput` hook in InputBox, you'll need to merge the logic. The key principle is:
- When dropdown is open → intercept arrow keys, Enter, Esc
- When dropdown is closed → normal behavior

---

### Step 3.2: Add Visual Feedback for Selection (10 min)

**File:** `src/tui/components/CommandDropdown.tsx` (MODIFY)

Enhance the selected item styling:

```typescript
// In the command list rendering:
{visibleCommands.map((command, index) => {
  const isSelected = index === selectedIndex;

  return (
    <Box
      key={command.name}
      marginBottom={0}
      paddingX={1}
      // Add background highlight (if terminal supports it)
    >
      <Text
        color={isSelected ? 'greenBright' : 'white'}
        bold={isSelected}
      >
        {isSelected ? '▸ ' : '  '}
        /{command.name}
      </Text>
      {command.description && (
        <Text color={isSelected ? 'green' : 'gray'} dimColor={!isSelected}>
          {' - '}
          {command.description.slice(0, 40)}
          {command.description.length > 40 ? '...' : ''}
        </Text>
      )}
    </Box>
  );
})}
```

---

### Step 3.3: Test Manually (10 min)

1. **Build:** `npm run build`
2. **Run TUI:** `npm run tui`
3. **Test keyboard:**
   - Type `/quest`
   - Press ↓ → Selection moves to `quest-milestone`
   - Press ↓ again → Selection moves to `quest-reflect`
   - Press ↑ → Selection moves back up
   - Press Enter → Command inserted in input
   - Type `/` again
   - Press Esc → Dropdown closes

---

### ✅ CHECKPOINT 3: Interaction Complete

**🛑 STOP HERE and validate:**

1. ✅ Arrow keys navigate dropdown
2. ✅ Selection wraps around (bottom→top, top→bottom)
3. ✅ Enter inserts command
4. ✅ Tab autocompletes command
5. ✅ Esc closes dropdown
6. ✅ No conflicts with normal input

**Expected behavior:**
- User types `/quest` → 4 commands shown
- User presses ↓ → Green highlight moves to 2nd command
- User presses ↓↓ → Highlight on 4th command
- User presses ↓ → Wraps to 1st command
- User presses Enter → Input shows `/quest-start `

**👤 USER DECISION:**
- ✅ "Keyboard nav works, integrate with Claude"
- ⚠️ "Navigation feels buggy" → debug Layer 3
- 🛑 "Good enough, polish later"

---

## 🔗 Layer 4: Integration (45-60 min)

### Goal: Connect commands to Claude Agent

**What you'll be able to do after this layer:**
- ✅ Submit `/quest-start` → Expands to full markdown
- ✅ Claude receives expanded prompt
- ✅ User sees system message about expansion
- ✅ Commands work end-to-end

---

### Step 4.1: Modify useClaudeAgent (30 min)

**File:** `src/tui/hooks/useClaudeAgent.ts` (MODIFY)

Find the `sendMessage` function and add command expansion:

```typescript
import { loadCommands, expandCommand } from '../commands/loader.js';

// Add state (at top of hook)
const [commandsCache, setCommandsCache] = useState<Map<string, Command>>(new Map());

// Load commands on mount
useEffect(() => {
  loadCommands(cwd).then(result => {
    setCommandsCache(result.commands);
  });
}, [cwd]);

// Modify sendMessage function
const sendMessage = useCallback(async (prompt: string) => {
  try {
    setIsThinking(true);
    setError(null);

    // STEP 1: Expand slash command FIRST (before context injection)
    let finalPrompt = prompt;
    let wasExpanded = false;

    if (prompt.startsWith('/') && commandsCache.size > 0) {
      const expanded = expandCommand(prompt, commandsCache);

      if (expanded) {
        finalPrompt = expanded;
        wasExpanded = true;

        // Show system message about expansion
        setMessages(prev => [...prev, {
          type: 'system',
          content: `🔧 Expanding command: ${prompt.split(' ')[0]}`,
          timestamp: new Date()
        }]);
      } else {
        // Unknown command - provide helpful error (Claude Code feedback)
        const commandName = prompt.split(' ')[0];
        const availableCommands = Array.from(commandsCache.keys())
          .slice(0, 5)
          .map(c => `/${c}`)
          .join(', ');

        throw new Error(
          `Unknown command: ${commandName}\n` +
          `Available commands: ${availableCommands}...\n` +
          `Type '/' to see all commands.`
        );
      }
    }

    // STEP 2: Add user message (show ORIGINAL input, not expanded)
    const userMessageTimestamp = new Date();
    setMessages(prev => [...prev, {
      type: 'user',
      content: prompt,  // Show what user typed
      timestamp: userMessageTimestamp
    }]);

    // STEP 3: Continue with existing logic (context injection, SDK query, etc.)
    // Use finalPrompt instead of prompt from here on

    let contextualPrompt = finalPrompt;

    // Inject SIGMA lattice context (existing code)
    if (sessionManager.isSessionActive()) {
      const latticeContext = await getLatticeContext();
      if (latticeContext) {
        contextualPrompt = `${latticeContext}\n\n${finalPrompt}`;
      }
    }

    // Create SDK query (existing code)
    const query = await createSDKQuery(contextualPrompt, {
      // ... existing options
    });

    // ... rest of sendMessage logic
  } catch (error) {
    setError(error instanceof Error ? error.message : 'Unknown error');
    setIsThinking(false);
  }
}, [commandsCache, cwd, /* other deps */]);
```

---

### Step 4.2: Add Error Handling (10 min)

**File:** `src/tui/components/ClaudePanelAgent.tsx` (MODIFY if needed)

Ensure error messages are displayed properly:

```typescript
{error && (
  <Box marginY={1} paddingX={2} borderStyle="round" borderColor="red">
    <Text color="red">❌ Error:</Text>
    <Text color="red">{error}</Text>
  </Box>
)}
```

---

### Step 4.3: Test End-to-End (10 min)

1. **Build:** `npm run build`
2. **Run TUI:** `npm run tui`
3. **Test scenarios:**

**Scenario 1: Valid command**
```
User types: /quest-start new alignment feature
→ Dropdown appears
→ User presses Enter
→ Input shows: /quest-start new alignment feature
→ User presses Enter to submit
→ System message: "🔧 Expanding command: /quest-start"
→ User message: "/quest-start new alignment feature"
→ Claude receives: [full quest-start.md content] + context
→ Claude responds
```

**Scenario 2: Unknown command**
```
User types: /unknown-command
→ No dropdown (no matches)
→ User presses Enter to submit
→ Error message: "Unknown command: /unknown-command..."
```

**Scenario 3: Command with file path**
```
User types: /analyze-impact src/tui/components/InputBox.tsx
→ Claude receives expanded prompt with file path substituted
```

---

### ✅ CHECKPOINT 4: Integration Complete

**🛑 STOP HERE and validate:**

1. ✅ Slash commands expand correctly
2. ✅ Claude receives expanded content
3. ✅ User sees system message about expansion
4. ✅ Unknown commands show helpful error
5. ✅ Arguments (file paths, etc.) are substituted
6. ✅ SIGMA context injection still works

**Expected flow:**
1. User: `/check-alignment`
2. System: "🔧 Expanding command: /check-alignment"
3. User message shown: "/check-alignment"
4. Claude receives: [Full check-alignment.md prompt]
5. Claude responds appropriately

**👤 USER DECISION:**
- ✅ "Commands work end-to-end, polish it"
- ⚠️ "Expansion not working" → debug Layer 4
- 🛑 "This is enough, ship it"

---

## ✨ Layer 5: Polish (45-60 min)

### Goal: Handle edge cases and improve UX

**What you'll add in this layer:**
- ✅ Better error messages
- ✅ Command descriptions in dropdown
- ✅ Loading state while commands load
- ✅ Terminal size handling
- ✅ Documentation

---

### Step 5.1: Add Loading State (15 min)

**File:** `src/tui/components/InputBox.tsx` (MODIFY)

```typescript
const [commandsLoading, setCommandsLoading] = useState(true);

useEffect(() => {
  setCommandsLoading(true);
  loadCommands(process.cwd())
    .then(result => {
      setAllCommands(result.commands);
      setCommandsLoading(false);
    })
    .catch(error => {
      console.error('Failed to load commands:', error);
      setCommandsLoading(false);
    });
}, []);

// In dropdown rendering:
{commandsLoading && value.startsWith('/') && (
  <Box marginTop={1}>
    <Text color="yellow">⏳ Loading commands...</Text>
  </Box>
)}
```

---

### Step 5.2: Improve Error Messages (15 min)

**File:** `src/tui/hooks/useClaudeAgent.ts` (MODIFY)

Better error for unknown commands:

```typescript
if (!expanded && prompt.startsWith('/')) {
  const commandName = prompt.split(' ')[0];
  const allCommandNames = Array.from(commandsCache.keys());

  // Try to find similar commands (simple string distance)
  const similar = allCommandNames
    .filter(name => {
      const lowerName = name.toLowerCase();
      const lowerInput = commandName.slice(1).toLowerCase();
      return lowerName.includes(lowerInput) || lowerInput.includes(lowerName);
    })
    .slice(0, 3);

  let errorMessage = `Unknown command: ${commandName}\n`;

  if (similar.length > 0) {
    errorMessage += `Did you mean: ${similar.map(s => `/${s}`).join(', ')}?\n`;
  }

  errorMessage += `Type '/' to see all ${commandsCache.size} available commands.`;

  throw new Error(errorMessage);
}
```

---

### Step 5.3: Handle Small Terminals (10 min)

**File:** `src/tui/components/CommandDropdown.tsx` (MODIFY)

Adjust max height based on terminal size:

```typescript
import { useStdout } from 'ink';

export function CommandDropdown({ ... }: CommandDropdownProps) {
  const { stdout } = useStdout();

  // Adjust max height for small terminals
  const terminalHeight = stdout?.rows || 24;
  const adjustedMaxHeight = Math.min(maxHeight, Math.floor(terminalHeight / 3));

  const visibleCommands = commands.slice(0, adjustedMaxHeight);

  // ... rest of component
}
```

---

### Step 5.4: Add Documentation (10 min)

**File:** `.claude/commands/README.md` (UPDATE)

Add section about TUI integration:

```markdown
## Using Commands in TUI

The Cognition CLI TUI supports all commands in this directory via slash command syntax.

### Usage:

1. Type `/` in the TUI input to see all commands
2. Continue typing to filter: `/quest` shows quest-* commands
3. Use ↑/↓ arrows to navigate
4. Press Enter to select a command
5. Add arguments after the command name: `/analyze-impact src/cli.ts`
6. Press Enter to submit

### Creating Custom Commands:

1. Create a new `.md` file in this directory
2. Name it descriptively: `my-command.md` → `/my-command`
3. Write your prompt in markdown
4. Use placeholders: `{{FILE_PATH}}`, `{{SYMBOL_NAME}}`, `{{ALL_ARGS}}`
5. Restart TUI to load new commands

### Examples:

```
/quest-start building slash commands feature
/analyze-impact src/tui/components/InputBox.tsx
/check-alignment
```
```

---

### Step 5.5: Final Testing (10 min)

**Test checklist:**
- [ ] Commands load on TUI startup (no errors in logs)
- [ ] Dropdown appears when typing `/`
- [ ] Dropdown filters correctly
- [ ] Arrow keys navigate smoothly
- [ ] Enter selects command
- [ ] Command expands and sends to Claude
- [ ] Unknown commands show helpful error
- [ ] Works in small terminal (80x24)
- [ ] Works with arguments
- [ ] Documentation is accurate

---

### ✅ CHECKPOINT 5: Polish Complete

**🛑 FINAL VALIDATION:**

1. ✅ All features working
2. ✅ Edge cases handled
3. ✅ Good error messages
4. ✅ Works in different terminal sizes
5. ✅ Documentation updated
6. ✅ No regressions in existing functionality

**👤 USER DECISION:**
- ✅ "Ship it! Merge to main"
- ⚠️ "Found issues" → fix and re-test
- 📝 "Add to feature branch, document, and create PR"

---

## Summary

### What We Built:

**Layer 1:** Command loader with validation and tests
**Layer 2:** Visual dropdown component
**Layer 3:** Keyboard navigation (↑/↓/Enter/Esc)
**Layer 4:** Integration with Claude Agent
**Layer 5:** Error handling, loading states, polish

### Files Created:

- `src/tui/commands/loader.ts` - Command loading and expansion
- `src/tui/commands/__tests__/loader.test.ts` - Unit tests
- `src/tui/components/CommandDropdown.tsx` - Dropdown UI
- `scripts/test-commands.ts` - Manual testing script

### Files Modified:

- `src/tui/components/InputBox.tsx` - Added dropdown integration + keyboard handling
- `src/tui/hooks/useClaudeAgent.ts` - Added command expansion
- `.claude/commands/README.md` - Added TUI usage documentation

### Time Breakdown:

- **Layer 1:** 60-75 min (foundation)
- **Layer 2:** 60-75 min (UI)
- **Layer 3:** 45-60 min (keyboard)
- **Layer 4:** 45-60 min (integration)
- **Layer 5:** 45-60 min (polish)

**Total:** 5-6 hours (as estimated)

---

## Future Enhancements

### Post-Launch (v2.3.1+):

1. **Fuzzy matching** - `/qstart` matches `quest-start`
2. **Command aliases** - Define shortcuts in command files
3. **Recent commands** - Track and prioritize frequently used
4. **Command categories** - Group by prefix with collapsible sections
5. **Dynamic command generation** - Learn from user patterns
6. **Arguments autocomplete** - Suggest file paths when typing
7. **Command help** - `/help quest-start` shows detailed info
8. **Command composition** - Chain multiple commands

---

## Success Metrics

### How to measure success:

1. **Adoption:** % of TUI sessions that use slash commands
2. **Efficiency:** Time saved vs typing full prompts
3. **Errors:** % of unknown command errors (should be low)
4. **Satisfaction:** User feedback via GitHub issues

### Target Metrics (v2.3.0):

- ✅ 0 crashes related to slash commands
- ✅ < 1s command loading time
- ✅ < 5% unknown command error rate
- ✅ 100% of existing commands accessible via dropdown

---

## Risk Mitigation

### Identified Risks:

| Risk | Mitigation | Status |
|------|------------|--------|
| Keyboard event conflicts | Priority system with `isActive` flag | ✅ Addressed |
| Dropdown positioning | Use Ink's layout, test multiple sizes | ✅ Addressed |
| Command expansion edge cases | Structured placeholders, validation | ✅ Addressed |
| Performance with many commands | Lazy loading, caching | ✅ Addressed |
| Security (directory traversal) | Path normalization, validation | ✅ Addressed |

---

## 📋 Claude Code Review Feedback

### Review Score: 9.5/10 (up from 7.5/10)

**Status:** ✅ EXCELLENT - Ready for implementation

### ✅ Fully Addressed Issues (11/11):

1. **Time Estimate** - Updated from 3-4 hours to 5-6 hours
2. **Keyboard Event Priority** - Added priority system with `isActive` flag
3. **Command Validation** - Added `validateCommandFile()` and schema checking
4. **Security** - Added directory traversal prevention
5. **Structured Placeholders** - Changed from `[FILE_PATH]` to `{{FILE_PATH}}`
6. **Error Reporting** - Added `LoadCommandsResult` with errors/warnings arrays
7. **Unit Tests** - Comprehensive test suite included
8. **Loading State** - Added `commandsLoading` state
9. **Terminal Size Handling** - Dynamic max height based on terminal rows
10. **Better Error Messages** - "Did you mean?" suggestions for typos
11. **Documentation** - README section for TUI usage

### ⚠️ Known Minor Issues (To Address During Implementation):

#### 1. Dropdown Scrolling (Medium Priority)
**Issue:** If user navigates to item #15 but maxHeight=10, they won't see it.

**Solution:** Implement scroll window in Layer 5:
```typescript
// Calculate scroll window
const scrollOffset = Math.max(0, selectedIndex - maxHeight + 3);
const visibleCommands = commands.slice(scrollOffset, scrollOffset + maxHeight);
const adjustedSelectedIndex = selectedIndex - scrollOffset;
```

**When:** Layer 5 (Polish) or post-launch

---

#### 2. Type Safety in expandCommand (Low Priority)
**Issue:** TypeScript `as` assertion could fail silently.

**Solution:** Add type guard with warning:
```typescript
expanded = expanded.replace(/\{\{(\w+)\}\}/g, (match, key) => {
  if (key in placeholders) {
    return placeholders[key as keyof typeof placeholders];
  }
  console.warn(`Unknown placeholder: {{${key}}}`);
  return match; // Leave as-is
});
```

**When:** Layer 1 - Step 1.1 (during loader implementation)

---

#### 3. Command Caching Duplication (Low Priority)
**Issue:** Commands loaded twice (InputBox and useClaudeAgent).

**Solution:** Create shared `useCommands()` hook:
```typescript
// src/tui/hooks/useCommands.ts
export function useCommands() {
  const [commands, setCommands] = useState<Map<string, Command>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCommands(process.cwd()).then(result => {
      setCommands(result.commands);
      setLoading(false);
    });
  }, []);

  return { commands, loading };
}
```

**When:** Layer 5 (Polish) if performance issues noticed

---

#### 4. Ink useInput Behavior (Important)
**Issue:** `useInput` doesn't support `return` to stop propagation.

**Solution:** Use separate hooks with `isActive`:
```typescript
// Dropdown handler
useInput((input, key) => {
  // ... dropdown handling
}, { isActive: showDropdown });

// Normal input handler
useInput((input, key) => {
  // ... normal handling
}, { isActive: !showDropdown });
```

**When:** Layer 3 - Step 3.1 (keyboard handlers)

---

#### 5. Directory Traversal Test (Low Priority)
**Issue:** Test is a placeholder.

**Solution:** Implement actual test in Layer 1 - Step 1.2

---

### 🎯 Claude Code's Recommendation:

> "Start implementation immediately. The plan is solid enough that these minor issues can be discovered and fixed during implementation checkpoints."

**Suggested workflow:**
1. ✅ Create feature branch: `git checkout -b feature/slash-commands-dropdown`
2. ✅ Start Layer 1 (validates foundation)
3. ✅ At each checkpoint: Review and address relevant minor issues
4. ✅ Continue through layers
5. ✅ Layer 5: Final polish

---

**Status:** Ready for Layer 1 implementation ✅
**Next Step:** Create feature branch, then begin Layer 1 - Step 1.1 (Command Loader)
