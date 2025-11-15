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
 * 4. Proofs (0.9) - Step-by-step derivations
 * 5. Identities (0.85) - Mathematical equalities and invariants
 *
 * FUTURE:
 * This will enable the system to reason about formal properties,
 * verify mathematical correctness, and apply Echo's theoretical framework.
 *
 * @example
 * const extractor = new ProofExtractor();
 * const knowledge = extractor.extract(theoremsDoc);
 * // Returns: [{ text: "Theorem 1: Overlay composition is associative", statementType: "theorem", ... }, ...]
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
 * - proof: Step-by-step derivations
 * - identity: Mathematical equalities and invariants
 *
 * @example
 * const extractor = new ProofExtractor();
 * const knowledge = extractor.extract(proofsDoc);
 * const theorems = knowledge.filter(k => k.statementType === 'theorem');
 */
export class ProofExtractor
  implements DocumentExtractor<MathematicalKnowledge>
{
  /**
   * Extract mathematical knowledge from document
   *
   * Recursively processes all sections to extract theorems, lemmas,
   * axioms, proofs, and identities.
   *
   * @param doc - Parsed markdown document
   * @returns Array of mathematical knowledge items
   *
   * @example
   * const doc = parser.parse(theoremsmd);
   * const knowledge = extractor.extract(doc);
   * console.log(knowledge.find(k => k.text.startsWith('Theorem')));
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
   *
   * Processes section tree to extract mathematical statements from
   * all levels of the document hierarchy.
   *
   * @private
   * @param section - Section to extract from
   * @param sectionIndex - Position in parent array
   * @param totalSections - Total sections at this level
   * @returns Array of extracted mathematical knowledge
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
   *
   * @param docType - Document type to check
   * @returns True if document type is MATHEMATICAL
   */
  supports(docType: DocumentType): boolean {
    return docType === DocumentType.MATHEMATICAL;
  }

  /**
   * Targets O₆ (Mathematical) overlay
   *
   * @returns Overlay layer identifier "O6_Mathematical"
   */
  getOverlayLayer(): string {
    return 'O6_Mathematical';
  }

  /**
   * Extract mathematical knowledge from a single section
   *
   * Applies all extraction patterns (theorems, lemmas, axioms, proofs,
   * identities) based on section heading and content.
   *
   * @private
   * @param section - Section to extract from
   * @param sectionIndex - Position in parent array
   * @param totalSections - Total sections at this level
   * @returns Array of extracted mathematical knowledge
   */
  private extractFromSection(
    section: MarkdownSection,
    sectionIndex: number,
    totalSections: number
  ): MathematicalKnowledge[] {
    const knowledge: MathematicalKnowledge[] = [];
    const content = section.content;

    // Position weight
    const positionWeight = 1.0 - (sectionIndex / totalSections) * 0.4;

    // 1. Extract theorems
    if (this.isTheoremSection(section.heading)) {
      const theorems = this.extractTheorems(content);
      theorems.forEach((theorem) => {
        knowledge.push({
          ...theorem,
          section: section.heading,
          sectionHash: section.structuralHash,
          weight: positionWeight * 1.0, // Highest - foundational
          occurrences: 1,
          statementType: 'theorem',
        });
      });
    }

    // 2. Extract lemmas
    if (this.isLemmaSection(section.heading)) {
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

    // 3. Extract proofs
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

    // 4. Extract axioms
    const axioms = this.extractAxioms(content);
    axioms.forEach((axiom) => {
      knowledge.push({
        ...axiom,
        section: section.heading,
        sectionHash: section.structuralHash,
        weight: positionWeight * 1.0, // Foundational
        occurrences: 1,
        statementType: 'axiom',
      });
    });

    // 5. Extract mathematical identities/invariants
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

    return knowledge;
  }

  /**
   * Check if section contains theorems
   *
   * @private
   * @param heading - Section heading text
   * @returns True if heading contains "theorem"
   */
  private isTheoremSection(heading: string): boolean {
    const lower = heading.toLowerCase();
    return lower.includes('theorem');
  }

  /**
   * Check if section contains lemmas
   *
   * @private
   * @param heading - Section heading text
   * @returns True if heading contains "lemma"
   */
  private isLemmaSection(heading: string): boolean {
    const lower = heading.toLowerCase();
    return lower.includes('lemma');
  }

  /**
   * Extract theorems
   *
   * Pattern: **Theorem N:** Statement
   * Extracts formal theorem statements for the mathematical overlay.
   *
   * @private
   * @param content - Section content to extract from
   * @returns Array of theorem objects
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

      // Match: **Theorem N:** Statement
      const theoremMatch = trimmed.match(
        /^\*\*Theorem\s+([^*:]+):\*\*\s*(.+)$/i
      );
      if (theoremMatch) {
        const name = theoremMatch[1].trim();
        const statement = theoremMatch[2].trim();

        theorems.push({
          text: `Theorem ${name}: ${statement}`,
        });
      }
    }

    return theorems;
  }

  /**
   * Extract lemmas (supporting propositions)
   *
   * Pattern: **Lemma N:** Statement
   * Lemmas are supporting propositions used in proofs of larger theorems.
   *
   * @private
   * @param content - Section content to extract from
   * @returns Array of lemma objects
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

      // Match: **Lemma N:** Statement
      const lemmaMatch = trimmed.match(/^\*\*Lemma\s+([^*:]+):\*\*\s*(.+)$/i);
      if (lemmaMatch) {
        const name = lemmaMatch[1].trim();
        const statement = lemmaMatch[2].trim();

        lemmas.push({
          text: `Lemma ${name}: ${statement}`,
        });
      }
    }

    return lemmas;
  }

  /**
   * Extract proofs
   *
   * Pattern: **Proof:** ... Q.E.D. or ∎
   * Extracts proof blocks with optional step-by-step structure.
   *
   * @private
   * @param content - Section content to extract from
   * @returns Array of proof objects with optional proof steps
   */
  private extractProofs(
    content: string
  ): Array<{ text: string; metadata?: { proofSteps?: string[] } }> {
    const proofs: Array<{
      text: string;
      metadata?: { proofSteps?: string[] };
    }> = [];

    // Match proof blocks (simplified - full implementation would parse structure)
    const proofRegex = /\*\*Proof:\*\*\s*([^]*?)(?:Q\.E\.D\.|∎)/gi;
    let match;

    while ((match = proofRegex.exec(content)) !== null) {
      const proofText = match[1].trim();
      // Extract numbered steps if present
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
   * Extract axioms (foundational truths)
   *
   * Pattern: **Axiom N:** Statement
   * Axioms are the foundational truths upon which theorems are built.
   *
   * @private
   * @param content - Section content to extract from
   * @returns Array of axiom objects
   */
  private extractAxioms(content: string): Array<{ text: string }> {
    const axioms: Array<{ text: string }> = [];
    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();

      // Match: **Axiom N:** Statement
      const axiomMatch = trimmed.match(/^\*\*Axiom\s+([^*:]+):\*\*\s*(.+)$/i);
      if (axiomMatch) {
        const name = axiomMatch[1].trim();
        const statement = axiomMatch[2].trim();

        axioms.push({
          text: `Axiom ${name}: ${statement}`,
        });
      }
    }

    return axioms;
  }

  /**
   * Extract mathematical identities/invariants
   *
   * Pattern: Equations in code blocks (LaTeX-like notation)
   * Looks for equality statements (contains '=').
   *
   * @private
   * @param content - Section content to extract from
   * @returns Array of identity objects with formal notation
   */
  private extractIdentities(
    content: string
  ): Array<{ text: string; metadata?: { formalNotation?: string } }> {
    const identities: Array<{
      text: string;
      metadata?: { formalNotation?: string };
    }> = [];

    // Look for equality statements in code blocks (LaTeX-like)
    const codeBlockRegex = /```(?:math)?\s*\n([^`]+)\n```/g;
    let match;

    while ((match = codeBlockRegex.exec(content)) !== null) {
      const notation = match[1].trim();
      if (notation.includes('=')) {
        identities.push({
          text: notation,
          metadata: { formalNotation: notation },
        });
      }
    }

    return identities;
  }
}
