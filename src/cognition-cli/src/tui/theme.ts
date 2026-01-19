export const TUITheme = {
  // Base text colors
  text: {
    primary: '#a0b0c0',
    secondary: '#8b9bb4', // Muted gray
    tertiary: '#484f58', // Dark gray
    inverse: '#0d131c', // Dark background (matches color-background-primary)
    error: '#f85149', // Red
    warning: '#fcae27', // Amber (matches color-accent-orange)
    success: '#34d399', // Vibe green (Emerald 400)
  },

  // Background colors (AIEcho Palette)
  background: {
    primary: '#0d131c', // Dark blue-charcoal (Main BG)
    secondary: '#2e3c52', // Lighter blue-charcoal (Bubbles/Sidebar)
    code: '#1c2433', // Deep blue for code blocks
    selection: '#34d399', // Greenish selection
  },

  // Role-based colors - MATCHING AIECHO THEME
  roles: {
    user: '#fcae27', // Amber-Orange (matches color-accent-orange)
    assistant: '#8bfdda', // Cyan/Aqua (matches color-accent-green-light/Gemini)
    system: '#8b9bb4', // Muted Gray
    thinking: '#58a6ff', // Blue (Operational - matches 🐘 Edges)
    thinkingInlineCode: '#58a6ff', // Same Blue (will be dimmed via attribute)
    tool: '#34d399', // Vibe green (Emerald 400)
    toolResult: '#8b9bb4', // Muted Gray (secondary)
  },

  // Message styling
  messages: {
    user: {
      text: '#fcae27', // Amber
      bg: undefined, // Transparent to blend with terminal
    },
    assistant: {
      text: '#848d97', // Dimmed Primary (was Cyan #8bfdda)
      bg: undefined, // Transparent
    },
    system: {
      text: '#8b9bb4', // Gray
      bg: undefined,
    },
    thinking: {
      text: '#58a6ff', // Blue (matches roles.thinking)
      bg: undefined,
    },
  },

  // Overlay colors (O1-O7) - Adapted to Vibe
  overlays: {
    o1_structural: '#8bfdda', // Cyan (Structural/Architectural)
    o2_security: '#fcae27', // Amber (Alert/Warning)
    o3_lineage: '#34d399', // Green (Growth/History)
    o4_mission: '#d29922', // Darker Gold
    o5_operational: '#58a6ff', // Blue (Operations/Logic - classic tech color)
    o6_mathematical: '#bc8cff', // Purple (Math/Abstract)
    o7_strategic: '#9ed2f5', // Vivid Cyan (Strategic/High Level)
  },

  // Syntax highlighting
  syntax: {
    heading: {
      h1: '#8bfdda', // Cyan
      h2: '#34d399', // Green
      h3: '#82aaff', // Lighter Blue
      prefix: '#484f58',
    },
    code: {
      block: '#a0b0c0',
      inline: '#fcae27', // Amber for inline (stand out)
      background: '#1c2433', // AIEcho code background
    },
    diff: {
      add: '#46f2b6', // Brighter Green
      addBg: '#1b3b24', // Slightly brighter Forest Green
      remove: '#ff7b72', // Brighter Red
      removeBg: '#441d1d', // Slightly brighter Maroon
      header: '#bc8cff', // Purple
      meta: '#6e7681', // Gray
    },
    link: '#fcae27', // Amber links (matches color-accent-orange)
    lineNumber: '#a0b0c0', // Muted gray line numbers
  },

  // UI Elements
  ui: {
    border: {
      focused: '#34d399', // Green
      default: '#30363d',
      dim: '#1e2329',
    },
    paste: {
      header: '#34d399', // Green
      content: '#fcae27', // Amber
    },
    spinner: '#8bfdda', // Cyan
    error: '#f85149',
    warning: '#fcae27',
    success: '#34d399',
  },

  // Provider branding
  providers: {
    anthropic: '#d97757', // Claude Orange
    google: '#4285f4', // Google Blue
    openai: '#ffffff', // OpenAI White
  },
};
