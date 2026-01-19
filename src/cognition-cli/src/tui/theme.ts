export const TUITheme = {
  // Base text colors
  text: {
    primary: '#a0b0c0', // Silver
    secondary: '#94a3b8', // Slate gray
    tertiary: '#8b9cb0', // Muted blue-gray (Improved contrast)
    inverse: '#0d131c', // Dark background
    error: '#ff7b72', // Red
    warning: '#fcae27', // Amber
    success: '#34d399', // Emerald
  },

  // Background colors (AIEcho Palette)
  background: {
    primary: '#0d131c', // Dark blue-charcoal
    secondary: '#1c2433', // Deep blue-charcoal
    code: '#090e14', // Slightly darker for code blocks
    selection: '#34d399',
  },

  // Role-based colors - MONOLITH SCHEME
  roles: {
    user: '#a0b0c0', // Primary Silver
    assistant: '#4dd0e1', // Cyan
    system: '#94a3b8', // Slate Gray
    thinking: '#94a3b8', // Slate Gray
    thinkingInlineCode: '#4dd0e1', // Cyan
    tool: '#94a3b8', // Slate Gray
    toolResult: '#94a3b8', // Slate Gray
  },

  // Message styling
  messages: {
    user: {
      text: '#a0b0c0',
      bg: undefined as string | undefined,
    },
    assistant: {
      text: '#a0b0c0',
      bg: undefined as string | undefined,
    },
    system: {
      text: '#94a3b8',
      bg: undefined as string | undefined,
    },
    thinking: {
      text: '#94a3b8',
      bg: undefined as string | undefined,
    },
  },

  // Overlay colors (O1-O7) - Distinct Cyan Shades
  overlays: {
    o1_structural: '#4dd0e1', // Cyan 300
    o2_security: '#fcae27', // Amber (Keep for visibility)
    o3_lineage: '#34d399', // Green (Keep for visibility)
    o4_mission: '#80deea', // Cyan 200
    o5_operational: '#94a3b8', // Slate (Neutral)
    o6_mathematical: '#26c6da', // Cyan 400
    o7_strategic: '#00acc1', // Cyan 600
  },

  // Syntax highlighting
  syntax: {
    heading: {
      h1: '#4dd0e1', // Cyan
      h2: '#4dd0e1', // Cyan
      h3: '#4dd0e1', // Cyan
      prefix: '#506b9b',
    },
    code: {
      block: '#a0b0c0',
      inline: '#4dd0e1', // Cyan accent
      background: '#090e14',
    },
    diff: {
      add: '#34d399', // Green
      addBg: '#11221a',
      remove: '#ff7b72', // Red
      removeBg: '#2a1414',
      header: '#4dd0e1', // Cyan
      meta: '#828c9b', // Muted
    },
    link: '#4dd0e1', // Cyan links
    lineNumber: '#374862',
  },

  // UI Elements
  ui: {
    border: {
      focused: '#4dd0e1', // Cyan
      default: '#374862', // Muted blue-gray
      dim: '#1c2433',
    },
    paste: {
      header: '#4dd0e1', // Cyan
      content: '#a0b0c0', // Silver
    },
    spinner: '#4dd0e1', // Cyan
    error: '#ff7b72',
    warning: '#fcae27',
    success: '#34d399',
  },

  // Cognition markers
  cognition: {
    vibrantTitles: [
      'Idle Moment',
      'Strategic Assessment',
      'Mental Map',
      'Context Reconstruction',
      'Task Planning',
    ],
  },

  // Provider branding
  providers: {
    anthropic: '#d97757', // Claude Orange
    google: '#4285f4', // Google Blue
    openai: '#ffffff', // OpenAI White
  },
};
