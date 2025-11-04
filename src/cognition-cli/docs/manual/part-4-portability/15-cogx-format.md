---
type: strategic
overlay: O4_Mission
---

# Chapter 15: The .cogx Format — Portable Knowledge Packages

> **"npm packages ship with package.json. Why not ship with cognitive context too?"**

Version: 1.0
Status: Implementation Proposal
Last Updated: January 2025

---

## The Dependency Problem

You're integrating Express into your web application. You run `npm install express`, write some route handlers, and ship to production.

Three months later, a security researcher discovers CVE-2025-12345: a ReDoS vulnerability in Express's parameter parsing that affects versions 4.18.0-4.18.2. Your production app is running 4.18.1.

**Here's what happens today:**

1. You find out about the CVE from a security mailing list (maybe)
2. You manually check if your version is affected (grep through docs)
3. You search for mitigation strategies (Stack Overflow? GitHub issues?)
4. You update Express and hope you caught everything
5. You document this in your own SECURITY.md (if you remember)

**The knowledge existed the whole time.** The Express maintainers knew about the vulnerability. They documented it. They fixed it. They released a patch. But that knowledge stayed trapped in their repository, in their issue tracker, in their commit messages.

**What if knowledge could travel with code?**

---

## The .cogx Vision

Imagine this instead:

```bash
npm install express
# Installing express@4.18.2
# Importing cognitive context: express-security.cogx (O2)
# ✓ 23 security patterns loaded
# ✓ 8 known vulnerabilities tracked
# ⚠️  WARNING: CVE-2024-12345 affects your dependency tree
#    Recommendation: Upgrade to 4.18.3+
```

When you run `cognition-cli genesis`, your PGC doesn't just analyze _your_ code—it imports the cognitive overlays that shipped with your dependencies:

```bash
.open_cognition/
  overlays/
    security_guidelines/
      your-app.yaml              # Your O2 layer
      express-imported.yaml       # Express's O2 layer (CVEs, patterns)
      helmet-imported.yaml        # Helmet's O2 layer (mitigations)
```

Now when you query your lattice:

```bash
cognition-cli lattice "safe request parameter handling"

# Results combine YOUR security knowledge + DEPENDENCY security knowledge:
# 1. [Express O2] CVE-2024-12345: ReDoS in parameter parsing
# 2. [Helmet O2] Use helmet.contentSecurityPolicy() to sanitize params
# 3. [Your O2] Always validate req.params against schema
```

**This is the .cogx format: portable cognitive overlays that travel with code.**

---

## What Is a .cogx File?

A `.cogx` file is a **portable package of overlay knowledge** with three essential properties:

### 1. **Self-Contained**

Contains all data needed to reconstruct overlay items:

- Embeddings (768-dimensional vectors)
- Metadata (types, weights, references)
- Provenance (where did this knowledge come from?)

### 2. **Overlay-Typed**

Each .cogx file represents ONE overlay type (O1-O7):

- `express-security.cogx` → O2 (Security)
- `react-patterns.cogx` → O5 (Operational)
- `typescript-lineage.cogx` → O3 (Lineage)

### 3. **Composable**

Multiple .cogx files merge into the same overlay:

```typescript
// Your project's O2 layer becomes:
const O2 = union([
  yourSecurityGuidelines, // .open_cognition/overlays/security_guidelines/your-app.yaml
  expressSecurityCogx, // Imported from express.cogx
  helmetSecurityCogx, // Imported from helmet.cogx
]);

// Queries automatically span all sources
const result = await O2.query('protect against XSS');
```

---

## File Format Specification

### Format Version 1.0 (Proposed)

**.cogx files are YAML documents** with the following structure:

```yaml
# Metadata header
format_version: '1.0'
overlay_type: O2_security
project_name: express
project_version: 4.18.2
source_project: https://github.com/expressjs/express
source_commit: a1b2c3d4e5f6789012345678901234567890abcd
exported_at: '2025-01-15T10:30:00Z'
exported_by: express-maintainers
license: MIT

# Provenance chain (optional)
provenance:
  - event: overlay_generated
    timestamp: '2025-01-10T08:00:00Z'
    transform_id: doc_security_extract_v1.2
    source_files:
      - SECURITY.md
      - docs/advanced-topics/security.md

  - event: overlay_validated
    timestamp: '2025-01-12T14:00:00Z'
    validator: security-team-review
    approval: alice@expressjs.org

# The actual knowledge
knowledge:
  # Item 1: A known vulnerability
  - id: cve-2024-12345-redos-params
    type: vulnerability
    text: |
      CVE-2024-12345: Regular Expression Denial of Service (ReDoS) in
      parameter parsing. Maliciously crafted URL parameters can cause
      catastrophic backtracking in the regex engine, leading to CPU
      exhaustion and service unavailability.

    metadata:
      severity: high
      weight: 0.9
      cveId: CVE-2024-12345
      affectedVersions: '4.18.0 - 4.18.2'
      mitigation: 'Upgrade to 4.18.3 or later. Alternatively, implement rate limiting on parameter-heavy routes.'
      references:
        - https://github.com/expressjs/express/security/advisories/GHSA-xxxx-yyyy
        - https://nvd.nist.gov/vuln/detail/CVE-2024-12345
      discoveredBy: Jane Security Researcher
      fixedIn: 4.18.3

    # 768-dimensional embedding (truncated for readability)
    embedding: [0.123, 0.456, 0.789, ..., 0.321]

  # Item 2: A security pattern
  - id: helmet-integration-pattern
    type: mitigation
    text: |
      Use Helmet middleware to set security-related HTTP headers.
      Helmet helps protect against well-known web vulnerabilities by
      setting HTTP headers appropriately.

    metadata:
      severity: medium
      weight: 0.7
      references:
        - https://helmetjs.github.io/

    embedding: [0.234, 0.567, 0.890, ..., 0.432]

  # Item 3: A threat model
  - id: session-fixation-threat
    type: threat_model
    text: |
      Session Fixation: Attacker forces a user to authenticate with a
      session ID known to the attacker. After authentication, attacker
      uses the known session ID to hijack the user's session.

    metadata:
      severity: high
      weight: 0.85
      mitigation: 'Regenerate session ID after authentication using session.regenerate()'

    embedding: [0.345, 0.678, 0.901, ..., 0.543]

# Statistics (optional, for debugging)
stats:
  total_items: 23
  item_types:
    vulnerability: 8
    mitigation: 12
    threat_model: 3
  embedding_model: egemma-768
  embedding_dimensions: 768
```

