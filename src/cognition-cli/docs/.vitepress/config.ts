import { defineConfig } from 'vitepress';

export default defineConfig({
  title: 'Cognition CLI',
  description:
    'Verifiable AI memory through cryptographic grounding and multi-overlay knowledge graphs.',
  base: '/cogx/',
  themeConfig: {
    nav: [
      { text: 'Home', link: '/' },
      {
        text: 'Manual',
        link: '/manual/part-1-foundation/01-cognitive-architecture',
      },
      { text: 'Get Started', link: '/introduction' },
    ],

    sidebar: [
      {
        text: 'Getting Started',
        items: [
          {
            text: 'Introduction',
            link: '/00_Introduction',
          },
          {
            text: 'Structural Analysis',
            link: '/01_Structural_Analysis',
          },
          {
            text: 'Core Infrastructure (PGC)',
            link: '/02_Core_Infrastructure',
          },
          {
            text: 'Commands Overview',
            link: '/03_Commands',
          },
        ],
      },
      {
        text: 'Foundation Manual',
        collapsed: false,
        items: [
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
            ],
          },
        ],
      },
      {
        text: 'Advanced Topics',
        collapsed: true,
        items: [
          {
            text: 'Miners and Executors',
            link: '/04_Miners_and_Executors',
          },
          {
            text: 'Verification and Oracles',
            link: '/05_Verification_and_Oracles',
          },
          {
            text: 'Testing and Deployment',
            link: '/06_Testing_and_Deployment',
          },
          {
            text: 'AI-Grounded Architecture Analysis',
            link: '/07_AI_Grounded_Architecture_Analysis',
          },
          {
            text: 'Claude Code Integration',
            link: '/08_Claude_CLI_Integration',
          },
          {
            text: 'Mission Concept Extraction',
            link: '/09_Mission_Concept_Extraction',
          },
          {
            text: 'Mission Security Validation',
            link: '/10_Mission_Security_Validation',
          },
        ],
      },
      {
        text: 'Philosophy & Vision',
        collapsed: true,
        items: [
          {
            text: 'Cognitive Prosthetics',
            link: '/COGNITIVE_PROSTHETICS',
          },
          {
            text: 'Dual Use Mandate',
            link: '/DUAL_USE_MANDATE',
          },
          {
            text: 'Lattice Algebra',
            link: '/LATTICE_ALGEBRA',
          },
          {
            text: 'Neural Memory Protocol',
            link: '/NEURAL_MEMORY_PROTOCOL',
          },
          {
            text: 'Vindication',
            link: '/VINDICATION',
          },
        ],
      },
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/mirzahusadzic/cogx' },
    ],
  },
});
