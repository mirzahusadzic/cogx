import { MarkdownDocument } from '../parsers/markdown-parser.js';

/**
 * Document types that map to different overlay layers
 *
 * ARCHITECTURE NOTE:
 * Each document type routes to a specific overlay layer:
 * - strategic → O₄ (Mission) - Vision, goals, purpose
 * - operational → O₅ (Operational) - Workflow patterns, quest structure
 * - mathematical → O₆ (Mathematical) - Theorems, proofs, formal properties
 * - security → O₂ (Security) - Threat models, constraints, safe patterns
 *
 * O₂ (Security) is foundational - it's checked before mission alignment
 * and can be inherited from dependencies via .cogx files
 */
export enum DocumentType {
  STRATEGIC = 'strategic',
  OPERATIONAL = 'operational',
  MATHEMATICAL = 'mathematical',
  SECURITY = 'security',
  ARCHITECTURAL = 'architectural',
  UNKNOWN = 'unknown',
}

/**
 * Maps document types to overlay layers
 */
export const OVERLAY_ROUTING = {
  strategic: 'O4_Mission',
  operational: 'O5_Operational',
  mathematical: 'O6_Mathematical',
  security: 'O2_Security',
  architectural: 'O4_Mission', // Architecture philosophy is strategic
  unknown: 'O4_Mission', // Default to mission for backward compatibility
} as const;

/**
 * Classification result with confidence score
 */
export interface ClassificationResult {
  type: DocumentType;
  confidence: number; // 0-1
  reasoning: string[];
}

/**
 * DocumentClassifier
 *
 * Analyzes markdown documents to determine their type and appropriate overlay layer.
 * Uses multiple signals: filename, frontmatter, section structure, content patterns.
 *
 * DESIGN PRINCIPLE:
 * Classification should be deterministic and explainable.
 * Each classification includes reasoning for auditability.
 */
export class DocumentClassifier {
  /**
   * Classify a document by analyzing multiple signals
   */
  classify(doc: MarkdownDocument, filePath: string): ClassificationResult {
    const signals: ClassificationResult[] = [];

    // Signal 1: Filename patterns
    signals.push(this.classifyByFilename(filePath));

    // Signal 2: Frontmatter metadata (if present)
    if (doc.metadata) {
      signals.push(this.classifyByFrontmatter(doc.metadata));
    }

    // Signal 3: Section structure
    signals.push(this.classifyBySectionStructure(doc));

    // Signal 4: Content patterns
    signals.push(this.classifyByContentPatterns(doc));

    // Combine signals with weighted voting
    return this.combineSignals(signals);
  }

  /**
   * Classify by filename patterns
   */
  private classifyByFilename(filePath: string): ClassificationResult {
    const filename = filePath.toLowerCase();
    const reasoning: string[] = [];

    // Security documents
    if (
      filename.includes('security') ||
      filename.includes('threat') ||
      filename.includes('vulnerability')
    ) {
      reasoning.push('Filename contains security-related keywords');
      return {
        type: DocumentType.SECURITY,
        confidence: 0.9,
        reasoning,
      };
    }

    // Operational documents
    if (
      filename.includes('operational') ||
      filename.includes('workflow') ||
      filename.includes('process')
    ) {
      reasoning.push('Filename contains operational/workflow keywords');
      return {
        type: DocumentType.OPERATIONAL,
        confidence: 0.9,
        reasoning,
      };
    }

    // Mathematical documents
    if (
      filename.includes('proof') ||
      filename.includes('theorem') ||
      filename.includes('lemma') ||
      filename.includes('math')
    ) {
      reasoning.push('Filename contains mathematical keywords');
      return {
        type: DocumentType.MATHEMATICAL,
        confidence: 0.9,
        reasoning,
      };
    }

    // Strategic documents
    if (
      filename.includes('vision') ||
      filename.includes('mission') ||
      filename.includes('strategy')
    ) {
      reasoning.push('Filename contains strategic keywords');
      return {
        type: DocumentType.STRATEGIC,
        confidence: 0.9,
        reasoning,
      };
    }

    // Architectural documents
    if (filename.includes('architecture') || filename.includes('design')) {
      reasoning.push('Filename contains architecture/design keywords');
      return {
        type: DocumentType.ARCHITECTURAL,
        confidence: 0.8,
        reasoning,
      };
    }

    reasoning.push('No filename match');
    return {
      type: DocumentType.UNKNOWN,
      confidence: 0.0,
      reasoning,
    };
  }

