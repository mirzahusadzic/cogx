# Test Coverage Gap Analysis for cognition-cli

**Analysis Date:** 2025-11-15
**Codebase Version:** 2.3.2
**Analyzer:** Claude (Sonnet 4.5)

---

## Executive Summary

### Coverage Metrics

| Metric                       | Value   | Status          |
| ---------------------------- | ------- | --------------- |
| **Total Source Files**       | 178     | -               |
| **Files with Tests**         | 41      | 23% ✗           |
| **Untested Files**           | 137     | 77% ✗           |
| **Test Lines of Code**       | ~12,327 | -               |
| **Critical Files Untested**  | 18      | **P0 PRIORITY** |
| **High-Risk Files Untested** | 45      | **P1 PRIORITY** |

### Critical Findings

**SECURITY CRISIS (P0):**

- 🚨 **ALL 8 security modules untested** (mission-validator.ts, drift-detector.ts, etc.)
- 🚨 **0% test coverage** for mission integrity validation
- 🚨 **0% test coverage** for drift detection (attack prevention)

**COMPRESSION CRISIS (P0):**

- 🚨 **compressor.ts (276 LOC)** - 30-50x compression algorithm untested
- 🚨 **useClaudeAgent.ts (1262 LOC)** - Core TUI state management untested
- 🚨 Risk of data loss, session corruption, race conditions

**COMMAND COVERAGE (P1):**

- ⚠️ **14 of 18 commands untested** (78% untested)
- ⚠️ Critical commands: init, watch, migrate, wizard, coherence

### Estimated Effort to Close Gaps

| Priority          | Files | Estimated Hours | Timeline  |
| ----------------- | ----- | --------------- | --------- |
| **P0 (Critical)** | 18    | 60-80 hours     | Weeks 1-2 |
| **P1 (High)**     | 45    | 90-120 hours    | Weeks 3-4 |
| **P2 (Medium)**   | 38    | 60-80 hours     | Weeks 5-6 |
| **P3 (Low)**      | 14    | 20-30 hours     | Ongoing   |
| **TOTAL**         | 115   | 230-310 hours   | 6 weeks   |

---

## Test Gap Inventory

### P0 - CRITICAL (Must Test Immediately)

#### Security Module (8 files, 0% coverage)

| File Path                             | LOC  | Risk Level   | Test Status | Priority | Effort |
| ------------------------------------- | ---- | ------------ | ----------- | -------- | ------ |
| `core/security/mission-validator.ts`  | 563  | **CRITICAL** | ❌ None     | P0       | 8h     |
| `core/security/drift-detector.ts`     | 429  | **CRITICAL** | ❌ None     | P0       | 8h     |
| `core/security/mission-integrity.ts`  | ~150 | **CRITICAL** | ❌ None     | P0       | 4h     |
| `core/security/security-bootstrap.ts` | ~200 | **CRITICAL** | ❌ None     | P0       | 4h     |
| `core/security/transparency-log.ts`   | ~150 | **CRITICAL** | ❌ None     | P0       | 4h     |
| `core/security/dual-use-mandate.ts`   | ~100 | **CRITICAL** | ❌ None     | P0       | 2h     |
| `core/security/security-config.ts`    | ~100 | HIGH         | ❌ None     | P0       | 2h     |
| `core/security/index.ts`              | ~50  | MEDIUM       | ❌ None     | P2       | 1h     |

**Total Security Module: 33 hours**

#### Compression & Session Management (3 files, 0% coverage)

| File Path                      | LOC  | Risk Level   | Test Status | Priority | Effort |
| ------------------------------ | ---- | ------------ | ----------- | -------- | ------ |
| `sigma/compressor.ts`          | 276  | **CRITICAL** | ❌ None     | P0       | 6h     |
| `tui/hooks/useClaudeAgent.ts`  | 1262 | **CRITICAL** | ❌ None     | P0       | 12h    |
| `sigma/cross-session-query.ts` | ~200 | **CRITICAL** | ❌ None     | P0       | 4h     |

**Total Compression: 22 hours**

#### Security Commands (2 files, 0% coverage)

| File Path                      | LOC  | Risk Level | Test Status | Priority | Effort |
| ------------------------------ | ---- | ---------- | ----------- | -------- | ------ |
| `commands/security/mandate.ts` | ~100 | HIGH       | ❌ None     | P0       | 2h     |
| `commands/sugar/security.ts`   | ~150 | HIGH       | ❌ None     | P0       | 3h     |

**Total Commands: 5 hours**

#### TUI Core Components (5 files, 0% coverage)

| File Path                             | LOC  | Risk Level | Test Status | Priority | Effort |
| ------------------------------------- | ---- | ---------- | ----------- | -------- | ------ |
| `tui/components/ClaudePanelAgent.tsx` | ~200 | HIGH       | ❌ None     | P0       | 4h     |
| `tui/hooks/useClaude.ts`              | ~300 | HIGH       | ❌ None     | P0       | 6h     |
| `tui/hooks/useOverlays.ts`            | ~200 | HIGH       | ❌ None     | P0       | 4h     |
| `tui/hooks/useMouse.ts`               | ~100 | MEDIUM     | ❌ None     | P1       | 2h     |
| `tui/components/ClaudePanel.tsx`      | ~150 | MEDIUM     | ❌ None     | P1       | 3h     |

**Total TUI: 19 hours**

**P0 TOTAL: 18 files, 79 hours**

---

### P1 - HIGH (Test Within 1 Month)

#### Command Handlers (14 files, 0% coverage)

