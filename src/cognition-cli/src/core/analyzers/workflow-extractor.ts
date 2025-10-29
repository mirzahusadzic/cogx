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
 * Targets O₅ (Operational) overlay.
 *
 * Handles: OPERATIONAL_LATTICE.md, workflow guides, process documentation
 *
 * EXTRACTION PATTERNS:
 * 1. Quest structures (What/Why/Success criteria)
 * 2. Sacred sequences (F.L.T.B, invariant steps)
 * 3. Workflow patterns (depth tracking, rebalancing)
 * 4. Terminology (quest, oracle, scribe, AQS)
 * 5. Formulas/metrics (AQS calculation, depth levels)
 */
export class WorkflowExtractor
  implements DocumentExtractor<OperationalKnowledge>
{
  /**
   * Extract operational patterns from document
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
   */
  supports(docType: DocumentType): boolean {
    return docType === DocumentType.OPERATIONAL;
  }

  /**
   * Targets O₅ (Operational) overlay
   */
  getOverlayLayer(): string {
    return 'O5_Operational';
  }

  /**
   * Extract patterns from a single section
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

    return patterns;
  }

  /**
   * Extract quest structure patterns
   * Pattern: **What is...?**, **Why...?**, **Success criteria:**
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
   * Pattern: Numbered lists in "Sacred Sequence" sections
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
   * Pattern: Bold statements about process
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
   * Pattern: "Depth 0:", "Depth 1:", etc.
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
   * Pattern: **Term** - Definition
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
   * Pattern: Code blocks or explicit formula markers
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
}
