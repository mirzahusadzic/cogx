import fs from 'fs-extra';
import { createHash } from 'crypto';
import { basename } from 'path';
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
import { DocumentType } from '../analyzers/document-classifier.js';
import {
  PERSONA_SECURITY_VALIDATOR,
  PERSONA_OPERATIONAL_VALIDATOR,
  PERSONA_SECURITY_META_VALIDATOR,
  PERSONA_MATHEMATICAL_VALIDATOR,
} from '../../config.js';

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
  embeddedConcepts?: MissionConcept[]; // Concepts with embeddings (from drift detection)
}

/**
 * MissionValidator
 *
 * MISSION ALIGNMENT:
 * - Core implementation of "Goal → Transform → Oracle" pattern (Innovation #2, 88.1% importance)
 * - Enforces "Verification Over Trust" principle (VISION.md:122, 74.3% importance)
 * - Provides "Oracle Validation Metrics" for mission document integrity (88.1% importance)
 * - Embodies "Cryptographic Truth" through content-addressable validation (86.7% importance)
 *
 * PURPOSE:
 * Multi-layer validation before ingesting mission documents.
 * Combines pattern matching, semantic drift detection, and optional
 * LLM-based content filtering.
 *
 * VALIDATION LAYERS (Goal → Transform → Oracle):
 * 1. Content safety (LLM-based Oracle, optional)
 * 2. Content patterns (regex-based Transform, fallback)
 * 3. Semantic drift analysis (embedding-based Oracle)
 * 4. Structural integrity (markdown Oracle validation)
 *
 * SECURITY ROLE:
 * - Pre-ingestion gate for mission documents
 * - Prevents poisoned content from entering knowledge graph (Innovation #19: Attack Detection)
 * - Provides evidence for human review ("National Security Through Transparency", 81.2%)
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
   * Map document type to appropriate security validator persona
   * Note: Personas are provisional and user-controlled
   */
  private getValidatorPersona(docType: DocumentType): string {
    const personaMap: Record<string, string> = {
      strategic: PERSONA_SECURITY_VALIDATOR,
      operational: PERSONA_OPERATIONAL_VALIDATOR,
      security: PERSONA_SECURITY_META_VALIDATOR,
      mathematical: PERSONA_MATHEMATICAL_VALIDATOR,
      architectural: PERSONA_SECURITY_VALIDATOR, // Architecture docs use strategic validator
      unknown: PERSONA_SECURITY_VALIDATOR, // Default to strategic validator
    };

    return personaMap[docType] || PERSONA_SECURITY_VALIDATOR;
  }

  /**
   * Validate a document before ingestion with domain-specific validator
   *
   * ALGORITHM:
   * 1. Check if this exact file (by hash) was already validated
   * 2. If yes, skip validation (return cached result)
   * 3. If no, select appropriate validator persona based on document type
   * 4. Run all validation layers
   * 5. Aggregate results
   * 6. Determine recommendation
   * 7. Set alert level
   * 8. Return embedded concepts from drift detection (reuse for version recording + overlay)
   *
   * @param visionPath - Path to document to validate
   * @param documentType - Classified document type (strategic, operational, security, mathematical)
   */
  async validate(
    visionPath: string,
    documentType: DocumentType = DocumentType.STRATEGIC
  ): Promise<ValidationResult> {
    // Check if this exact version (by hash) was already validated
    const content = await fs.readFile(visionPath, 'utf-8');
    const currentHash = createHash('sha256').update(content).digest('hex');
    const latestVersion = await this.integrityMonitor.getLatestVersion();

    if (latestVersion && latestVersion.hash === currentHash) {
      // File unchanged since last validation - skip security checks
      return {
        safe: true,
        layers: [
          {
            name: 'Cached',
            passed: true,
            message: `Document unchanged (hash: ${currentHash.slice(0, 8)}...) - skipping validation`,
          },
        ],
        recommendation: 'approve',
        alertLevel: 'none',
        // No embedded concepts available from cache
      };
    }

    const layers: ValidationLayer[] = [];
    let embeddedConcepts: MissionConcept[] | undefined;

    // Layer 1: Content filtering (pattern or LLM)
    if (this.config.contentFiltering.enabled) {
      if (this.config.contentFiltering.llmFilter.enabled && this.workbench) {
        layers.push(await this.validateContentSafety(visionPath, documentType));
      } else {
        layers.push(await this.validateContentPatterns(visionPath));
      }
    }

    // Layer 2: Semantic drift analysis (embeds concepts - save for reuse)
    if (this.config.missionIntegrity.enabled) {
      const driftResult = await this.validateSemanticDrift(visionPath);
      layers.push(driftResult);
      // Extract embedded concepts from drift detection for reuse
      if (
        driftResult.details &&
        'embeddedConcepts' in driftResult.details &&
        Array.isArray(driftResult.details.embeddedConcepts)
      ) {
        embeddedConcepts = driftResult.details
          .embeddedConcepts as MissionConcept[];
      }
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
      embeddedConcepts, // Return embedded concepts for reuse
    };
  }

  /**
   * Layer 1A: LLM-based content safety via Gemini
   *
   * Uses domain-specific validator persona via WorkbenchClient to detect
   * malicious patterns in documents.
   *
   * STRICT MODE: If LLM filtering is enabled, it MUST work.
   * - Missing Workbench = FAIL
   * - Missing model config = FAIL
   * - No fallback to pattern matching (that defeats the purpose)
   */
  private async validateContentSafety(
    visionPath: string,
    documentType: DocumentType
  ): Promise<ValidationLayer> {
    // Check prerequisites
    if (!this.workbench) {
      return {
        name: 'ContentSafety',
        passed: false,
        message:
          'LLM filtering enabled but Workbench not available. Check WORKBENCH_URL and WORKBENCH_API_KEY environment variables.',
      };
    }

    if (!this.config.contentFiltering.llmFilter.model) {
      return {
        name: 'ContentSafety',
        passed: false,
        message:
          'LLM filtering enabled but DEFAULT_OPSEC_MODEL_NAME not defined in config',
      };
    }

    // Run Gemini security validation
    const content = await fs.readFile(visionPath, 'utf-8');
    const filename = basename(visionPath);

    // Select appropriate validator persona based on document type
    const persona = this.getValidatorPersona(documentType);

    const response = await this.workbench.summarize({
      content,
      filename,
      persona,
      model_name: this.config.contentFiltering.llmFilter.model,
      enable_safety: true, // Enable Gemini safety settings
      max_tokens: 2000, // Allow sufficient tokens for detailed validation
    });

    // Parse structured response from validator persona
    const summary = response.summary;
    const threatMatch = summary.match(/THREAT ASSESSMENT:\s*(\w+)/i);
    const recommendationMatch = summary.match(/RECOMMENDATION:\s*(\w+)/i);

    const threat = threatMatch ? threatMatch[1].toUpperCase() : 'UNKNOWN';
    const recommendation = recommendationMatch
      ? recommendationMatch[1].toUpperCase()
      : 'REVIEW';

    const passed = threat === 'SAFE' || recommendation === 'APPROVE';

    return {
      name: 'ContentSafety',
      passed,
      message: passed
        ? `✓ No threats detected (${this.config.contentFiltering.llmFilter.model})`
        : `⚠️ Threat: ${threat} → ${recommendation}`,
      details: {
        model: this.config.contentFiltering.llmFilter.model,
        geminiResponse: summary,
        threat,
        recommendation,
      },
    };
  }

  /**
   * Layer 1B: Pattern-based content filtering
   * Used ONLY when LLM filtering is explicitly disabled
   * (Not a fallback - different validation path)
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
   *
   * IMPORTANT: Always embeds concepts (even on first ingestion) for reuse in:
   * - Version recording (skip fallback embedding)
   * - Overlay generation (skip re-embedding)
   *
   * Only performs drift analysis if previous version exists.
   */
  private async validateSemanticDrift(
    visionPath: string
  ): Promise<ValidationLayer> {
    try {
      // 1. Parse document and extract concepts (ALWAYS - even on first ingestion)
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

      // 2. Generate embeddings (ALWAYS - even on first ingestion)
      const workbenchUrl = this.workbench
        ? this.workbench.getBaseUrl()
        : undefined;
      const manager = new MissionConceptsManager(this.pgcRoot, workbenchUrl);

      // Access private method using bracket notation for testing
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const generateEmbeddings = (manager as any).generateEmbeddings.bind(
        manager
      );
      const docName = `${basename(visionPath)} [security validation]`;
      const conceptsWithEmbeddings: MissionConcept[] = await generateEmbeddings(
        concepts,
        docName
      );

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

      // 3. Check if previous version exists
      const previousVersion = await this.integrityMonitor.getLatestVersion();

      if (!previousVersion) {
        // First ingestion - no drift to detect, but return embedded concepts for reuse
        return {
          name: 'SemanticDrift',
          passed: true,
          message: 'No previous version (first ingestion)',
          details: {
            embeddedConcepts: validConcepts, // Store for reuse in version recording + overlay
          },
        };
      }

      // 4. Perform drift analysis (only if previous version exists)
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
        details: {
          drift,
          embeddedConcepts: validConcepts, // Store for reuse in version recording + overlay
        },
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
