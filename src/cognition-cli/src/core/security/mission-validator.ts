import fs from 'fs-extra';
import { createHash } from 'crypto';
import {
  MissionIntegrityMonitor,
  MissionVersion,
} from './mission-integrity.js';
import { SemanticDriftDetector, DriftAnalysis } from './drift-detector.js';
import { SecurityConfig } from './security-config.js';
import { MarkdownParser } from '../parsers/markdown-parser.js';
import {
  ConceptExtractor,
  MissionConcept,
} from '../analyzers/concept-extractor.js';
import { MissionConceptsManager } from '../overlays/mission-concepts/manager.js';
import { WorkbenchClient } from '../executors/workbench-client.js';

/**
 * Single validation layer result
 */
export interface ValidationLayer {
  name: string; // Layer name (ContentSafety, SemanticDrift, Structure)
  passed: boolean; // Did this layer pass?
  message: string; // Human-readable message
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  details?: any; // Additional details (drift analysis, threats, etc.)
}

/**
 * Complete validation result
 */
export interface ValidationResult {
  safe: boolean; // Overall safety (all layers passed)
  layers: ValidationLayer[]; // Results from each layer
  recommendation: 'approve' | 'review' | 'reject';
  alertLevel: 'none' | 'info' | 'warning' | 'critical';
}

/**
 * MissionValidator
 *
 * PURPOSE:
 * Multi-layer validation before ingesting mission documents.
 * Combines pattern matching, semantic drift detection, and optional
 * LLM-based content filtering.
 *
 * LAYERS:
 * 1. Content safety (LLM-based, optional)
 * 2. Content patterns (regex-based, fallback)
 * 3. Semantic drift analysis (embedding-based)
 * 4. Structural integrity (markdown validation)
 *
 * SECURITY ROLE:
 * - Pre-ingestion gate for mission documents
 * - Prevents poisoned content from entering knowledge graph
 * - Provides evidence for human review
 *
 * TRANSPARENCY:
 * - All layers report findings explicitly
 * - Recommendation logic is clear and documented
 * - Users can inspect why validation failed
 */
export class MissionValidator {
  private integrityMonitor: MissionIntegrityMonitor;
  private driftDetector: SemanticDriftDetector;
  private workbench?: WorkbenchClient;

  constructor(
    private pgcRoot: string,
    private config: SecurityConfig,
    workbenchUrl?: string
  ) {
    this.integrityMonitor = new MissionIntegrityMonitor(pgcRoot);

    // Map config drift thresholds to detector thresholds
    this.driftDetector = new SemanticDriftDetector({
      low: config.missionIntegrity.drift.warnThreshold,
      medium: config.missionIntegrity.drift.alertThreshold,
      high: config.missionIntegrity.drift.blockThreshold,
      critical: Math.max(config.missionIntegrity.drift.blockThreshold, 0.5), // At least 0.50 for critical
    });

    // Only initialize workbench if LLM filtering is enabled
    if (config.contentFiltering.llmFilter.enabled) {
      this.workbench = new WorkbenchClient(
        workbenchUrl || process.env.WORKBENCH_URL || 'http://localhost:8000'
      );
    }
  }

  /**
   * Validate a mission document before ingestion
   *
   * ALGORITHM:
   * 1. Run all validation layers
   * 2. Aggregate results
   * 3. Determine recommendation
   * 4. Set alert level
   */
  async validate(visionPath: string): Promise<ValidationResult> {
    const layers: ValidationLayer[] = [];

    // Layer 1: Content filtering (pattern or LLM)
    if (this.config.contentFiltering.enabled) {
      if (this.config.contentFiltering.llmFilter.enabled && this.workbench) {
        layers.push(await this.validateContentSafety(visionPath));
      } else {
        layers.push(await this.validateContentPatterns(visionPath));
      }
    }

    // Layer 2: Semantic drift analysis
    if (this.config.missionIntegrity.enabled) {
      layers.push(await this.validateSemanticDrift(visionPath));
    }

    // Layer 3: Structural integrity (always runs)
    layers.push(await this.validateStructure(visionPath));

    // Aggregate results
    const failed = layers.filter((l) => !l.passed);
    const safe = failed.length === 0;

    return {
      safe,
      layers,
      recommendation: this.aggregateRecommendation(layers),
      alertLevel: this.determineAlertLevel(failed),
    };
  }

