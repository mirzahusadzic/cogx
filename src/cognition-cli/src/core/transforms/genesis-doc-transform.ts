import { MarkdownParser } from '../parsers/markdown-parser.js';
import { ObjectStore } from '../pgc/object-store.js';
import {
  DocumentObject,
  TransformResult,
  TransformLog,
} from '../pgc/document-object.js';
import { createHash } from 'crypto';
import { readFile, stat } from 'fs/promises';
import { basename, relative, dirname } from 'path';
import fs from 'fs-extra';
import path from 'path';
import {
  MissionValidator,
  MissionIntegrityMonitor,
  loadSecurityConfig,
  type SecurityConfig,
  type ValidationResult,
} from '../security/index.js';
import {
  ConceptExtractor,
  MissionConcept,
} from '../analyzers/concept-extractor.js';
import { MissionConceptsManager } from '../overlays/mission-concepts/manager.js';
import { OperationalPatternsManager } from '../overlays/operational-patterns/manager.js';
import { SecurityGuidelinesManager } from '../overlays/security-guidelines/manager.js';
import { MathematicalProofsManager } from '../overlays/mathematical-proofs/manager.js';
import { MarkdownDocument } from '../parsers/markdown-parser.js';
import {
  DocumentClassifier,
  DocumentType,
} from '../analyzers/document-classifier.js';
import { getTransparencyLog } from '../security/transparency-log.js';
import chalk from 'chalk';

/**
 * Genesis transform for documentation
 * Ingests markdown files into PGC with full provenance tracking
 *
 * SECURITY:
 * - Validates mission documents before ingestion
 * - Detects semantic drift and suspicious patterns
 * - Records version history for audit trail
 * - Advisory mode by default (warn, don't block)
 */
export class GenesisDocTransform {
  private parser: MarkdownParser;
  private classifier: DocumentClassifier;
  private objectStore: ObjectStore;
  private pgcRoot: string;
  private projectRoot: string;
  private securityConfig?: SecurityConfig;
  private validator?: MissionValidator;
  private integrityMonitor?: MissionIntegrityMonitor;

  // Overlay managers for multi-overlay routing
  private missionManager: MissionConceptsManager;
  private operationalManager: OperationalPatternsManager;
  private securityManager: SecurityGuidelinesManager;
  private mathManager: MathematicalProofsManager;
  private workbenchUrl?: string;

  constructor(pgcRoot: string, workbenchUrl?: string) {
    this.parser = new MarkdownParser();
    this.classifier = new DocumentClassifier();
    this.objectStore = new ObjectStore(pgcRoot);
    this.pgcRoot = pgcRoot;
    this.workbenchUrl = workbenchUrl;

    // Project root is the parent of .open_cognition
    this.projectRoot = dirname(pgcRoot);

    // Initialize overlay managers
    this.missionManager = new MissionConceptsManager(pgcRoot, workbenchUrl);
    this.operationalManager = new OperationalPatternsManager(
      pgcRoot,
      workbenchUrl
    );
    this.securityManager = new SecurityGuidelinesManager(pgcRoot, workbenchUrl);
    this.mathManager = new MathematicalProofsManager(pgcRoot, workbenchUrl);
  }

  /**
   * Initialize security (lazy load on first use)
   */
  private async initializeSecurity(): Promise<void> {
    if (this.securityConfig) {
      return; // Already initialized
    }

    // Load user config
    this.securityConfig = await loadSecurityConfig(this.projectRoot);

    // Skip validator if security is off
    if (this.securityConfig.mode === 'off') {
      return;
    }

    // Initialize validator and monitor
    this.validator = new MissionValidator(this.pgcRoot, this.securityConfig);
    this.integrityMonitor = new MissionIntegrityMonitor(this.pgcRoot);
  }

