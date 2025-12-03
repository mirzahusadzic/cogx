import { defineConfig } from 'vitepress';

export default defineConfig({
  title: 'Open Cognition',
  description:
    'Verifiable AI memory through cryptographic grounding and multi-overlay knowledge graphs.',
  base: '/cogx/',
  srcExclude: ['**/architecture/audits/prompts/**'],
  ignoreDeadLinks: [
    // Ignore localhost links (eGemma workbench examples)
    /^http:\/\/localhost/,
    // Ignore .log file links (proof artifacts)
    /\.log$/,
  ],
  themeConfig: {
    nav: [
      { text: 'Home', link: '/' },
      {
        text: 'The Lattice Book',
        link: '/the-lattice-book-cover',
      },
      {
        text: 'Manual',
        link: '/manual/part-1-foundation/01-cognitive-architecture',
      },
      { text: 'Get Started', link: '/00_Introduction' },
    ],

    sidebar: [
      {
        text: 'The Lattice Book',
        link: '/',
        collapsed: false,
        items: [
          {
            text: 'Part 0: Quick Start',
            collapsed: false,
            items: [
              {
                text: '00 - Quick Start Guide',
                link: '/manual/part-0-quickstart/00-quick-start',
              },
            ],
          },
          {
            text: 'Part I: Foundation',
            collapsed: false,
            items: [
              {
                text: '01 - Cognitive Architecture',
                link: '/manual/part-1-foundation/01-cognitive-architecture',
              },
              {
                text: '02 - The PGC',
                link: '/manual/part-1-foundation/02-the-pgc',
              },
              {
                text: '03 - Why Overlays',
                link: '/manual/part-1-foundation/03-why-overlays',
              },
              {
                text: '04 - Embeddings',
                link: '/manual/part-1-foundation/04-embeddings',
              },
              {
                text: '04.5 - Core Security',
                link: '/manual/part-1-foundation/04.5-core-security',
              },
              {
                text: '05 - CLI Operations',
                link: '/manual/part-1-foundation/05-cli-operations',
              },
            ],
          },
          {
            text: 'Part II: The Seven Overlays',
            collapsed: false,
            items: [
              {
                text: '05 - O₁ Structural Patterns',
                link: '/manual/part-2-seven-layers/05-o1-structure',
              },
              {
                text: '06 - O₂ Security Guidelines',
                link: '/manual/part-2-seven-layers/06-o2-security',
              },
              {
                text: '07 - O₃ Lineage Patterns',
                link: '/manual/part-2-seven-layers/07-o3-lineage',
              },
              {
                text: '08 - O₄ Mission Concepts',
                link: '/manual/part-2-seven-layers/08-o4-mission',
              },
              {
                text: '09 - O₅ Operational Patterns',
                link: '/manual/part-2-seven-layers/09-o5-operational',
              },
              {
                text: '10 - O₆ Mathematical Proofs',
                link: '/manual/part-2-seven-layers/10-o6-mathematical',
              },
              {
                text: '11 - O₇ Strategic Coherence',
                link: '/manual/part-2-seven-layers/11-o7-coherence',
              },
            ],
          },
          {
            text: 'Part III: The Algebra',
            collapsed: false,
            items: [
              {
                text: '12 - Boolean Operations',
                link: '/manual/part-3-algebra/12-boolean-operations',
              },
              {
                text: '13 - Query Syntax',
                link: '/manual/part-3-algebra/13-query-syntax',
              },
              {
                text: '14 - Set Operations',
                link: '/manual/part-3-algebra/14-set-operations',
              },
              {
                text: '15 - Lattice Algebraic Properties',
                link: '/manual/part-3-algebra/15-lattice-algebraic-properties',
              },
            ],
          },
          {
            text: 'Part IV: Portability',
            collapsed: false,
            items: [
              {
                text: '15 - The .cogx Format',
                link: '/manual/part-4-portability/15-cogx-format',
              },
            ],
          },
          {
            text: 'Part V: cPoW Loop',
            collapsed: false,
            items: [
              {
                text: '18 - Operational Flow',
                link: '/manual/part-5-cpow-loop/18-operational-flow',
              },
              {
                text: '19 - Quest Structures',
                link: '/manual/part-5-cpow-loop/19-quest-structures',
              },
              {
                text: '20 - cPoW Reference',
                link: '/manual/part-5-cpow-loop/20-cpow-reference',
              },
              {
                text: '21 - F.L.T.B., AQS & CoMP',
                link: '/manual/part-5-cpow-loop/21-fltb-aqs-comp',
              },
            ],
          },
          {
            text: 'Part VI: Σ (Sigma) - Infinite Context',
            collapsed: false,
            items: [
              {
                text: '21 - Sigma Architecture',
                link: '/manual/part-6-sigma/21-sigma-architecture',
              },
              {
                text: 'Lattice Restoration',
                link: '/sigma/LATTICE_RESTORATION',
              },
            ],
          },
          {
            text: 'Appendices',
            collapsed: false,
            items: [
              {
                text: 'Appendix A - Troubleshooting',
                link: '/manual/appendix-a-troubleshooting',
              },
            ],
          },
        ],
      },
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/mirzahusadzic/cogx' },
    ],
  },
});