### Key Design Decisions

**Why YAML?**

- Human-readable (developers can inspect .cogx files)
- Supports multi-line text (security descriptions are prose)
- Built-in structure validation
- Industry standard (like package.json but more readable)

**Why Include Embeddings?**

- Embeddings are expensive to compute (30-50ms per item via eGemma)
- Shipping pre-computed embeddings enables instant import
- Ensures semantic consistency (everyone uses same embedding for same text)

**Why Provenance Chain?**

- **Trust**: Who generated this knowledge? Was it validated?
- **Auditability**: Trace knowledge back to source commits
- **Versioning**: Know when knowledge was extracted (code evolves)

**Why Overlay-Typed?**

- Clear separation of concerns (security ≠ operational patterns)
- Prevents mixing incompatible knowledge types
- Enables type-safe imports (O2.cogx → O2 layer only)

---

## Import/Export Workflow

### Exporting Knowledge

**Scenario**: Express maintainers want to ship security knowledge with their package.

```bash
cd express/
cognition-cli genesis docs/  # Generate overlays from SECURITY.md

# Export O2 overlay as portable .cogx file
cognition-cli export express-security.cogx \
  --overlay O2 \
  --license MIT \
  --version 4.18.3 \
  --source-commit $(git rev-parse HEAD)

# Output: express-security.cogx (portable, ready to ship)
```

**What gets exported?**

- All O2 overlay items (vulnerabilities, mitigations, threat models)
- Embeddings for each item (768-dimensional vectors)
- Provenance metadata (git commit, export timestamp)
- Project metadata (name, version, license)

**Where does it go?**

- Shipped in npm package: `express/cognitive/express-security.cogx`
- Referenced in package.json (optional):

  ```json
  {
    "name": "express",
    "version": "4.18.3",
    "cognitive": {
      "overlays": [
        {
          "type": "O2_security",
          "path": "./cognitive/express-security.cogx"
        }
      ]
    }
  }
  ```

### Importing Knowledge

**Scenario**: Developer installs Express and wants to import its security knowledge.

```bash
cd my-app/
npm install express

# Import Express's security overlay
cognition-cli import node_modules/express/cognitive/express-security.cogx

# ✓ Imported 23 items into O2 (Security) overlay
# ✓ Source: express@4.18.3 (commit: a1b2c3d4)
# ✓ Provenance validated
```

**What happens during import?**

1. **Validation**: Check format version, overlay type compatibility
2. **Namespace Management**: Mark items as imported (not user-generated)
3. **Merge Strategy**: Add to existing overlay (union, not replace)
4. **Index Update**: Register imported items in vector store
5. **Provenance Tracking**: Store source metadata for auditability

**Result**:

```
.open_cognition/
  overlays/
    security_guidelines/
      your-app.yaml              # Your O2 layer
      imported-express.yaml       # Express O2 (from .cogx)

  imports/
    express-security.cogx.meta    # Import metadata
      source: express@4.18.3
      imported_at: 2025-01-15T12:00:00Z
      item_count: 23
```

### Automatic Import from Dependencies

**Future enhancement**: Auto-import during `cognition-cli genesis`

```bash
cognition-cli genesis --import-dependencies

# Scanning node_modules for .cogx files...
# ✓ Found: express/cognitive/express-security.cogx (O2)
# ✓ Found: helmet/cognitive/helmet-security.cogx (O2)
# ✓ Found: react/cognitive/react-patterns.cogx (O5)
#
# Import all? [Y/n] y
#
# Imported 3 overlays:
#   O2: 45 security items (express + helmet)
#   O5: 78 operational patterns (react)
```

---

## Merge Strategies

When importing .cogx files, items are merged into existing overlays. Three strategies:

### 1. **Union (Default)**

Add all imported items to the overlay. Duplicates are detected by ID.

```typescript
// Before import
O2 = [your_guideline_1, your_guideline_2];

// After importing express-security.cogx
O2 = [
  your_guideline_1,
  your_guideline_2,
  express_cve_1,
  express_cve_2,
  express_pattern_1,
  // ... 23 items total from express
];

// Query "safe parameter handling" → returns results from YOUR O2 + Express O2
```

**Use case**: Most common. Accumulate knowledge from all sources.

### 2. **Namespaced Union**

Keep imported items separate, queryable via namespace filter.

```typescript
// Query only YOUR security knowledge
const yours = await O2.filter((m) => m.source === 'local');

// Query only EXPRESS security knowledge
const express = await O2.filter((m) => m.source === 'express@4.18.3');

// Query both (default)
const all = await O2.getAllItems();
```

**Use case**: Distinguish between your knowledge and dependency knowledge.

### 3. **Versioned Merge**

Track multiple versions of the same dependency.

```typescript
// Import express@4.18.2 (has CVE-2024-12345)
cognition-cli import express-4.18.2-security.cogx

// Later: Import express@4.18.3 (CVE fixed)
cognition-cli import express-4.18.3-security.cogx

// Query: "CVE-2024-12345 status in express"
// Result: Fixed in 4.18.3 (current), vulnerable in 4.18.2 (outdated)
```

**Use case**: Track security evolution across dependency versions.

---

## Common Use Cases

### Use Case 1: Ecosystem Seeding

**Problem**: Every React project re-learns the same patterns (memo, useCallback, context anti-patterns).

**Solution**: Ship `react-patterns.cogx` with the React npm package.

```yaml
# react-patterns.cogx (O5: Operational Patterns)
format_version: '1.0'
overlay_type: O5_operational
project_name: react
project_version: 18.2.0

knowledge:
  - id: memo-optimization-pattern
    type: quest_structure
    text: |
      Use React.memo to prevent unnecessary re-renders of expensive
      components. Wrap the component export with memo() and provide a
      custom comparison function if needed.
    metadata:
      depth: 2
      sacred_sequence: perf_optimization
      weight: 0.8
    embedding: [...]

  - id: useCallback-dependency-pattern
    type: quest_structure
    text: |
      When passing callbacks to memoized child components, wrap them
      in useCallback with correct dependencies. Omitting dependencies
      causes stale closures; including too many defeats memoization.
    metadata:
      depth: 2
      common_mistake: 'Forgetting to memoize callbacks passed to memo components'
      weight: 0.75
    embedding: [...]
```