  /**
   * Execute genesis transform on a markdown file
   *
   * SECURITY FLOW:
   * 1. Basic file validation
   * 2. SECURITY GATE: Validate mission document
   * 3. Parse and store if validation passes
   * 4. Record version for future drift detection
   *
   * @param filePath - Path to markdown file to ingest
   */
  async execute(filePath: string): Promise<TransformResult> {
    // 1. Validate file exists and is markdown
    await this.validateMarkdownFile(filePath);

    // 2. Compute relative path from project root (for portability)
    const relativePath = relative(this.projectRoot, filePath);

    // 3. Parse markdown into AST
    const ast = await this.parser.parse(filePath);

    // 4. Classify document type
    const classification = this.classifier.classify(ast, filePath);
    console.log(
      chalk.dim(
        `  [Classification] ${basename(filePath)}: ${classification.type} (confidence: ${(classification.confidence * 100).toFixed(1)}%)`
      )
    );

    // 5. SECURITY GATE: Initialize and run domain-specific validation
    await this.initializeSecurity();

    let embeddedConcepts: MissionConcept[] | undefined;
    if (this.securityConfig && this.securityConfig.mode !== 'off') {
      const validationResult = await this.validateMissionDocument(
        filePath,
        classification.type
      );

      // Capture embedded concepts from security validation for reuse
      embeddedConcepts = validationResult.embeddedConcepts;

      // Handle based on mode and result
      if (this.securityConfig.mode === 'strict') {
        if (
          !validationResult.safe &&
          validationResult.alertLevel === 'critical'
        ) {
          // Strict mode: Block on critical
          throw new Error(
            `Mission validation failed (strict mode)\n\n` +
              this.formatValidationErrors(validationResult)
          );
        }
      } else if (this.securityConfig.mode === 'advisory') {
        // Advisory mode: Warn but continue
        if (
          validationResult.alertLevel === 'warning' ||
          validationResult.alertLevel === 'critical'
        ) {
          this.displayValidationWarning(validationResult);
        }
      }
    }

    // 5. Read raw content
    const content = await readFile(filePath, 'utf-8');

    // 6. Compute document hash
    const hash = this.computeHash(content);

    // 7. Create document object (store relative path + classification + embedded concepts)
    const docObject: DocumentObject = {
      type: 'markdown_document',
      hash,
      filePath: relativePath,
      content,
      ast,
      metadata: {
        title: ast.metadata.title,
        author: ast.metadata.author,
        created: ast.metadata.date,
        modified: new Date().toISOString(),
        documentType: classification.type, // Store classified type for overlay routing
        documentTypeConfidence: classification.confidence,
      },
      embeddedConcepts, // Store embedded concepts from security validation for reuse
    };

    // 8. Store in objects/
    const objectHash = await this.storeDocumentObject(docObject);

    // 9. Create transform ID
    const transformId = this.generateTransformId(relativePath, hash);

    // 10. Create and store transform log
    const transformLog = this.createTransformLog(
      transformId,
      relativePath,
      hash,
      objectHash
    );
    await this.storeTransformLog(transformLog);

    // 11. Check for document changes and invalidate overlays if needed
    await this.invalidateOverlaysIfChanged(relativePath, hash);

    // 12. Update index mapping (file path → hashes)
    await this.updateIndex(relativePath, hash, objectHash);

    // 13. Record mission version (for future drift detection)
    // Reuse embedded concepts from security validation (no re-embedding!)
    if (
      this.integrityMonitor &&
      this.securityConfig?.missionIntegrity.enabled
    ) {
      await this.recordMissionVersion(filePath, ast, embeddedConcepts);
    }

    // 14. Route to appropriate overlay managers based on document type
    await this.routeToOverlays(
      classification,
      ast,
      filePath,
      hash,
      objectHash,
      embeddedConcepts
    );

    // 15. TRANSPARENCY: Log mission document load to audit trail
    const transparencyLog = getTransparencyLog(this.projectRoot);
    await transparencyLog.logMissionLoad({
      title: ast.metadata.title || basename(filePath),
      source: relativePath,
      concepts: embeddedConcepts || [],
      hash: hash,
    });

    return {
      transformId,
      outputHash: hash,
      fidelity: 1.0, // Parsing is deterministic
      verified: true,
    };
  }

  /**
   * Validate markdown file
   */
  private async validateMarkdownFile(filePath: string): Promise<void> {
    const stats = await stat(filePath);

    if (!stats.isFile()) {
      throw new Error(`Not a file: ${filePath}`);
    }

    if (!filePath.endsWith('.md')) {
      throw new Error(`Not a markdown file: ${filePath}`);
    }

    // Check file size (max 10MB)
    const maxSize = 10 * 1024 * 1024;
    if (stats.size > maxSize) {
      throw new Error(
        `File too large: ${stats.size} bytes (max ${maxSize} bytes)`
      );
    }
  }

