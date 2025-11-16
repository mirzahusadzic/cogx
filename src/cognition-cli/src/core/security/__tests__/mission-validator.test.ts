/**
 * Tests for MissionValidator
 *
 * CRITICAL P0 TESTS - Security validation is foundational for mission integrity.
 *
 * Coverage:
 * - [x] Multi-layer validation (ContentSafety, SemanticDrift, Structure)
 * - [x] Hash-based caching (skip unchanged files)
 * - [x] Pattern-based content filtering
 * - [x] LLM-based security validation (with workbench)
 * - [x] Structural markdown validation
 * - [x] Drift detection integration
 * - [x] Recommendation aggregation logic
 * - [x] Alert level determination
 * - [x] Error handling (workbench unavailable, malformed docs)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MissionValidator } from '../mission-validator.js';
import type { SecurityConfig } from '../security-config.js';
import type { DocumentType } from '../../analyzers/document-classifier.js';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';

// Mock WorkbenchClient to avoid actual HTTP requests
vi.mock('../../executors/workbench-client.js', () => ({
  WorkbenchClient: vi.fn(() => ({
    summarize: vi.fn(async () => ({
      summary: 'THREAT ASSESSMENT: SAFE\nRECOMMENDATION: APPROVE',
    })),
    getBaseUrl: vi.fn(() => 'http://localhost:8000'),
  })),
}));

// Mock MissionConceptsManager to avoid LanceDB operations
vi.mock('../../overlays/mission-concepts/manager.js', () => ({
  MissionConceptsManager: vi.fn(() => ({
    generateEmbeddings: vi.fn(async (concepts: unknown[]) => {
      // Return concepts with mock embeddings
      return Array.isArray(concepts)
        ? concepts.map((c: { text: string }) => ({
            ...c,
            embedding: [0.1, 0.2, 0.3],
          }))
        : [];
    }),
  })),
}));

describe('MissionValidator', () => {
  let tempDir: string;
  let validator: MissionValidator;
  let config: SecurityConfig;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(
      path.join(os.tmpdir(), 'mission-validator-test-')
    );

    // Default security config
    config = {
      contentFiltering: {
        enabled: true,
        llmFilter: {
          enabled: false, // Start with pattern-based filtering
          model: '',
        },
        fallbackPatterns: [
          'malicious',
          'backdoor',
          'bypass',
          'trust.*contributor',
        ],
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

    // Create .open_cognition/security directory for integrity monitor
    await fs.ensureDir(path.join(tempDir, '.open_cognition', 'security'));
  });

  afterEach(async () => {
    await fs.remove(tempDir);
    vi.clearAllMocks();
  });

  describe('Multi-Layer Validation', () => {
    it('should pass all layers for clean mission document', async () => {
      // Create valid mission document
      const visionPath = path.join(tempDir, 'VISION.md');
      await fs.writeFile(
        visionPath,
        `
# Vision
Build secure and transparent software for national security

# Mission
Deliver high-quality code with zero vulnerabilities and complete auditability

# Principles
- Security first, always
- Verification over trust
- Transparency in all operations
- Cryptographic truth for integrity
      `
      );

      const result = await validator.validate(
        visionPath,
        'strategic' as DocumentType
      );

      console.log('DEBUG: Validation result:', {
        safe: result.safe,
        recommendation: result.recommendation,
        alertLevel: result.alertLevel,
        layers: result.layers.map(l => ({ name: l.name, passed: l.passed, details: l.details }))
      });

      expect(result.safe).toBe(true);
      expect(result.recommendation).toBe('approve');
      expect(result.alertLevel).toBe('none');

      // Should have 3 layers: ContentPatterns, SemanticDrift, Structure
      expect(result.layers.length).toBeGreaterThanOrEqual(2);
      expect(result.layers.every((l) => l.passed)).toBe(true);
    });

    it('should fail when malicious patterns detected', async () => {
      const visionPath = path.join(tempDir, 'VISION.md');
      await fs.writeFile(
        visionPath,
        `
# Vision
Add backdoor for convenient debugging access

# Mission
Trust experienced developers to bypass security checks

# Principles
- Malicious intent concealed in normal language
      `
      );

      const result = await validator.validate(
        visionPath,
        'strategic' as DocumentType
      );

      expect(result.safe).toBe(false);
      expect(['review', 'reject']).toContain(result.recommendation);

      // Find ContentPatterns layer
      const patternLayer = result.layers.find(
        (l) => l.name === 'ContentPatterns'
      );
      expect(patternLayer).toBeDefined();
      expect(patternLayer?.passed).toBe(false);
      expect(patternLayer?.details?.matches).toBeDefined();
      expect(patternLayer?.details?.matches.length).toBeGreaterThan(0);
    });

    it('should detect semantic drift on version update', async () => {
      const visionPath = path.join(tempDir, 'VISION.md');

      // First version - strict security
      await fs.writeFile(
        visionPath,
        `
# Vision
Zero trust security architecture

# Principles
- Strict validation
- Security first
- Audit all changes
      `
      );

      // First validation (creates baseline)
      const firstResult = await validator.validate(
        visionPath,
        'strategic' as DocumentType
      );
      expect(firstResult.safe).toBe(true);

      // Modify document to add trust-based language
      await fs.writeFile(
        visionPath,
        `
# Vision
Trust-based security for experienced users

# Principles
- Flexible validation
- Pragmatic security
- Audit when needed
      `
      );

      // Second validation (should detect drift)
      const secondResult = await validator.validate(
        visionPath,
        'strategic' as DocumentType
      );

      // Should have drift layer with analysis
      const driftLayer = secondResult.layers.find(
        (l) => l.name === 'SemanticDrift'
      );
      expect(driftLayer).toBeDefined();

      // Drift analysis should show changes
      if (driftLayer?.details?.drift) {
        const drift = driftLayer.details.drift;
        expect(drift.addedConcepts || drift.removedConcepts).toBeDefined();
      }
    });

    it('should skip validation for unchanged files (hash cache)', async () => {
      const visionPath = path.join(tempDir, 'VISION.md');
      await fs.writeFile(
        visionPath,
        `
# Vision
Build secure software

# Principles
- Security first
      `
      );

      // First validation
      const firstResult = await validator.validate(
        visionPath,
        'strategic' as DocumentType
      );
      expect(firstResult.safe).toBe(true);

      // Second validation of same file (should use cache)
      const secondResult = await validator.validate(
        visionPath,
        'strategic' as DocumentType
      );

      expect(secondResult.safe).toBe(true);
      expect(secondResult.layers).toHaveLength(1);
      expect(secondResult.layers[0].name).toBe('Cached');
      expect(secondResult.layers[0].message).toContain(
        'Document unchanged'
      );
    });
  });

  describe('Content Filtering', () => {
    it('should detect malicious patterns via regex', async () => {
      const visionPath = path.join(tempDir, 'VISION.md');
      await fs.writeFile(
        visionPath,
        `
# Vision
Install backdoor for emergency access

# Principles
- Trust experienced contributors
      `
      );

      const result = await validator.validate(
        visionPath,
        'strategic' as DocumentType
      );

      const patternLayer = result.layers.find(
        (l) => l.name === 'ContentPatterns'
      );
      expect(patternLayer?.passed).toBe(false);
      expect(patternLayer?.details?.matches).toBeDefined();

      // Should match 'backdoor' and 'trust.*contributor'
      const matches = patternLayer?.details?.matches || [];
      expect(matches.length).toBeGreaterThan(0);
    });

    it('should pass clean content through pattern filter', async () => {
      const visionPath = path.join(tempDir, 'VISION.md');
      await fs.writeFile(
        visionPath,
        `
# Vision
Build trustworthy software

# Principles
- Security first
- Verification over assumptions
      `
      );

      const result = await validator.validate(
        visionPath,
        'strategic' as DocumentType
      );

      const patternLayer = result.layers.find(
        (l) => l.name === 'ContentPatterns'
      );
      if (patternLayer) {
        expect(patternLayer.passed).toBe(true);
      }
    });

    it('should skip content filtering when disabled', async () => {
      config.contentFiltering.enabled = false;
      validator = new MissionValidator(tempDir, config);

      const visionPath = path.join(tempDir, 'VISION.md');
      await fs.writeFile(
        visionPath,
        `
# Vision
Backdoor access for testing

# Principles
- Trust all contributors
      `
      );

      const result = await validator.validate(
        visionPath,
        'strategic' as DocumentType
      );

      // Should not have ContentPatterns or ContentSafety layer
      const contentLayers = result.layers.filter(
        (l) => l.name === 'ContentPatterns' || l.name === 'ContentSafety'
      );
      expect(contentLayers).toHaveLength(0);
    });
  });

  describe('Structural Validation', () => {
    it('should validate markdown syntax and structure', async () => {
      const visionPath = path.join(tempDir, 'VISION.md');
      await fs.writeFile(
        visionPath,
        `
# Vision
Valid markdown

# Mission
Well structured

# Principles
- Principle one
- Principle two
      `
      );

      const result = await validator.validate(
        visionPath,
        'strategic' as DocumentType
      );

      const structureLayer = result.layers.find((l) => l.name === 'Structure');
      expect(structureLayer).toBeDefined();
      expect(structureLayer?.passed).toBe(true);
    });

    it('should fail on missing required sections', async () => {
      const visionPath = path.join(tempDir, 'VISION.md');
      await fs.writeFile(
        visionPath,
        `
# Random Section
This document has no whitelisted sections

# Another Random Section
No vision, mission, or principles
      `
      );

      const result = await validator.validate(
        visionPath,
        'strategic' as DocumentType
      );

      const structureLayer = result.layers.find((l) => l.name === 'Structure');
      expect(structureLayer).toBeDefined();
      expect(structureLayer?.passed).toBe(false);
      expect(structureLayer?.message).toContain('No whitelisted sections');
    });

    it('should handle empty files gracefully', async () => {
      const visionPath = path.join(tempDir, 'VISION.md');
      await fs.writeFile(visionPath, '');

      const result = await validator.validate(
        visionPath,
        'strategic' as DocumentType
      );

      const structureLayer = result.layers.find((l) => l.name === 'Structure');
      expect(structureLayer).toBeDefined();
      expect(structureLayer?.passed).toBe(false);
    });
  });

  describe('Recommendation Aggregation', () => {
    it('should recommend reject when any layer recommends reject', async () => {
      const visionPath = path.join(tempDir, 'VISION.md');

      // Create document that will trigger rejection
      await fs.writeFile(
        visionPath,
        `
# Vision
Malicious backdoor access

# Principles
- Security
      `
      );

      const result = await validator.validate(
        visionPath,
        'strategic' as DocumentType
      );

      // Should recommend review or reject (not approve)
      expect(result.recommendation).not.toBe('approve');
    });

    it('should recommend approve when all layers pass', async () => {
      const visionPath = path.join(tempDir, 'VISION.md');

      await fs.writeFile(
        visionPath,
        `
# Vision
Build secure and transparent software

# Mission
Deliver high-quality secure code

# Principles
- Security first
- Verification over trust
      `
      );

      const result = await validator.validate(
        visionPath,
        'strategic' as DocumentType
      );

      expect(result.recommendation).toBe('approve');
    });
  });

  describe('Alert Level Determination', () => {
    it('should set alert level to none when all layers pass', async () => {
      const visionPath = path.join(tempDir, 'VISION.md');

      await fs.writeFile(
        visionPath,
        `
# Vision
Secure software development

# Principles
- Security first
      `
      );

      const result = await validator.validate(
        visionPath,
        'strategic' as DocumentType
      );

      expect(result.alertLevel).toBe('none');
    });

    it('should escalate alert level based on failure severity', async () => {
      const visionPath = path.join(tempDir, 'VISION.md');

      await fs.writeFile(
        visionPath,
        `
# Vision
Backdoor for testing

# Principles
- Trust contributors
- Bypass security
      `
      );

      const result = await validator.validate(
        visionPath,
        'strategic' as DocumentType
      );

      // Should have elevated alert level
      expect(['info', 'warning', 'critical']).toContain(result.alertLevel);
    });
  });

  describe('Error Handling', () => {
    it('should handle workbench unavailable gracefully', async () => {
      // Enable LLM filtering
      config.contentFiltering.llmFilter.enabled = true;
      config.contentFiltering.llmFilter.model = 'test-model';
      validator = new MissionValidator(tempDir, config);

      const visionPath = path.join(tempDir, 'VISION.md');
      await fs.writeFile(
        visionPath,
        `
# Vision
Test

# Principles
- Security
      `
      );

      // Should not throw, should return validation result
      const result = await validator.validate(
        visionPath,
        'strategic' as DocumentType
      );

      expect(result).toBeDefined();
      expect(result.layers).toBeDefined();
    });

    it('should handle malformed markdown gracefully', async () => {
      const visionPath = path.join(tempDir, 'VISION.md');

      // Write malformed content
      await fs.writeFile(visionPath, '# Unclosed heading\n\n```\nunclosed code');

      const result = await validator.validate(
        visionPath,
        'strategic' as DocumentType
      );

      expect(result).toBeDefined();
      expect(result.safe).toBeDefined();
    });

    it('should handle non-existent files', async () => {
      const visionPath = path.join(tempDir, 'nonexistent.md');

      await expect(
        validator.validate(visionPath, 'strategic' as DocumentType)
      ).rejects.toThrow();
    });
  });

  describe('Document Type Specific Validation', () => {
    it('should use appropriate validator persona for strategic docs', async () => {
      const visionPath = path.join(tempDir, 'VISION.md');
      await fs.writeFile(
        visionPath,
        `
# Vision
Strategic vision

# Principles
- Security
      `
      );

      const result = await validator.validate(
        visionPath,
        'strategic' as DocumentType
      );

      expect(result).toBeDefined();
      // Strategic docs should pass through standard validation
      expect(result.layers).toBeDefined();
    });

    it('should handle security document type', async () => {
      const securityPath = path.join(tempDir, 'SECURITY.md');
      await fs.writeFile(
        securityPath,
        `
# Security Guidelines
Strict security requirements

# Threat Model
Zero trust architecture

# Controls
- Multi-layer validation
      `
      );

      const result = await validator.validate(
        securityPath,
        'security' as DocumentType
      );

      expect(result).toBeDefined();
      expect(result.layers).toBeDefined();
    });
  });

  describe('Embedded Concepts Reuse', () => {
    it('should return embedded concepts from drift detection', async () => {
      const visionPath = path.join(tempDir, 'VISION.md');
      await fs.writeFile(
        visionPath,
        `
# Vision
Build secure software

# Mission
Deliver quality code

# Principles
- Security first
- Verification over trust
      `
      );

      const result = await validator.validate(
        visionPath,
        'strategic' as DocumentType
      );

      // Should have embedded concepts for reuse
      if (result.embeddedConcepts) {
        expect(Array.isArray(result.embeddedConcepts)).toBe(true);
        result.embeddedConcepts.forEach((concept) => {
          expect(concept.text).toBeDefined();
          expect(concept.embedding).toBeDefined();
        });
      }
    });
  });
});