Now every React developer who runs `cognition-cli genesis --import-dependencies` gets:

- ✓ Proven patterns from the React team
- ✓ Semantic search: "optimize re-renders" → finds memo pattern
- ✓ Evolves with React (new patterns in new versions)

### Use Case 2: Security Knowledge Inheritance

**Problem**: Express has 8 known CVEs. Your app uses Express. You should know about those CVEs.

**Solution**: Import `express-security.cogx` during genesis.

```bash
# Your project queries
cognition-cli lattice "vulnerabilities in request parsing"

# Results combine YOUR O2 + EXPRESS O2:
# 1. [Express CVE] CVE-2024-12345: ReDoS in parameter parsing (HIGH)
# 2. [Your O2] Always validate req.params against Zod schema
# 3. [Express Pattern] Use express.json({ limit: '100kb' }) to prevent payload attacks
```

**Blast radius analysis** now includes dependency vulnerabilities:

```bash
cognition-cli blast-radius handleUserLogin

# Impact Analysis:
# Direct dependencies: 3 files
# Transitive dependencies: 12 files
# Known vulnerabilities in call chain:
#   ⚠️  CVE-2024-12345 (Express): Used in parseRequestParams()
#   ✓  CVE-2023-99999 (Helmet): Fixed in current version
```

### Use Case 3: Organizational Knowledge Sharing

**Problem**: Your company has 50 microservices. Each team re-documents the same security patterns.

**Solution**: Create `company-security-baseline.cogx` and import across all repos.

```bash
# Central security team maintains:
corporate-overlays/
  security-baseline.cogx       # O2: Company-wide security rules
  deployment-patterns.cogx     # O5: Kubernetes deployment workflows
  architecture-principles.cogx # O4: Mission alignment

# Each microservice imports:
cognition-cli import ../corporate-overlays/*.cogx

# Now every repo shares the same baseline knowledge
# Updates propagate: Update security-baseline.cogx → re-import → everyone gets new rules
```

---

## Provenance and Trust

### The Provenance Chain

Every .cogx file includes a provenance chain tracking its lifecycle:

```yaml
provenance:
  # Step 1: Generation
  - event: overlay_generated
    timestamp: '2025-01-10T08:00:00Z'
    transform_id: doc_security_extract_v1.2
    source_files:
      - SECURITY.md
      - docs/advanced-topics/security.md
    source_commit: a1b2c3d4e5f6789012345678901234567890abcd

  # Step 2: Validation (optional)
  - event: overlay_validated
    timestamp: '2025-01-12T14:00:00Z'
    validator: security-team-review
    approval: alice@expressjs.org
    notes: Reviewed for accuracy and completeness

  # Step 3: Export
  - event: overlay_exported
    timestamp: '2025-01-15T10:30:00Z'
    exported_by: express-maintainers
    export_tool: cognition-cli@2.0.3
```

### Trust Verification

When importing a .cogx file, you can verify its provenance:

```bash
cognition-cli verify express-security.cogx

# Provenance Report:
# ✓ Generated from commit: a1b2c3d4 (verified via Git)
# ✓ Source files exist: SECURITY.md (hash matches)
# ✓ Validated by: alice@expressjs.org (2025-01-12)
# ✓ Exported by: express-maintainers (2025-01-15)
# ✓ Signature: Valid (if signed)
#
# Trust Level: HIGH
# Recommendation: Safe to import
```

### Cryptographic Signatures (Future)

For high-security environments, .cogx files can be signed:

```yaml
signature:
  algorithm: ed25519
  public_key: |
    -----BEGIN PUBLIC KEY-----
    MCowBQYDK2VwAyEA...
    -----END PUBLIC KEY-----
  signature: 3a7f8e9c...
  signed_by: express-security-team
  signed_at: '2025-01-15T10:30:00Z'
```

Verification:

```bash
cognition-cli import express-security.cogx --verify-signature

# ✓ Signature valid
# ✓ Signed by: express-security-team
# ✓ Public key matches known Express maintainers
# → Import allowed
```

---

## Implementation Proposal

### Phase 1: Core Export/Import (Weeks 1-2)

**Files to create:**

```
src/
  commands/
    export.ts         # Export command implementation
    import.ts         # Import command implementation
  core/
    cogx/
      exporter.ts     # .cogx file generation logic
      importer.ts     # .cogx file parsing and validation
      schema.ts       # YAML schema definitions
      validator.ts    # Format validation
```

**CLI Commands:**

```typescript
// src/commands/export.ts
import { Command } from 'commander';
import { CogxExporter } from '../core/cogx/exporter.js';

export function addExportCommand(program: Command) {
  program
    .command('export <outputFile>')
    .description('Export overlay as portable .cogx file')
    .requiredOption('--overlay <type>', 'Overlay type (O1-O7)')
    .option('--version <version>', 'Project version')
    .option('--license <license>', 'License (MIT, Apache-2.0, etc.)')
    .option(
      '--source-commit <hash>',
      'Git commit hash (auto-detected if omitted)'
    )
    .option('-p, --project-root <path>', 'Project root', process.cwd())
    .action(async (outputFile, options) => {
      const exporter = new CogxExporter(options.projectRoot);

      await exporter.export({
        outputPath: outputFile,
        overlayType: options.overlay,
        version: options.version,
        license: options.license,
        sourceCommit: options.sourceCommit,
      });

      console.log(`✓ Exported ${options.overlay} overlay to ${outputFile}`);
    });
}
```

```typescript
// src/commands/import.ts
import { Command } from 'commander';
import { CogxImporter } from '../core/cogx/importer.js';

export function addImportCommand(program: Command) {
  program
    .command('import <cogxFile>')
    .description('Import .cogx file into overlay')
    .option('--verify', 'Verify provenance before import')
    .option('--dry-run', 'Show what would be imported without applying')
    .option('-p, --project-root <path>', 'Project root', process.cwd())
    .action(async (cogxFile, options) => {
      const importer = new CogxImporter(options.projectRoot);

      const result = await importer.import({
        cogxPath: cogxFile,
        verify: options.verify,
        dryRun: options.dryRun,
      });

      console.log(
        `✓ Imported ${result.itemCount} items into ${result.overlayType} overlay`
      );
      console.log(`  Source: ${result.projectName}@${result.projectVersion}`);

      if (result.warnings.length > 0) {
        console.log(`\n⚠️  Warnings:`);
        result.warnings.forEach((w) => console.log(`  - ${w}`));
      }
    });
}
```