  /**
   * Classify by frontmatter metadata
   */
  private classifyByFrontmatter(metadata: {
    [key: string]: unknown;
  }): ClassificationResult {
    const reasoning: string[] = [];

    // Check for explicit 'type' field
    if (metadata.type && typeof metadata.type === 'string') {
      const type = metadata.type.toLowerCase();
      reasoning.push(`Frontmatter type: ${type}`);

      if (type === 'security' || type === 'threat-model') {
        return {
          type: DocumentType.SECURITY,
          confidence: 1.0,
          reasoning,
        };
      }

      if (type === 'operational' || type === 'workflow' || type === 'process') {
        return {
          type: DocumentType.OPERATIONAL,
          confidence: 1.0,
          reasoning,
        };
      }

      if (type === 'mathematical' || type === 'proof' || type === 'theorem') {
        return {
          type: DocumentType.MATHEMATICAL,
          confidence: 1.0,
          reasoning,
        };
      }

      if (type === 'strategic' || type === 'vision' || type === 'mission') {
        return {
          type: DocumentType.STRATEGIC,
          confidence: 1.0,
          reasoning,
        };
      }

      if (type === 'architectural' || type === 'design') {
        return {
          type: DocumentType.ARCHITECTURAL,
          confidence: 1.0,
          reasoning,
        };
      }
    }

    reasoning.push('No frontmatter type match');
    return {
      type: DocumentType.UNKNOWN,
      confidence: 0.0,
      reasoning,
    };
  }

  /**
   * Classify by section structure
   */
  private classifyBySectionStructure(
    doc: MarkdownDocument
  ): ClassificationResult {
    const reasoning: string[] = [];
    const sections = doc.sections.map((s) => s.heading.toLowerCase());

    // Security patterns
    const securitySections = [
      'threat model',
      'security',
      'vulnerabilities',
      'attack vectors',
      'mitigations',
    ];
    const securityMatches = sections.filter((s) =>
      securitySections.some((pattern) => s.includes(pattern))
    ).length;

    if (securityMatches >= 2) {
      reasoning.push(`Found ${securityMatches} security-related sections`);
      return {
        type: DocumentType.SECURITY,
        confidence: 0.8,
        reasoning,
      };
    }

    // Operational patterns
    const operationalSections = [
      'patterns:',
      'workflow',
      'quest',
      'sacred sequence',
      'operations log',
      'aqs',
    ];
    const operationalMatches = sections.filter((s) =>
      operationalSections.some((pattern) => s.includes(pattern))
    ).length;

    if (operationalMatches >= 2) {
      reasoning.push(
        `Found ${operationalMatches} operational pattern sections`
      );
      return {
        type: DocumentType.OPERATIONAL,
        confidence: 0.8,
        reasoning,
      };
    }

    // Mathematical patterns
    const mathSections = ['theorem', 'proof', 'lemma', 'axiom', 'corollary'];
    const mathMatches = sections.filter((s) =>
      mathSections.some((pattern) => s.includes(pattern))
    ).length;

    if (mathMatches >= 2) {
      reasoning.push(`Found ${mathMatches} mathematical sections`);
      return {
        type: DocumentType.MATHEMATICAL,
        confidence: 0.8,
        reasoning,
      };
    }

    // Strategic patterns
    const strategicSections = [
      'vision',
      'mission',
      'principles',
      'goals',
      'purpose',
      'opportunity',
    ];
    const strategicMatches = sections.filter((s) =>
      strategicSections.some((pattern) => s.includes(pattern))
    ).length;

    if (strategicMatches >= 2) {
      reasoning.push(`Found ${strategicMatches} strategic sections`);
      return {
        type: DocumentType.STRATEGIC,
        confidence: 0.8,
        reasoning,
      };
    }

    reasoning.push('No clear section structure pattern');
    return {
      type: DocumentType.UNKNOWN,
      confidence: 0.0,
      reasoning,
    };
  }