  /**
   * Layer 1A: LLM-based content safety
   *
   * TODO: Implement when Workbench supports completion API
   * Currently WorkbenchClient only has summarize() and embed() methods
   *
   * For now, always falls back to pattern matching
   */
  private async validateContentSafety(
    visionPath: string
  ): Promise<ValidationLayer> {
    console.warn(
      'LLM-based content filtering not yet implemented (Workbench completion API needed)'
    );
    console.warn('Falling back to pattern matching');

    // Fallback to pattern matching
    return await this.validateContentPatterns(visionPath);
  }

  /**
   * Layer 1B: Pattern-based content filtering
   * Fallback when LLM is disabled or unavailable
   */
  private async validateContentPatterns(
    visionPath: string
  ): Promise<ValidationLayer> {
    const content = await fs.readFile(visionPath, 'utf-8');
    const patterns = this.config.contentFiltering.fallbackPatterns;

    const matches: Array<{ pattern: string; threat: string }> = [];

    patterns.forEach((patternStr) => {
      const pattern = new RegExp(patternStr, 'i');
      if (pattern.test(content)) {
        matches.push({ pattern: patternStr, threat: patternStr });
      }
    });

    return {
      name: 'ContentPatterns',
      passed: matches.length === 0,
      message:
        matches.length > 0
          ? `Found ${matches.length} suspicious pattern(s): ${matches.map((m) => m.pattern).join(', ')}`
          : 'No suspicious patterns detected',
      details: { matches },
    };
  }