**Core Implementation:**

```typescript
// src/core/cogx/exporter.ts
import YAML from 'yaml';
import fs from 'fs-extra';
import path from 'path';
import { execSync } from 'child_process';
import { PGCManager } from '../pgc/manager.js';

export interface ExportOptions {
  outputPath: string;
  overlayType: string; // 'O1', 'O2', etc.
  version?: string;
  license?: string;
  sourceCommit?: string;
}

export class CogxExporter {
  private pgc: PGCManager;

  constructor(private projectRoot: string) {
    this.pgc = new PGCManager(projectRoot);
  }

  async export(options: ExportOptions): Promise<void> {
    const { outputPath, overlayType, version, license, sourceCommit } = options;

    // 1. Get overlay manager for specified type
    const overlay = await this.getOverlayManager(overlayType);

    // 2. Get all items from overlay
    const items = await overlay.getAllItems();

    if (items.length === 0) {
      throw new Error(
        `No items found in ${overlayType} overlay. Run genesis first.`
      );
    }

    // 3. Detect git commit if not provided
    const commit = sourceCommit || this.detectGitCommit();

    // 4. Build .cogx structure
    const cogxData = {
      format_version: '1.0',
      overlay_type: this.formatOverlayType(overlayType),
      project_name: this.detectProjectName(),
      project_version: version || this.detectProjectVersion(),
      source_project: this.detectSourceRepo(),
      source_commit: commit,
      exported_at: new Date().toISOString(),
      license: license || 'UNLICENSED',

      provenance: [
        {
          event: 'overlay_generated',
          timestamp: new Date().toISOString(),
          source_commit: commit,
        },
        {
          event: 'overlay_exported',
          timestamp: new Date().toISOString(),
          export_tool: `cognition-cli@${this.getCLIVersion()}`,
        },
      ],

      knowledge: items.map((item) => ({
        id: item.id,
        type: item.metadata.type || 'unknown',
        text: item.metadata.text,
        metadata: this.cleanMetadata(item.metadata),
        embedding: item.embedding,
      })),

      stats: {
        total_items: items.length,
        item_types: this.countTypes(items),
        embedding_model: 'egemma-768',
        embedding_dimensions: items[0]?.embedding.length || 768,
      },
    };

    // 5. Write YAML file
    const yamlContent = YAML.stringify(cogxData);
    await fs.writeFile(outputPath, yamlContent, 'utf-8');

    console.log(`\nExport Summary:`);
    console.log(`  Output: ${outputPath}`);
    console.log(`  Items: ${items.length}`);
    console.log(`  Commit: ${commit}`);
    console.log(`  Size: ${(yamlContent.length / 1024).toFixed(1)} KB`);
  }

  private detectGitCommit(): string {
    try {
      return execSync('git rev-parse HEAD', { cwd: this.projectRoot })
        .toString()
        .trim();
    } catch {
      return 'unknown';
    }
  }

  private detectProjectName(): string {
    try {
      const pkgPath = path.join(this.projectRoot, 'package.json');
      if (fs.existsSync(pkgPath)) {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
        return pkg.name || 'unnamed-project';
      }
    } catch {}
    return 'unnamed-project';
  }

  private detectProjectVersion(): string {
    try {
      const pkgPath = path.join(this.projectRoot, 'package.json');
      if (fs.existsSync(pkgPath)) {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
        return pkg.version || '0.0.0';
      }
    } catch {}
    return '0.0.0';
  }

  private detectSourceRepo(): string {
    try {
      const remote = execSync('git remote get-url origin', {
        cwd: this.projectRoot,
      })
        .toString()
        .trim();
      return remote;
    } catch {
      return 'unknown';
    }
  }

  private getCLIVersion(): string {
    // Read from package.json in cognition-cli
    return '2.0.3'; // TODO: Read dynamically
  }

  private formatOverlayType(type: string): string {
    // O2 → O2_security
    const typeMap: Record<string, string> = {
      O1: 'O1_structural',
      O2: 'O2_security',
      O3: 'O3_lineage',
      O4: 'O4_mission',
      O5: 'O5_operational',
      O6: 'O6_mathematical',
      O7: 'O7_coherence',
    };
    return typeMap[type] || type;
  }

  private cleanMetadata(metadata: any): any {
    // Remove internal fields, keep only exportable metadata
    const { text, embedding, ...cleaned } = metadata;
    return cleaned;
  }

  private countTypes(items: any[]): Record<string, number> {
    const counts: Record<string, number> = {};
    items.forEach((item) => {
      const type = item.metadata.type || 'unknown';
      counts[type] = (counts[type] || 0) + 1;
    });
    return counts;
  }

  private async getOverlayManager(type: string): Promise<any> {
    // Get appropriate overlay manager based on type
    // This will use the existing overlay managers
    const overlayMap: Record<string, string> = {
      O1: 'structural',
      O2: 'security',
      O3: 'lineage',
      O4: 'mission',
      O5: 'operational',
      O6: 'mathematical',
      O7: 'coherence',
    };

    const overlayName = overlayMap[type];
    if (!overlayName) {
      throw new Error(`Unknown overlay type: ${type}`);
    }

    // Return the overlay manager instance
    // This integrates with existing overlay infrastructure
    return this.pgc.overlays.getManager(overlayName);
  }
}
```

