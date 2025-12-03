/**
 * Mathematical Proof Extraction
 *
 * Extracts mathematical statements and proofs from formal documentation for O₆ (Mathematical) overlay.
 * This is Echo's domain - enabling formal reasoning about system properties, correctness proofs,
 * and theoretical foundations.
 *
 * OVERLAY TARGET: O₆ (Mathematical)
 *
 * EXTRACTION PATTERNS (by weight):
 * 1. Theorems (1.0) - Formal statements with proofs
 * 2. Axioms (1.0) - Foundational truths
 * 3. Lemmas (0.95) - Supporting propositions
 * 4. Invariants (0.95) - Properties that hold throughout execution
 * 5. Complexity (0.9) - Time/space complexity bounds
 * 6. Proofs (0.9) - Step-by-step derivations
 * 7. Identities (0.85) - Mathematical equalities and invariants
 *
 * SUPPORTED FORMATS:
 * - **THEOREM**: Statement (uppercase, colon outside bold)
 * - **Theorem N:** Statement (numbered, colon inside bold)
 * - THEOREM: Statement (plain uppercase in comments)
 *
 * @example
 * const extractor = new ProofExtractor();
 * const knowledge = extractor.extract(mathDoc);
 * // Returns theorems, lemmas, axioms, invariants, complexity bounds, proofs, identities
 */

import {
  MarkdownDocument,
  MarkdownSection,
} from '../parsers/markdown-parser.js';
import { DocumentType } from './document-classifier.js';
import {
  DocumentExtractor,
  MathematicalKnowledge,
} from './document-extractor.js';

/**
 * ProofExtractor
 *
 * Extracts mathematical statements from formal documentation.
 * Targets O₆ (Mathematical) overlay - Echo's domain.
 *
 * STATEMENT TYPES:
 * - theorem: Formal statements with proofs
 * - lemma: Supporting propositions
 * - axiom: Foundational truths
 * - invariant: Properties that hold throughout execution
 * - complexity: Time/space complexity bounds
 * - proof: Step-by-step derivations
 * - identity: Mathematical equalities and invariants
 *
 * @example
 * const extractor = new ProofExtractor();
 * const knowledge = extractor.extract(proofsDoc);
 * const theorems = knowledge.filter(k => k.statementType === 'theorem');
 */
export class ProofExtractor implements DocumentExtractor<MathematicalKnowledge> {
  /**
   * Extract mathematical knowledge from document
   *
   * Recursively processes all sections to extract theorems, lemmas,
   * axioms, invariants, complexity bounds, proofs, and identities.
   *
   * @param doc - Parsed markdown document
   * @returns Array of mathematical knowledge items
   */
  extract(doc: MarkdownDocument): MathematicalKnowledge[] {
    const knowledge: MathematicalKnowledge[] = [];

    // Extract from each section (recursively including children)
    doc.sections.forEach((section, index) => {
      knowledge.push(
        ...this.extractFromSectionRecursive(section, index, doc.sections.length)
      );
    });

    return knowledge;
  }

