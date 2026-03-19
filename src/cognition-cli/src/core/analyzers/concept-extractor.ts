/**
 * Mission Concept Extraction
 *
 * Extracts strategic concepts from mission-critical documentation for O₄ (Mission) overlay.
 * Targets whitelisted sections (Vision, Mission, Principles, etc.) to build the strategic
 * knowledge layer that guides system behavior and architectural decisions.
 *
 * DESIGN RATIONALE:
 * - Extends BaseMarkdownExtractor for consistent traversal and weighting.
 * - Integrates strategic type inference (vision, mission, principle, goal, value).
 * - Implements security boundary via whitelisted sections (MISSION_SECTIONS).
 *
 * @example
 * const extractor = new ConceptExtractor();
 * const concepts = extractor.extract(missionDoc);
 * // Returns: [{ text: "Enable human agency", type: "vision", weight: 0.95, ... }, ...]
 */

import {
  MarkdownDocument,
  MarkdownSection,
} from '../parsers/markdown-parser.js';
import { MISSION_SECTIONS } from '../config/mission-sections.js';
import { DocumentType } from './document-classifier.js';
import {
  BaseMarkdownExtractor,
  StrategyKnowledge,
} from './document-extractor.js';

/**
 * Represents a mission-critical concept extracted from documentation.
 * Alias for StrategyKnowledge for backward compatibility and domain-specific naming.
 */
export type MissionConcept = StrategyKnowledge;

/**
 * Stop words to filter out during concept extraction
 * Common words that don't carry strategic meaning
 */
const STOP_WORDS = new Set([
  'the',
  'be',
  'to',
  'of',
  'and',
  'a',
  'in',
  'that',
  'have',
  'i',
  'it',
  'for',
  'not',
  'on',
  'with',
  'he',
  'as',
  'you',
  'do',
  'at',
  'this',
  'but',
  'his',
  'by',
  'from',
  'they',
  'we',
  'say',
  'her',
  'she',
  'or',
  'an',
  'will',
  'my',
  'one',
  'all',
  'would',
  'there',
  'their',
  'what',
  'so',
  'up',
  'out',
  'if',
  'about',
  'who',
  'get',
  'which',
  'go',
  'me',
  'when',
  'make',
  'can',
  'like',
  'time',
  'no',
  'just',
  'him',
  'know',
  'take',
  'people',
  'into',
  'year',
  'your',
  'good',
  'some',
  'could',
  'them',
  'see',
  'other',
  'than',
  'then',
  'now',
  'look',
  'only',
  'come',
  'its',
  'over',
  'think',
  'also',
  'back',
  'after',
  'use',
  'two',
  'how',
  'our',
  'work',
  'first',
  'well',
  'way',
  'even',
  'new',
  'want',
  'because',
  'any',
  'these',
  'give',
  'day',
  'most',
  'us',
  'is',
  'was',
  'are',
  'been',
  'has',
  'had',
  'were',
  'said',
  'did',
  'having',
  'may',
  'should',
]);

/**
 * ConceptExtractor
 *
 * Extracts mission-critical concepts from markdown documentation for strategic coherence
 * analysis. Targets O₄ (Mission) overlay - the strategic knowledge layer.
 *
 * OVERLAY TARGET: O₄ (Mission)
 */