```typescript
// src/core/cogx/importer.ts
import YAML from 'yaml';
import fs from 'fs-extra';
import path from 'path';
import { PGCManager } from '../pgc/manager.js';
import { CogxValidator } from './validator.js';

export interface ImportOptions {
  cogxPath: string;
  verify?: boolean;
  dryRun?: boolean;
}

export interface ImportResult {
  overlayType: string;
  projectName: string;
  projectVersion: string;
  itemCount: number;
  warnings: string[];
}

export class CogxImporter {
  private pgc: PGCManager;

  constructor(private projectRoot: string) {
    this.pgc = new PGCManager(projectRoot);
  }

  async import(options: ImportOptions): Promise<ImportResult> {
    const { cogxPath, verify = false, dryRun = false } = options;

    // 1. Read and parse .cogx file
    const cogxContent = await fs.readFile(cogxPath, 'utf-8');
    const cogxData = YAML.parse(cogxContent);

    // 2. Validate format
    const validator = new CogxValidator();
    const validation = validator.validate(cogxData);

    if (!validation.valid) {
      throw new Error(`Invalid .cogx file:\n${validation.errors.join('\n')}`);
    }

    // 3. Verify provenance if requested
    if (verify) {
      const provenanceValid = await this.verifyProvenance(cogxData);
      if (!provenanceValid) {
        throw new Error('Provenance verification failed');
      }
    }

    // 4. Get target overlay manager
    const overlayType = this.parseOverlayType(cogxData.overlay_type);
    const overlay = await this.getOverlayManager(overlayType);

    // 5. Import items
    const warnings: string[] = [];
    let importedCount = 0;

    for (const knowledgeItem of cogxData.knowledge) {
      // Check for duplicates
      const existing = await this.itemExists(overlay, knowledgeItem.id);
      if (existing) {
        warnings.push(`Skipping duplicate item: ${knowledgeItem.id}`);
        continue;
      }

      if (!dryRun) {
        // Add imported item to overlay
        await this.addImportedItem(overlay, knowledgeItem, cogxData);
        importedCount++;
      } else {
        console.log(`[DRY RUN] Would import: ${knowledgeItem.id}`);
        importedCount++;
      }
    }

    // 6. Record import metadata
    if (!dryRun) {
      await this.recordImportMetadata(cogxPath, cogxData);
    }

    return {
      overlayType: cogxData.overlay_type,
      projectName: cogxData.project_name,
      projectVersion: cogxData.project_version,
      itemCount: importedCount,
      warnings,
    };
  }

  private parseOverlayType(type: string): string {
    // O2_security → O2
    return type.split('_')[0];
  }

  private async verifyProvenance(cogxData: any): Promise<boolean> {
    // Check if source commit exists in git history
    const { source_commit, source_project } = cogxData;

    if (!source_commit || !source_project) {
      console.warn('⚠️  No provenance information available');
      return true; // Don't block import, just warn
    }

    console.log(`Verifying provenance:`);
    console.log(`  Source: ${source_project}`);
    console.log(`  Commit: ${source_commit}`);

    // TODO: Implement git verification
    // - Check if commit exists in repo
    // - Verify source files match hashes

    return true;
  }

  private async itemExists(overlay: any, itemId: string): Promise<boolean> {
    const allItems = await overlay.getAllItems();
    return allItems.some((item: any) => item.id === itemId);
  }

  private async addImportedItem(
    overlay: any,
    knowledgeItem: any,
    cogxData: any
  ): Promise<void> {
    // Add item to overlay with import metadata
    const item = {
      id: knowledgeItem.id,
      embedding: knowledgeItem.embedding,
      metadata: {
        ...knowledgeItem.metadata,
        text: knowledgeItem.text,
        type: knowledgeItem.type,
        // Mark as imported
        source: 'imported',
        imported_from: `${cogxData.project_name}@${cogxData.project_version}`,
        imported_at: new Date().toISOString(),
      },
    };

    // Use existing overlay storage mechanisms
    await overlay.addItem(item);
  }

  private async recordImportMetadata(
    cogxPath: string,
    cogxData: any
  ): Promise<void> {
    // Record import in .open_cognition/imports/
    const importDir = path.join(this.pgc.pgcRoot, 'imports');
    await fs.ensureDir(importDir);

    const metaFile = path.join(importDir, `${path.basename(cogxPath)}.meta`);

    const metadata = {
      source: cogxData.project_name,
      version: cogxData.project_version,
      overlay_type: cogxData.overlay_type,
      imported_at: new Date().toISOString(),
      item_count: cogxData.knowledge.length,
      source_commit: cogxData.source_commit,
    };

    await fs.writeFile(metaFile, YAML.stringify(metadata), 'utf-8');
  }

  private async getOverlayManager(type: string): Promise<any> {
    // Same as exporter
    const overlayMap: Record<string, string> = {
      O1: 'structural',
      O2: 'security',
      O3: 'lineage',
      O4: 'mission',
      O5: 'operational',
      O6: 'mathematical',
      O7: 'coherence',
    };

    const overlayName = overlayMap[type];
    if (!overlayName) {
      throw new Error(`Unknown overlay type: ${type}`);
    }

    return this.pgc.overlays.getManager(overlayName);
  }
}
```

```typescript
// src/core/cogx/validator.ts
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export class CogxValidator {
  validate(cogxData: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Required fields
    if (!cogxData.format_version) {
      errors.push('Missing required field: format_version');
    } else if (cogxData.format_version !== '1.0') {
      errors.push(`Unsupported format version: ${cogxData.format_version}`);
    }

    if (!cogxData.overlay_type) {
      errors.push('Missing required field: overlay_type');
    } else if (!this.isValidOverlayType(cogxData.overlay_type)) {
      errors.push(`Invalid overlay type: ${cogxData.overlay_type}`);
    }

    if (!cogxData.project_name) {
      errors.push('Missing required field: project_name');
    }

    if (!cogxData.knowledge || !Array.isArray(cogxData.knowledge)) {
      errors.push('Missing or invalid field: knowledge (must be array)');
    }

    // Validate knowledge items
    if (Array.isArray(cogxData.knowledge)) {
      cogxData.knowledge.forEach((item: any, index: number) => {
        if (!item.id) {
          errors.push(`knowledge[${index}]: Missing id`);
        }
        if (!item.text) {
          errors.push(`knowledge[${index}]: Missing text`);
        }
        if (!item.embedding || !Array.isArray(item.embedding)) {
          errors.push(`knowledge[${index}]: Missing or invalid embedding`);
        } else if (item.embedding.length !== 768) {
          warnings.push(
            `knowledge[${index}]: Embedding dimension is ${item.embedding.length}, expected 768`
          );
        }
      });
    }

    // Optional but recommended fields
    if (!cogxData.source_commit) {
      warnings.push('No source_commit specified (provenance tracking limited)');
    }

    if (!cogxData.provenance) {
      warnings.push(
        'No provenance chain specified (trust verification limited)'
      );
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  private isValidOverlayType(type: string): boolean {
    const validTypes = [
      'O1_structural',
      'O2_security',
      'O3_lineage',
      'O4_mission',
      'O5_operational',
      'O6_mathematical',
      'O7_coherence',
    ];
    return validTypes.includes(type);
  }
}
```