  /**
   * Classify by content patterns (keyword density)
   */
  private classifyByContentPatterns(
    doc: MarkdownDocument
  ): ClassificationResult {
    const reasoning: string[] = [];
    const content = doc.sections
      .map((s) => s.content)
      .join('\n')
      .toLowerCase();

    // Count keyword occurrences
    const securityKeywords = [
      'vulnerability',
      'attack',
      'threat',
      'exploit',
      'mitigation',
      'security boundary',
    ];
    const operationalKeywords = [
      'quest',
      'workflow',
      'sacred',
      'depth',
      'oracle',
      'scribe',
    ];
    const mathKeywords = [
      'theorem',
      'proof',
      'lemma',
      'q.e.d',
      'axiom',
      'corollary',
    ];
    const strategicKeywords = [
      'vision',
      'mission',
      'purpose',
      'augment',
      'symbiosis',
    ];

    const securityCount = securityKeywords.filter((k) =>
      content.includes(k)
    ).length;
    const operationalCount = operationalKeywords.filter((k) =>
      content.includes(k)
    ).length;
    const mathCount = mathKeywords.filter((k) => content.includes(k)).length;
    const strategicCount = strategicKeywords.filter((k) =>
      content.includes(k)
    ).length;

    const max = Math.max(
      securityCount,
      operationalCount,
      mathCount,
      strategicCount
    );

    if (max === 0) {
      reasoning.push('No strong keyword signals');
      return {
        type: DocumentType.UNKNOWN,
        confidence: 0.0,
        reasoning,
      };
    }

    if (securityCount === max && securityCount >= 3) {
      reasoning.push(`Found ${securityCount} security keywords`);
      return {
        type: DocumentType.SECURITY,
        confidence: 0.6,
        reasoning,
      };
    }

    if (operationalCount === max && operationalCount >= 3) {
      reasoning.push(`Found ${operationalCount} operational keywords`);
      return {
        type: DocumentType.OPERATIONAL,
        confidence: 0.6,
        reasoning,
      };
    }

    if (mathCount === max && mathCount >= 3) {
      reasoning.push(`Found ${mathCount} mathematical keywords`);
      return {
        type: DocumentType.MATHEMATICAL,
        confidence: 0.6,
        reasoning,
      };
    }

    if (strategicCount === max && strategicCount >= 2) {
      reasoning.push(`Found ${strategicCount} strategic keywords`);
      return {
        type: DocumentType.STRATEGIC,
        confidence: 0.6,
        reasoning,
      };
    }

    reasoning.push('Keyword counts too low for classification');
    return {
      type: DocumentType.UNKNOWN,
      confidence: 0.0,
      reasoning,
    };
  }

  /**
   * Combine multiple signals using weighted voting
   */
  private combineSignals(
    signals: ClassificationResult[]
  ): ClassificationResult {
    // Group by type and sum confidence scores
    const typeScores = new Map<DocumentType, number>();
    const allReasoning: string[] = [];

    for (const signal of signals) {
      const current = typeScores.get(signal.type) || 0;
      typeScores.set(signal.type, current + signal.confidence);
      allReasoning.push(...signal.reasoning);
    }

    // Remove UNKNOWN from consideration if we have any other type
    if (typeScores.size > 1) {
      typeScores.delete(DocumentType.UNKNOWN);
    }

    // Find the type with highest score
    let maxType = DocumentType.UNKNOWN;
    let maxScore = 0;

    for (const [type, score] of typeScores) {
      if (score > maxScore) {
        maxScore = score;
        maxType = type;
      }
    }

    // Normalize confidence to 0-1
    const maxPossibleScore = signals.length * 1.0;
    const confidence = Math.min(maxScore / maxPossibleScore, 1.0);

    return {
      type: maxType,
      confidence,
      reasoning: allReasoning,
    };
  }
}