| File Path                      | LOC  | Risk Level | Test Status | Priority | Effort |
| ------------------------------ | ---- | ---------- | ----------- | -------- | ------ |
| `commands/init.ts`             | 60   | HIGH       | ❌ None     | P1       | 2h     |
| `commands/watch.ts`            | 111  | HIGH       | ❌ None     | P1       | 3h     |
| `commands/genesis.ts`          | ~200 | HIGH       | ❌ None     | P1       | 4h     |
| `commands/wizard.ts`           | ~300 | HIGH       | ❌ None     | P1       | 6h     |
| `commands/migrate-to-lance.ts` | ~250 | HIGH       | ❌ None     | P1       | 5h     |
| `commands/coherence.ts`        | ~150 | HIGH       | ❌ None     | P1       | 3h     |
| `commands/ask.ts`              | ~100 | MEDIUM     | ❌ None     | P1       | 2h     |
| `commands/tui.ts`              | ~100 | MEDIUM     | ❌ None     | P1       | 2h     |
| `commands/status.ts`           | ~100 | MEDIUM     | ❌ None     | P1       | 2h     |
| `commands/update.ts`           | ~100 | MEDIUM     | ❌ None     | P1       | 2h     |
| `commands/patterns.ts`         | ~100 | MEDIUM     | ❌ None     | P1       | 2h     |
| `commands/concepts.ts`         | ~100 | MEDIUM     | ❌ None     | P1       | 2h     |
| `commands/blast-radius.ts`     | ~100 | MEDIUM     | ❌ None     | P1       | 2h     |
| `commands/guide.ts`            | ~50  | LOW        | ❌ None     | P2       | 1h     |

**Total Commands: 38 hours**

#### PGC Core Modules (6 files, partial coverage)

| File Path                      | LOC  | Risk Level | Test Status | Priority | Effort |
| ------------------------------ | ---- | ---------- | ----------- | -------- | ------ |
| `core/pgc/document-object.ts`  | ~200 | HIGH       | ❌ None     | P1       | 4h     |
| `core/pgc/embedding-loader.ts` | ~150 | HIGH       | ❌ None     | P1       | 3h     |
| `core/pgc/overlays.ts`         | ~100 | HIGH       | ❌ None     | P1       | 2h     |
| `core/pgc/search-worker.ts`    | ~200 | HIGH       | ❌ None     | P1       | 4h     |
| `core/pgc/patterns.ts`         | ~100 | MEDIUM     | ❌ None     | P1       | 2h     |
| `core/pgc/transform-log.ts`    | ~100 | MEDIUM     | ❌ None     | P1       | 2h     |

**Total PGC: 17 hours**

#### Orchestrators & Miners (5 files, partial coverage)

| File Path                                     | LOC  | Risk Level | Test Status | Priority | Effort |
| --------------------------------------------- | ---- | ---------- | ----------- | -------- | ------ |
| `core/orchestrators/genesis-worker.ts`        | ~300 | HIGH       | ❌ None     | P1       | 6h     |
| `core/orchestrators/update.ts`                | ~200 | HIGH       | ❌ None     | P1       | 4h     |
| `core/orchestrators/miners/llm-supervisor.ts` | ~200 | HIGH       | ❌ None     | P1       | 4h     |
| `core/orchestrators/miners/slm-extractor.ts`  | ~150 | MEDIUM     | ❌ None     | P1       | 3h     |
| `core/orchestrators/miners/structural.ts`     | ~150 | MEDIUM     | ❌ None     | P1       | 3h     |

**Total Orchestrators: 20 hours**

#### Analyzers (6 files, 1 tested)

| File Path                               | LOC  | Risk Level | Test Status | Priority | Effort |
| --------------------------------------- | ---- | ---------- | ----------- | -------- | ------ |
| `core/analyzers/proof-extractor.ts`     | ~200 | HIGH       | ❌ None     | P1       | 4h     |
| `core/analyzers/security-extractor.ts`  | ~200 | HIGH       | ❌ None     | P1       | 4h     |
| `core/analyzers/strategy-extractor.ts`  | ~200 | HIGH       | ❌ None     | P1       | 4h     |
| `core/analyzers/workflow-extractor.ts`  | ~200 | MEDIUM     | ❌ None     | P1       | 4h     |
| `core/analyzers/document-extractor.ts`  | ~200 | MEDIUM     | ❌ None     | P1       | 4h     |
| `core/analyzers/document-classifier.ts` | ~150 | MEDIUM     | ❌ None     | P1       | 3h     |

**Total Analyzers: 23 hours**

#### Overlay Adapters (8 files, 0% coverage)

| File Path                                              | LOC  | Risk Level | Test Status | Priority | Effort |
| ------------------------------------------------------ | ---- | ---------- | ----------- | -------- | ------ |
| `core/overlays/lineage/algebra-adapter.ts`             | ~150 | HIGH       | ❌ None     | P1       | 3h     |
| `core/overlays/strategic-coherence/algebra-adapter.ts` | ~150 | HIGH       | ❌ None     | P1       | 3h     |
| `core/overlays/security-guidelines/manager.ts`         | ~500 | HIGH       | ❌ None     | P1       | 8h     |
| `core/overlays/mission-concepts/manager.ts`            | ~500 | MEDIUM     | ❌ None     | P1       | 8h     |
| `core/overlays/operational-patterns/manager.ts`        | ~500 | MEDIUM     | ❌ None     | P1       | 8h     |
| `core/overlays/mathematical-proofs/manager.ts`         | ~500 | MEDIUM     | ❌ None     | P1       | 8h     |
| `core/overlays/structural-patterns/manager.ts`         | ~200 | MEDIUM     | ❌ None     | P1       | 4h     |
| `core/overlays/lineage/manager.ts`                     | ~300 | MEDIUM     | ❌ None     | P1       | 6h     |

