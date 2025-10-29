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
  embedding?: number[]; // 768-dimensional vector from eGemma (optional for testing)
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

    // 1. Extract blockquotes/epigraphs (highest signal)
    const blockquotes = this.extractBlockquotes(content);
    blockquotes.forEach((text) => {
      concepts.push({
        text,
        section: section.heading,
        weight: positionWeight * 1.0, // Highest weight - distilled essence
        occurrences: 1,
        sectionHash: section.structuralHash,
      });
    });

    // 2. Extract H3/H4 subsection headers (concepts as titles)
    // Use section.children to get actual subsection headings from the tree
    if (section.children && section.children.length > 0) {
      section.children.forEach((child) => {
        if (child.level === 3 || child.level === 4) {
          const text = child.heading.trim();
          if (this.isValidConcept(text)) {
            concepts.push({
              text,
              section: section.heading,
              weight: positionWeight * 0.95, // Very high - named concepts
              occurrences: 1,
              sectionHash: section.structuralHash,
            });
          }
        }
      });
    }

    // 3. Extract bullet points with bold prefix pattern
    const bulletConcepts = this.extractBulletPrefixes(content);
    bulletConcepts.forEach((text) => {
      concepts.push({
        text,
        section: section.heading,
        weight: positionWeight * 0.9, // High - structured value props
        occurrences: 1,
        sectionHash: section.structuralHash,
      });
    });

    // 4. Extract standalone bold complete sentences
    const boldSentences = this.extractBoldSentences(content);
    boldSentences.forEach((text) => {
      concepts.push({
        text,
        section: section.heading,
        weight: positionWeight * 0.85, // High - complete thoughts
        occurrences: 1,
        sectionHash: section.structuralHash,
      });
    });

    // 5. Extract emoji-prefixed items
    const emojiItems = this.extractEmojiPrefixed(content);
    emojiItems.forEach((text) => {
      concepts.push({
        text,
        section: section.heading,
        weight: positionWeight * 0.8, // Good - structured lists
        occurrences: 1,
        sectionHash: section.structuralHash,
      });
    });

    // 6. Extract quoted phrases (fallback)
    const quoted = this.extractQuoted(content);
    quoted.forEach((text) => {
      concepts.push({
        text,
        section: section.heading,
        weight: positionWeight * 0.75, // Medium - may be examples
        occurrences: 1,
        sectionHash: section.structuralHash,
      });
    });

    return concepts;
  }

  /**
   * Extract blockquotes/epigraphs (> lines)
   * These are typically distilled essence statements
   */
  private extractBlockquotes(content: string): string[] {
    const blockquotes: string[] = [];
    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('>')) {
        // Remove > and surrounding _ or * formatting
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
   * Extract subsection headers (### or ####)
   * These are named concepts in the document structure
   */
  private extractSubHeaders(content: string): string[] {
    const headers: string[] = [];
    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      // Match ### or #### headers (but not ## or #)
      const match = trimmed.match(/^###\s+(.+)$/);
      if (match) {
        const text = match[1].trim().replace(/^[#\s]+/, '');
        if (this.isValidConcept(text)) {
          headers.push(text);
        }
      }
    }

    return headers;
  }

  /**
   * Extract bullet points with bold prefix pattern
   * Pattern: - **prefix**, rest of text
   * Or: - **complete bold statement**
   */
  private extractBulletPrefixes(content: string): string[] {
    const concepts: string[] = [];
    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      // Match bullet/dash lines with bold content
      if (trimmed.match(/^[-*•]\s+/)) {
        // Extract bold prefix + context (up to comma, em dash, or end)
        const boldPrefixMatch = trimmed.match(
          /^[-*•]\s+\*\*([^*]+)\*\*(?:[,—]\s*(.+?))?$/
        );

        if (boldPrefixMatch) {
          const prefix = boldPrefixMatch[1].trim();
          const context = boldPrefixMatch[2]?.trim();

          // If there's context, combine prefix + first part of context
          if (context) {
            const contextSnippet = context.split(/[.!?]/)[0].trim();
            const combined = `${prefix}: ${contextSnippet}`;
            if (this.isValidConcept(combined) && combined.length > 10) {
              concepts.push(combined);
            }
          } else if (this.isValidConcept(prefix) && prefix.length > 5) {
            // Just the bold prefix if it's meaningful
            concepts.push(prefix);
          }
        }
      }
    }

    return concepts;
  }

  /**
   * Extract standalone bold sentences (complete thoughts)
   * Must be a complete sentence (ends with punctuation) and substantial
   */
  private extractBoldSentences(content: string): string[] {
    const sentences: string[] = [];

    // Match **text that ends with punctuation**
    const sentenceRegex = /\*\*([^*]+[.!?])\*\*/g;
    let match;

    while ((match = sentenceRegex.exec(content)) !== null) {
      const text = match[1].trim();
      // Must be a complete sentence (at least 20 chars, ends with punctuation)
      if (this.isValidConcept(text) && text.length >= 20) {
        sentences.push(text);
      }
    }

    return sentences;
  }

  /**
   * Extract emoji-prefixed items
   * Pattern: ✅ or ❌ followed by text
   * Captures bold prefix + context for compound value props
   */
  private extractEmojiPrefixed(content: string): string[] {
    const items: string[] = [];
    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      // Match lines starting with common list emojis
      // Using test for emoji presence then capturing the rest
      if (
        !/^[-*•]?\s*[✅❌✓✗⚠🔥💡]/u.test(trimmed) &&
        !trimmed.includes('⚠️')
      ) {
        continue;
      }

      const emojiMatch = trimmed.match(/^[-*•]?\s*[^\s]+\s+(.+)$/u);
      if (emojiMatch) {
        let text = emojiMatch[1].trim();

        // If it contains bold, extract the bold part + meaningful context
        const boldMatch = text.match(/\*\*([^*]+)\*\*/);
        if (boldMatch) {
          const boldText = boldMatch[1];

          // Check for em-dash separator (—)
          const afterBold = text
            .substring(text.indexOf(boldMatch[0]) + boldMatch[0].length)
            .trim();

          if (afterBold.startsWith('—')) {
            // Has explanation after em-dash, extract first meaningful part
            const explanation = afterBold.substring(1).trim();
            const snippet = explanation.split(/[.!?]/)[0].trim();

            if (snippet.length > 10) {
              text = `${boldText} — ${snippet}`;
            } else {
              text = boldText;
            }
          } else {
            // No em-dash, just use bold text
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
   * Skip questions and very short quotes (likely examples, not concepts)
   */
  private extractQuoted(content: string): string[] {
    const quoted: string[] = [];

    // Match "quoted text"
    const quoteRegex = /"([^"]+)"/g;
    let match;
    while ((match = quoteRegex.exec(content)) !== null) {
      const text = match[1].trim();

      // Skip questions (examples, not concepts)
      if (text.endsWith('?')) {
        continue;
      }

      // Must be substantial (at least 15 chars)
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
