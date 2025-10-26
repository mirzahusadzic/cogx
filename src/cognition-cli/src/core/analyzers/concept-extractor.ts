import {
  MarkdownDocument,
  MarkdownSection,
} from '../parsers/markdown-parser.js';
import { MISSION_SECTIONS } from '../config/mission-sections.js';

/**
 * Represents a mission-critical concept extracted from documentation
 */
export interface MissionConcept {
  text: string; // The concept text
  section: string; // Which section it came from
  weight: number; // Importance score (0-1)
  occurrences: number; // How many times it appears
  sectionHash: string; // Structural hash of source section (provenance)
}

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
 * Extracts mission-critical concepts from markdown documentation
 * for strategic coherence analysis.
 *
 * SECURITY:
 * - Only processes whitelisted sections (Vision, Mission, Principles, etc.)
 * - Prevents malicious concept injection via arbitrary markdown
 *
 * EXTRACTION STRATEGY:
 * 1. Filter to whitelisted sections only
 * 2. Extract concepts from:
 *    - Emphasized text (**bold**, *italic*)
 *    - Quoted phrases
 *    - Important noun phrases (2-4 word sequences)
 * 3. Weight by:
 *    - Position: Earlier sections = higher weight
 *    - Frequency: More occurrences = higher weight
 * 4. Return ranked concepts
 */
export class ConceptExtractor {
  /**
   * Extract mission concepts from a markdown document
   */
  extract(doc: MarkdownDocument): MissionConcept[] {
    // 1. Filter to whitelisted sections only (security boundary)
    const missionSections = this.filterMissionSections(doc.sections);

    if (missionSections.length === 0) {
      return []; // No mission sections found
    }

    // 2. Extract raw concepts from all mission sections
    const conceptMap = new Map<string, MissionConcept>();

    missionSections.forEach((section, index) => {
      const concepts = this.extractFromSection(
        section,
        index,
        missionSections.length
      );

      // Merge concepts (accumulate occurrences, update weight)
      concepts.forEach((concept) => {
        const key = concept.text.toLowerCase();
        if (conceptMap.has(key)) {
          const existing = conceptMap.get(key)!;
          existing.occurrences += concept.occurrences;
          existing.weight = Math.max(existing.weight, concept.weight);
        } else {
          conceptMap.set(key, concept);
        }
      });
    });

    // 3. Sort by weight (descending) and return top concepts
    const concepts = Array.from(conceptMap.values());
    concepts.sort((a, b) => b.weight - a.weight);

    return concepts;
  }

  /**
   * Filter sections to only whitelisted mission sections
   * Recursively checks children as well
   */
  private filterMissionSections(
    sections: MarkdownSection[],
    depth = 0
  ): MarkdownSection[] {
    const filtered: MarkdownSection[] = [];

    for (const section of sections) {
      if (MISSION_SECTIONS.matches(section.heading)) {
        filtered.push(section);
      }

      // Recursively check children
      if (section.children && section.children.length > 0) {
        filtered.push(
          ...this.filterMissionSections(section.children, depth + 1)
        );
      }
    }

    return filtered;
  }

  /**
   * Extract concepts from a single section
   */
  private extractFromSection(
    section: MarkdownSection,
    sectionIndex: number,
    totalSections: number
  ): MissionConcept[] {
    const concepts: MissionConcept[] = [];
    const content = section.content;

    // Position weight: earlier sections are more important
    // First section = 1.0, last section = 0.6
    const positionWeight = 1.0 - (sectionIndex / totalSections) * 0.4;

    // Extract emphasized text (**bold**, *italic*)
    const emphasized = this.extractEmphasized(content);
    emphasized.forEach((text) => {
      concepts.push({
        text,
        section: section.heading,
        weight: positionWeight * 0.95, // High weight for emphasized
        occurrences: 1,
        sectionHash: section.structuralHash,
      });
    });

    // Extract quoted phrases
    const quoted = this.extractQuoted(content);
    quoted.forEach((text) => {
      concepts.push({
        text,
        section: section.heading,
        weight: positionWeight * 0.9, // High weight for quotes
        occurrences: 1,
        sectionHash: section.structuralHash,
      });
    });

    // Extract noun phrases (2-4 word sequences)
    const nounPhrases = this.extractNounPhrases(content);
    nounPhrases.forEach((text) => {
      concepts.push({
        text,
        section: section.heading,
        weight: positionWeight * 0.7, // Medium weight for noun phrases
        occurrences: 1,
        sectionHash: section.structuralHash,
      });
    });

    return concepts;
  }

  /**
   * Extract emphasized text (**bold**, *italic*)
   */
  private extractEmphasized(content: string): string[] {
    const emphasized: string[] = [];

    // Match **bold**
    const boldRegex = /\*\*([^*]+)\*\*/g;
    let match;
    while ((match = boldRegex.exec(content)) !== null) {
      const text = match[1].trim();
      if (this.isValidConcept(text)) {
        emphasized.push(text);
      }
    }

    // Match *italic*
    const italicRegex = /\*([^*]+)\*/g;
    while ((match = italicRegex.exec(content)) !== null) {
      const text = match[1].trim();
      if (this.isValidConcept(text)) {
        emphasized.push(text);
      }
    }

    return emphasized;
  }

  /**
   * Extract quoted phrases
   */
  private extractQuoted(content: string): string[] {
    const quoted: string[] = [];

    // Match "quoted text"
    const quoteRegex = /"([^"]+)"/g;
    let match;
    while ((match = quoteRegex.exec(content)) !== null) {
      const text = match[1].trim();
      if (this.isValidConcept(text)) {
        quoted.push(text);
      }
    }

    return quoted;
  }

  /**
   * Extract noun phrases (2-4 word sequences)
   * Simple heuristic: sequences of capitalized words or meaningful word pairs
   */
  private extractNounPhrases(content: string): string[] {
    const phrases: string[] = [];

    // Remove markdown formatting for cleaner extraction
    const cleanContent = content
      .replace(/\*\*([^*]+)\*\*/g, '$1') // Remove bold
      .replace(/\*([^*]+)\*/g, '$1') // Remove italic
      .replace(/`([^`]+)`/g, '$1') // Remove code
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1'); // Remove links

    // Extract 2-4 word phrases
    const words = cleanContent.split(/\s+/);

    for (let i = 0; i < words.length - 1; i++) {
      // Try 4-word phrases
      if (i + 3 < words.length) {
        const phrase = words.slice(i, i + 4).join(' ');
        if (this.isValidConcept(phrase)) {
          phrases.push(phrase);
        }
      }

      // Try 3-word phrases
      if (i + 2 < words.length) {
        const phrase = words.slice(i, i + 3).join(' ');
        if (this.isValidConcept(phrase)) {
          phrases.push(phrase);
        }
      }

      // Try 2-word phrases
      const phrase = words.slice(i, i + 2).join(' ');
      if (this.isValidConcept(phrase)) {
        phrases.push(phrase);
      }
    }

    // Deduplicate
    return Array.from(new Set(phrases));
  }

  /**
   * Check if a concept is valid (not too short, not all stop words)
   */
  private isValidConcept(text: string): boolean {
    // Must be at least 3 characters
    if (text.length < 3) {
      return false;
    }

    // Remove punctuation and normalize
    const cleaned = text.toLowerCase().replace(/[^\w\s]/g, '');
    const words = cleaned.split(/\s+/).filter((w) => w.length > 0);

    // Must have at least one word
    if (words.length === 0) {
      return false;
    }

    // At least one word must not be a stop word
    const hasNonStopWord = words.some((word) => !STOP_WORDS.has(word));

    return hasNonStopWord;
  }
}