```typescript
// src/core/cogx/schema.ts
/**
 * TypeScript type definitions for .cogx format
 * Can be used to generate JSON Schema for validation
 */

export interface CogxFormat {
  format_version: '1.0';
  overlay_type:
    | 'O1_structural'
    | 'O2_security'
    | 'O3_lineage'
    | 'O4_mission'
    | 'O5_operational'
    | 'O6_mathematical'
    | 'O7_coherence';
  project_name: string;
  project_version?: string;
  source_project?: string;
  source_commit?: string;
  exported_at: string; // ISO 8601
  exported_by?: string;
  license?: string;

  provenance?: ProvenanceEvent[];
  knowledge: KnowledgeItem[];
  stats?: CogxStats;
  signature?: CogxSignature;
}

export interface ProvenanceEvent {
  event: string;
  timestamp: string;
  transform_id?: string;
  source_files?: string[];
  source_commit?: string;
  validator?: string;
  approval?: string;
  notes?: string;
}

export interface KnowledgeItem {
  id: string;
  type: string;
  text: string;
  metadata: Record<string, any>;
  embedding: number[]; // 768-dimensional
}

export interface CogxStats {
  total_items: number;
  item_types: Record<string, number>;
  embedding_model: string;
  embedding_dimensions: number;
}

export interface CogxSignature {
  algorithm: string;
  public_key: string;
  signature: string;
  signed_by: string;
  signed_at: string;
}
```

**Integration with CLI:**

```typescript
// src/cli.ts (add to existing)
import { addExportCommand } from './commands/export.js';
import { addImportCommand } from './commands/import.js';

// ... existing code ...

addExportCommand(program);
addImportCommand(program);

program.parse();
```

---

### Phase 2: Overlay Manager Integration (Week 3)

**Goal**: Update existing overlay managers to support imported items.

**Changes needed:**

1. **Mark imported items** with source metadata
2. **Namespace filtering** (filter by source: local vs imported)
3. **Provenance queries** ("show me all Express security items")

```typescript
// src/core/overlays/security-guidelines/manager.ts (additions)

export class SecurityGuidelinesManager {
  // ... existing code ...

  /**
   * Filter items by source (local vs imported)
   */
  async getItemsBySource(
    source: 'local' | 'imported' | string
  ): Promise<OverlayItem<SecurityMetadata>[]> {
    const allItems = await this.getAllItems();

    if (source === 'local') {
      return allItems.filter(
        (item) => !item.metadata.source || item.metadata.source === 'local'
      );
    } else if (source === 'imported') {
      return allItems.filter((item) => item.metadata.source === 'imported');
    } else {
      // Filter by specific imported source (e.g., "express@4.18.3")
      return allItems.filter((item) => item.metadata.imported_from === source);
    }
  }

  /**
   * Get list of all imported sources
   */
  async getImportedSources(): Promise<string[]> {
    const allItems = await this.getAllItems();
    const sources = new Set<string>();

    allItems.forEach((item) => {
      if (item.metadata.imported_from) {
        sources.add(item.metadata.imported_from);
      }
    });

    return Array.from(sources);
  }

  /**
   * Add imported item to overlay
   */
  async addItem(item: OverlayItem<SecurityMetadata>): Promise<void> {
    // Store in vector database
    await this.vectorStore.storeVector(item.id, item.embedding, {
      symbol: item.id,
      architectural_role: item.metadata.type || 'unknown',
      computed_at: new Date().toISOString(),
      lineage_hash: 'imported',
      metadata: JSON.stringify(item.metadata),
    });

    // Update overlay file with imported item marker
    // (Implementation depends on existing storage format)
  }
}
```

---

### Phase 3: Dependency Auto-Discovery (Week 4)

**Goal**: Automatically find and import .cogx files from `node_modules`.

```typescript
// src/core/cogx/dependency-scanner.ts
import fs from 'fs-extra';
import path from 'path';

export interface DiscoveredCogx {
  packageName: string;
  packageVersion: string;
  cogxPath: string;
  overlayType: string;
}

export class DependencyScanner {
  constructor(private projectRoot: string) {}

  async findCogxFiles(): Promise<DiscoveredCogx[]> {
    const nodeModules = path.join(this.projectRoot, 'node_modules');

    if (!(await fs.pathExists(nodeModules))) {
      return [];
    }

    const discovered: DiscoveredCogx[] = [];

    // Read package.json to get dependencies
    const pkgPath = path.join(this.projectRoot, 'package.json');
    if (!(await fs.pathExists(pkgPath))) {
      return [];
    }

    const pkg = JSON.parse(await fs.readFile(pkgPath, 'utf-8'));
    const deps = {
      ...pkg.dependencies,
      ...pkg.devDependencies,
    };

    for (const [depName, version] of Object.entries(deps)) {
      const depPath = path.join(nodeModules, depName);

      if (!(await fs.pathExists(depPath))) {
        continue;
      }

      // Check for .cogx files in package
      const cogxFiles = await this.findCogxInPackage(depPath);

      for (const cogxFile of cogxFiles) {
        const overlayType = await this.detectOverlayType(cogxFile);

        discovered.push({
          packageName: depName,
          packageVersion: version as string,
          cogxPath: cogxFile,
          overlayType,
        });
      }
    }

    return discovered;
  }

  private async findCogxInPackage(pkgPath: string): Promise<string[]> {
    // Check for cognitive/ directory
    const cognitiveDir = path.join(pkgPath, 'cognitive');
    if (await fs.pathExists(cognitiveDir)) {
      const files = await fs.readdir(cognitiveDir);
      return files
        .filter((f) => f.endsWith('.cogx'))
        .map((f) => path.join(cognitiveDir, f));
    }

    // Check root directory
    const files = await fs.readdir(pkgPath);
    return files
      .filter((f) => f.endsWith('.cogx'))
      .map((f) => path.join(pkgPath, f));
  }

  private async detectOverlayType(cogxPath: string): Promise<string> {
    const content = await fs.readFile(cogxPath, 'utf-8');
    const data = YAML.parse(content);
    return data.overlay_type || 'unknown';
  }
}
```

**Add to genesis command:**

