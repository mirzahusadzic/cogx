import {
  MarkdownDocument,
  MarkdownSection,
} from '../parsers/markdown-parser.js';
import { DocumentType } from './document-classifier.js';
import { DocumentExtractor, SecurityKnowledge } from './document-extractor.js';

/**
 * SecurityExtractor
 *
 * Extracts security knowledge from security documentation.
 * Targets O₂ (Security) overlay - the foundational layer.
 *
 * Handles: SECURITY.md, THREAT_MODEL.md, vulnerability docs
 *
 * PORTABILITY:
 * This layer is designed to be exported/imported via .cogx files,
 * enabling security knowledge reuse across dependencies.
 *
 * EXTRACTION PATTERNS:
 * 1. Threat models (attack scenarios)
 * 2. Attack vectors (exploit methods)
 * 3. Mitigations (countermeasures)
 * 4. Security boundaries (trust zones)
 * 5. Constraints (security requirements)
 * 6. Vulnerabilities (known issues, CVEs)
 */
export class SecurityExtractor implements DocumentExtractor<SecurityKnowledge> {
  /**
   * Extract security knowledge from document
   */
  extract(doc: MarkdownDocument): SecurityKnowledge[] {
    const knowledge: SecurityKnowledge[] = [];

    // Extract from each section
    doc.sections.forEach((section, index) => {
      knowledge.push(
        ...this.extractFromSection(section, index, doc.sections.length)
      );
    });

    return knowledge;
  }

  /**
   * Supports security documents
   */
  supports(docType: DocumentType): boolean {
    return docType === DocumentType.SECURITY;
  }

  /**
   * Targets O₂ (Security) overlay - foundational layer
   */
  getOverlayLayer(): string {
    return 'O2_Security';
  }

  /**
   * Extract security knowledge from a single section
   */
  private extractFromSection(
    section: MarkdownSection,
    sectionIndex: number,
    totalSections: number
  ): SecurityKnowledge[] {
    const knowledge: SecurityKnowledge[] = [];
    const content = section.content;

    // Position weight
    const positionWeight = 1.0 - (sectionIndex / totalSections) * 0.4;

    // 1. Extract threat models
    if (this.isThreatModelSection(section.heading)) {
      const threats = this.extractThreats(content);
      threats.forEach((threat) => {
        knowledge.push({
          ...threat,
          section: section.heading,
          sectionHash: section.structuralHash,
          weight: positionWeight * 1.0, // Highest - critical knowledge
          occurrences: 1,
          securityType: 'threat_model',
        });
      });
    }

    // 2. Extract attack vectors
    if (this.isAttackVectorSection(section.heading)) {
      const attacks = this.extractAttackVectors(content);
      attacks.forEach((attack) => {
        knowledge.push({
          ...attack,
          section: section.heading,
          sectionHash: section.structuralHash,
          weight: positionWeight * 0.95,
          occurrences: 1,
          securityType: 'attack_vector',
        });
      });
    }

    // 3. Extract mitigations
    const mitigations = this.extractMitigations(content);
    mitigations.forEach((mitigation) => {
      knowledge.push({
        ...mitigation,
        section: section.heading,
        sectionHash: section.structuralHash,
        weight: positionWeight * 0.9,
        occurrences: 1,
        securityType: 'mitigation',
      });
    });

    // 4. Extract security boundaries
    const boundaries = this.extractBoundaries(content);
    boundaries.forEach((boundary) => {
      knowledge.push({
        ...boundary,
        section: section.heading,
        sectionHash: section.structuralHash,
        weight: positionWeight * 0.85,
        occurrences: 1,
        securityType: 'boundary',
      });
    });

    // 5. Extract vulnerabilities (CVEs)
    const vulnerabilities = this.extractVulnerabilities(content);
    vulnerabilities.forEach((vuln) => {
      knowledge.push({
        ...vuln,
        section: section.heading,
        sectionHash: section.structuralHash,
        weight: positionWeight * 1.0, // Critical
        occurrences: 1,
        securityType: 'vulnerability',
      });
    });

    return knowledge;
  }

  /**
   * Check if section is about threat models
   */
  private isThreatModelSection(heading: string): boolean {
    const lower = heading.toLowerCase();
    return lower.includes('threat') || lower.includes('attack');
  }

  /**
   * Check if section is about attack vectors
   */
  private isAttackVectorSection(heading: string): boolean {
    const lower = heading.toLowerCase();
    return lower.includes('vector') || lower.includes('exploit');
  }

