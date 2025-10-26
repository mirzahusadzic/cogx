/**
 * SECURITY: Mission Section Whitelist
 *
 * Only these specific sections are parsed for mission concepts.
 * This prevents malicious injection via arbitrary markdown.
 *
 * WHY THIS MATTERS:
 * - Prevents attackers from injecting fake "mission" concepts via PRs
 * - Ensures only legitimate strategic documents influence coherence scoring
 * - Acts as a security boundary for strategic intelligence layer
 *
 * USAGE:
 * - ConceptExtractor filters sections using this whitelist
 * - Only whitelisted sections contribute to mission concepts overlay
 * - Case-insensitive matching for flexibility
 */

export const MISSION_SECTIONS = {
  /**
   * Whitelisted section headings
   * Only sections with these headings (case-insensitive) will be analyzed
   */
  whitelist: [
    'Vision',
    'Mission',
    'Principles',
    'Goals',
    'Core Values',
    'Strategic Intent',
    'Why',
    'Purpose',
  ],

  /**
   * Check if a heading matches the whitelist (case-insensitive)
   */
  matches(heading: string): boolean {
    const normalized = heading.toLowerCase().trim();
    return this.whitelist.some((allowed) =>
      normalized.includes(allowed.toLowerCase())
    );
  },

  /**
   * Get all whitelisted section names (for documentation/debugging)
   */
  getWhitelist(): string[] {
    return [...this.whitelist];
  },
} as const;