  /**
   * Compute SHA-256 hash
   */
  private computeHash(content: string): string {
    return createHash('sha256').update(content).digest('hex');
  }

  /**
   * Generate transform ID
   */
  private generateTransformId(filePath: string, hash: string): string {
    const timestamp = new Date().toISOString();
    const data = `genesis_doc:${filePath}:${hash}:${timestamp}`;
    return createHash('sha256').update(data).digest('hex');
  }

  /**
   * Store document object in objects/
   * Note: The object is stored by its JSON hash, which differs from doc.hash (content hash)
   */
  private async storeDocumentObject(doc: DocumentObject): Promise<string> {
    const content = JSON.stringify(doc, null, 2);
    const objectHash = await this.objectStore.store(content);
    return objectHash;
  }

  /**
   * Create transform log entry
   */
  private createTransformLog(
    transformId: string,
    filePath: string,
    contentHash: string,
    objectHash: string
  ): TransformLog {
    return {
      transform_id: transformId,
      type: 'genesis_doc',
      timestamp: new Date().toISOString(),
      method: 'markdown-ast-parse',
      inputs: {
        source_file: filePath,
      },
      outputs: [
        {
          hash: objectHash,
          type: 'markdown_document',
          semantic_path: filePath,
        },
      ],
      fidelity: 1.0,
      verified: true,
      provenance: {
        parser: 'remark@15.0.0',
        content_hash: contentHash,
      },
    };
  }

  /**
   * Store transform log
   */
  private async storeTransformLog(log: TransformLog): Promise<void> {
    const logsDir = path.join(this.pgcRoot, 'logs', 'transforms');
    await fs.ensureDir(logsDir);

    const logPath = path.join(logsDir, `${log.transform_id}.json`);
    await fs.writeFile(logPath, JSON.stringify(log, null, 2));
  }

  /**
   * Invalidate overlays if document has changed
   * Deletes mission_concepts and strategic_coherence overlays when a document changes
   */
  private async invalidateOverlaysIfChanged(
    filePath: string,
    newContentHash: string
  ): Promise<void> {
    const indexDir = path.join(this.pgcRoot, 'index', 'docs');
    const fileName = basename(filePath);
    const indexPath = path.join(indexDir, `${fileName}.json`);

    // Check if document already exists in index
    if (!(await fs.pathExists(indexPath))) {
      // New document - no overlays to invalidate
      return;
    }

    try {
      const existingIndex = await fs.readJSON(indexPath);

      // If content hash has changed, invalidate overlays
      if (existingIndex.contentHash !== newContentHash) {
        console.log(
          chalk.yellow(
            `Document changed: ${fileName} - invalidating mission overlays`
          )
        );

        // Delete mission_concepts overlay for this document's object hash
        const missionConceptsPath = path.join(
          this.pgcRoot,
          'overlays',
          'mission_concepts',
          `${existingIndex.objectHash}.yaml`
        );
        if (await fs.pathExists(missionConceptsPath)) {
          await fs.remove(missionConceptsPath);
          console.log(
            chalk.dim(`  Invalidated mission_concepts overlay for ${fileName}`)
          );
        }

        // Delete strategic_coherence overlay (it depends on mission_concepts)
        const coherencePath = path.join(
          this.pgcRoot,
          'overlays',
          'strategic_coherence',
          'coherence.yaml'
        );
        if (await fs.pathExists(coherencePath)) {
          await fs.remove(coherencePath);
          console.log(chalk.dim(`  Invalidated strategic_coherence overlay`));
        }
      }
    } catch (error) {
      // If we can't read the index or invalidate overlays, log warning but continue
      console.warn(
        `Warning: Failed to invalidate overlays for ${fileName}: ${(error as Error).message}`
      );
    }
  }

