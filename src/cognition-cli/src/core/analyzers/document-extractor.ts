import {
  MarkdownDocument,
  MarkdownSection,
} from '../parsers/markdown-parser.js';
import { DocumentType } from './document-classifier.js';
import { BaseRegistry } from '../common/registry.js';
import { IBaseOverlayFinding } from '../overlays/base-types.js';

/**
 * Base structure for knowledge extracted from documents.
 * Standardized across O2, O4, O5, O6.
 */
export interface ExtractedKnowledge extends IBaseOverlayFinding {
  /** Overlay-specific metadata (optional) */
  metadata?: Record<string, unknown>;
}

/**
 * Strategic concepts (O₄ Mission overlay)
 */
export interface StrategyKnowledge extends ExtractedKnowledge {
  /** Mission concept category */
  type: 'vision' | 'mission' | 'principle' | 'goal' | 'value' | 'concept';
}

/**
 * Operational patterns (O₅ Operational overlay)
 */
export interface OperationalKnowledge extends ExtractedKnowledge {
  /** Pattern classification */
  type:
    | 'quest_structure'
    | 'sacred_sequence'
    | 'workflow_pattern'
    | 'depth_rule'
    | 'terminology'
    | 'explanation'; // Explanatory paragraphs from documentation
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
  /** Mathematical statement classification */
  type:
    | 'theorem'
    | 'lemma'
    | 'axiom'
    | 'corollary'
    | 'proof'
    | 'identity'
    | 'invariant'
    | 'complexity';
  metadata?: {
    proofSteps?: string[]; // For proofs
    dependencies?: string[]; // Required lemmas/theorems
    formalNotation?: string; // Mathematical notation
    timeComplexity?: string; // For complexity bounds (e.g., "O(n log n)")
    spaceComplexity?: string; // For complexity bounds (e.g., "O(n)")
    enforcement?: string; // For invariants - how it's enforced
    violations?: string[]; // For invariants - what to watch for
  };
}

/**
 * Security knowledge (O₂ Security overlay)
 */
