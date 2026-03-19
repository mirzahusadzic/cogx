/**
 * Security Knowledge Extraction
 *
 * Extracts security knowledge from security documentation for O₂ (Security) overlay.
 * This is the foundational security layer that can be exported/imported via .cogx files,
 * enabling security knowledge reuse across dependencies.
 *
 * OVERLAY TARGET: O₂ (Security)
 *
 * EXTRACTION PATTERNS:
 * 1. Threat models (attack scenarios) - Weight 1.0
 * 2. Attack vectors (exploit methods) - Weight 0.95
 * 3. Mitigations (countermeasures) - Weight 0.9
 * 4. Security boundaries (trust zones) - Weight 0.85
 * 5. Vulnerabilities (CVEs, known issues) - Weight 1.0
 *
 * PORTABILITY:
 * Designed for export/import via .cogx files to enable security knowledge sharing.
 *
 * @example
 * const extractor = new SecurityExtractor();
 * const knowledge = extractor.extract(securityDoc);
 * // Returns: [{ text: "SQL Injection: Malicious SQL via user input", type: "threat_model", ... }, ...]
 */

import { MarkdownSection } from '../parsers/markdown-parser.js';
import { DocumentType } from './document-classifier.js';
import {
  BaseMarkdownExtractor,
  SecurityKnowledge,
} from './document-extractor.js';

/**
 * SecurityExtractor
 *
 * Extracts security knowledge from security documentation.
 * Targets O₂ (Security) overlay - the foundational security layer.
 *
 * Handles: SECURITY.md, THREAT_MODEL.md, vulnerability documentation
 *
 * SECURITY TYPES:
 * - threat_model: Attack scenarios and threat descriptions
 * - attack_vector: Specific exploit methods
 * - mitigation: Countermeasures and defenses
 * - boundary: Trust zones and security boundaries
 * - vulnerability: CVEs and known security issues
 *
 * @example
 * const extractor = new SecurityExtractor();
 * const knowledge = extractor.extract(threatModelDoc);
 * knowledge.forEach(k => {
 *   console.log(`${k.type}: ${k.text}`);
 * });
 */
export class SecurityExtractor extends BaseMarkdownExtractor<SecurityKnowledge> {
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
  protected extractFromSection(
    section: MarkdownSection,
    sectionIndex: number,
    totalSections: number
  ): SecurityKnowledge[] {
    const knowledge: SecurityKnowledge[] = [];
    const content = section.content;

    // Position weight
    const positionWeight = this.getPositionWeight(sectionIndex, totalSections);

    // 1. Extract threat models from ALL sections
    const threats = this.extractThreats(content);
    threats.forEach((threat) => {
      knowledge.push({
        ...threat,
        section: section.heading,
        sectionHash: section.structuralHash,
        weight: positionWeight * 1.0, // Highest - critical knowledge
        occurrences: 1,
        type: 'threat_model',
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
        type: 'attack_vector',
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
        type: 'mitigation',
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
        type: 'boundary',
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
        type: 'vulnerability',
      });
    });

    return knowledge;
  }

  /**
   * Extract threat models from content
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

        // Skip if this looks like a boundary or asset (not a threat)
        const lowerName = name.toLowerCase();
        if (
          lowerName.includes('boundary') ||
          lowerName.includes('credentials') ||
          lowerName.includes('asset') ||
          lowerName.includes('data') ||
          lowerName.includes('gateway') ||
          lowerName.includes('service')
        ) {
          continue;
        }

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
          continue;
        }

        const mitigationBulletMatch = trimmed.match(/^[-*]\s+(.+)$/);
        if (mitigationBulletMatch && currentThreat.mitigation) {
          currentThreat.mitigation.push(mitigationBulletMatch[1].trim());
          continue;
        }

        if (!trimmed || trimmed.startsWith('##')) {
          if (currentThreat.name) {
            threats.push(this.formatStructuredThreat(currentThreat));
            currentThreat = null;
          }
        }
      }
    }

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
   */
  private extractAttackVectors(content: string): Array<{
    text: string;
    severity?: 'critical' | 'high' | 'medium' | 'low';
  }> {
    const attacks: Array<{
      text: string;
      severity?: 'critical' | 'high' | 'medium' | 'low';
    }> = [];
    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();

      const attackMatch = trimmed.match(/^\*\*Attack Vector\*\*:\s*(.+)$/i);
      if (attackMatch) {
        const description = attackMatch[1].trim();
        attacks.push({
          text: description,
          severity: this.inferSeverity(description),
        });
      }
    }

    return attacks;
  }

  /**
   * Extract mitigations (countermeasures)
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
   * Extract security boundaries (trust zones)
   */
  private extractBoundaries(content: string): Array<{ text: string }> {
    const boundaries: Array<{ text: string }> = [];
    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();

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

    const contentWithoutCodeBlocks = this.stripCodeBlocks(content);
    const lines = contentWithoutCodeBlocks.split('\n');
    const processedCVEs = new Set<string>();

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const cveMatch = line.match(/CVE-\d{4}-\d{4,}/g);

      if (cveMatch) {
        for (const cveId of cveMatch) {
          if (processedCVEs.has(cveId)) continue;
          processedCVEs.add(cveId);

          let description = line
            .replace(cveId, '')
            .replace(/^[-*#\s]+/, '')
            .trim();

          if (
            description.length < 10 ||
            /^[{}[\],"':]+$/.test(description) ||
            description.endsWith(',') ||
            description.endsWith(':')
          ) {
            for (let j = i + 1; j < Math.min(i + 3, lines.length); j++) {
              const nextLine = lines[j].trim();
              if (
                nextLine &&
                !nextLine.startsWith('-') &&
                !nextLine.startsWith('*') &&
                !nextLine.startsWith('#') &&
                !/^[{}[\],"':]+$/.test(nextLine)
              ) {
                description = nextLine;
                break;
              }
            }
          }

          if (
            !description ||
            description.length < 10 ||
            /^[{}[\],"':]+$/.test(description)
          ) {
            continue;
          }

          vulnerabilities.push({
            text: `${cveId}: ${description}`,
            severity: this.inferSeverity(line),
            metadata: {
              cveId,
            },
          });
        }
      }
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

    if (lower.includes('exploit') || lower.includes('injection')) {
      return 'high';
    }

    return undefined;
  }
}
