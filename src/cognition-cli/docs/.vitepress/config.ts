import { defineConfig } from 'vitepress';

export default defineConfig({
  title: 'Cognition CLI',
  description: 'A meta-interpreter for verifiable, stateful AI cognition.',
  themeConfig: {
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Get Started', link: '/introduction' },
    ],

    sidebar: [
      {
        text: 'Documentation',
        items: [
          {
            text: '00 - Introduction to Cognition CLI',
            link: '/00_Introduction',
          },
          {
            text: '01 - Structural Analysis: Mapping the Codebase',
            link: '/01_Structural_Analysis',
          },
          {
            text: '02 - Core Infrastructure: The Grounded Context Pool (PGC)',
            link: '/02_Core_Infrastructure',
          },
          {
            text: '03 - Commands: Interacting with the Cognition CLI',
            link: '/03_Commands',
          },
          {
            text: '04 - Miners and Executors: Extracting and Processing Knowledge',
            link: '/04_Miners_and_Executors',
          },
          {
            text: '05 - Verification and Oracles: Ensuring PGC Integrity',
            link: '/05_Verification_and_Oracles',
          },
          {
            text: '06 - Testing and Deployment',
            link: '/06_Testing_and_Deployment',
          },
          {
            text: '07 - AI-Grounded Architecture Analysis',
            link: '/07_AI_Grounded_Architecture_Analysis',
          },
          {
            text: '08 - Claude Code Integration',
            link: '/08_Claude_CLI_Integration',
          },
        ],
      },
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/mirzahusadzic/cogx' },
    ],
  },
});
