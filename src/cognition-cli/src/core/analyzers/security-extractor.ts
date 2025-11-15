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
 * // Returns: [{ text: "SQL Injection: Malicious SQL via user input", securityType: "threat_model", ... }, ...]
 */

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
 *   console.log(`${k.securityType}: ${k.text}`);
 * });
 */
export class SecurityExtractor implements DocumentExtractor<SecurityKnowledge> {
  /**
   * Extract security knowledge from document
   *
   * Recursively processes all sections to extract threats, mitigations,
   * attack vectors, boundaries, and vulnerabilities.
   *
   * @param doc - Parsed markdown document
   * @returns Array of security knowledge items
   *
   * @example
   * const doc = parser.parse(securityMd);
   * const knowledge = extractor.extract(doc);
   * const threats = knowledge.filter(k => k.securityType === 'threat_model');
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
   *
   * @param docType - Document type to check
   * @returns True if document type is SECURITY
   */
  supports(docType: DocumentType): boolean {
    return docType === DocumentType.SECURITY;
  }

  /**
   * Targets O₂ (Security) overlay - foundational layer
   *
   * @returns Overlay layer identifier "O2_Security"
   */
  getOverlayLayer(): string {
    return 'O2_Security';
  }

  /**
   * Extract security knowledge from a single section
   *
   * Applies position-based weighting and extracts all security types
   * (threats, attacks, mitigations, boundaries, vulnerabilities).
   *
   * @private
   * @param section - Section to extract from
   * @param sectionIndex - Position in parent array
   * @param totalSections - Total number of sections
   * @returns Array of extracted security knowledge
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
   *
   * @private
   * @param heading - Section heading text
   * @returns True if heading contains "threat" or "attack"
   */
  private isThreatModelSection(heading: string): boolean {
    const lower = heading.toLowerCase();
    return lower.includes('threat') || lower.includes('attack');
  }

  /**
   * Check if section is about attack vectors
   *
   * @private
   * @param heading - Section heading text
   * @returns True if heading contains "vector" or "exploit"
   */
  private isAttackVectorSection(heading: string): boolean {
    const lower = heading.toLowerCase();
    return lower.includes('vector') || lower.includes('exploit');
  }

  /**
   * Extract threat models from content
   *
   * Supports two formats:
   * 1. Single-line: **Threat Name** — Description
   * 2. Multi-field structured: **Threat**: Name, **Severity**: ..., etc.
   *
   * Infers severity from text (critical/high/medium/low).
   *
   * @private
   * @param content - Section content to extract from
   * @returns Array of threat objects with text and optional severity
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
   *
   * Combines multi-field threat data (name, attack vector, impact, mitigations)
   * into a single formatted security knowledge item.
   *
   * @private
   * @param threat - Structured threat object with optional fields
   * @returns Formatted threat with text and severity
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
   *
   * Uses same pattern as extractThreats since attack vectors follow
   * similar structural patterns.
   *
   * @private
   * @param content - Section content to extract from
   * @returns Array of attack vector objects with text and optional severity
   */
  private extractAttackVectors(content: string): Array<{
    text: string;
    severity?: 'critical' | 'high' | 'medium' | 'low';
  }> {
    // Same pattern as threats
    return this.extractThreats(content);
  }

  /**
   * Extract mitigations (countermeasures)
   *
   * Pattern: `- Mitigation: description` or `- **Pattern**: context`
   * Looks for mitigation keywords (prevention, defense, protection, etc.)
   *
   * @private
   * @param content - Section content to extract from
   * @returns Array of mitigation objects
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
   *
   * @private
   * @param text - Text to check for mitigation keywords
   * @returns True if text contains mitigation-related keywords
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
   *
   * Pattern: Bold statements containing "boundary", "trust", or "zone"
   *
   * @private
   * @param content - Section content to extract from
   * @returns Array of boundary statements
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
   *
   * Pattern: CVE-YYYY-NNNNN identifiers with surrounding context.
   * Strips code blocks to avoid extracting from examples.
   * Infers severity from context.
   *
   * @private
   * @param content - Section content to extract from
   * @returns Array of vulnerability objects with CVE metadata
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

    // Strip code blocks before processing
    const contentWithoutCodeBlocks = this.stripCodeBlocks(content);

    const lines = contentWithoutCodeBlocks.split('\n');
    const processedCVEs = new Set<string>();

    // Match CVE identifiers and extract complete context
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const cveMatch = line.match(/CVE-\d{4}-\d{4,}/g);

      if (cveMatch) {
        for (const cveId of cveMatch) {
          // Skip if already processed
          if (processedCVEs.has(cveId)) continue;
          processedCVEs.add(cveId);

          // Extract meaningful description from the same line or nearby lines
          let description = line
            .replace(cveId, '')
            .replace(/^[-*#\s]+/, '')
            .trim();

          // If description is too short or looks like code/JSON, try next lines
          if (
            description.length < 10 ||
            /^[{}[\],"':]+$/.test(description) ||
            description.endsWith(',') ||
            description.endsWith(':')
          ) {
            // Look for description in next few lines
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

          // Still invalid? Skip this CVE (likely from documentation example)
          if (
            !description ||
            description.length < 10 ||
            /^[{}[\],"':]+$/.test(description)
          ) {
            continue; // Skip instead of using placeholder
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
   * Strip code blocks from content to avoid extracting from examples
   *
   * Removes fenced code blocks (```...```) to prevent extracting
   * CVEs and other security content from documentation examples.
   *
   * @private
   * @param content - Content to strip code blocks from
   * @returns Content without code blocks
   */
  private stripCodeBlocks(content: string): string {
    // Remove fenced code blocks
    return content.replace(/```[\s\S]*?```/g, '');
  }

  /**
   * Infer severity from text
   *
   * Looks for severity keywords (critical, high, medium, low) and
   * threat indicators (exploit, injection).
   *
   * @private
   * @param text - Text to analyze for severity
   * @returns Inferred severity level or undefined
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
