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

    // Extract from each section (recursively process nested sections)
    const extractRecursively = (sections: MarkdownSection[]) => {
      sections.forEach((section, index) => {
        const extracted = this.extractFromSection(
          section,
          index,
          sections.length
        );
        knowledge.push(...extracted);

        // Recursively process child sections
        if (section.children && section.children.length > 0) {
          extractRecursively(section.children);
        }
      });
    };

    extractRecursively(doc.sections);

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

    // 1. Extract threat models from ALL sections (threats can appear anywhere)
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

    // 2. Extract attack vectors from ALL sections
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

    // 3. Extract mitigations from ALL sections
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

    // 4. Extract security boundaries from ALL sections
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

    // 5. Extract vulnerabilities (CVEs) from ALL sections
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
   * Pattern: **Threat Name** — Description (single-line format)
   * Pattern: **Threat**: Value (multi-field structured format)
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

    // Track multi-field threat blocks
    let currentThreat: {
      name?: string;
      severity?: string;
      attackVector?: string;
      impact?: string;
      mitigation?: string[];
    } | null = null;

    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim();

      // Match single-line format: **Threat Name** — Description
      const singleLineThreatMatch = trimmed.match(
        /^\*\*([^*]+)\*\*\s*[—-]\s*(.+)$/
      );
      if (singleLineThreatMatch) {
        const name = singleLineThreatMatch[1].trim();
        const description = singleLineThreatMatch[2].trim();
        const severity = this.inferSeverity(name + ' ' + description);

        threats.push({
          text: `${name}: ${description}`,
          severity,
        });
        continue;
      }

      // Match multi-field structured format: **Threat**: Name
      const threatFieldMatch = trimmed.match(/^\*\*Threat\*\*:\s*(.+)$/i);
      if (threatFieldMatch) {
        // Save previous threat if exists
        if (currentThreat?.name) {
          threats.push(this.formatStructuredThreat(currentThreat));
        }

        currentThreat = {
          name: threatFieldMatch[1].trim(),
          mitigation: [],
        };
        continue;
      }

      // Collect fields for current threat
      if (currentThreat) {
        const severityMatch = trimmed.match(/^\*\*Severity\*\*:\s*(.+)$/i);
        if (severityMatch) {
          currentThreat.severity = severityMatch[1].trim();
          continue;
        }

        const attackVectorMatch = trimmed.match(
          /^\*\*Attack Vector\*\*:\s*(.+)$/i
        );
        if (attackVectorMatch) {
          currentThreat.attackVector = attackVectorMatch[1].trim();
          continue;
        }

        const impactMatch = trimmed.match(/^\*\*Impact\*\*:\s*(.+)$/i);
        if (impactMatch) {
          currentThreat.impact = impactMatch[1].trim();
          continue;
        }

        const mitigationHeaderMatch = trimmed.match(
          /^\*\*Mitigation\*\*:\s*$/i
        );
        if (mitigationHeaderMatch) {
          // Next lines are mitigation bullets
          continue;
        }

        // Collect mitigation bullets
        const mitigationBulletMatch = trimmed.match(/^[-*]\s+(.+)$/);
        if (mitigationBulletMatch && currentThreat.mitigation) {
          currentThreat.mitigation.push(mitigationBulletMatch[1].trim());
          continue;
        }

        // Empty line or new section - end current threat
        if (!trimmed || trimmed.startsWith('##')) {
          if (currentThreat.name) {
            threats.push(this.formatStructuredThreat(currentThreat));
            currentThreat = null;
          }
        }
      }
    }

    // Save last threat if exists
    if (currentThreat?.name) {
      threats.push(this.formatStructuredThreat(currentThreat));
    }

    return threats;
  }

  /**
   * Format structured threat into SecurityKnowledge format
   */
  private formatStructuredThreat(threat: {
    name?: string;
    severity?: string;
    attackVector?: string;
    impact?: string;
    mitigation?: string[];
  }): {
    text: string;
    severity?: 'critical' | 'high' | 'medium' | 'low';
  } {
    const parts: string[] = [threat.name || 'Unknown Threat'];

    if (threat.attackVector) {
      parts.push(`Attack: ${threat.attackVector}`);
    }

    if (threat.impact) {
      parts.push(`Impact: ${threat.impact}`);
    }

    if (threat.mitigation && threat.mitigation.length > 0) {
      parts.push(`Mitigations: ${threat.mitigation.join('; ')}`);
    }

    return {
      text: parts.join(' | '),
      severity: this.inferSeverity(threat.severity || ''),
    };
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