  /**
   * Layer 2: Semantic drift analysis
   * Compares against previous version using embeddings
   */
  private async validateSemanticDrift(
    visionPath: string
  ): Promise<ValidationLayer> {
    // Get previous version
    const previousVersion = await this.integrityMonitor.getLatestVersion();

    if (!previousVersion) {
      return {
        name: 'SemanticDrift',
        passed: true,
        message: 'No previous version (first ingestion)',
      };
    }

    try {
      // Parse new version and extract concepts
      const parser = new MarkdownParser();
      const doc = await parser.parse(visionPath);

      const extractor = new ConceptExtractor();
      const concepts = extractor.extract(doc);

      if (concepts.length === 0) {
        return {
          name: 'SemanticDrift',
          passed: false,
          message:
            'No mission concepts extracted (no whitelisted sections found)',
        };
      }

      // Generate embeddings for new concepts
      const workbenchUrl = this.workbench
        ? this.workbench.getBaseUrl()
        : undefined;
      const manager = new MissionConceptsManager(this.pgcRoot, workbenchUrl);

      // Access private method using bracket notation for testing
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const generateEmbeddings = (manager as any).generateEmbeddings.bind(
        manager
      );
      const conceptsWithEmbeddings: MissionConcept[] =
        await generateEmbeddings(concepts);

      // Filter to only concepts with valid embeddings
      const validConcepts = conceptsWithEmbeddings.filter(
        (c) => c.embedding && c.embedding.length === 768
      );

      if (validConcepts.length === 0) {
        return {
          name: 'SemanticDrift',
          passed: false,
          message: 'No valid embeddings generated for concepts',
        };
      }

      // Create new version snapshot (temporary, for drift analysis)
      const newVersion: MissionVersion = {
        version: previousVersion.version + 1,
        hash: createHash('sha256')
          .update(await fs.readFile(visionPath, 'utf-8'))
          .digest('hex'),
        timestamp: new Date().toISOString(),
        conceptEmbeddings: validConcepts.map((c) => c.embedding!),
        semanticFingerprint: '', // Will be computed by integrity monitor
        conceptTexts: validConcepts.map((c) => c.text),
      };

      // Analyze drift
      const drift = await this.driftDetector.analyzeDrift(
        previousVersion,
        newVersion
      );

      // Determine if passed based on recommendation
      const passed = drift.recommendation !== 'reject';

      return {
        name: 'SemanticDrift',
        passed,
        message: this.formatDriftMessage(drift),
        details: { drift },
      };
    } catch (error) {
      return {
        name: 'SemanticDrift',
        passed: false,
        message: `Drift analysis failed: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Format drift analysis into human-readable message
   */
  private formatDriftMessage(drift: DriftAnalysis): string {
    let msg = `Drift: ${drift.distance.toFixed(4)} (${drift.severity})`;

    if (drift.addedConcepts.length > 0) {
      const preview = drift.addedConcepts.slice(0, 3).join(', ');
      const more =
        drift.addedConcepts.length > 3
          ? ` (+${drift.addedConcepts.length - 3} more)`
          : '';
      msg += `\n  + Added: ${preview}${more}`;
    }

    if (drift.removedConcepts.length > 0) {
      const preview = drift.removedConcepts.slice(0, 3).join(', ');
      const more =
        drift.removedConcepts.length > 3
          ? ` (+${drift.removedConcepts.length - 3} more)`
          : '';
      msg += `\n  - Removed: ${preview}${more}`;
    }

    if (drift.suspiciousPatterns.length > 0) {
      msg += `\n  ⚠️  ${drift.suspiciousPatterns.join('\n  ⚠️  ')}`;
    }

    return msg;
  }

  /**
   * Layer 3: Structural integrity
   * Validates markdown syntax and whitelisted sections
   */
  private async validateStructure(
    visionPath: string
  ): Promise<ValidationLayer> {
    try {
      const parser = new MarkdownParser();
      const doc = await parser.parse(visionPath);

      const extractor = new ConceptExtractor();
      const concepts = extractor.extract(doc);

      if (concepts.length === 0) {
        return {
          name: 'Structure',
          passed: false,
          message:
            'No whitelisted sections found (Vision, Mission, Principles, etc.)',
        };
      }

      return {
        name: 'Structure',
        passed: true,
        message: `Valid markdown with ${concepts.length} mission concepts`,
      };
    } catch (error) {
      return {
        name: 'Structure',
        passed: false,
        message: `Invalid markdown: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Aggregate recommendation from all layers
   *
   * LOGIC:
   * - Any layer recommends "reject" → reject
   * - Any layer recommends "review" → review
   * - All layers approve → approve
   */
  private aggregateRecommendation(
    layers: ValidationLayer[]
  ): ValidationResult['recommendation'] {
    const driftLayer = layers.find((l) => l.name === 'SemanticDrift');

    if (driftLayer && driftLayer.details?.drift) {
      const drift = driftLayer.details.drift as DriftAnalysis;

      if (drift.recommendation === 'reject') {
        return 'reject';
      }
      if (drift.recommendation === 'review') {
        return 'review';
      }
    }

    // If any layer failed, at least review
    const anyFailed = layers.some((l) => !l.passed);
    return anyFailed ? 'review' : 'approve';
  }

  /**
   * Determine alert level from failed layers
   *
   * LOGIC:
   * - Drift critical or 2+ patterns → critical
   * - Drift high or 1 pattern → warning
   * - Any layer failed → info
   * - All passed → none
   */
  private determineAlertLevel(
    failed: ValidationLayer[]
  ): ValidationResult['alertLevel'] {
    if (failed.length === 0) {
      return 'none';
    }

    const driftLayer = failed.find((l) => l.name === 'SemanticDrift');

    if (driftLayer && driftLayer.details?.drift) {
      const drift = driftLayer.details.drift as DriftAnalysis;

      if (
        drift.severity === 'critical' ||
        drift.suspiciousPatterns.length >= 2
      ) {
        return 'critical';
      }

      if (drift.severity === 'high' || drift.suspiciousPatterns.length === 1) {
        return 'warning';
      }
    }

    return 'info';
  }
}
