/**
 * Strategic Knowledge Extraction
 *
 * Extracts strategic concepts from vision and mission documentation for O₄ (Mission) overlay.
 * This is a wrapper around ConceptExtractor that adds category inference
 * (vision/mission/principle/goal/value) to enable strategic pattern matching.
 *
 * OVERLAY TARGET: O₄ (Mission)
 *
 * CATEGORIES:
 * - vision: High-level aspirational statements
 * - mission: Core purpose and objectives
 * - principle: Guiding rules and values
 * - goal: Specific targets and outcomes
 * - value: Fundamental beliefs
 *
 * @example
 * const extractor = new StrategyExtractor();
 * const knowledge = extractor.extract(visionDoc);
 * // Returns: [{ text: "Enable human agency", category: "mission", weight: 0.95, ... }, ...]
 */

import { MarkdownDocument } from '../parsers/markdown-parser.js';
import { DocumentType } from './document-classifier.js';
import { DocumentExtractor, StrategyKnowledge } from './document-extractor.js';
import { ConceptExtractor, MissionConcept } from './concept-extractor.js';

/**
 * StrategyExtractor
 *
 * Wraps ConceptExtractor to add strategic category inference.
 * Targets O₄ (Mission) overlay for vision, mission, and architectural documents.
 *
 * STRATEGY:
 * 1. Extract concepts using ConceptExtractor
 * 2. Infer category from section heading and concept text
 * 3. Return categorized strategic knowledge
 *
 * @example
 * const extractor = new StrategyExtractor();
 * const knowledge = extractor.extract(missionDoc);
 * const principles = knowledge.filter(k => k.category === 'principle');
 */
export class StrategyExtractor implements DocumentExtractor<StrategyKnowledge> {
  private conceptExtractor: ConceptExtractor;

  constructor() {
    this.conceptExtractor = new ConceptExtractor();
  }

  /**
   * Extract strategic concepts from document
   *
   * Uses ConceptExtractor internally, then adds category inference.
   *
   * @param doc - Parsed markdown document
   * @returns Array of strategic knowledge with categories
   *
   * @example
   * const doc = parser.parse(visionMd);
   * const knowledge = extractor.extract(doc);
   * console.log(knowledge[0].category); // "vision"
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
   *
   * @param docType - Document type to check
   * @returns True if document is STRATEGIC or ARCHITECTURAL
   */
  supports(docType: DocumentType): boolean {
    return (
      docType === DocumentType.STRATEGIC ||
      docType === DocumentType.ARCHITECTURAL
    );
  }

  /**
   * Targets O₄ (Mission) overlay
   *
   * @returns Overlay layer identifier "O4_Mission"
   */
  getOverlayLayer(): string {
    return 'O4_Mission';
  }

  /**
   * Infer concept category from section and text
   *
   * Uses keyword matching to categorize concepts as vision, mission,
   * principle, goal, or value. Defaults to "mission" if no match.
   *
   * @private
   * @param section - Section heading where concept was found
   * @param text - Concept text
   * @returns Inferred category
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