  /**
   * Extract threat models
   * Pattern: **Threat Name** — Description
   */
  private extractThreats(content: string): Array<{
    text: string;
    severity?: 'critical' | 'high' | 'medium' | 'low';
  }> {
    const threats: Array<{
      text: string;
      severity?: 'critical' | 'high' | 'medium' | 'low';
    }> = [];
    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();

      // Match: **Threat Name** — Description
      const threatMatch = trimmed.match(/^\*\*([^*]+)\*\*\s*[—-]\s*(.+)$/);
      if (threatMatch) {
        const name = threatMatch[1].trim();
        const description = threatMatch[2].trim();
        const severity = this.inferSeverity(name + ' ' + description);

        threats.push({
          text: `${name}: ${description}`,
          severity,
        });
      }
    }

    return threats;
  }

  /**
   * Extract attack vectors
   * Pattern: Similar to threats
   */
  private extractAttackVectors(content: string): Array<{
    text: string;
    severity?: 'critical' | 'high' | 'medium' | 'low';
  }> {
    // Same pattern as threats
    return this.extractThreats(content);
  }

  /**
   * Extract mitigations
   * Pattern: - Mitigation: description
   */
  private extractMitigations(
    content: string
  ): Array<{ text: string; metadata?: { mitigation: string } }> {
    const mitigations: Array<{
      text: string;
      metadata?: { mitigation: string };
    }> = [];
    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();

      // Match: - Mitigation: description
      const mitMatch = trimmed.match(
        /^[-*]\s+(Mitigation|Prevention|Defense):\s*(.+)$/i
      );
      if (mitMatch) {
        const mitigation = mitMatch[2].trim();
        mitigations.push({
          text: mitigation,
          metadata: { mitigation },
        });
      }

      // Also match: - **Pattern**: context
      const patternMatch = trimmed.match(/^[-*]\s+\*\*([^*]+)\*\*:\s*(.+)$/);
      if (patternMatch && this.isMitigationKeyword(patternMatch[1])) {
        mitigations.push({
          text: `${patternMatch[1]}: ${patternMatch[2]}`,
          metadata: { mitigation: patternMatch[2] },
        });
      }
    }

    return mitigations;
  }

  /**
   * Check if keyword indicates mitigation
   */
  private isMitigationKeyword(text: string): boolean {
    const keywords = [
      'mitigation',
      'prevention',
      'defense',
      'protection',
      'validation',
      'sanitization',
      'whitelist',
    ];
    const lower = text.toLowerCase();
    return keywords.some((k) => lower.includes(k));
  }

  /**
   * Extract security boundaries
   * Pattern: Boundary statements, trust zones
   */
  private extractBoundaries(content: string): Array<{ text: string }> {
    const boundaries: Array<{ text: string }> = [];
    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();

      // Match bold statements about boundaries
      const boundaryMatch = trimmed.match(
        /\*\*([^*]*(?:boundary|trust|zone)[^*]*)\*\*/i
      );
      if (boundaryMatch) {
        boundaries.push({
          text: boundaryMatch[1].trim(),
        });
      }
    }

    return boundaries;
  }

  /**
   * Extract vulnerabilities (CVEs, known issues)
   * Pattern: CVE-YYYY-NNNNN, explicit vulnerability statements
   */
  private extractVulnerabilities(content: string): Array<{
    text: string;
    severity?: 'critical' | 'high' | 'medium' | 'low';
    metadata?: {
      cveId?: string;
      affectedVersions?: string;
      references?: string[];
    };
  }> {
    const vulnerabilities: Array<{
      text: string;
      severity?: 'critical' | 'high' | 'medium' | 'low';
      metadata?: {
        cveId?: string;
        affectedVersions?: string;
        references?: string[];
      };
    }> = [];

    // Match CVE identifiers
    const cveRegex = /CVE-\d{4}-\d{4,}/g;
    let match;

    while ((match = cveRegex.exec(content)) !== null) {
      const cveId = match[0];
      // Get surrounding context (up to 200 chars)
      const start = Math.max(0, match.index - 100);
      const end = Math.min(content.length, match.index + 100);
      const context = content.substring(start, end).trim();

      vulnerabilities.push({
        text: `${cveId}: ${context.split('\n')[0]}`,
        severity: this.inferSeverity(context),
        metadata: {
          cveId,
        },
      });
    }

    return vulnerabilities;
  }

  /**
   * Infer severity from text
   */
  private inferSeverity(
    text: string
  ): 'critical' | 'high' | 'medium' | 'low' | undefined {
    const lower = text.toLowerCase();

    if (lower.includes('critical')) return 'critical';
    if (lower.includes('high') || lower.includes('severe')) return 'high';
    if (lower.includes('medium') || lower.includes('moderate')) return 'medium';
    if (lower.includes('low') || lower.includes('minor')) return 'low';

    // Default severity based on keywords
    if (lower.includes('exploit') || lower.includes('injection')) {
      return 'high';
    }

    return undefined;
  }
}