  /**
   * Update index mapping (file path → hashes)
   */
  private async updateIndex(
    filePath: string,
    contentHash: string,
    objectHash: string
  ): Promise<void> {
    const indexDir = path.join(this.pgcRoot, 'index', 'docs');
    await fs.ensureDir(indexDir);

    const fileName = basename(filePath);
    const indexPath = path.join(indexDir, `${fileName}.json`);

    const indexEntry = {
      filePath,
      contentHash, // Hash of raw markdown content (for change detection)
      objectHash, // Hash of JSON DocumentObject (for retrieval from object store)
      timestamp: new Date().toISOString(),
    };

    await fs.writeFile(indexPath, JSON.stringify(indexEntry, null, 2));
  }

  /**
   * SECURITY: Validate document before ingestion with domain-specific validator
   */
  private async validateMissionDocument(
    filePath: string,
    documentType: DocumentType
  ): Promise<ValidationResult> {
    if (!this.validator) {
      throw new Error('Validator not initialized');
    }

    const result = await this.validator.validate(filePath, documentType);

    // Log alert if needed
    if (result.alertLevel !== 'none') {
      await this.logSecurityAlert(filePath, result);
    }

    return result;
  }

  /**
   * SECURITY: Display validation warning (advisory mode)
   */
  private displayValidationWarning(result: ValidationResult): void {
    console.log(''); // Blank line

    // Header
    if (result.alertLevel === 'critical') {
      console.log(chalk.red.bold('🛑 Mission Drift Alert (Critical)'));
    } else if (result.alertLevel === 'warning') {
      console.log(chalk.yellow.bold('⚠️  Mission Drift Alert (Warning)'));
    } else {
      console.log(chalk.blue.bold('ℹ️  Mission Validation Notice'));
    }

    console.log(chalk.gray('━'.repeat(60)));

    // Show failed layers
    const failedLayers = result.layers.filter((l) => !l.passed);
    failedLayers.forEach((layer) => {
      console.log(chalk.white(`  ${layer.name}:`));
      console.log(chalk.gray(`    ${layer.message}`));

      // Show drift details if present
      if (layer.details?.drift) {
        const drift = layer.details.drift;
        if (drift.suspiciousPatterns && drift.suspiciousPatterns.length > 0) {
          console.log('');
          console.log(chalk.red.bold('  Suspicious patterns detected:'));
          drift.suspiciousPatterns.forEach((pattern: string) => {
            console.log(chalk.red(`    • ${pattern}`));
          });
        }
      }
    });

    console.log('');
    console.log(
      chalk.white(
        `  Recommendation: ${chalk.bold(result.recommendation.toUpperCase())}`
      )
    );
    console.log('');
    console.log(
      chalk.gray('  This is advisory only - ingestion will continue.')
    );
    console.log(
      chalk.gray(
        '  Alert logged to: .open_cognition/mission_integrity/alerts.log'
      )
    );
    console.log(chalk.gray('━'.repeat(60)));
    console.log(''); // Blank line
  }

  /**
   * SECURITY: Format validation errors for strict mode
   */
  private formatValidationErrors(result: ValidationResult): string {
    const lines: string[] = [];

    const failedLayers = result.layers.filter((l) => !l.passed);
    failedLayers.forEach((layer) => {
      lines.push(`  ❌ ${layer.name}: ${layer.message}`);

      // Show drift details
      if (layer.details?.drift) {
        const drift = layer.details.drift;
        if (drift.suspiciousPatterns && drift.suspiciousPatterns.length > 0) {
          lines.push('');
          lines.push('  Suspicious patterns:');
          drift.suspiciousPatterns.forEach((pattern: string) => {
            lines.push(`    • ${pattern}`);
          });
        }
      }
    });

    lines.push('');
    lines.push(`Recommendation: ${result.recommendation.toUpperCase()}`);
    lines.push('');
    lines.push('To proceed anyway:');
    lines.push('1. Review changes carefully');
    lines.push("2. Set mode: 'advisory' in .cogx/config.ts");
    lines.push('3. Re-run command');

    return lines.join('\n');
  }