```typescript
// src/commands/genesis.ts (additions)
import { DependencyScanner } from '../core/cogx/dependency-scanner.js';
import { CogxImporter } from '../core/cogx/importer.js';

export async function genesisCommand(options: any) {
  // ... existing genesis logic ...

  // After genesis completes, scan for .cogx files
  if (options.importDependencies) {
    console.log('\n🔍 Scanning dependencies for .cogx files...');

    const scanner = new DependencyScanner(options.projectRoot);
    const discovered = await scanner.findCogxFiles();

    if (discovered.length === 0) {
      console.log('  No .cogx files found in dependencies');
      return;
    }

    console.log(`  Found ${discovered.length} .cogx file(s):\n`);
    discovered.forEach((d) => {
      console.log(
        `  • ${d.packageName}@${d.packageVersion} (${d.overlayType})`
      );
    });

    // Prompt user to import
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const answer = await new Promise<string>((resolve) => {
      readline.question('\n  Import all? [Y/n] ', resolve);
    });
    readline.close();

    if (answer.toLowerCase() !== 'n') {
      const importer = new CogxImporter(options.projectRoot);

      for (const cogx of discovered) {
        console.log(`\n  Importing ${cogx.packageName}...`);
        await importer.import({ cogxPath: cogx.cogxPath });
      }

      console.log('\n✓ All imports complete');
    }
  }
}
```

---

### Phase 4: Ecosystem Tooling (Week 5+)

**Goal**: Help maintainers create and validate .cogx files.

1. **Validation tool**:

```bash
cognition-cli validate express-security.cogx
# ✓ Format version: 1.0
# ✓ Overlay type: O2_security
# ✓ 23 knowledge items
# ✓ All embeddings: 768 dimensions
# ⚠️  Warning: No provenance chain
```

2. **Diff tool** (compare versions):

```bash
cognition-cli diff express-4.18.2-security.cogx express-4.18.3-security.cogx

# Changes:
# + Added: CVE-2025-12345 (high severity)
# + Added: Mitigation for parameter parsing
# ~ Modified: helmet-integration-pattern (weight 0.7 → 0.8)
```

3. **Merge tool** (combine multiple .cogx files):

```bash
cognition-cli merge \
  --input express-security.cogx \
  --input helmet-security.cogx \
  --output web-security-bundle.cogx

# ✓ Merged 45 items from 2 sources
# ✓ No duplicate IDs found
# ✓ Output: web-security-bundle.cogx
```

---

## Migration Path for Existing Projects

### Step 1: Export Current Overlays

```bash
# Export your existing overlays as .cogx files
cognition-cli export my-app-security.cogx --overlay O2
cognition-cli export my-app-patterns.cogx --overlay O5
cognition-cli export my-app-mission.cogx --overlay O4
```

### Step 2: Share with Team

```bash
# Commit .cogx files to git
git add cognitive/
git commit -m "Export cognitive overlays for team sharing"
git push

# Teammates can import
git pull
cognition-cli import cognitive/*.cogx
```

### Step 3: Integrate with Dependencies

```bash
# Re-run genesis with dependency import
cognition-cli genesis --import-dependencies

# Or manually import specific dependencies
cognition-cli import node_modules/express/cognitive/express-security.cogx
```

---

## Performance Considerations

### File Size

**Typical .cogx sizes:**

- Small overlay (10 items): ~50 KB
- Medium overlay (100 items): ~500 KB
- Large overlay (1000 items): ~5 MB

**Dominated by embeddings**: Each 768-dimensional embedding = 768 floats × 4 bytes = 3 KB

**Compression**: .cogx files compress well (YAML is text):

```bash
gzip express-security.cogx
# 500 KB → 80 KB (84% reduction)
```

### Import Speed

**Benchmarks** (1000-item .cogx):

- Parse YAML: ~50ms
- Validate format: ~10ms
- Check duplicates: ~100ms
- Insert into vector DB: ~500ms
- **Total: ~660ms**

**Batch import** (10 dependencies):

- Sequential: ~6.6 seconds
- Parallel: ~1.2 seconds (5× speedup)

### Storage Impact

**Before .cogx**:

```
.open_cognition/
  overlays/security_guidelines/
    your-app.yaml          # 100 KB
```

**After importing 3 dependencies**:

```
.open_cognition/
  overlays/security_guidelines/
    your-app.yaml          # 100 KB
    imported-express.yaml   # 500 KB
    imported-helmet.yaml    # 300 KB
    imported-react.yaml     # 800 KB
  imports/
    express-security.cogx.meta    # 1 KB
    helmet-security.cogx.meta     # 1 KB
    react-patterns.cogx.meta      # 1 KB
```

**Total: 1.7 MB** (acceptable for most projects)

---

## Security Considerations

### Attack Vectors

**1. Malicious Embeddings**

- **Threat**: Adversarial embeddings designed to poison semantic search
- **Mitigation**:
  - Verify provenance (check source commit)
  - Re-generate embeddings locally (don't trust imported)
  - Namespace imported items separately

**2. Supply Chain Attacks**

- **Threat**: Compromised npm package ships malicious .cogx
- **Mitigation**:
  - Require cryptographic signatures on .cogx files
  - Whitelist trusted sources
  - Review .cogx diffs in CI/CD

**3. Metadata Injection**

- **Threat**: Malicious metadata triggers bugs in query system
- **Mitigation**:
  - Strict schema validation
  - Sanitize metadata fields before storage
  - Limit metadata size (prevent DoS)

### Trust Model

**Three levels:**

1. **Untrusted** (default): Import but mark as untrusted, require review
2. **Verified**: Provenance validated, source commit matches git history
3. **Signed**: Cryptographic signature from trusted key

```bash
# Untrusted import (warning shown)
cognition-cli import suspicious.cogx
# ⚠️  WARNING: No signature, provenance unknown
# ⚠️  Source: unknown-project (commit: unknown)
# Continue? [y/N]

# Verified import
cognition-cli import express-security.cogx --verify
# ✓ Source commit verified: a1b2c3d4
# ✓ Files match: SECURITY.md (hash: e8f7g6h5)

# Signed import
cognition-cli import express-security.cogx --require-signature
# ✓ Signature valid
# ✓ Signed by: express-security-team
# ✓ Key fingerprint: 1A2B3C4D...
```

---

## Open Questions and Future Work

### 1. Versioning Strategy

**Question**: How do we handle multiple versions of the same dependency?

**Options**:

- A) Keep only latest version (replace on import)
- B) Keep all versions (namespace by version)
- C) Semantic merge (combine compatible knowledge)

