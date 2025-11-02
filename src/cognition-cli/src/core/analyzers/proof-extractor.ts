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
 * Handles: ECHO_PROOFS.md, THEOREMS.md, mathematical properties
 *
 * EXTRACTION PATTERNS:
 * 1. Theorems (formal statements with proofs)
 * 2. Lemmas (supporting propositions)
 * 3. Axioms (foundational truths)
 * 4. Corollaries (derived results)
 * 5. Proofs (step-by-step derivations)
 * 6. Mathematical identities (equalities, invariants)
 *
 * FUTURE: This will enable the system to reason about formal properties,
 * verify mathematical correctness, and apply Echo's theoretical framework.
 */
export class ProofExtractor
  implements DocumentExtractor<MathematicalKnowledge>
{
  /**
   * Extract mathematical knowledge from document
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
   */
  private isTheoremSection(heading: string): boolean {
    const lower = heading.toLowerCase();
    return lower.includes('theorem');
  }

  /**
   * Check if section contains lemmas
   */
  private isLemmaSection(heading: string): boolean {
    const lower = heading.toLowerCase();
    return lower.includes('lemma');
  }

  /**
   * Extract theorems
   * Pattern: **Theorem N:** Statement
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
   * Pattern: **Lemma N:** Statement
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
   * Pattern: **Proof:** ... Q.E.D. or ∎
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
   * Pattern: **Axiom N:** Statement
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
   * Pattern: Equations, invariant statements
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