  /**
   * Recursively extract from section and all its children
   */
  private extractFromSectionRecursive(
    section: MarkdownSection,
    sectionIndex: number,
    totalSections: number
  ): MathematicalKnowledge[] {
    const knowledge: MathematicalKnowledge[] = [];

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
   * Supports mathematical documents
   */
  supports(docType: DocumentType): boolean {
    return docType === DocumentType.MATHEMATICAL;
  }

  /**
   * Targets O₆ (Mathematical) overlay
   */
  getOverlayLayer(): string {
    return 'O6_Mathematical';
  }

  /**
   * Extract mathematical knowledge from a single section
   */
  private extractFromSection(
    section: MarkdownSection,
    sectionIndex: number,
    totalSections: number
  ): MathematicalKnowledge[] {
    const knowledge: MathematicalKnowledge[] = [];
    const content = section.content;
    const heading = section.heading.toLowerCase();

    // Position weight
    const positionWeight = 1.0 - (sectionIndex / totalSections) * 0.4;

    // 1. Extract theorems (from theorem sections or inline)
    if (heading.includes('theorem')) {
      const theorems = this.extractTheorems(content);
      theorems.forEach((theorem) => {
        knowledge.push({
          ...theorem,
          section: section.heading,
          sectionHash: section.structuralHash,
          weight: positionWeight * 1.0,
          occurrences: 1,
          statementType: 'theorem',
        });
      });
    }

    // 2. Extract lemmas
    if (heading.includes('lemma')) {
      const lemmas = this.extractLemmas(content);
      lemmas.forEach((lemma) => {
        knowledge.push({
          ...lemma,
          section: section.heading,
          sectionHash: section.structuralHash,
          weight: positionWeight * 0.95,
          occurrences: 1,
          statementType: 'lemma',
        });
      });
    }

    // 3. Extract axioms
    if (heading.includes('axiom')) {
      const axioms = this.extractAxioms(content);
      axioms.forEach((axiom) => {
        knowledge.push({
          ...axiom,
          section: section.heading,
          sectionHash: section.structuralHash,
          weight: positionWeight * 1.0,
          occurrences: 1,
          statementType: 'axiom',
        });
      });
    }

    // 4. Extract invariants (NEW)
    if (heading.includes('invariant')) {
      const invariants = this.extractInvariants(content);
      invariants.forEach((invariant) => {
        knowledge.push({
          ...invariant,
          section: section.heading,
          sectionHash: section.structuralHash,
          weight: positionWeight * 0.95,
          occurrences: 1,
          statementType: 'invariant',
        });
      });
    }

    // 5. Extract complexity bounds (NEW)
    if (heading.includes('complexity') || heading.includes('bound')) {
      const complexities = this.extractComplexity(content);
      complexities.forEach((complexity) => {
        knowledge.push({
          ...complexity,
          section: section.heading,
          sectionHash: section.structuralHash,
          weight: positionWeight * 0.9,
          occurrences: 1,
          statementType: 'complexity',
        });
      });
    }

    // 6. Extract proofs (from any section)
    const proofs = this.extractProofs(content);
    proofs.forEach((proof) => {
      knowledge.push({
        ...proof,
        section: section.heading,
        sectionHash: section.structuralHash,
        weight: positionWeight * 0.9,
        occurrences: 1,
        statementType: 'proof',
      });
    });

    // 7. Extract mathematical identities/formulas
    const identities = this.extractIdentities(content);
    identities.forEach((identity) => {
      knowledge.push({
        ...identity,
        section: section.heading,
        sectionHash: section.structuralHash,
        weight: positionWeight * 0.85,
        occurrences: 1,
        statementType: 'identity',
      });
    });

    // Also scan content for inline statements regardless of section heading
    const inlineStatements = this.extractInlineStatements(
      content,
      section,
      positionWeight
    );
    knowledge.push(...inlineStatements);

    return knowledge;
  }

  /**
   * Extract inline mathematical statements from content
   * Handles **THEOREM**: format and other inline patterns
   */
  private extractInlineStatements(
    content: string,
    section: MarkdownSection,
    positionWeight: number
  ): MathematicalKnowledge[] {
    const knowledge: MathematicalKnowledge[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // **THEOREM**: Statement (Karpathy format)
      const theoremMatch = line.match(/^\*\*THEOREM\*\*:\s*(.+)$/i);
      if (theoremMatch) {
        knowledge.push({
          text: `THEOREM: ${theoremMatch[1]}`,
          section: section.heading,
          sectionHash: section.structuralHash,
          weight: positionWeight * 1.0,
          occurrences: 1,
          statementType: 'theorem',
        });
      }

      // **LEMMA**: Statement
      const lemmaMatch = line.match(/^\*\*LEMMA\*\*:\s*(.+)$/i);
      if (lemmaMatch) {
        knowledge.push({
          text: `LEMMA: ${lemmaMatch[1]}`,
          section: section.heading,
          sectionHash: section.structuralHash,
          weight: positionWeight * 0.95,
          occurrences: 1,
          statementType: 'lemma',
        });
      }

      // **AXIOM**: Statement
      const axiomMatch = line.match(/^\*\*AXIOM\*\*:\s*(.+)$/i);
      if (axiomMatch) {
        knowledge.push({
          text: `AXIOM: ${axiomMatch[1]}`,
          section: section.heading,
          sectionHash: section.structuralHash,
          weight: positionWeight * 1.0,
          occurrences: 1,
          statementType: 'axiom',
        });
      }

      // **INVARIANT**: Statement
      const invariantMatch = line.match(/^\*\*INVARIANT\*\*:\s*(.+)$/i);
      if (invariantMatch) {
        knowledge.push({
          text: `INVARIANT: ${invariantMatch[1]}`,
          section: section.heading,
          sectionHash: section.structuralHash,
          weight: positionWeight * 0.95,
          occurrences: 1,
          statementType: 'invariant',
        });
      }

      // **COMPLEXITY**: O(n) or similar
      const complexityMatch = line.match(/^\*\*COMPLEXITY\*\*:\s*(.+)$/i);
      if (complexityMatch) {
        const complexityText = complexityMatch[1];
        knowledge.push({
          text: `COMPLEXITY: ${complexityText}`,
          section: section.heading,
          sectionHash: section.structuralHash,
          weight: positionWeight * 0.9,
          occurrences: 1,
          statementType: 'complexity',
          metadata: this.parseComplexityMetadata(complexityText),
        });
      }
    }

    return knowledge;
  }

  /**
   * Parse complexity metadata from text like "O(n² × d)"
   */
  private parseComplexityMetadata(text: string): {
    timeComplexity?: string;
    spaceComplexity?: string;
  } {
    const metadata: { timeComplexity?: string; spaceComplexity?: string } = {};

    // Look for O(...) pattern
    const bigOMatch = text.match(/O\([^)]+\)/);
    if (bigOMatch) {
      metadata.timeComplexity = bigOMatch[0];
    }

    return metadata;
  }