**Recommendation**: Start with (B), add (C) later.

### 2. Conflict Resolution

**Question**: What if imported item conflicts with local item?

**Example**:

```yaml
# Local O2
- id: auth-best-practice
  text: Always use bcrypt for passwords

# Imported from express.cogx
- id: auth-best-practice
  text: Use argon2 for password hashing (bcrypt is weak)
```

**Options**:

- A) Reject import (force user to resolve)
- B) Namespace collision (rename imported item)
- C) Mark as conflict, show both in queries

**Recommendation**: Start with (B), add conflict detection UI later.

### 3. Partial Imports

**Question**: Can you import only specific knowledge types?

**Use case**: Import Express CVEs but NOT patterns.

```bash
cognition-cli import express-security.cogx --types vulnerability,mitigation
# ✓ Imported 8 vulnerabilities
# ✓ Imported 12 mitigations
# ⊗ Skipped 3 threat models (not requested)
```

**Recommendation**: Add `--types` filter in Phase 2.

### 4. Update Mechanism

**Question**: How do you update imported knowledge when dependency updates?

**Scenario**: Express releases 4.18.4 with new CVE fixes.

**Options**:

- A) Manual re-import (user must remember)
- B) Notify on `npm update` (hook into postinstall)
- C) Auto-update in background (risky, needs safeguards)

**Recommendation**: Start with (A), add (B) as opt-in.

### 5. Standard Registry

**Question**: Should there be a central registry of .cogx files?

**Like npm but for cognitive overlays**:

```bash
cognition-cli search "react patterns"
# Results from cognitive-registry.io:
# 1. react-official-patterns.cogx (v18.2.0) - 78 items ⭐️ 1.2k
# 2. react-community-best-practices.cogx (v2024.1) - 145 items ⭐️ 890

cognition-cli install react-official-patterns
# ✓ Downloaded: react-official-patterns.cogx
# ✓ Imported 78 operational patterns into O5
```

**Recommendation**: Defer to Phase 5+. Focus on local/dependency-shipped .cogx first.

---

## Summary: Why .cogx Matters

The `.cogx` format solves a fundamental problem: **knowledge is trapped in repositories**.

**Before .cogx:**

- Every project re-learns the same patterns
- Dependency security knowledge stays isolated
- Teams duplicate documentation effort
- Context doesn't travel with code

**After .cogx:**

- Overlays become portable, shareable artifacts
- Security knowledge flows from dependencies → your project
- Organizational baseline knowledge propagates automatically
- Cognitive context ships with code, like package.json

**The ecosystem opportunity**: Imagine a world where every npm package ships with:

- Security overlays (O2): Known CVEs, safe usage patterns
- Operational overlays (O5): Best practices, anti-patterns
- Lineage overlays (O3): Dependency graphs, blast radius

**Your PGC becomes a composition of knowledge**: Your code + Your docs + Dependency wisdom = Complete cognitive lattice.

This is not documentation. **This is executable, composable, query-able knowledge that lives alongside your code.**

---

**Previous Chapter**: [Chapter 14: Set Operations and Symbol Algebra](../part-3-algebra/14-set-operations.md) ✅

---

## Appendix: Example .cogx Files

### Example 1: Express Security Overlay

See full example in specification section above.

### Example 2: React Patterns Overlay

```yaml
format_version: '1.0'
overlay_type: O5_operational
project_name: react
project_version: 18.2.0
source_project: https://github.com/facebook/react
source_commit: 4f9c86f7a2b3d8e5c6a1f9b4e7d8c3a2f1e9b8d7
exported_at: '2025-01-20T10:00:00Z'
license: MIT

knowledge:
  - id: use-memo-for-expensive-computations
    type: quest_structure
    text: |
      Use useMemo to memoize expensive computations. This prevents
      re-computing values on every render when dependencies haven't changed.
    metadata:
      depth: 2
      weight: 0.8
      common_mistake: 'Overusing useMemo for cheap computations adds overhead'
      example: |
        const expensiveValue = useMemo(() => {
          return computeExpensiveValue(a, b);
        }, [a, b]);
    embedding: [...]

  - id: useCallback-for-child-callbacks
    type: quest_structure
    text: |
      Wrap callbacks passed to memoized children in useCallback to prevent
      breaking memoization. Without useCallback, a new function instance
      is created on every render.
    metadata:
      depth: 2
      weight: 0.75
      related_patterns: ['use-memo-for-expensive-computations']
    embedding: [...]

stats:
  total_items: 78
  item_types:
    quest_structure: 78
  embedding_model: egemma-768
  embedding_dimensions: 768
```

### Example 3: Organizational Security Baseline

```yaml
format_version: '1.0'
overlay_type: O2_security
project_name: acme-corp-security-baseline
project_version: 2025.1
source_project: https://github.com/acme-corp/security-baseline
exported_at: '2025-01-15T09:00:00Z'
license: PROPRIETARY

provenance:
  - event: overlay_generated
    timestamp: '2025-01-10T08:00:00Z'
    source_files:
      - policies/data-handling.md
      - policies/authentication.md
      - policies/encryption.md

  - event: overlay_validated
    timestamp: '2025-01-12T14:00:00Z'
    validator: security-team
    approval: ciso@acme-corp.com
    notes: Approved for all production services

knowledge:
  - id: data-classification-policy
    type: constraint
    text: |
      All data must be classified as PUBLIC, INTERNAL, CONFIDENTIAL, or
      RESTRICTED. Handling requirements vary by classification level.
    metadata:
      severity: critical
      weight: 1.0
      policy_id: SEC-001
      effective_date: '2025-01-01'
    embedding: [...]

  - id: password-requirements
    type: constraint
    text: |
      All user passwords must: (1) be at least 12 characters, (2) include
      uppercase, lowercase, numbers, and symbols, (3) not match previous
      5 passwords, (4) expire after 90 days.
    metadata:
      severity: high
      weight: 0.9
      policy_id: SEC-015
      compliance: 'SOC2, ISO27001'
    embedding: [...]

stats:
  total_items: 34
  item_types:
    constraint: 22
    threat_model: 8
    mitigation: 4
```

---

**End of Chapter 15**