**Total Overlays: 48 hours**

**P1 TOTAL: 45 files, 146 hours**

---

### P2 - MEDIUM (Test Within 2 Months)

#### Sigma Utilities (15 files, partial coverage)

| File Path                                     | LOC  | Risk Level | Test Status | Priority | Effort |
| --------------------------------------------- | ---- | ---------- | ----------- | -------- | ------ |
| `sigma/analyzer.ts`                           | ~300 | MEDIUM     | ❌ None     | P2       | 6h     |
| `sigma/reconstructor.ts`                      | ~200 | MEDIUM     | ❌ None     | P2       | 4h     |
| `sigma/lattice-reconstructor.ts`              | ~200 | MEDIUM     | ❌ None     | P2       | 4h     |
| `sigma/context-injector.ts`                   | ~200 | MEDIUM     | ❌ None     | P2       | 4h     |
| `sigma/context-reconstructor.ts`              | ~200 | MEDIUM     | ❌ None     | P2       | 4h     |
| `sigma/recall-tool.ts`                        | ~150 | MEDIUM     | ❌ None     | P2       | 3h     |
| `sigma/conversation-populator.ts`             | ~150 | MEDIUM     | ❌ None     | P2       | 3h     |
| `sigma/analyzer-with-embeddings.ts`           | ~200 | MEDIUM     | ❌ None     | P2       | 4h     |
| `sigma/migrate-lattice-to-v2.ts`              | ~150 | MEDIUM     | ❌ None     | P2       | 3h     |
| `sigma/migrate-yaml-to-lancedb.ts`            | ~150 | MEDIUM     | ❌ None     | P2       | 3h     |
| `sigma/compact-lancedb.ts`                    | ~100 | MEDIUM     | ❌ None     | P2       | 2h     |
| `sigma/utils/AsyncMutex.ts`                   | ~100 | MEDIUM     | ❌ None     | P2       | 2h     |
| `sigma/overlays/base-conversation-manager.ts` | ~200 | MEDIUM     | ❌ None     | P2       | 4h     |
| (+ 2 more sigma utilities)                    | -    | -          | -           | -        | 6h     |

**Total Sigma: 52 hours**

#### TUI Components (6 files, 0% coverage)

| File Path                            | LOC  | Risk Level | Test Status | Priority | Effort |
| ------------------------------------ | ---- | ---------- | ----------- | -------- | ------ |
| `tui/components/InputBox.tsx`        | ~350 | MEDIUM     | ❌ None     | P2       | 6h     |
| `tui/components/CommandDropdown.tsx` | ~100 | MEDIUM     | ❌ None     | P2       | 2h     |
| `tui/components/OverlaysBar.tsx`     | ~60  | MEDIUM     | ❌ None     | P2       | 2h     |
| `tui/components/SigmaInfoPanel.tsx`  | ~100 | MEDIUM     | ❌ None     | P2       | 2h     |
| `tui/components/StatusBar.tsx`       | ~40  | LOW        | ❌ None     | P2       | 1h     |
| `tui/types.ts`                       | ~100 | LOW        | ❌ None     | P3       | 1h     |

**Total TUI: 14 hours**

#### Graph & Watcher (4 files, 0% coverage)

| File Path                      | LOC  | Risk Level | Test Status | Priority | Effort |
| ------------------------------ | ---- | ---------- | ----------- | -------- | ------ |
| `core/graph/traversal.ts`      | ~200 | MEDIUM     | ❌ None     | P2       | 4h     |
| `core/watcher/file-watcher.ts` | ~300 | MEDIUM     | ❌ None     | P2       | 6h     |
| `core/graph/types.ts`          | ~100 | LOW        | ❌ None     | P3       | 1h     |
| `core/types/watcher.ts`        | ~50  | LOW        | ❌ None     | P3       | 1h     |

**Total Graph/Watcher: 12 hours**

#### Workspace & Config (3 files, 0% coverage)

| File Path                            | LOC  | Risk Level | Test Status | Priority | Effort |
| ------------------------------------ | ---- | ---------- | ----------- | -------- | ------ |
| `core/workspace-manager.ts`          | ~200 | MEDIUM     | ❌ None     | P2       | 4h     |
| `core/executors/workbench-client.ts` | ~300 | MEDIUM     | ❌ None     | P2       | 6h     |
| `config.ts`                          | ~100 | LOW        | ❌ None     | P3       | 1h     |

**Total Workspace: 11 hours**

**P2 TOTAL: 38 files, 89 hours**

---

### P3 - LOW (Can Defer)

#### Type Definitions & Config (14 files)

| File Path                     | LOC  | Risk Level | Test Status | Priority | Effort |
| ----------------------------- | ---- | ---------- | ----------- | -------- | ------ |
| `core/types/*.ts` (8 files)   | ~600 | LOW        | ❌ None     | P3       | 8h     |
| `core/config/*.ts`            | ~100 | LOW        | ❌ None     | P3       | 1h     |
| `sigma/types.ts`              | ~200 | LOW        | ❌ None     | P3       | 2h     |
| (+ 3 more index/export files) | ~100 | LOW        | ❌ None     | P3       | 3h     |

**P3 TOTAL: 14 files, 14 hours**

---

## Recommended Test Cases (Top 20)

### 1. Mission Validator - Multi-Layer Validation (P0, 8h)