  /**
   * SECURITY: Log security alert to file
   */
  private async logSecurityAlert(
    filePath: string,
    result: ValidationResult
  ): Promise<void> {
    const alertsDir = path.join(this.pgcRoot, 'mission_integrity');
    await fs.ensureDir(alertsDir);

    const alertLogPath = path.join(alertsDir, 'alerts.log');

    const alert = {
      timestamp: new Date().toISOString(),
      file: filePath,
      alertLevel: result.alertLevel,
      recommendation: result.recommendation,
      layers: result.layers
        .filter((l) => !l.passed)
        .map((l) => ({
          name: l.name,
          message: l.message,
          suspiciousPatterns: l.details?.drift?.suspiciousPatterns || [],
        })),
    };

    const logEntry = JSON.stringify(alert) + '\n';

    // Append to log file
    await fs.appendFile(alertLogPath, logEntry);
  }

  /**
   * SECURITY: Record mission version for future drift detection
   *
   * @param filePath - Path to document
   * @param ast - Parsed markdown AST
   * @param preEmbeddedConcepts - Already-embedded concepts from security validation (skip re-embedding)
   */
  private async recordMissionVersion(
    filePath: string,
    ast: MarkdownDocument,
    preEmbeddedConcepts?: MissionConcept[]
  ): Promise<void> {
    if (!this.integrityMonitor) {
      return; // Monitor not initialized
    }

    try {
      let validConcepts: MissionConcept[];

      // If concepts were already embedded during security validation, reuse them
      if (preEmbeddedConcepts && preEmbeddedConcepts.length > 0) {
        validConcepts = preEmbeddedConcepts.filter(
          (c) => c.embedding && c.embedding.length === 768
        );
      } else {
        // Fallback: Extract and embed (shouldn't happen in normal flow)
        const extractor = new ConceptExtractor();
        const concepts = extractor.extract(ast);

        if (concepts.length === 0) {
          // No mission concepts found - not a mission document
          return;
        }

        // Generate embeddings for concepts (fallback path)
        const manager = new MissionConceptsManager(this.pgcRoot);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const generateEmbeddings = (manager as any).generateEmbeddings.bind(
          manager
        );
        const docName = `${basename(filePath)} [version recording fallback]`;
        const conceptsWithEmbeddings: MissionConcept[] =
          await generateEmbeddings(concepts, docName);

        // Filter to valid embeddings
        validConcepts = conceptsWithEmbeddings.filter(
          (c) => c.embedding && c.embedding.length === 768
        );
      }

      if (validConcepts.length === 0) {
        // No valid embeddings - skip version recording
        return;
      }

      // Record version
      await this.integrityMonitor.recordVersion(filePath, validConcepts);
    } catch (error) {
      // Non-blocking: log warning but don't fail ingestion
      console.warn(
        `Warning: Failed to record mission version: ${(error as Error).message}`
      );
    }
  }

  /**
   * Route document to appropriate overlay managers based on classification
   *
   * MULTI-OVERLAY ROUTING (Phase 2):
   * - strategic → O₄ (Mission Concepts)
   * - operational → O₅ (Operational Patterns)
   * - security → O₂ (Security Guidelines)
   * - mathematical → O₆ (Mathematical Proofs)
   *
   * Each document type generates its corresponding overlay with extracted knowledge.
   */
  private async routeToOverlays(
    classification: { type: DocumentType; confidence: number },
    ast: MarkdownDocument,
    filePath: string,
    contentHash: string,
    objectHash: string,
    preEmbeddedConcepts?: MissionConcept[]
  ): Promise<void> {
    const relativePath = relative(this.projectRoot, filePath);

    console.log(
      chalk.blue(
        `  [Routing] Generating ${classification.type} overlay (confidence: ${(classification.confidence * 100).toFixed(1)}%)...`
      )
    );

    try {
      switch (classification.type) {
        case DocumentType.STRATEGIC:
          // Route to O₄ Mission Concepts
          await this.generateMissionOverlay(
            ast,
            contentHash,
            objectHash,
            relativePath,
            preEmbeddedConcepts
          );
          break;

        case DocumentType.OPERATIONAL:
          // Route to O₅ Operational Patterns
          await this.generateOperationalOverlay(
            ast,
            contentHash,
            objectHash,
            relativePath
          );
          break;

        case DocumentType.SECURITY:
          // Route to O₂ Security Guidelines
          await this.generateSecurityOverlay(
            ast,
            contentHash,
            objectHash,
            relativePath
          );
          break;

        case DocumentType.MATHEMATICAL:
          // Route to O₆ Mathematical Proofs
          await this.generateMathematicalOverlay(
            ast,
            contentHash,
            objectHash,
            relativePath
          );
          break;

        default:
          console.log(
            chalk.yellow(
              `  [Warning] Unknown document type: ${classification.type}`
            )
          );
      }
    } catch (error) {
      console.error(
        chalk.red(
          `  [Error] Failed to generate overlay: ${error instanceof Error ? error.message : 'Unknown error'}`
        )
      );
      throw error;
    }
  }

