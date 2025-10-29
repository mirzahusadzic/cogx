import { MarkdownDocument } from '../parsers/markdown-parser.js';
import { DocumentType } from './document-classifier.js';
import { DocumentExtractor, StrategyKnowledge } from './document-extractor.js';
import { ConceptExtractor, MissionConcept } from './concept-extractor.js';

/**
 * StrategyExtractor
 *
 * Wraps the existing ConceptExtractor to fit the DocumentExtractor interface.
 * Extracts strategic concepts for O₄ (Mission) overlay.
 *
 * Handles: VISION.md, MISSION.md, strategic architecture docs
 */
export class StrategyExtractor implements DocumentExtractor<StrategyKnowledge> {
  private conceptExtractor: ConceptExtractor;

  constructor() {
    this.conceptExtractor = new ConceptExtractor();
  }

  /**
   * Extract strategic concepts from document
   */
  extract(doc: MarkdownDocument): StrategyKnowledge[] {
    // Use existing ConceptExtractor
    const concepts: MissionConcept[] = this.conceptExtractor.extract(doc);

    // Convert to StrategyKnowledge with category inference
    return concepts.map((concept) => ({
      ...concept,
      category: this.inferCategory(concept.section, concept.text),
    }));
  }

  /**
   * Supports strategic and architectural documents
   */
  supports(docType: DocumentType): boolean {
    return (
      docType === DocumentType.STRATEGIC ||
      docType === DocumentType.ARCHITECTURAL
    );
  }

  /**
   * Targets O₄ (Mission) overlay
   */
  getOverlayLayer(): string {
    return 'O4_Mission';
  }

  /**
   * Infer concept category from section and text
   */
  private inferCategory(
    section: string,
    text: string
  ): 'vision' | 'mission' | 'principle' | 'goal' | 'value' {
    const lower = (section + ' ' + text).toLowerCase();

    if (lower.includes('vision')) return 'vision';
    if (lower.includes('mission')) return 'mission';
    if (lower.includes('principle')) return 'principle';
    if (lower.includes('goal')) return 'goal';
    if (lower.includes('value')) return 'value';

    // Default to mission
    return 'mission';
  }
}