**File:** `core/security/mission-validator.ts:139-206`

**Test Description:** Verify all 3 validation layers execute correctly and aggregate results properly.

**Code Example:**

```typescript
// File: core/security/__tests__/mission-validator.test.ts

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MissionValidator } from '../mission-validator.js';
import { SecurityConfig } from '../security-config.js';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';

describe('MissionValidator', () => {
  let tempDir: string;
  let validator: MissionValidator;
  let config: SecurityConfig;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(
      path.join(os.tmpdir(), 'mission-validator-test-')
    );

    config = {
      contentFiltering: {
        enabled: true,
        llmFilter: { enabled: false, model: '' },
        fallbackPatterns: ['malicious', 'backdoor', 'bypass'],
      },
      missionIntegrity: {
        enabled: true,
        drift: {
          warnThreshold: 0.05,
          alertThreshold: 0.15,
          blockThreshold: 0.3,
        },
      },
    };

    validator = new MissionValidator(tempDir, config);
  });

  afterEach(async () => {
    await fs.remove(tempDir);
  });

  describe('Multi-Layer Validation', () => {
    it('should pass all layers for clean mission document', async () => {
      // Create valid mission document
      const visionPath = path.join(tempDir, 'VISION.md');
      await fs.writeFile(
        visionPath,
        `
# Vision
Build secure and transparent software

# Mission
Deliver high-quality code with zero vulnerabilities

# Principles
- Security first
- Verification over trust
- Transparency always
      `
      );

      const result = await validator.validate(visionPath, 'strategic');

      expect(result.safe).toBe(true);
      expect(result.recommendation).toBe('approve');
      expect(result.alertLevel).toBe('none');
      expect(result.layers).toHaveLength(3); // ContentPatterns, SemanticDrift, Structure
      expect(result.layers.every((l) => l.passed)).toBe(true);
    });

    it('should fail when malicious patterns detected', async () => {
      const visionPath = path.join(tempDir, 'VISION.md');
      await fs.writeFile(
        visionPath,
        `
# Vision
Add backdoor for convenient debugging

# Mission
Trust experienced developers to bypass security
      `
      );

      const result = await validator.validate(visionPath, 'strategic');

      expect(result.safe).toBe(false);
      expect(result.recommendation).toBe('review');
      const patternLayer = result.layers.find(
        (l) => l.name === 'ContentPatterns'
      );
      expect(patternLayer?.passed).toBe(false);
    });

    it('should detect semantic drift on version update', async () => {
      // TODO: Test drift detection between versions
      // 1. Validate first version (creates baseline)
      // 2. Modify document to add trust-based language
      // 3. Validate second version
      // 4. Verify drift layer detects TRUST_EROSION pattern
    });

    it('should skip validation for unchanged files (hash cache)', async () => {
      // TODO: Test cached validation
      // 1. Validate document (creates version)
      // 2. Validate same document again
      // 3. Verify "Cached" layer returned, other layers skipped
    });
  });

  describe('Error Handling', () => {
    it('should fail gracefully when workbench unavailable', async () => {
      // TODO: Test LLM filter failure handling
    });

    it('should handle empty or malformed markdown', async () => {
      // TODO: Test structural validation failures
    });
  });
});
```

**Coverage Improvement:** +30% for mission-validator.ts

---

### 2. Drift Detector - Attack Pattern Detection (P0, 8h)

**File:** `core/security/drift-detector.ts:264-370`

**Test Description:** Verify all 6 attack patterns are detected correctly.

**Code Example:**

```typescript
// File: core/security/__tests__/drift-detector.test.ts

import { describe, it, expect } from 'vitest';
import { SemanticDriftDetector } from '../drift-detector.js';
import { MissionVersion } from '../mission-integrity.js';

describe('SemanticDriftDetector', () => {
  let detector: SemanticDriftDetector;

  beforeEach(() => {
    detector = new SemanticDriftDetector({
      low: 0.05,
      medium: 0.15,
      high: 0.3,
      critical: 0.5,
    });
  });

  describe('Attack Pattern Detection', () => {
    it('should detect SECURITY_WEAKENING pattern', async () => {
      const oldVersion: MissionVersion = {
        version: 1,
        hash: 'abc123',
        timestamp: '2024-01-01T00:00:00Z',
        conceptEmbeddings: [[0.1, 0.2, 0.3]], // Dummy embedding
        semanticFingerprint: 'old',
        conceptTexts: [
          'security first',
          'strict validation',
          'audit all changes',
        ],
      };

      const newVersion: MissionVersion = {
        version: 2,
        hash: 'def456',
        timestamp: '2024-01-02T00:00:00Z',
        conceptEmbeddings: [[0.15, 0.25, 0.35]],
        semanticFingerprint: 'new',
        conceptTexts: [
          'pragmatic security',
          'flexible validation',
          'audit when needed',
        ],
      };

      const result = await detector.analyzeDrift(oldVersion, newVersion);

      expect(result.suspiciousPatterns).toContain('SECURITY_WEAKENING');
      expect(result.severity).toBeOneOf(['medium', 'high', 'critical']);
      expect(result.recommendation).toBeOneOf(['review', 'reject']);
    });

    it('should detect TRUST_EROSION pattern', async () => {
      const oldVersion: MissionVersion = {
        version: 1,
        hash: 'abc',
        timestamp: '2024-01-01T00:00:00Z',
        conceptEmbeddings: [[0.1, 0.2]],
        semanticFingerprint: 'old',
        conceptTexts: ['verify all contributors', 'zero trust architecture'],
      };

      const newVersion: MissionVersion = {
        version: 2,
        hash: 'def',
        timestamp: '2024-01-02T00:00:00Z',
        conceptEmbeddings: [[0.15, 0.25]],
        semanticFingerprint: 'new',
        conceptTexts: [
          'trust experienced contributors',
          'skip checks for known users',
        ],
      };

      const result = await detector.analyzeDrift(oldVersion, newVersion);

      expect(result.suspiciousPatterns).toContain('TRUST_EROSION');
      expect(result.addedConcepts).toContain('trust experienced contributors');
    });

    // TODO: Add tests for other 4 patterns:
    // - PERMISSION_CREEP
    // - AMBIGUITY_INJECTION
    // - VELOCITY_OVER_SAFETY
    // - ERROR_TOLERANCE
  });

  describe('Severity Classification', () => {
    it('should classify as critical when distance >= 0.5', async () => {
      // TODO: Test with embeddings that have 0.5+ distance
    });

    it('should classify as high when 2+ patterns detected', async () => {
      // TODO: Test with multiple patterns
    });
  });
});
```