export class ConceptExtractor extends BaseMarkdownExtractor<MissionConcept> {
  /**
   * Targets O₄ (Mission) overlay
   */
  getOverlayLayer(): string {
    return 'O4_Mission';
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
   * Extract mission concepts from a markdown document.
   * Overrides base extract to apply mission-specific section filtering (security boundary).
   */
  override extract(doc: MarkdownDocument): MissionConcept[] {
    // 1. Filter to whitelisted sections only (security boundary)
    const missionSections = this.filterMissionSections(doc.sections);

    if (missionSections.length === 0) {
      return [];
    }

    // 2. Use base extraction logic on filtered sections
    // Note: index/total will be relative to the filtered set, which matches original behavior
    const knowledge: MissionConcept[] = [];
    missionSections.forEach((section, index) => {
      knowledge.push(
        ...this.extractFromSectionRecursive(
          section,
          index,
          missionSections.length
        )
      );
    });

    // 3. Deduplicate by normalized text
    return this.deduplicateKnowledge(knowledge);
  }

  /**
   * Filter sections to only whitelisted mission sections
   *
   * Security boundary: Only processes sections matching MISSION_SECTIONS whitelist.
   * Recursively checks children to capture nested strategic content.
   */
  private filterMissionSections(
    sections: MarkdownSection[]
  ): MarkdownSection[] {
    const filtered: MarkdownSection[] = [];

    for (const section of sections) {
      if (MISSION_SECTIONS.matches(section.heading)) {
        filtered.push(section);
      }

      // Recursively check children
      if (section.children && section.children.length > 0) {
        filtered.push(...this.filterMissionSections(section.children));
      }
    }

    return filtered;
  }

  /**
   * Extract concepts from a single section.
   *
   * Applies hierarchical extraction patterns with position-based weighting.
   */
  protected extractFromSection(
    section: MarkdownSection,
    sectionIndex: number,
    totalSections: number
  ): MissionConcept[] {
    const concepts: MissionConcept[] = [];
    const content = section.content;
    const positionWeight = this.getPositionWeight(sectionIndex, totalSections);

    // 1. Extract blockquotes/epigraphs (highest signal)
    this.extractBlockquotes(content).forEach((text) => {
      concepts.push({
        text,
        section: section.heading,
        weight: positionWeight * 1.0,
        occurrences: 1,
        sectionHash: section.structuralHash,
        type: this.inferType(section.heading, text),
      });
    });

    // 2. Extract H3/H4 subsection headers (concepts as titles)
    this.extractSubHeaders(content).forEach((text) => {
      concepts.push({
        text,
        section: section.heading,
        weight: positionWeight * 0.95,
        occurrences: 1,
        sectionHash: section.structuralHash,
        type: this.inferType(section.heading, text),
      });
    });

    // Also check section.children for structured subsections (level 3 or 4)
    // These are often used as concept containers.
    if (section.children && section.children.length > 0) {
      section.children.forEach((child) => {
        if (child.level === 3 || child.level === 4) {
          const heading = child.heading.trim();
          const isNumberedHeading = /^\d+\.\s+/.test(heading);

          if (!isNumberedHeading && this.isValidConcept(heading)) {
            concepts.push({
              text: heading,
              section: section.heading,
              weight: positionWeight * 0.95,
              occurrences: 1,
              sectionHash: section.structuralHash,
              type: this.inferType(section.heading, heading),
            });
          }
        }
      });
    }

    // 3. Extract bullet points with bold prefix pattern
    this.extractBulletPrefixes(content).forEach((text) => {
      concepts.push({
        text,
        section: section.heading,
        weight: positionWeight * 0.9,
        occurrences: 1,
        sectionHash: section.structuralHash,
        type: this.inferType(section.heading, text),
      });
    });

    // 4. Extract standalone bold complete sentences
    this.extractBoldSentences(content).forEach((text) => {
      concepts.push({
        text,
        section: section.heading,
        weight: positionWeight * 0.85,
        occurrences: 1,
        sectionHash: section.structuralHash,
        type: this.inferType(section.heading, text),
      });
    });

    // 5. Extract emoji-prefixed items
    this.extractEmojiPrefixed(content).forEach((text) => {
      concepts.push({
        text,
        section: section.heading,
        weight: positionWeight * 0.8,
        occurrences: 1,
        sectionHash: section.structuralHash,
        type: this.inferType(section.heading, text),
      });
    });

    // 6. Extract quoted phrases (fallback)
    this.extractQuoted(content).forEach((text) => {
      concepts.push({
        text,
        section: section.heading,
        weight: positionWeight * 0.75,
        occurrences: 1,
        sectionHash: section.structuralHash,
        type: this.inferType(section.heading, text),
      });
    });

    return concepts;
  }

  /**
   * Infer concept type from section and text.
   * Migrated from StrategyExtractor to centralize strategic categorization.
   */
  private inferType(section: string, text: string): MissionConcept['type'] {
    const lower = (section + ' ' + text).toLowerCase();

    if (lower.includes('vision')) return 'vision';
    if (lower.includes('mission')) return 'mission';
    if (lower.includes('principle')) return 'principle';
    if (lower.includes('goal')) return 'goal';
    if (lower.includes('value')) return 'value';

    return 'concept';
  }

  /**
   * Extract blockquotes/epigraphs (> lines)
   */
  private extractBlockquotes(content: string): string[] {
    const blockquotes: string[] = [];
    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('>')) {
        const text = trimmed
          .substring(1)
          .trim()
          .replace(/^[_*]+|[_*]+$/g, '')
          .trim();

        if (this.isValidConcept(text) && text.length > 15) {
          blockquotes.push(text);
        }
      }
    }

