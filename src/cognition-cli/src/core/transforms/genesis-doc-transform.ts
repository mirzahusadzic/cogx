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
import { MarkdownDocument } from '../parsers/markdown-parser.js';
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
  private objectStore: ObjectStore;
  private projectRoot: string;
  private securityConfig?: SecurityConfig;
  private validator?: MissionValidator;
  private integrityMonitor?: MissionIntegrityMonitor;

  constructor(private pgcRoot: string) {
    this.parser = new MarkdownParser();
    this.objectStore = new ObjectStore(pgcRoot);
    // Project root is the parent of .open_cognition
    this.projectRoot = dirname(pgcRoot);
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
   */
  async execute(filePath: string): Promise<TransformResult> {
    // 1. Validate file exists and is markdown
    await this.validateMarkdownFile(filePath);

    // 2. Compute relative path from project root (for portability)
    const relativePath = relative(this.projectRoot, filePath);

    // 3. SECURITY GATE: Initialize and run validation
    await this.initializeSecurity();

    if (this.securityConfig && this.securityConfig.mode !== 'off') {
      const validationResult = await this.validateMissionDocument(filePath);

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

    // 4. Parse markdown into AST
    const ast = await this.parser.parse(filePath);

    // 5. Read raw content
    const content = await readFile(filePath, 'utf-8');

    // 6. Compute document hash
    const hash = this.computeHash(content);

    // 7. Create document object (store relative path)
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
      },
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

    // 11. Update index mapping (file path → hashes)
    await this.updateIndex(relativePath, hash, objectHash);

    // 12. Record mission version (for future drift detection)
    if (
      this.integrityMonitor &&
      this.securityConfig?.missionIntegrity.enabled
    ) {
      await this.recordMissionVersion(filePath, ast);
    }

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
   * SECURITY: Validate mission document before ingestion
   */
  private async validateMissionDocument(
    filePath: string
  ): Promise<ValidationResult> {
    if (!this.validator) {
      throw new Error('Validator not initialized');
    }

    const result = await this.validator.validate(filePath);

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
   */
  private async recordMissionVersion(
    filePath: string,
    ast: MarkdownDocument
  ): Promise<void> {
    if (!this.integrityMonitor) {
      return; // Monitor not initialized
    }

    try {
      // Extract concepts from the document
      const extractor = new ConceptExtractor();
      const concepts = extractor.extract(ast);

      if (concepts.length === 0) {
        // No mission concepts found - not a mission document
        return;
      }

      // Generate embeddings for concepts
      const manager = new MissionConceptsManager(this.pgcRoot);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const generateEmbeddings = (manager as any).generateEmbeddings.bind(
        manager
      );
      const conceptsWithEmbeddings: MissionConcept[] =
        await generateEmbeddings(concepts);

      // Filter to valid embeddings
      const validConcepts = conceptsWithEmbeddings.filter(
        (c) => c.embedding && c.embedding.length === 768
      );

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
}
