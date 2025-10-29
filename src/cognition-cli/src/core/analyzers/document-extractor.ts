import { MarkdownDocument } from '../parsers/markdown-parser.js';
import { DocumentType } from './document-classifier.js';

/**
 * Base interface for extracted knowledge
 * All overlay-specific knowledge types extend this
 */
export interface ExtractedKnowledge {
  text: string; // The extracted text
  section: string; // Source section
  weight: number; // Importance score (0-1)
  occurrences: number; // Frequency
  sectionHash: string; // Provenance
  embedding?: number[]; // Vector embedding (optional)
  metadata?: Record<string, unknown>; // Overlay-specific data
}

/**
 * Strategic concepts (O₄ Mission overlay)
 */
export interface StrategyKnowledge extends ExtractedKnowledge {
  category: 'vision' | 'mission' | 'principle' | 'goal' | 'value';
}

/**
 * Operational patterns (O₅ Operational overlay)
 */
export interface OperationalKnowledge extends ExtractedKnowledge {
  patternType:
    | 'quest_structure'
    | 'sacred_sequence'
    | 'workflow_pattern'
    | 'depth_rule'
    | 'terminology';
  metadata?: {
    steps?: string[]; // For sequences
    formula?: string; // For AQS, calculations
    example?: string; // Usage example
  };
}

/**
 * Mathematical statements (O₆ Mathematical overlay)
 */
export interface MathematicalKnowledge extends ExtractedKnowledge {
  statementType:
    | 'theorem'
    | 'lemma'
    | 'axiom'
    | 'corollary'
    | 'proof'
    | 'identity';
  metadata?: {
    proofSteps?: string[]; // For proofs
    dependencies?: string[]; // Required lemmas/theorems
    formalNotation?: string; // Mathematical notation
  };
}

/**
 * Security knowledge (O₂ Security overlay)
 */
export interface SecurityKnowledge extends ExtractedKnowledge {
  securityType:
    | 'threat_model'
    | 'attack_vector'
    | 'mitigation'
    | 'boundary'
    | 'constraint'
    | 'vulnerability';
  severity?: 'critical' | 'high' | 'medium' | 'low';
  metadata?: {
    cveId?: string; // CVE identifier
    affectedVersions?: string; // Version range
    mitigation?: string; // How to mitigate
    references?: string[]; // External links
  };
}

/**
 * Base interface for document extractors
 * Each overlay type implements its own extractor
 */
export interface DocumentExtractor<
  T extends ExtractedKnowledge = ExtractedKnowledge,
> {
  /**
   * Extract knowledge from a document
   */
  extract(doc: MarkdownDocument): T[];

  /**
   * Check if this extractor supports a document type
   */
  supports(docType: DocumentType): boolean;

  /**
   * Get the overlay layer this extractor targets
   */
  getOverlayLayer(): string;
}

/**
 * Registry for managing document extractors
 *
 * DESIGN:
 * - Maintains a mapping of document types to extractors
 * - Allows registration of new extractors dynamically
 * - Enables overlay-specific extraction strategies
 */
export class ExtractorRegistry {
  private extractors: DocumentExtractor[] = [];

  /**
   * Register a new extractor
   */
  register(extractor: DocumentExtractor): void {
    this.extractors.push(extractor);
  }

  /**
   * Get the appropriate extractor for a document type
   */
  getExtractor(docType: DocumentType): DocumentExtractor | undefined {
    return this.extractors.find((e) => e.supports(docType));
  }

  /**
   * Get all registered extractors
   */
  getAllExtractors(): DocumentExtractor[] {
    return [...this.extractors];
  }

  /**
   * Get extractors by overlay layer
   */
  getExtractorsByLayer(layer: string): DocumentExtractor[] {
    return this.extractors.filter((e) => e.getOverlayLayer() === layer);
  }
}