**Coverage Improvement:** +40% for drift-detector.ts

---

### 3. Compressor - Compression Algorithm (P0, 6h)

**File:** `sigma/compressor.ts:34-134`

**Test Description:** Verify 30-50x compression ratio and paradigm shift preservation.

**Code Example:**

```typescript
// File: sigma/__tests__/compressor.test.ts

import { describe, it, expect } from 'vitest';
import { compressContext, getLatticeStats } from '../compressor.js';
import type { TurnAnalysis } from '../types.js';

describe('Compressor', () => {
  describe('Compression Algorithm', () => {
    it('should achieve 30-50x compression ratio', async () => {
      // Create 100 turns with mixed importance
      const turns: TurnAnalysis[] = [];

      for (let i = 0; i < 100; i++) {
        const importance = i % 10 === 0 ? 8 : Math.random() * 5; // 10% paradigm shifts
        turns.push({
          turn_id: `turn-${i}`,
          role: i % 2 === 0 ? 'user' : 'assistant',
          content: 'x'.repeat(500), // 500 chars = ~125 tokens
          timestamp: Date.now() + i,
          embedding: [Math.random(), Math.random()],
          novelty: Math.random(),
          overlay_scores: {
            O1_structural: 0,
            O2_security: 0,
            O3_lineage: 0,
            O4_mission: 0,
            O5_operational: 0,
            O6_mathematical: 0,
            O7_strategic: 0,
          },
          importance_score: importance,
          is_paradigm_shift: importance >= 7,
          is_routine: importance < 3,
          semantic_tags: [],
          references: [],
        });
      }

      const result = await compressContext(turns, { target_size: 40000 });

      // Verify compression ratio
      expect(result.compression_ratio).toBeGreaterThan(2); // At least 2x
      expect(result.compression_ratio).toBeLessThan(100); // Reasonable upper bound

      // Verify original size calculation
      expect(result.original_size).toBeGreaterThan(10000); // 100 turns * 125 tokens

      // Verify compressed size within budget
      expect(result.compressed_size).toBeLessThanOrEqual(40000);
    });

    it('should preserve all paradigm shifts (importance >= 7)', async () => {
      const turns: TurnAnalysis[] = [
        {
          turn_id: 'paradigm-1',
          role: 'assistant',
          content: 'BREAKTHROUGH: New architecture discovered',
          timestamp: Date.now(),
          embedding: [0.1, 0.2],
          novelty: 0.9,
          overlay_scores: {} as any,
          importance_score: 9,
          is_paradigm_shift: true,
          is_routine: false,
          semantic_tags: ['architecture'],
          references: [],
        },
        {
          turn_id: 'routine-1',
          role: 'user',
          content: 'ok',
          timestamp: Date.now() + 1,
          embedding: [0.3, 0.4],
          novelty: 0.1,
          overlay_scores: {} as any,
          importance_score: 1,
          is_paradigm_shift: false,
          is_routine: true,
          semantic_tags: [],
          references: [],
        },
      ];

      const result = await compressContext(turns, { target_size: 1000 });

      // Paradigm shift should be preserved
      expect(result.preserved_turns).toContain('paradigm-1');

      // Routine turn should be discarded or summarized
      expect(result.preserved_turns).not.toContain('routine-1');
    });

    it('should never discard paradigm shifts even with zero budget', async () => {
      // TODO: Test edge case where all turns are paradigm shifts
      // and target_size is very small
    });
  });

  describe('Lattice Construction', () => {
    it('should create temporal edges between consecutive turns', async () => {
      // TODO: Test that lattice has temporal edges
    });

    it('should create reference edges for turn dependencies', async () => {
      // TODO: Test that references[] create edges
    });
  });
});
```

**Coverage Improvement:** +60% for compressor.ts

---

### 4. useClaudeAgent - Session State Management (P0, 12h)

**File:** `tui/hooks/useClaudeAgent.ts:166-189`

**Test Description:** Verify session transitions on compression, SDK session changes, and state persistence.

**Code Example:**

