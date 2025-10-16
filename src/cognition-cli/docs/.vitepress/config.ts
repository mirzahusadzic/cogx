import { defineConfig } from 'vitepress';

export default defineConfig({
  title: 'CogX CLI',
  description: 'A meta-interpreter for verifiable, stateful AI cognition.',
  themeConfig: {
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Get Started', link: '/introduction' },
    ],

    sidebar: [
      {
        text: 'Introduction',
        items: [
          { text: 'What is CogX CLI?', link: '/introduction' },
          { text: 'Installation', link: '/installation' },
        ],
      },
      {
        text: 'Core Concepts',
        items: [{ text: 'Architecture', link: '/architecture' }],
      },
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/your-repo-link' },
    ],
  },
});
