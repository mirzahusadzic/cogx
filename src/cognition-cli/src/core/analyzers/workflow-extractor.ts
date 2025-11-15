/**
 * Operational Workflow Extraction
 *
 * Extracts operational patterns from workflow and process documentation for O₅ (Operational) overlay.
 * Captures quest structures, sacred sequences, depth rules, terminology, and formulas that
 * guide operational execution.
 *
 * OVERLAY TARGET: O₅ (Operational)
 *
 * EXTRACTION PATTERNS (by weight):
 * 1. Sacred sequences (1.0) - F.L.T.B invariant steps
 * 2. Quest structures (0.95) - What/Why/Success criteria
 * 3. Workflow patterns (0.9) - Depth tracking, rebalancing
 * 4. Formulas/metrics (0.9) - AQS calculation, depth levels
 * 5. Explanatory content (0.85) - Purpose statements, definitions
 * 6. Depth rules (0.85) - Depth 0/1/2 semantics
 * 7. Terminology (0.8) - Quest, oracle, scribe, AQS
 *
 * @example
 * const extractor = new WorkflowExtractor();
 * const patterns = extractor.extract(operationalDoc);
 * // Returns: [{ text: "F.L.T.B Sacred Sequence", patternType: "sacred_sequence", ... }, ...]
 */

import {
  MarkdownDocument,
  MarkdownSection,
} from '../parsers/markdown-parser.js';
import { DocumentType } from './document-classifier.js';
import {
  DocumentExtractor,
  OperationalKnowledge,
} from './document-extractor.js';

/**
 * WorkflowExtractor
 *
 * Extracts operational patterns from workflow/process documents.
 * Targets O₅ (Operational) overlay for procedural knowledge.
 *
 * PATTERN TYPES:
 * - quest_structure: What/Why/Success patterns
 * - sacred_sequence: Invariant step sequences (F.L.T.B)
 * - workflow_pattern: Process guidance (depth, rebalancing)
 * - depth_rule: Depth-specific semantics
 * - terminology: Domain-specific vocabulary
 * - explanation: Conceptual documentation
 *
 * @example
 * const extractor = new WorkflowExtractor();
 * const patterns = extractor.extract(workflowDoc);
 * const sequences = patterns.filter(p => p.patternType === 'sacred_sequence');
 */