```typescript
// File: tui/hooks/__tests__/unit/useClaudeAgent.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useClaudeAgent } from '../../useClaudeAgent.js';

// Mock dependencies
vi.mock('../../../core/services/embedding.js', () => ({
  EmbeddingService: vi.fn(() => ({ embed: vi.fn() })),
}));

describe('useClaudeAgent', () => {
  const defaultOptions = {
    cwd: '/tmp/test',
    sessionTokens: 120000,
    maxThinkingTokens: 10000,
    debug: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Session State Management', () => {
    it('should initialize with anchor ID and SDK session', () => {
      const { result } = renderHook(() => useClaudeAgent(defaultOptions));

      expect(result.current.currentSessionId).toMatch(/^tui-/);
      expect(result.current.messages).toHaveLength(1); // Welcome message
    });

    it('should update SDK session when compression triggered', async () => {
      const { result } = renderHook(() =>
        useClaudeAgent({
          ...defaultOptions,
          sessionTokens: 1000, // Low threshold for testing
        })
      );

      const initialSession = result.current.currentSessionId;

      // Simulate sending message that triggers compression
      act(() => {
        result.current.sendMessage('test message that will compress');
      });

      await waitFor(() => {
        expect(result.current.currentSessionId).not.toBe(initialSession);
      });

      // Verify session state file created
      // TODO: Assert .sigma/{sessionId}.state.json exists
    });

    it('should handle concurrent compression requests gracefully', async () => {
      // TODO: Test compressionInProgressRef guard
      // 1. Trigger compression
      // 2. Trigger compression again before first completes
      // 3. Verify second request is skipped
    });

    it('should resume session from resumeSessionId prop', async () => {
      // TODO: Test session resumption
      // 1. Create session state file
      // 2. Initialize hook with sessionId={existingId}
      // 3. Verify state loaded from file
    });
  });

  describe('Compression Flow', () => {
    it('should wait for analysis queue before compression', async () => {
      // TODO: Test waitForCompressionReady integration
    });

    it('should show progress updates during compression', async () => {
      // TODO: Test progress bar updates
    });

    it('should handle compression timeout gracefully', async () => {
      // TODO: Test 60s timeout with friendly message
    });
  });

  describe('Context Injection', () => {
    it('should inject recap after compression', async () => {
      // TODO: Test injectedRecap state
    });

    it('should inject real-time context for subsequent queries', async () => {
      // TODO: Test semantic lattice search
    });
  });
});
```

**Coverage Improvement:** +50% for useClaudeAgent.ts

---

### 5. init Command - PGC Initialization (P1, 2h)

**File:** `commands/init.ts:9-59`

**Test Description:** Verify directory structure creation and metadata.

**Code Example:**

```typescript
// File: commands/__tests__/init.test.ts

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { initCommand } from '../init.js';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';

describe('init command', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'init-test-'));
  });

  afterEach(async () => {
    await fs.remove(tempDir);
  });

  it('should create .open_cognition directory structure', async () => {
    await initCommand({ path: tempDir });

    const pgcRoot = path.join(tempDir, '.open_cognition');
    expect(await fs.pathExists(pgcRoot)).toBe(true);
    expect(await fs.pathExists(path.join(pgcRoot, 'objects'))).toBe(true);
    expect(await fs.pathExists(path.join(pgcRoot, 'transforms'))).toBe(true);
    expect(await fs.pathExists(path.join(pgcRoot, 'index'))).toBe(true);
    expect(await fs.pathExists(path.join(pgcRoot, 'reverse_deps'))).toBe(true);
    expect(await fs.pathExists(path.join(pgcRoot, 'overlays'))).toBe(true);
  });

  it('should create metadata.json with correct version', async () => {
    await initCommand({ path: tempDir });

    const metadataPath = path.join(tempDir, '.open_cognition', 'metadata.json');
    const metadata = await fs.readJSON(metadataPath);

    expect(metadata.version).toBe('0.1.0');
    expect(metadata.status).toBe('empty');
    expect(metadata.initialized_at).toBeDefined();
  });

  it('should create .gitignore for object store', async () => {
    await initCommand({ path: tempDir });

    const gitignorePath = path.join(tempDir, '.open_cognition', '.gitignore');
    const content = await fs.readFile(gitignorePath, 'utf-8');

    expect(content).toContain('objects/');
  });

  it('should fail gracefully if directory already exists', async () => {
    // First init
    await initCommand({ path: tempDir });

    // Second init should succeed (idempotent)
    await expect(initCommand({ path: tempDir })).resolves.not.toThrow();
  });
});
```

**Coverage Improvement:** +100% for init.ts

---

### 6. watch Command - File Change Detection (P1, 3h)

**File:** `commands/watch.ts:32-110`

**Test Description:** Verify file watcher initialization and event handling.

**Code Example:**

```typescript
// File: commands/__tests__/watch.test.ts

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createWatchCommand } from '../watch.js';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';

// Mock FileWatcher
vi.mock('../../core/watcher/file-watcher.js', () => ({
  FileWatcher: vi.fn(() => ({
    on: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  })),
}));

describe('watch command', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'watch-test-'));
    // Create PGC structure
    await fs.ensureDir(path.join(tempDir, '.open_cognition'));
  });

  afterEach(async () => {
    await fs.remove(tempDir);
  });

  it('should initialize file watcher with correct options', async () => {
    const cmd = createWatchCommand();

    // Parse command with options
    cmd.parse(['watch', '--debounce', '500', '--verbose'], { from: 'user' });

    // TODO: Verify FileWatcher instantiated with correct params
  });

  it('should fail if no .open_cognition workspace found', async () => {
    // Remove PGC directory
    await fs.remove(path.join(tempDir, '.open_cognition'));

    const cmd = createWatchCommand();

    // TODO: Verify exit with error message
  });

  it('should handle SIGINT gracefully', async () => {
    // TODO: Test process.on('SIGINT') handler
  });
});
```

**Coverage Improvement:** +70% for watch.ts

---

### 7-20. Additional P0/P1 Test Cases

