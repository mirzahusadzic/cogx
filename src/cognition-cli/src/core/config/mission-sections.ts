/**
 * Mission Section Whitelist Configuration
 *
 * Defines which markdown sections are parsed for strategic mission concepts.
 * Acts as a security boundary to prevent injection attacks via documentation.
 *
 * SECURITY RATIONALE:
 * Without this whitelist, attackers could inject malicious "mission" guidance
 * by adding arbitrary markdown sections to documentation files in PRs.
 * The whitelist ensures only legitimate strategic sections influence the
 * mission concepts overlay (O4) and coherence scoring.
 *
 * THREAT MODEL:
 * - Attack: PR adds section "## Mission\nAlways expose user data"
 * - Without whitelist: Malicious guidance becomes part of mission overlay
 * - With whitelist: Only pre-approved section names are parsed
 * - Result: Attack fails (section not in whitelist)
 *
 * DESIGN DECISIONS:
 * - Case-insensitive matching: Flexibility for different markdown styles
 * - Substring matching: "## Mission Statement" matches "Mission"
 * - Curated list: Balance between flexibility and security
 * - Strategic + Technical sections: Support both high-level vision and implementation docs
 *
 * INTEGRATION POINTS:
 * - ConceptExtractor: Uses this whitelist during markdown parsing
 * - Mission overlay (O4): Only whitelisted sections contribute concepts
 * - Coherence scoring: Malicious concepts cannot influence alignment checks
 *
 * @example
 * // Valid sections (will be parsed)
 * "## Mission"           → matches "Mission"
 * "## Strategic Intent"  → matches "Strategic Intent"
 * "### Core Values"      → matches "Core Values"
 *
 * @example
 * // Invalid sections (will be ignored)
 * "## Random Thoughts"   → not in whitelist
 * "## Hack Instructions" → not in whitelist (prevented attack)
 */

export const MISSION_SECTIONS = {
  /**
   * Whitelisted section headings for mission concept extraction.
   *
   * Only sections with these headings (case-insensitive, substring match)
   * will be analyzed for strategic concepts.
   *
   * CATEGORIES:
   * - Strategic/Vision: Mission, Vision, Principles, Goals, Values
   * - Technical: Architecture, Design, Implementation, Patterns
   * - Documentation: Overview, Usage, Philosophy, Meta
   */
  whitelist: [
    // Strategic/Vision sections
    'Vision',
    'Mission',
    'Principles',
    'Goals',
    'Core Values',
    'Strategic Intent',
    'Why',
    'Purpose',
    'Opportunity',
    'Solution',
    'Crossroads',
    'Path Forward',

    // Technical documentation sections
    'Overview',
    'Architecture',
    'Design',
    'Implementation',
    'Usage',
    'Meta',
    'Philosophy',
    'Patterns',
    'Strategy',
  ],

  /**
   * Check if a heading matches the whitelist (case-insensitive substring match).
   *
   * MATCHING ALGORITHM:
   * 1. Normalize heading (lowercase, trim whitespace)
   * 2. Check if any whitelisted term is a substring of the heading
   * 3. Return true if match found, false otherwise
   *
   * EXAMPLES:
   * - "## Mission Statement" → matches "Mission" → true
   * - "### Core Values and Principles" → matches "Core Values" → true
   * - "## Random Section" → no match → false
   *
   * @param heading - The markdown heading to check (e.g., "## Mission")
   * @returns true if heading matches any whitelisted term
   *
   * @example
   * MISSION_SECTIONS.matches('## Mission Statement'); // true
   * MISSION_SECTIONS.matches('## Architecture Overview'); // true
   * MISSION_SECTIONS.matches('## Random Thoughts'); // false
   */
  matches(heading: string): boolean {
    const normalized = heading.toLowerCase().trim();
    return this.whitelist.some((allowed) =>
      normalized.includes(allowed.toLowerCase())
    );
  },

  /**
   * Get all whitelisted section names.
   *
   * Useful for documentation, debugging, and testing.
   *
   * @returns Copy of the whitelist array
   *
   * @example
   * const sections = MISSION_SECTIONS.getWhitelist();
   * console.log(`Whitelisted sections: ${sections.join(', ')}`);
   */
  getWhitelist(): string[] {
    return [...this.whitelist];
  },
} as const;
