# Code Documentation Standard for Cognition Σ CLI

## Format: TSDoc (TypeScript Documentation)

All documentation uses [TSDoc](https://tsdoc.org/) format, the official TypeScript documentation standard. This ensures compatibility with TypeDoc, VS Code IntelliSense, and other TypeScript tooling.

## Required Elements

### 1. Description

Every documented API must have a clear, structured description:

- **First line**: One-sentence summary (what it does) - imperative tone
- **Second paragraph**: Detailed explanation (how it works, why it exists)
- **Third paragraph**: Usage context (when to use it)

**Example**:

```typescript
/**
 * Manages structural patterns from code analysis.
 *
 * Extracts and stores architectural patterns using AST parsing and
 * embedding generation via the eGemma workbench. Stores patterns in
 * LanceDB with both body and shadow embeddings for dual-lattice queries.
 *
 * Use this manager when analyzing code structure, design patterns, or
 * architectural components across your codebase.
 */
```

### 2. Required Tags

#### For all public APIs:

- `@param {type} name - Description` - For each parameter
- `@returns {type} Description` - Return value (use `@returns {void}` for void functions)
- `@throws {ErrorType} Description` - All possible errors
- `@example` - At least one usage example

#### Optional but recommended:

- `@see` - Related functions/classes
- `@deprecated` - Mark deprecated APIs with migration path
- `@since` - Version introduced
- `@internal` - Mark internal-only APIs (not for public use)
- `@remarks` - Additional notes, performance considerations, or warnings
- `@async` - Explicitly mark async functions (though TypeScript infers this)

### 3. Examples

Every public API must have at least one `@example`. Complex APIs should have multiple examples showing different use cases.

**Single Example**:

```typescript
/**
 * @example
 * const result = await processFile('src/index.ts');
 */
```

**Multiple Examples**:

```typescript
/**
 * @example
 * // Basic usage
 * const result = await processFile('src/index.ts');
 *
 * @example
 * // With options
 * const result = await processFile('src/index.ts', {
 *   skipCache: true,
 *   verbose: true
 * });
 *
 * @example
 * // Error handling
 * try {
 *   await processFile('missing.ts');
 * } catch (err) {
 *   if (err instanceof FileNotFoundError) {
 *     console.error('File not found');
 *   }
 * }
 */
```

## What MUST Be Documented

### P0 - Required (100% Coverage)

These APIs MUST be documented with full TSDoc:

```typescript
// ✅ REQUIRED: Public interfaces
/**
 * Represents a pattern extracted from code structure.
 *
 * @interface Pattern
 * @property {string} id - Unique SHA-256 hash identifier
 * @property {PatternType} type - Type of pattern (structural, lineage, etc.)
 * @property {Record<string, unknown>} metadata - Pattern-specific metadata
 */
export interface Pattern {
  id: string;
  type: PatternType;
  metadata: Record<string, unknown>;
}

// ✅ REQUIRED: Public classes
/**
 * Manages structural patterns from code analysis.
 *
 * Extracts and stores architectural patterns using AST parsing and
 * embedding generation via the eGemma workbench.
 *
 * @class StructuralPatternsManager
 * @extends {OverlayManager}
 *
 * @example
 * const manager = new StructuralPatternsManager(pgc, workbench);
 * await manager.generateOverlay();
 * const patterns = await manager.getAllPatterns();
 */
export class StructuralPatternsManager extends OverlayManager {
  // ...
}

// ✅ REQUIRED: Public functions/methods
/**
 * Generates embeddings for a code signature using eGemma.
 *
 * @param {string} signature - Code signature to embed
 * @param {number} dimensions - Embedding dimensions (default: 768)
 * @returns {Promise<number[]>} Embedding vector
 *
 * @throws {WorkbenchError} If workbench API fails
 * @throws {RateLimitError} If rate limit exceeded
 *
 * @example
 * const embedding = await getEmbedding('function add(a: number, b: number)', 768);
 */
export async function getEmbedding(
  signature: string,
  dimensions: number = 768
): Promise<number[]> {
  // ...
}

// ✅ REQUIRED: Complex types
/**
 * Configuration for overlay generation.
 *
 * @typedef {Object} OverlayConfig
 * @property {boolean} skipExisting - Skip files already in manifest
 * @property {number} batchSize - Number of items per batch
 * @property {string[]} excludePatterns - Glob patterns to exclude
 */
export type OverlayConfig = {
  skipExisting: boolean;
  batchSize: number;
  excludePatterns: string[];
};

// ✅ REQUIRED: Enums
/**
 * Types of patterns extracted from code.
 *
 * @enum {string}
 */
export enum PatternType {
  /** Structural/architectural patterns */
  STRUCTURAL = 'structural',
  /** Code lineage and dependencies */
  LINEAGE = 'lineage',
  /** Security guidelines and policies */
  SECURITY = 'security',
}
```

### P1 - Recommended (90%+ Coverage)

Document these for better maintainability:

```typescript
// ✅ Complex private methods with non-obvious logic
/**
 * Computes incremental diff between old and new manifest entries.
 *
 * Uses SHA-256 content hashing to detect changed files. Only files
 * with different hashes are marked for re-processing.
 *
 * @private
 * @param {ManifestEntry[]} oldEntries - Previous manifest
 * @param {FileInfo[]} newFiles - Current file list
 * @returns {FileInfo[]} Files that changed
 */
private computeIncrementalDiff(
  oldEntries: ManifestEntry[],
  newFiles: FileInfo[]
): FileInfo[] {
  // ...
}

// ✅ Non-obvious constants
/**
 * Maximum worker pool size for parallel processing.
 * Based on CPU cores with 75% utilization to leave headroom.
 */
const MAX_WORKERS = Math.max(2, Math.floor(os.cpus().length * 0.75));
```

### Skip Documentation

Don't waste time documenting these:

```typescript
// ❌ Skip: Simple getters/setters
get id(): string {
  return this._id;
}

// ❌ Skip: Obvious utility functions
function isEmpty(arr: any[]): boolean {
  return arr.length === 0;
}

// ❌ Skip: Self-explanatory private variables
private _initialized = false;

// ❌ Skip: Test files (unless testing complex behavior)
describe('MyClass', () => {
  it('should work', () => { /* ... */ });
});
```

## Consistency Rules

### CLI vs TUI: Same Standards

Both CLI (core) and TUI (Ink) code follow **IDENTICAL** documentation format:

```typescript
// ✅ CLI code example (src/core/pgc/index.ts)
/**
 * Project Grounded Context (PGC) manager.
 *
 * Manages content-addressable storage, overlays, and knowledge graph.
 * Central orchestrator for all Cognition Σ operations.
 *
 * @class PGC
 * @example
 * const pgc = await PGC.initialize('/path/to/project');
 * await pgc.genesis(['src/']);
 */
export class PGC {
  // ...
}

// ✅ TUI code example (src/tui/components/StatusPanel.tsx)
/**
 * Status panel component showing PGC health metrics.
 *
 * Displays coherence score, overlay status, and file watcher state.
 * Updates in real-time as PGC state changes.
 *
 * @component
 * @param {Props} props - Component props
 * @param {PGC} props.pgc - PGC instance for data access
 * @param {number} [props.refreshInterval=5000] - Update interval in ms
 *
 * @returns {JSX.Element} Rendered component
 *
 * @example
 * <StatusPanel pgc={pgcInstance} refreshInterval={3000} />
 */
export const StatusPanel: React.FC<StatusPanelProps> = ({
  pgc,
  refreshInterval = 5000,
}) => {
  // ...
};
```

### Terminology Consistency

Use consistent terminology across all documentation:

| ✅ Use                              | ❌ Don't Use                        |
| ----------------------------------- | ----------------------------------- |
| "PGC" or "Project Grounded Context" | "project context", "knowledge base" |
| "overlay"                           | "layer", "dimension"                |
| "pattern"                           | "symbol", "item"                    |
| "embedding"                         | "vector", "representation"          |
| "workbench"                         | "API", "service"                    |
| "genesis"                           | "initialization", "ingestion"       |
| "lattice"                           | "graph", "network"                  |
| "coherence"                         | "consistency", "alignment"          |

## Special Documentation Patterns

### Error Documentation

Document all thrown errors with `@throws`:

```typescript
/**
 * Analyzes a source file and extracts patterns.
 *
 * @param {string} filePath - Path to file to analyze
 * @returns {Promise<Pattern[]>} Extracted patterns
 *
 * @throws {PGCNotInitializedError} If PGC not initialized in directory
 * @throws {FileNotFoundError} If file doesn't exist
 * @throws {WorkbenchError} If embedding generation fails
 * @throws {ParseError} If AST parsing fails
 *
 * @example
 * try {
 *   const patterns = await analyzeFile('src/index.ts');
 * } catch (err) {
 *   if (err instanceof FileNotFoundError) {
 *     console.error('File not found');
 *   }
 * }
 */
async function analyzeFile(filePath: string): Promise<Pattern[]> {
  if (!this.initialized) {
    throw new PGCNotInitializedError('Run cognition-cli init first');
  }
  // ...
}
```

### Async Functions

Always document:

- What the Promise resolves to
- What errors can be thrown
- Whether it's safe to call concurrently
- Any rate limiting or performance considerations

```typescript
/**
 * Generates embeddings for multiple signatures in parallel.
 *
 * Uses a worker pool to process signatures concurrently while respecting
 * the eGemma workbench rate limits (max 8 parallel requests).
 *
 * @async
 * @param {string[]} signatures - Code signatures to embed
 * @returns {Promise<number[][]>} Array of embedding vectors
 *
 * @throws {WorkbenchError} If any embedding fails
 *
 * @remarks
 * This function is safe to call concurrently. Uses worker pool with
 * max 8 parallel requests to respect rate limits.
 *
 * @example
 * const sigs = ['function foo()', 'class Bar {}'];
 * const embeddings = await batchEmbed(sigs);
 * // embeddings.length === 2
 */
async function batchEmbed(signatures: string[]): Promise<number[][]> {
  // ...
}
```

### React Components

Document React components with TSDoc:

```typescript
/**
 * Interactive overlay selection panel.
 *
 * Displays all available overlays (O₁-O₇) with status indicators,
 * allows toggling visibility, and shows overlay-specific metrics.
 *
 * @component
 *
 * @param {Props} props - Component props
 * @param {Overlay[]} props.overlays - List of overlays to display
 * @param {(id: string) => void} props.onToggle - Called when overlay toggled
 * @param {boolean} [props.showMetrics=false] - Show detailed metrics
 *
 * @returns {JSX.Element} Rendered component
 *
 * @example
 * <OverlayPanel
 *   overlays={overlayList}
 *   onToggle={handleToggle}
 *   showMetrics={true}
 * />
 */
export const OverlayPanel: React.FC<OverlayPanelProps> = ({
  overlays,
  onToggle,
  showMetrics = false,
}) => {
  // ...
};
```

### React Hooks

Document custom hooks:

```typescript
/**
 * Hook for managing PGC state in TUI components.
 *
 * Provides reactive access to PGC data with automatic refresh.
 * Handles loading states, errors, and cleanup on unmount.
 *
 * @hook
 *
 * @param {PGC} pgc - PGC instance
 * @param {number} [refreshInterval=5000] - Auto-refresh interval (ms)
 *
 * @returns {UsePGCState} PGC state object
 * @returns {boolean} .loading - True while loading data
 * @returns {Error | null} .error - Error if fetch failed
 * @returns {PGCData | null} .data - PGC data when loaded
 * @returns {() => void} .refresh - Manual refresh function
 *
 * @example
 * const { loading, error, data, refresh } = usePGC(pgcInstance, 3000);
 *
 * if (loading) return <Spinner />;
 * if (error) return <ErrorDisplay error={error} />;
 * return <Dashboard data={data} onRefresh={refresh} />;
 */
export const usePGC = (pgc: PGC, refreshInterval = 5000): UsePGCState => {
  // ...
};
```

### CLI Commands

Document CLI command functions:

```typescript
/**
 * Genesis command - Ingests source code into PGC.
 *
 * Discovers files, computes content hashes, and stores in content-addressable
 * object store. Incrementally processes only changed files.
 *
 * @async
 * @param {string[]} paths - File paths or glob patterns to ingest
 * @param {GenesisOptions} options - Command options
 * @param {string} [options.projectRoot] - Override workspace root
 * @param {boolean} [options.verbose] - Enable verbose logging
 *
 * @returns {Promise<void>}
 *
 * @throws {PGCNotInitializedError} If PGC not initialized
 * @throws {WorkbenchError} If AST parsing fails
 *
 * @example
 * // CLI usage:
 * // $ cognition-cli genesis src/
 *
 * @example
 * // Programmatic usage:
 * await genesisCommand(['src/', 'lib/'], { verbose: true });
 */
export async function genesisCommand(
  paths: string[],
  options: GenesisOptions
): Promise<void> {
  // ...
}
```

### Overlay Managers

All overlay managers follow this template:

```typescript
/**
 * [Overlay Name] Overlay Manager (O[N]).
 *
 * [Brief description of what this overlay captures]
 *
 * **Overlay Type**: O[N] ([Overlay Name])
 * **Storage**: `.open_cognition/pgc/overlays/[overlay_name]/`
 * **Vector Dimensions**: 768 (eGemma embeddings)
 *
 * **Data Schema**:
 * - `id`: SHA-256 hash
 * - `type`: [list of types this overlay stores]
 * - `metadata`: [describe metadata fields]
 * - `vector`: 768-dimensional embedding (body)
 * - `shadow_vector`: 768-dimensional semantic embedding (shadow)
 *
 * **Generation Process**:
 * 1. [Step 1]
 * 2. [Step 2]
 * 3. [Step 3]
 *
 * @class [ClassName]
 * @extends {OverlayManager}
 *
 * @example
 * const manager = new [ClassName](pgc, workbench);
 * await manager.generateOverlay();
 * const items = await manager.getAllItems();
 */
export class StructuralPatternsManager extends OverlayManager {
  // ...
}
```

## Validation and Enforcement

### TypeDoc

Run TypeDoc to validate documentation:

```bash
# Validate documentation (no output)
npm run docs:validate

# Generate full API docs
npm run docs:generate
```

TypeDoc configuration (`typedoc.json`) enforces:

- All exported APIs documented
- All `@param` tags match function parameters
- All links resolve correctly
- No invalid TSDoc syntax

### ESLint

ESLint rules enforce documentation:

```javascript
{
  "plugins": ["tsdoc"],
  "rules": {
    "tsdoc/syntax": "error",
    "require-jsdoc": ["error", {
      "require": {
        "FunctionDeclaration": true,
        "MethodDefinition": true,
        "ClassDeclaration": true
      }
    }]
  }
}
```

### Pre-commit Hook

Documentation is validated before every commit:

```bash
#!/bin/sh
# Validate TSDoc before commit
npm run docs:validate

# Lint for documentation issues
npx eslint $(git diff --cached --name-only --diff-filter=ACMR | grep -E '\.(ts|tsx)$')
```

## Examples of Good Documentation

### Complete Class Example

```typescript
/**
 * Project Grounded Context (PGC) - Content-addressable knowledge graph manager.
 *
 * The PGC is the central orchestrator for Cognition Σ, managing:
 * - Content-addressable storage with SHA-256 hashing
 * - Seven overlays (O₁-O₇) for multi-dimensional analysis
 * - Dual-lattice architecture (local + global knowledge)
 * - Vector embeddings via eGemma workbench
 *
 * Stores data in `.open_cognition/pgc/` within the workspace root.
 *
 * @class PGC
 * @see {@link WorkspaceManager} for workspace initialization
 *
 * @example
 * // Initialize PGC in current directory
 * const pgc = new PGC(process.cwd());
 * await pgc.initialize();
 *
 * @example
 * // Run genesis to ingest code
 * await pgc.genesis(['src/', 'lib/']);
 *
 * @example
 * // Generate overlays
 * await pgc.generateOverlay('structural_patterns');
 */
export class PGC {
  /**
   * Creates a new PGC instance.
   *
   * @constructor
   * @param {string} workspaceRoot - Absolute path to workspace root
   *
   * @throws {InvalidPathError} If workspaceRoot is not absolute
   */
  constructor(private workspaceRoot: string) {
    if (!path.isAbsolute(workspaceRoot)) {
      throw new InvalidPathError('Workspace root must be absolute path');
    }
  }

  /**
   * Initializes PGC storage structures.
   *
   * Creates `.open_cognition/pgc/` directory structure:
   * - `objects/` - Content-addressable object storage
   * - `overlays/` - LanceDB vector stores for each overlay
   * - `index/` - File index with content hashes
   *
   * @async
   * @returns {Promise<void>}
   *
   * @throws {PermissionError} If cannot create directories
   * @throws {PGCAlreadyInitializedError} If PGC already exists
   *
   * @example
   * const pgc = new PGC('/path/to/project');
   * await pgc.initialize();
   */
  async initialize(): Promise<void> {
    // ...
  }
}
```

## Documentation Workflow

### Before Writing Code

1. **Read existing code** - Understand what it does
2. **Check for existing docs** - Don't duplicate
3. **Plan documentation** - What needs to be explained?

### While Writing Code

1. **Write TSDoc first** - Document before implementing
2. **Update as you code** - Keep docs in sync
3. **Add examples** - At least one per public API

### After Writing Code

1. **Review documentation** - Is it clear and accurate?
2. **Run validation** - `npm run docs:validate`
3. **Fix warnings** - Zero warnings required
4. **Generate docs** - `npm run docs:generate` to preview

### Before Committing

1. **Pre-commit hook runs** - Automatic validation
2. **Fix any errors** - Must pass to commit
3. **Review changes** - Ensure docs are correct

## Common Pitfalls

### ❌ Don't: Use regular comments for public APIs

```typescript
// This function processes files  ← WRONG
export function processFile(path: string) {}
```

### ✅ Do: Use TSDoc for public APIs

```typescript
/**
 * Processes a source file for pattern extraction.
 *
 * @param {string} path - File path to process
 * @returns {Promise<void>}
 */
export function processFile(path: string): Promise<void> {}
```

### ❌ Don't: Missing parameter descriptions

```typescript
/**
 * Creates a pattern.
 *
 * @param type
 * @param metadata  ← Missing descriptions
 */
```

### ✅ Do: Describe every parameter

```typescript
/**
 * Creates a pattern.
 *
 * @param {PatternType} type - Type of pattern to create
 * @param {Record<string, unknown>} metadata - Pattern-specific metadata
 */
```

### ❌ Don't: No examples

```typescript
/**
 * Complex function with many options.
 * @param options - Configuration object
 */
```

### ✅ Do: Include examples

```typescript
/**
 * Complex function with many options.
 *
 * @param {Options} options - Configuration object
 *
 * @example
 * processWithOptions({ verbose: true, skipCache: false });
 */
```

## Summary

**Golden Rules**:

1. ✅ **Every public API must have TSDoc** - No exceptions
2. ✅ **Examples are required** - At least one per public API
3. ✅ **Document all errors** - Use `@throws` for every thrown error
4. ✅ **Consistent terminology** - Use the terminology table
5. ✅ **CLI = TUI standards** - Identical format everywhere
6. ✅ **Validation must pass** - Zero warnings on `npm run docs:validate`

**When in doubt**:

- Look at `workspace-manager.ts` as the gold standard
- Check the examples in this document
- Run TypeDoc to see how it renders
- Ask: "Would a new contributor understand this?"

---

**Questions?** Ask in discussions.