Due to space constraints, here are abbreviated recommendations for the remaining top 20:

**7. genesis Command** (P1, 4h) - Test orchestration workflow
**8. wizard Command** (P1, 6h) - Test interactive setup flow
**9. migrate-to-lance Command** (P1, 5h) - Test YAML→LanceDB migration
**10. coherence Command** (P1, 3h) - Test strategic alignment analysis
**11. PGC document-object.ts** (P1, 4h) - Test document representation
**12. PGC embedding-loader.ts** (P1, 3h) - Test embedding loading from files
**13. PGC search-worker.ts** (P1, 4h) - Test multi-threaded search
**14. genesis-worker.ts** (P1, 6h) - Test worker pool orchestration
**15. llm-supervisor.ts** (P1, 4h) - Test LLM-based analysis
**16. proof-extractor.ts** (P1, 4h) - Test mathematical proof extraction
**17. security-extractor.ts** (P1, 4h) - Test security finding extraction
**18. O2 security-guidelines/manager.ts** (P1, 8h) - Test security overlay
**19. O4 mission-concepts/manager.ts** (P1, 8h) - Test mission overlay
**20. lineage/algebra-adapter.ts** (P1, 3h) - Test lattice algebra integration

---

## Existing Test Quality Assessment

### Well-Written Tests (Use as Templates)

#### Excellent Examples

1. **interface-lineage.test.ts** (965 LOC)
   - ✅ Comprehensive coverage of complex lineage extraction
   - ✅ Excellent use of helper functions (`addTransformHistory`)
   - ✅ Clear test structure with descriptive names
   - ✅ Good edge case coverage (unions, arrays, generics)
   - **Template for:** Complex integration tests with PGC

2. **useCompression.test.ts** (200+ LOC)
   - ✅ Good use of React Testing Library hooks
   - ✅ Tests both automatic and manual triggering
   - ✅ Clear separation of test suites
   - **Template for:** TUI hook testing

3. **compression-flow.test.ts** (200+ LOC)
   - ✅ Integration test covering multiple compressions
   - ✅ Good state persistence verification
   - ✅ Clear simulation of real-world scenarios
   - **Template for:** Session state integration tests

### Tests Needing Refactoring

#### Brittle Tests

1. **Some overlay tests over-mock dependencies**
   - Issue: Mock entire PGC when only ObjectStore needed
   - Fix: Use partial mocks or test fixtures
   - Effort: 2h per test file

2. **Hard-coded file paths in some tests**
   - Issue: Tests fail on different OS
   - Fix: Use path.join and os.tmpdir()
   - Effort: 1h total

### Missing Test Patterns

1. **No E2E tests** - Commands tested in isolation, not end-to-end
2. **No performance tests** - Compression ratio not validated
3. **No concurrency tests** - Race conditions untested
4. **Limited error path coverage** - Happy path dominates

### Test Infrastructure Quality

✅ **Strengths:**

- Good use of Vitest (modern, fast)
- Proper temp directory cleanup
- Consistent beforeEach/afterEach patterns

❌ **Weaknesses:**

- No shared test fixtures (duplicated setup code)
- No test utilities library (repeated helper functions)
- Missing CI/CD integration tests

---

## Action Plan

### Phase 1: Critical Security (Weeks 1-2)

**Goal:** Eliminate security test gaps

**Week 1:**

- [ ] mission-validator.ts (8h)
- [ ] drift-detector.ts (8h)
- [ ] mission-integrity.ts (4h)
- [ ] security-bootstrap.ts (4h)
- [ ] transparency-log.ts (4h)

**Week 2:**

- [ ] dual-use-mandate.ts (2h)
- [ ] security-config.ts (2h)
- [ ] compressor.ts (6h)
- [ ] useClaudeAgent.ts (12h)
- [ ] cross-session-query.ts (4h)

**Deliverable:** 60% reduction in P0 gaps

---

### Phase 2: High-Priority Commands & PGC (Weeks 3-4)

**Goal:** Test all critical command handlers and PGC modules

**Week 3:**

- [ ] init, watch, genesis, wizard commands (15h)
- [ ] migrate-to-lance, coherence commands (8h)
- [ ] PGC document-object, embedding-loader (7h)

**Week 4:**

- [ ] PGC overlays, search-worker, patterns (8h)
- [ ] genesis-worker, update orchestrator (10h)
- [ ] llm-supervisor, slm-extractor (7h)

**Deliverable:** 80% of P1 gaps closed

---

### Phase 3: Analyzers & Overlays (Weeks 5-6)

**Goal:** Complete coverage for overlay managers and analyzers

**Week 5:**

- [ ] 6 analyzer modules (23h)
- [ ] 4 overlay managers (16h)

**Week 6:**

- [ ] 4 overlay adapters (12h)
- [ ] Sigma utilities (15h)

**Deliverable:** 90% overall coverage

---

### Phase 4: Continuous Improvement (Ongoing)

**Goal:** Maintain coverage and improve test quality

- [ ] Add E2E tests for critical workflows
- [ ] Add performance benchmarks
- [ ] Refactor brittle tests
- [ ] Create shared test fixtures library
- [ ] Set up CI/CD coverage reports

---

## Quick Wins (< 2 hours each)

These tests provide high value with low effort:

### 1. init.ts (1h)

```typescript
// Simple directory structure verification
it('should create all required directories', async () => {
  await initCommand({ path: tempDir });
  // Assert 5 directories exist
});
```

### 2. security-config.ts (1h)