export class WorkflowExtractor
  implements DocumentExtractor<OperationalKnowledge>
{
  /**
   * Extract operational patterns from document
   *
   * Flattens nested sections and extracts patterns from each section
   * with position-based weighting.
   *
   * @param doc - Parsed markdown document
   * @returns Array of operational knowledge patterns
   *
   * @example
   * const doc = parser.parse(operationalMd);
   * const patterns = extractor.extract(doc);
   * console.log(patterns.find(p => p.text.includes('F.L.T.B')));
   */
  extract(doc: MarkdownDocument): OperationalKnowledge[] {
    const patterns: OperationalKnowledge[] = [];

    // Extract from all sections (including nested)
    const allSections = this.flattenSections(doc.sections);
    allSections.forEach((section, index) => {
      patterns.push(
        ...this.extractFromSection(section, index, allSections.length)
      );
    });

    return patterns;
  }

  /**
   * Flatten nested sections into a single array
   *
   * Recursively traverses section hierarchy to create a flat list
   * for sequential processing.
   *
   * @private
   * @param sections - Array of sections (possibly nested)
   * @returns Flattened array of all sections
   */
  private flattenSections(sections: MarkdownSection[]): MarkdownSection[] {
    const flattened: MarkdownSection[] = [];

    for (const section of sections) {
      flattened.push(section);
      if (section.children && section.children.length > 0) {
        flattened.push(...this.flattenSections(section.children));
      }
    }

    return flattened;
  }

  /**
   * Supports operational documents
   *
   * @param docType - Document type to check
   * @returns True if document type is OPERATIONAL
   */
  supports(docType: DocumentType): boolean {
    return docType === DocumentType.OPERATIONAL;
  }

  /**
   * Targets O₅ (Operational) overlay
   *
   * @returns Overlay layer identifier "O5_Operational"
   */
  getOverlayLayer(): string {
    return 'O5_Operational';
  }

  /**
   * Extract patterns from a single section
   *
   * Applies all extraction patterns (quest structures, sacred sequences,
   * workflow patterns, depth rules, terminology, formulas, explanations)
   * with position-based weighting.
   *
   * @private
   * @param section - Section to extract from
   * @param sectionIndex - Position in flattened array
   * @param totalSections - Total number of sections
   * @returns Array of extracted operational patterns
   */
  private extractFromSection(
    section: MarkdownSection,
    sectionIndex: number,
    totalSections: number
  ): OperationalKnowledge[] {
    const patterns: OperationalKnowledge[] = [];
    const content = section.content;

    // Position weight
    const positionWeight = 1.0 - (sectionIndex / totalSections) * 0.4;

    // 1. Extract quest structure patterns (What/Why/Success)
    const questPatterns = this.extractQuestPatterns(content);
    questPatterns.forEach((text) => {
      patterns.push({
        text,
        section: section.heading,
        weight: positionWeight * 0.95,
        occurrences: 1,
        sectionHash: section.structuralHash,
        patternType: 'quest_structure',
      });
    });

    // 2. Extract sacred sequences
    const sacredSequences = this.extractSacredSequences(content);
    sacredSequences.forEach(({ text, steps }) => {
      patterns.push({
        text,
        section: section.heading,
        weight: positionWeight * 1.0, // Highest - invariants
        occurrences: 1,
        sectionHash: section.structuralHash,
        patternType: 'sacred_sequence',
        metadata: { steps },
      });
    });

    // 3. Extract workflow patterns (depth, rebalancing, etc.)
    const workflowPatterns = this.extractWorkflowPatterns(content);
    workflowPatterns.forEach((text) => {
      patterns.push({
        text,
        section: section.heading,
        weight: positionWeight * 0.9,
        occurrences: 1,
        sectionHash: section.structuralHash,
        patternType: 'workflow_pattern',
      });
    });

    // 4. Extract depth rules
    const depthRules = this.extractDepthRules(content);
    depthRules.forEach((text) => {
      patterns.push({
        text,
        section: section.heading,
        weight: positionWeight * 0.85,
        occurrences: 1,
        sectionHash: section.structuralHash,
        patternType: 'depth_rule',
      });
    });

    // 5. Extract terminology definitions
    const terminology = this.extractTerminology(content, section.heading);
    terminology.forEach(({ text, definition }) => {
      patterns.push({
        text,
        section: section.heading,
        weight: positionWeight * 0.8,
        occurrences: 1,
        sectionHash: section.structuralHash,
        patternType: 'terminology',
        metadata: { example: definition },
      });
    });

    // 6. Extract formulas/metrics (AQS, etc.)
    const formulas = this.extractFormulas(content);
    formulas.forEach(({ text, formula }) => {
      patterns.push({
        text,
        section: section.heading,
        weight: positionWeight * 0.9,
        occurrences: 1,
        sectionHash: section.structuralHash,
        patternType: 'workflow_pattern',
        metadata: { formula },
      });
    });

    // 7. Extract explanatory paragraphs (NEW: for documentation/reference manuals)
    const explanations = this.extractExplanatoryParagraphs(
      content,
      section.heading
    );
    explanations.forEach((text) => {
      patterns.push({
        text,
        section: section.heading,
        weight: positionWeight * 0.85,
        occurrences: 1,
        sectionHash: section.structuralHash,
        patternType: 'explanation',
      });
    });

    return patterns;
  }

  /**
   * Extract quest structure patterns
   *
   * Identifies bold text matching quest patterns: What/Why/Success/Big Blocks/Eyes Go.
   * These represent the structural elements of operational quests.
   *
   * @private
   * @param content - Section content to extract from
   * @returns Array of quest pattern text
   */
  private extractQuestPatterns(content: string): string[] {
    const patterns: string[] = [];
    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();

      // Match bold questions or structure markers
      const questMatch = trimmed.match(
        /\*\*(What|Why|Success|Big Blocks|Eyes Go)[^*]*\*\*/i
      );
      if (questMatch) {
        patterns.push(questMatch[0].replace(/\*\*/g, ''));
      }
    }

    return patterns;
  }

  /**
   * Extract sacred sequences (step-by-step invariants)
   *
   * Identifies F.L.T.B (Format, Lint, Test, Build) patterns - the
   * invariant sequences that must be preserved across operations.
   *
   * @private
   * @param content - Section content to extract from
   * @returns Array of sacred sequence objects with steps
   */
  private extractSacredSequences(
    content: string
  ): Array<{ text: string; steps: string[] }> {
    const sequences: Array<{ text: string; steps: string[] }> = [];

    // Look for F.L.T.B pattern
    if (content.includes('F.L.T.B')) {
      const steps = [];
      const lines = content.split('\n');
      let inSequence = false;

      for (const line of lines) {
        const trimmed = line.trim();

        // Start of sequence
        if (trimmed.match(/^\d+\.\s+\*\*(Format|Lint|Test|Build)\*\*/)) {
          inSequence = true;
          const stepMatch = trimmed.match(/\*\*([^*]+)\*\*/);
          if (stepMatch) {
            steps.push(stepMatch[1]);
          }
        } else if (inSequence && !trimmed.match(/^\d+\./)) {
          inSequence = false;
        }
      }

      if (steps.length > 0) {
        sequences.push({
          text: 'F.L.T.B Sacred Sequence',
          steps,
        });
      }
    }

    return sequences;
  }

  /**
   * Extract workflow patterns
   *
   * Identifies bold complete sentences that describe workflow patterns.
   * Filters for workflow-related keywords (depth, rebalancing, quest, etc.)
   *
   * @private
   * @param content - Section content to extract from
   * @returns Array of workflow pattern text
   */
  private extractWorkflowPatterns(content: string): string[] {
    const patterns: string[] = [];

    // Match bold complete sentences
    const sentenceRegex = /\*\*([^*]+[.!])\*\*/g;
    let match;

    while ((match = sentenceRegex.exec(content)) !== null) {
      const text = match[1].trim();
      if (this.isWorkflowPattern(text)) {
        patterns.push(text);
      }
    }

    return patterns;
  }

  /**
   * Check if text describes a workflow pattern
   *
   * Tests for workflow-related keywords to filter operational guidance.
   *
   * @private
   * @param text - Text to check
   * @returns True if text contains workflow keywords
   */
  private isWorkflowPattern(text: string): boolean {
    const workflowKeywords = [
      'depth',
      'rebalancing',
      'blocking',
      'refinement',
      'quest',
      'oracle',
      'scribe',
      'commit',
      'stage',
    ];

    return workflowKeywords.some((keyword) =>
      text.toLowerCase().includes(keyword)
    );
  }

  /**
   * Extract depth rules
   *
   * Pattern: "Depth 0:", "Depth 1:", "Depth 2:", etc.
   * Captures depth-specific operational semantics.
   *
   * @private
   * @param content - Section content to extract from
   * @returns Array of depth rule text
   */
  private extractDepthRules(content: string): string[] {
    const rules: string[] = [];
    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();

      // Match depth rules
      const depthMatch = trimmed.match(/^Depth \d+:\s*(.+)$/);
      if (depthMatch) {
        rules.push(trimmed);
      }
    }

    return rules;
  }

  /**
   * Extract terminology definitions
   *
   * Pattern: **Term** - Definition
   * Only extracts from "Terminology" or "Purpose" sections to avoid noise.
   *
   * @private
   * @param content - Section content to extract from
   * @param sectionHeading - Section heading to filter by
   * @returns Array of terminology objects with definitions
   */
  private extractTerminology(
    content: string,
    sectionHeading: string
  ): Array<{ text: string; definition: string }> {
    const terms: Array<{ text: string; definition: string }> = [];

    // Only extract from "Terminology" or "Purpose" sections
    if (
      !sectionHeading.toLowerCase().includes('terminology') &&
      !sectionHeading.toLowerCase().includes('purpose')
    ) {
      return terms;
    }

    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();

      // Match: **Term** - Definition
      const termMatch = trimmed.match(/^\*\*([^*]+)\*\*\s*[-—]\s*(.+)$/);
      if (termMatch) {
        terms.push({
          text: termMatch[1].trim(),
          definition: termMatch[2].trim(),
        });
      }
    }

    return terms;
  }

  /**
   * Extract formulas (AQS, calculations)
   *
   * Identifies formulas and metrics like AQS (Agentic Quality Score).
   * Looks for equation patterns in content.
   *
   * @private
   * @param content - Section content to extract from
   * @returns Array of formula objects with formula text
   */
  private extractFormulas(
    content: string
  ): Array<{ text: string; formula: string }> {
    const formulas: Array<{ text: string; formula: string }> = [];

    // Look for AQS formula
    const aqsMatch = content.match(/AQS\s*=\s*([^\n]+)/);
    if (aqsMatch) {
      formulas.push({
        text: 'Agentic Quality Score (AQS)',
        formula: aqsMatch[0],
      });
    }

    return formulas;
  }

  /**
   * Extract explanatory paragraphs from documentation
   *
   * For operational documentation like CLI manuals, we need to extract
   * substantial explanatory content, not just pattern fragments.
   *
   * This method extracts:
   * - "What is X?" section content
   * - Overlay-tagged content (O4-MISSION:, O5-DEPENDENCIES:, etc.)
   * - Purpose/why statements (PURPOSE:, ENABLES:, etc.)
   * - Paragraphs with concept indicators (is the, enables, provides)
   * - Definition-style content ("X is Y" patterns)
   *
   * @private
   * @param content - Section content to extract from
   * @param heading - Section heading for context
   * @returns Array of explanatory paragraph text (max 20)
   */
  private extractExplanatoryParagraphs(
    content: string,
    heading: string
  ): string[] {
    const explanations: string[] = [];

    // 1. Check if this section is a "What is X?" heading - if so, extract all content
    const whatIsPattern = /What is ([^?]+)\?/i;
    const whatIsMatch = heading.match(whatIsPattern);
    if (whatIsMatch) {
      // Extract paragraphs from this section's content
      const paragraphs = content.split('\n\n').slice(0, 5); // First 5 paragraphs
      for (const para of paragraphs) {
        const cleaned = para
          .replace(/\*\*/g, '')
          .replace(/`/g, '')
          .replace(/\n/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();

        if (cleaned.length > 50 && cleaned.length < 2000) {
          explanations.push(cleaned);
        }
      }
    }

    // 2. Extract overlay-tagged content (O4-MISSION:, O5-DEPENDENCIES:, etc.)
    const overlayTagPattern = /\*\*O[1-7]-[A-Z]+:\s*([^*]+)\*\*/g;
    let overlayMatch;
    while ((overlayMatch = overlayTagPattern.exec(content)) !== null) {
      const text = overlayMatch[1].trim();
      if (text.length > 50) {
        explanations.push(
          `${overlayMatch[0].replace(/\*\*/g, '').split(':')[0]}: ${text}`
        );
      }
    }

    // 2. Extract purpose statements (lines starting with PURPOSE:, ENABLES:, etc.)
    const purposePattern =
      /^(PURPOSE|ENABLES DOWNSTREAM OPERATIONS|KEY PRINCIPLE|WHAT GENESIS DOES|WHAT IT DOES|BEHAVIOR|IMPLEMENTATION|DETAILED PURPOSE|KEY PROPERTIES|CORE INNOVATION|EXECUTIVE SUMMARY):\s*$/gm;
    const purposeMatches = Array.from(content.matchAll(purposePattern));

    for (const match of purposeMatches) {
      const startIdx = match.index! + match[0].length;
      // Get next few lines after the header
      const restOfContent = content.substring(startIdx);
      const nextSection = restOfContent.split('\n##')[0]; // Until next heading
      const lines = nextSection.split('\n').slice(0, 10); // Max 10 lines

      let paragraph = '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('-') || trimmed.startsWith('*')) {
          // List item
          if (trimmed.length > 50) {
            explanations.push(trimmed.replace(/^[*-]\s*/, ''));
          }
        } else if (trimmed.length > 50 && !trimmed.startsWith('#')) {
          // Regular paragraph
          paragraph += trimmed + ' ';
          if (trimmed.endsWith('.') || trimmed.endsWith(':')) {
            explanations.push(paragraph.trim());
            paragraph = '';
          }
        }
      }
      if (paragraph.trim().length > 50) {
        explanations.push(paragraph.trim());
      }
    }

    // 3. Extract paragraphs with key concept indicators
    // Generic patterns for operational/reference documentation
    const conceptIndicators = [
      'is the',
      'is a',
      'enables',
      'provides',
      'allows',
      'ensures',
      'guarantees',
    ];

    const paragraphs = content.split('\n\n');
    for (const para of paragraphs) {
      const lowerPara = para.toLowerCase();
      const hasConceptIndicator = conceptIndicators.some((indicator) =>
        lowerPara.includes(indicator)
      );

      if (hasConceptIndicator) {
        // Clean up markdown formatting
        const cleaned = para
          .replace(/\*\*/g, '') // Remove bold
          .replace(/`/g, '') // Remove code formatting
          .replace(/\n/g, ' ') // Join lines
          .replace(/\s+/g, ' ') // Normalize whitespace
          .trim();

        if (cleaned.length > 50 && cleaned.length < 2000) {
          explanations.push(cleaned);
        }
      }
    }

    // 4. Extract definition-style content ("X is Y" patterns)
    const definitionPattern =
      /([A-Z][A-Za-z\s]+)\s+is\s+(the\s+)?([^.]{20,200}\.)/g;
    let defMatch;
    while ((defMatch = definitionPattern.exec(content)) !== null) {
      const fullMatch = defMatch[0].trim();
      if (fullMatch.length > 50 && !fullMatch.includes('\n')) {
        explanations.push(fullMatch);
      }
    }

    // Deduplicate and limit
    const unique = [...new Set(explanations)];
    return unique.slice(0, 20); // Max 20 explanations per section
  }
}