  /**
   * Extract theorems - supports multiple formats
   */
  private extractTheorems(
    content: string
  ): Array<{ text: string; metadata?: { formalNotation?: string } }> {
    const theorems: Array<{
      text: string;
      metadata?: { formalNotation?: string };
    }> = [];
    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();

      // Format 1: **Theorem N:** Statement (original)
      const theoremMatch1 = trimmed.match(
        /^\*\*Theorem\s+([^*:]+):\*\*\s*(.+)$/i
      );
      if (theoremMatch1) {
        const name = theoremMatch1[1].trim();
        const statement = theoremMatch1[2].trim();
        theorems.push({
          text: `Theorem ${name}: ${statement}`,
        });
        continue;
      }

      // Format 2: **THEOREM**: Statement (Karpathy format)
      const theoremMatch2 = trimmed.match(/^\*\*THEOREM\*\*:\s*(.+)$/i);
      if (theoremMatch2) {
        theorems.push({
          text: theoremMatch2[1].trim(),
        });
      }
    }

    return theorems;
  }

  /**
   * Extract lemmas - supports multiple formats
   */
  private extractLemmas(
    content: string
  ): Array<{ text: string; metadata?: { dependencies?: string[] } }> {
    const lemmas: Array<{
      text: string;
      metadata?: { dependencies?: string[] };
    }> = [];
    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();

      // Format 1: **Lemma N:** Statement
      const lemmaMatch1 = trimmed.match(/^\*\*Lemma\s+([^*:]+):\*\*\s*(.+)$/i);
      if (lemmaMatch1) {
        const name = lemmaMatch1[1].trim();
        const statement = lemmaMatch1[2].trim();
        lemmas.push({
          text: `Lemma ${name}: ${statement}`,
        });
        continue;
      }

      // Format 2: **LEMMA**: Statement
      const lemmaMatch2 = trimmed.match(/^\*\*LEMMA\*\*:\s*(.+)$/i);
      if (lemmaMatch2) {
        lemmas.push({
          text: lemmaMatch2[1].trim(),
        });
      }
    }

    return lemmas;
  }

  /**
   * Extract axioms - supports multiple formats
   */
  private extractAxioms(content: string): Array<{ text: string }> {
    const axioms: Array<{ text: string }> = [];
    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();

      // Format 1: **Axiom N:** Statement
      const axiomMatch1 = trimmed.match(/^\*\*Axiom\s+([^*:]+):\*\*\s*(.+)$/i);
      if (axiomMatch1) {
        const name = axiomMatch1[1].trim();
        const statement = axiomMatch1[2].trim();
        axioms.push({
          text: `Axiom ${name}: ${statement}`,
        });
        continue;
      }

      // Format 2: **AXIOM**: Statement
      const axiomMatch2 = trimmed.match(/^\*\*AXIOM\*\*:\s*(.+)$/i);
      if (axiomMatch2) {
        axioms.push({
          text: axiomMatch2[1].trim(),
        });
      }
    }

    return axioms;
  }

  /**
   * Extract invariants - properties that hold throughout execution
   */
  private extractInvariants(content: string): Array<{
    text: string;
    metadata?: { enforcement?: string; violations?: string[] };
  }> {
    const invariants: Array<{
      text: string;
      metadata?: { enforcement?: string; violations?: string[] };
    }> = [];
    const lines = content.split('\n');

    let currentInvariant: {
      text: string;
      enforcement?: string;
      violations: string[];
    } | null = null;

    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim();

      // Format 1: **Invariant N:** Statement
      const invariantMatch1 = trimmed.match(
        /^\*\*Invariant\s+([^*:]+):\*\*\s*(.+)$/i
      );
      if (invariantMatch1) {
        if (currentInvariant) {
          invariants.push({
            text: currentInvariant.text,
            metadata:
              currentInvariant.enforcement ||
              currentInvariant.violations.length > 0
                ? {
                    enforcement: currentInvariant.enforcement,
                    violations: currentInvariant.violations,
                  }
                : undefined,
          });
        }
        currentInvariant = {
          text: `Invariant ${invariantMatch1[1].trim()}: ${invariantMatch1[2].trim()}`,
          violations: [],
        };
        continue;
      }

      // Format 2: **INVARIANT**: Statement
      const invariantMatch2 = trimmed.match(/^\*\*INVARIANT\*\*:\s*(.+)$/i);
      if (invariantMatch2) {
        if (currentInvariant) {
          invariants.push({
            text: currentInvariant.text,
            metadata:
              currentInvariant.enforcement ||
              currentInvariant.violations.length > 0
                ? {
                    enforcement: currentInvariant.enforcement,
                    violations: currentInvariant.violations,
                  }
                : undefined,
          });
        }
        currentInvariant = {
          text: invariantMatch2[1].trim(),
          violations: [],
        };
        continue;
      }

      // Look for enforcement info
      if (currentInvariant && trimmed.match(/^\*\*Enforcement\*\*:/i)) {
        currentInvariant.enforcement = trimmed.replace(
          /^\*\*Enforcement\*\*:\s*/i,
          ''
        );
      }

      // Look for violations to watch
      if (
        currentInvariant &&
        trimmed.startsWith('-') &&
        lines[i - 1]?.includes('Violations')
      ) {
        currentInvariant.violations.push(trimmed.slice(1).trim());
      }
    }

    // Don't forget the last one
    if (currentInvariant) {
      invariants.push({
        text: currentInvariant.text,
        metadata:
          currentInvariant.enforcement || currentInvariant.violations.length > 0
            ? {
                enforcement: currentInvariant.enforcement,
                violations: currentInvariant.violations,
              }
            : undefined,
      });
    }

    return invariants;
  }

  /**
   * Extract complexity bounds - time/space complexity
   */
  private extractComplexity(content: string): Array<{
    text: string;
    metadata?: { timeComplexity?: string; spaceComplexity?: string };
  }> {
    const complexities: Array<{
      text: string;
      metadata?: { timeComplexity?: string; spaceComplexity?: string };
    }> = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim();

      // Format: **COMPLEXITY**: O(n² × d)
      const complexityMatch = trimmed.match(/^\*\*COMPLEXITY\*\*:\s*(.+)$/i);
      if (complexityMatch) {
        const text = complexityMatch[1].trim();
        const metadata: { timeComplexity?: string; spaceComplexity?: string } =
          {};

        // Extract time complexity (first O(...))
        const timeMatch = text.match(/O\([^)]+\)/);
        if (timeMatch) {
          metadata.timeComplexity = timeMatch[0];
        }

        complexities.push({ text, metadata });
        continue;
      }

      // Also check for **SPACE**: pattern
      const spaceMatch = trimmed.match(/^\*\*SPACE\*\*:\s*(.+)$/i);
      if (spaceMatch) {
        const prevComplexity = complexities[complexities.length - 1];
        if (prevComplexity) {
          const spaceO = spaceMatch[1].match(/O\([^)]+\)/);
          if (spaceO && prevComplexity.metadata) {
            prevComplexity.metadata.spaceComplexity = spaceO[0];
          }
        }
      }
    }

    return complexities;
  }

  /**
   * Extract proofs - supports multiple endings (Q.E.D., ∎, or numbered steps)
   */
  private extractProofs(
    content: string
  ): Array<{ text: string; metadata?: { proofSteps?: string[] } }> {
    const proofs: Array<{
      text: string;
      metadata?: { proofSteps?: string[] };
    }> = [];

    // Method 1: Match **PROOF**: followed by numbered steps
    const proofBlockRegex = /\*\*PROOF\*\*:\s*\n((?:\s*\d+\..+\n?)+)/gi;
    let match;

    while ((match = proofBlockRegex.exec(content)) !== null) {
      const proofText = match[1].trim();
      const steps = proofText
        .split(/\n/)
        .map((s) => s.trim())
        .filter((s) => /^\d+\./.test(s))
        .map((s) => s.replace(/^\d+\.\s*/, ''));

      if (steps.length > 0) {
        proofs.push({
          text: `Proof: ${steps[0]}...`,
          metadata: { proofSteps: steps },
        });
      }
    }

    // Method 2: Traditional **Proof:** ... Q.E.D. or ∎
    const traditionalProofRegex = /\*\*Proof:\*\*\s*([^]*?)(?:Q\.E\.D\.|∎)/gi;
    while ((match = traditionalProofRegex.exec(content)) !== null) {
      const proofText = match[1].trim();
      const steps = proofText
        .split(/\n\d+\./)
        .filter((s) => s.trim().length > 0);

      proofs.push({
        text: `Proof: ${proofText.substring(0, 200)}...`,
        metadata: steps.length > 1 ? { proofSteps: steps } : undefined,
      });
    }

    return proofs;
  }

  /**
   * Extract mathematical identities/formulas from code blocks
   */
  private extractIdentities(
    content: string
  ): Array<{ text: string; metadata?: { formalNotation?: string } }> {
    const identities: Array<{
      text: string;
      metadata?: { formalNotation?: string };
    }> = [];

    // Look for equations in code blocks (text blocks with = or mathematical notation)
    const codeBlockRegex = /```(?:text|math)?\s*\n([^`]+)\n```/g;
    let match;

    while ((match = codeBlockRegex.exec(content)) !== null) {
      const notation = match[1].trim();
      // Only extract if it looks like a formula (contains = or mathematical symbols)
      if (
        notation.includes('=') ||
        notation.includes('∀') ||
        notation.includes('∃') ||
        notation.includes('⟹')
      ) {
        identities.push({
          text: notation,
          metadata: { formalNotation: notation },
        });
      }
    }

    return identities;
  }
}