    return blockquotes;
  }

  /**
   * Extract subsection headers (###)
   */
  private extractSubHeaders(content: string): string[] {
    const headers: string[] = [];
    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      const match = trimmed.match(/^###\s+(.+)$/);
      if (match) {
        const text = match[1].trim().replace(/^[#\s]+/, '');
        const isNumberedHeading = /^\d+\.\s+/.test(text);
        if (isNumberedHeading) {
          continue;
        }

        if (this.isValidConcept(text)) {
          headers.push(text);
        }
      }
    }

    return headers;
  }

  /**
   * Extract bullet points with bold prefix pattern
   */
  private extractBulletPrefixes(content: string): string[] {
    const concepts: string[] = [];
    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.match(/^[-*•]\s+/)) {
        const boldPrefixMatch = trimmed.match(
          /^[-*•]\s+\*\*([^*]+)\*\*(?:[,—]\s*(.+?))?$/
        );

        if (boldPrefixMatch) {
          const prefix = boldPrefixMatch[1].trim();
          const context = boldPrefixMatch[2]?.trim();

          if (context) {
            const contextSnippet = context.split(/[.!?]/)[0].trim();
            const combined = `${prefix}: ${contextSnippet}`;
            if (this.isValidConcept(combined) && combined.length > 10) {
              concepts.push(combined);
            }
          } else if (this.isValidConcept(prefix) && prefix.length > 5) {
            concepts.push(prefix);
          }
        }
      }
    }

    return concepts;
  }

  /**
   * Extract standalone bold complete sentences
   */
  private extractBoldSentences(content: string): string[] {
    const sentences: string[] = [];
    const sentenceRegex = /\*\*([^*]+[.!?])\*\*/g;
    let match;

    while ((match = sentenceRegex.exec(content)) !== null) {
      const text = match[1].trim();
      if (this.isValidConcept(text) && text.length >= 20) {
        sentences.push(text);
      }
    }

    return sentences;
  }

  /**
   * Extract emoji-prefixed items
   */
  private extractEmojiPrefixed(content: string): string[] {
    const items: string[] = [];
    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (
        !/^[-*•]?\s*[✅❌✓✗⚠🔥💡]/u.test(trimmed) &&
        !trimmed.includes('⚠️')
      ) {
        continue;
      }

      const emojiMatch = trimmed.match(/^[-*•]?\s*[^\s]+\s+(.+)$/u);
      if (emojiMatch) {
        let text = emojiMatch[1].trim();
        const boldMatch = text.match(/\*\*([^*]+)\*\*/);
        if (boldMatch) {
          const boldText = boldMatch[1];
          const afterBold = text
            .substring(text.indexOf(boldMatch[0]) + boldMatch[0].length)
            .trim();

          if (afterBold.startsWith('—')) {
            const explanation = afterBold.substring(1).trim();
            const snippet = explanation.split(/[.!?]/)[0].trim();

            if (snippet.length > 10) {
              text = `${boldText} — ${snippet}`;
            } else {
              text = boldText;
            }
          } else {
            text = boldText;
          }
        }

        if (this.isValidConcept(text) && text.length >= 10) {
          items.push(text);
        }
      }
    }

    return items;
  }

  /**
   * Extract quoted phrases
   */
  private extractQuoted(content: string): string[] {
    const quoted: string[] = [];
    const quoteRegex = /"([^"]+)"/g;
    let match;
    while ((match = quoteRegex.exec(content)) !== null) {
      const text = match[1].trim();

      if (text.endsWith('?')) {
        continue;
      }

      if (this.isValidConcept(text) && text.length >= 15) {
        quoted.push(text);
      }
    }

    return quoted;
  }

  /**
   * Check if a concept is valid (not too short, not all stop words)
   */
  private isValidConcept(text: string): boolean {
    if (text.length < 3) {
      return false;
    }

    const cleaned = text.toLowerCase().replace(/[^\w\s]/g, '');
    const words = cleaned.split(/\s+/).filter((w) => w.length > 0);

    if (words.length === 0) {
      return false;
    }

    return words.some((word) => !STOP_WORDS.has(word));
  }
}