  /**
   * Generate O₄ Mission Concepts overlay (strategic documents)
   */
  private async generateMissionOverlay(
    ast: MarkdownDocument,
    contentHash: string,
    objectHash: string,
    filePath: string,
    preEmbeddedConcepts?: MissionConcept[]
  ): Promise<void> {
    let concepts: MissionConcept[];

    // Reuse pre-embedded concepts from security validation if available
    if (preEmbeddedConcepts && preEmbeddedConcepts.length > 0) {
      concepts = preEmbeddedConcepts;
      console.log(
        chalk.dim(
          `    ✓ O₄ Mission: Reusing ${concepts.length} pre-embedded concepts from security validation`
        )
      );
    } else {
      // Extract mission concepts using ConceptExtractor
      const extractor = new ConceptExtractor();
      concepts = extractor.extract(ast);
      console.log(
        chalk.dim(`    ✓ O₄ Mission: Extracted ${concepts.length} concepts`)
      );
    }

    // Generate embeddings and store in mission overlay
    // Note: MissionConceptsManager uses store() instead of generateOverlay()
    const overlay = {
      document_hash: contentHash,
      document_path: filePath,
      extracted_concepts: concepts,
      generated_at: new Date().toISOString(),
      transform_id: objectHash,
    };
    await this.missionManager.store(overlay);
  }

  /**
   * Generate O₅ Operational Patterns overlay (workflow documents)
   */
  private async generateOperationalOverlay(
    ast: MarkdownDocument,
    contentHash: string,
    objectHash: string,
    filePath: string
  ): Promise<void> {
    // Extract operational patterns using WorkflowExtractor
    const { WorkflowExtractor } = await import(
      '../analyzers/workflow-extractor.js'
    );
    const extractor = new WorkflowExtractor();
    const patterns = extractor.extract(ast);

    console.log(
      chalk.dim(`    ✓ O₅ Operational: Extracted ${patterns.length} patterns`)
    );

    // Generate embeddings and store in operational overlay
    await this.operationalManager.generateOverlay(
      filePath,
      contentHash,
      patterns,
      objectHash // transformId
    );
  }

  /**
   * Generate O₂ Security Guidelines overlay (security documents)
   */
  private async generateSecurityOverlay(
    ast: MarkdownDocument,
    contentHash: string,
    objectHash: string,
    filePath: string
  ): Promise<void> {
    // Extract security guidelines using SecurityExtractor
    const { SecurityExtractor } = await import(
      '../analyzers/security-extractor.js'
    );
    const extractor = new SecurityExtractor();
    const guidelines = extractor.extract(ast);

    console.log(
      chalk.dim(`    ✓ O₂ Security: Extracted ${guidelines.length} guidelines`)
    );

    // Generate embeddings and store in security overlay
    await this.securityManager.generateOverlay(
      filePath,
      contentHash,
      guidelines,
      objectHash // transformId
    );
  }

  /**
   * Generate O₆ Mathematical Proofs overlay (formal documents)
   */
  private async generateMathematicalOverlay(
    ast: MarkdownDocument,
    contentHash: string,
    objectHash: string,
    filePath: string
  ): Promise<void> {
    // Extract mathematical proofs using ProofExtractor
    const { ProofExtractor } = await import('../analyzers/proof-extractor.js');
    const extractor = new ProofExtractor();
    const knowledge = extractor.extract(ast);

    console.log(
      chalk.dim(
        `    ✓ O₆ Mathematical: Extracted ${knowledge.length} statements`
      )
    );

    // Generate embeddings and store in mathematical overlay
    await this.mathManager.generateOverlay(
      filePath,
      contentHash,
      knowledge,
      objectHash // transformId
    );
  }
}