export interface SecurityKnowledge extends ExtractedKnowledge {
  /** Security finding classification */
  type:
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
 * Base class for markdown-based document extractors.
 * Handles common tasks like section traversal, position weighting,
 * and deduplication.
 *
 * DESIGN RATIONALE:
 * - Reduces boilerplate in specific domain extractors
 * - Ensures consistent traversal logic (O(N) section visits)
 * - Standardizes importance weighting based on document flow
 * - Centralizes text cleaning and deduplication logic
 */
export abstract class BaseMarkdownExtractor<
  T extends ExtractedKnowledge,
> implements DocumentExtractor<T> {
  /**
   * Extract knowledge from a document
   */
  extract(doc: MarkdownDocument): T[] {
    const knowledge: T[] = [];

    // Extract from each section (recursively including children)
    doc.sections.forEach((section, index) => {
      knowledge.push(
        ...this.extractFromSectionRecursive(section, index, doc.sections.length)
      );
    });

    // Deduplicate by normalized text
    return this.deduplicateKnowledge(knowledge);
  }

  /**
   * Recursively extract from section and all its children
   */
  protected extractFromSectionRecursive(
    section: MarkdownSection,
    sectionIndex: number,
    totalSections: number
  ): T[] {
    const knowledge: T[] = [];

    // Extract from this section
    knowledge.push(
      ...this.extractFromSection(section, sectionIndex, totalSections)
    );

    // Recursively extract from children
    if (section.children && section.children.length > 0) {
      section.children.forEach((child, childIndex) => {
        knowledge.push(
          ...this.extractFromSectionRecursive(
            child,
            childIndex,
            section.children.length
          )
        );
      });
    }

    return knowledge;
  }

  /**
   * Extract knowledge from a single section.
   * To be implemented by specific extractors.
   */
  protected abstract extractFromSection(
    section: MarkdownSection,
    sectionIndex: number,
    totalSections: number
  ): T[];

  /**
   * Deduplicate knowledge items by normalized text content.
   * Standard implementation that prefers items without type prefix.
   */
  protected deduplicateKnowledge(knowledge: T[]): T[] {
    const seen = new Map<string, T>();

    for (const item of knowledge) {
      const key = this.normalizeForDedup(item.text);
      const existing = seen.get(key);

      if (!existing) {
        seen.set(key, item);
      } else {
        // Accumulate occurrences
        existing.occurrences =
          (existing.occurrences || 0) + (item.occurrences || 1);

        // Prefer the version WITHOUT a type prefix in the text (cleaner)
        const existingHasPrefix = this.hasTypePrefix(existing.text);
        const currentHasPrefix = this.hasTypePrefix(item.text);

        if (existingHasPrefix && !currentHasPrefix) {
          // Carry over accumulated occurrences to the new representative item
          item.occurrences = existing.occurrences;
          seen.set(key, item);
        } else if (
          (item.weight ?? 0) > (existing.weight ?? 0) &&
          existingHasPrefix === currentHasPrefix
        ) {
          // Carry over accumulated occurrences to the new representative item
          item.occurrences = existing.occurrences;
          seen.set(key, item);
        }
      }
    }

    return Array.from(seen.values());
  }

  /**
   * Check if text has a type prefix (e.g. "THEOREM: ...")
   */
  protected hasTypePrefix(text: string): boolean {
    return /^[A-Z_]{3,}:\s*/i.test(text);
  }

  /**
   * Normalize text by stripping common type prefixes for deduplication
   */
  protected normalizeForDedup(text: string): string {
    return text
      .replace(/^[A-Z_]{3,}:\s*/i, '')
      .trim()
      .toLowerCase();
  }

  /**
   * Calculate position-based weight
   */
  protected getPositionWeight(index: number, total: number): number {
    return 1.0 - (index / Math.max(1, total)) * 0.4;
  }

  /**
   * Utility to strip code blocks from text
   */
  protected stripCodeBlocks(text: string): string {
    return text.replace(/```[\s\S]*?```/g, '').trim();
  }

  // Abstract methods from DocumentExtractor
  abstract supports(docType: DocumentType): boolean;
  abstract getOverlayLayer(): string;
}

/**
 * Registry for managing document extractors
 *
 * DESIGN:
 * - Extends BaseRegistry for standard registry operations
 * - Maintains a mapping of document types to extractors
 * - Allows registration of new extractors dynamically
 * - Enables overlay-specific extraction strategies
 */
export class ExtractorRegistry extends BaseRegistry<DocumentExtractor> {
  constructor() {
    super('ExtractorRegistry');
  }

  /**
   * Register a new extractor
   *
   * @param extractor - Document extractor to register
   */
  // @ts-expect-error - Compatibility override: ExtractorRegistry.register uses a single argument
  override register(extractor: DocumentExtractor): void {
    // We use the constructor name as the key to satisfy BaseRegistry
    const name = extractor.constructor.name;

    // Maintain original behavior: allow multiple registrations by using a unique key
    // if constructor name is already present (though unlikely)
    let uniqueName = name;
    let counter = 1;
    while (this.has(uniqueName)) {
      uniqueName = `${name}_${counter++}`;
    }

    super.register(uniqueName, extractor);
  }

  /**
   * Get the appropriate extractor for a document type
   *
   * @param docType - Type of document to find extractor for
   * @returns Matching extractor or undefined if none found
   */
  getExtractor(docType: DocumentType): DocumentExtractor | undefined {
    return this.getAll().find((e) => e.supports(docType));
  }

  /**
   * Get all registered extractors
   *
   * @returns Array of all registered extractors
   */
  getAllExtractors(): DocumentExtractor[] {
    return this.getAll();
  }

  /**
   * Get extractors by overlay layer
   *
   * @param layer - Overlay layer identifier (e.g., 'O2', 'O4')
   * @returns Array of extractors targeting the specified layer
   */
  getExtractorsByLayer(layer: string): DocumentExtractor[] {
    return this.getAll().filter((e) => e.getOverlayLayer() === layer);
  }
}