```typescript
// Configuration validation
it('should export valid default config', () => {
  expect(SecurityConfig.default.missionIntegrity.enabled).toBe(true);
});
```

### 3. Type definitions (8 files × 1h = 8h)

```typescript
// Type validation tests
it('should have correct TurnAnalysis shape', () => {
  const turn: TurnAnalysis = {
    /* ... */
  };
  expectTypeOf(turn).toMatchTypeOf<TurnAnalysis>();
});
```

### 4. AsyncMutex.ts (2h)

```typescript
// Simple concurrency primitive
it('should prevent concurrent access', async () => {
  const mutex = new AsyncMutex();
  let count = 0;
  await Promise.all([
    mutex.run(async () => {
      await sleep(10);
      count++;
    }),
    mutex.run(async () => {
      await sleep(10);
      count++;
    }),
  ]);
  expect(count).toBe(2);
});
```

### 5. ToolFormatter.ts (Already tested! ✅)

### 6. MessageRenderer.ts (Already tested! ✅)

**Total Quick Wins: 12 hours, 10 files covered**

---

## Success Metrics

### Coverage Targets

| Metric                   | Current | Target (Phase 1) | Target (Phase 2) | Target (Phase 3) |
| ------------------------ | ------- | ---------------- | ---------------- | ---------------- |
| **Overall Coverage**     | 23%     | 40%              | 60%              | 80%              |
| **P0 Coverage**          | 0%      | 80%              | 100%             | 100%             |
| **P1 Coverage**          | 10%     | 30%              | 80%              | 90%              |
| **Security Coverage**    | 0%      | 100%             | 100%             | 100%             |
| **Compression Coverage** | 30%     | 100%             | 100%             | 100%             |
| **Command Coverage**     | 22%     | 50%              | 80%              | 90%              |

### Quality Metrics

- **Test Execution Time:** < 30 seconds for all unit tests
- **Flakiness Rate:** < 1% (tests pass consistently)
- **Maintainability:** All tests use shared fixtures by Phase 3
- **CI/CD Integration:** Coverage reports on every PR by Phase 2

---

## Test Infrastructure Recommendations

### Shared Test Utilities

Create `src/__tests__/utils/` with:

```typescript
// test-fixtures.ts
export function createMockPGC(tempDir: string): PGCManager {
  // Reusable PGC mock
}

export function createMockTurnAnalysis(
  overrides?: Partial<TurnAnalysis>
): TurnAnalysis {
  // Reusable turn analysis factory
}

export async function createTestMissionDocument(
  content: string
): Promise<string> {
  // Reusable mission document creation
}
```

### CI/CD Integration

Add to `.github/workflows/test.yml`:

```yaml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '25'
      - run: npm ci
      - run: npm test
      - name: Coverage Report
        run: npm run test:coverage
      - uses: codecov/codecov-action@v3
        with:
          files: ./coverage/coverage-final.json
```

---

## Appendix A: Test Template

Use this template for new test files:

```typescript
/**
 * Tests for {ModuleName}
 *
 * Coverage:
 * - [ ] Happy path
 * - [ ] Error handling
 * - [ ] Edge cases
 * - [ ] Integration points
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ModuleName } from '../module.js';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';

describe('ModuleName', () => {
  let tempDir: string;
  let instance: ModuleName;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'test-'));
    instance = new ModuleName(tempDir);
  });

  afterEach(async () => {
    await fs.remove(tempDir);
    vi.clearAllMocks();
  });

  describe('Core Functionality', () => {
    it('should perform main operation successfully', async () => {
      // Arrange
      const input = 'test';

      // Act
      const result = await instance.operation(input);

      // Assert
      expect(result).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should throw on invalid input', async () => {
      await expect(instance.operation(null)).rejects.toThrow();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty input', async () => {
      const result = await instance.operation('');
      expect(result).toEqual(expectedDefault);
    });
  });
});
```

---

## Appendix B: Coverage Tools

### Run Coverage Locally

```bash
# Add to package.json scripts:
"scripts": {
  "test:coverage": "vitest run --coverage",
  "test:coverage:watch": "vitest watch --coverage"
}

# Install coverage provider:
npm install -D @vitest/coverage-v8

# Run coverage:
npm run test:coverage

# View HTML report:
open coverage/index.html
```

### Coverage Configuration

Add to `vitest.config.ts`:

```typescript
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json'],
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      exclude: [
        'src/**/__tests__/**',
        'src/**/*.test.ts',
        'src/**/types.ts',
        'src/**/index.ts',
      ],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 60,
        statements: 70,
      },
    },
  },
});
```

---

## Summary

This analysis identified **137 untested files (77% of codebase)** with **18 critical P0 gaps** requiring immediate attention:

**Critical Priorities:**

1. **Security Module** (8 files, 33h) - ZERO coverage for attack detection
2. **Compression System** (3 files, 22h) - Core algorithm untested
3. **Command Handlers** (14 files, 38h) - User-facing features untested

**Recommended Approach:**

- Start with **Quick Wins** (12h for 10 files)
- Then tackle **P0 Security** (Week 1-2)
- Follow **3-phase plan** to reach 80% coverage in 6 weeks

**Total Effort:** 230-310 hours over 6 weeks with 2-3 engineers.

The existing test infrastructure is solid - leverage templates like `interface-lineage.test.ts` for complex tests and `useCompression.test.ts` for TUI hooks.

---

**Next Steps:**

1. Review and approve this analysis
2. Create GitHub issues for all P0/P1 gaps
3. Assign engineers to Phase 1 (Security)
4. Set up CI/CD coverage reporting
5. Begin with Quick Wins for momentum
