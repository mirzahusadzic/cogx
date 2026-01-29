import React from 'react';
import { render } from 'ink-testing-library';
import stripAnsi from 'strip-ansi';
import { ClaudePanelAgent } from '../ClaudePanelAgent.js';
import type { TUIMessage } from '../../hooks/useAgent.js';

// Mock useTUI to provide a stable context for tests
const mockTUIContext = {
  state: {
    focused: true,
    renderError: null,
    showInfoPanel: false,
    saveMessage: null,
    isDropdownVisible: false,
    streamingPaste: '',
    inputLineCount: 1,
    scrollSignal: null,
  },
  setFocus: vi.fn(),
  toggleFocus: vi.fn(),
  setRenderError: vi.fn(),
  setShowInfoPanel: vi.fn(),
  toggleInfoPanel: vi.fn(),
  setSaveMessage: vi.fn(),
  setIsDropdownVisible: vi.fn(),
  setStreamingPaste: vi.fn(),
  setInputLineCount: vi.fn(),
  sendScrollSignal: vi.fn(),
};

vi.mock('../../context/TUIContext.js', () => ({
  useTUI: () => mockTUIContext,
}));

describe('ClaudePanelAgent', () => {
  const createMessage = (
    type: TUIMessage['type'],
    content: string
  ): TUIMessage => ({
    type,
    content,
    timestamp: new Date(),
  });

  describe('empty state', () => {
    it('renders without crashing with empty messages', () => {
      expect(() => {
        render(
          <ClaudePanelAgent messages={[]} isThinking={false} focused={false} />
        );
      }).not.toThrow();
    });

    it('shows spinner when thinking with no messages', () => {
      const { lastFrame } = render(
        <ClaudePanelAgent messages={[]} isThinking={true} focused={false} />
      );
      expect(stripAnsi(lastFrame() ?? '')).toContain('Thinking');
    });
  });

  describe('message display', () => {
    it('displays user messages with > prefix', () => {
      const messages: TUIMessage[] = [createMessage('user', 'Hello Claude')];
      const { lastFrame } = render(
        <ClaudePanelAgent
          messages={messages}
          isThinking={false}
          focused={false}
        />
      );
      const output = stripAnsi(lastFrame() ?? '');
      expect(output).toContain('>');
      expect(output).toContain('Hello Claude');
    });

    it('displays assistant messages', () => {
      const messages: TUIMessage[] = [
        createMessage('assistant', 'Hello! How can I help you?'),
      ];
      const { lastFrame } = render(
        <ClaudePanelAgent
          messages={messages}
          isThinking={false}
          focused={false}
        />
      );
      expect(stripAnsi(lastFrame() ?? '')).toContain(
        'Hello! How can I help you?'
      );
    });

    it('displays system messages with bullet prefix', () => {
      const messages: TUIMessage[] = [
        createMessage('system', 'Session started'),
      ];
      const { lastFrame } = render(
        <ClaudePanelAgent
          messages={messages}
          isThinking={false}
          focused={false}
        />
      );
      const output = stripAnsi(lastFrame() ?? '');
      expect(output).toContain('*');
      expect(output).toContain('Session started');
    });

    it('displays thinking messages with robot emoji', () => {
      const messages: TUIMessage[] = [
        createMessage('thinking', 'Analyzing the code...'),
      ];
      const { lastFrame } = render(
        <ClaudePanelAgent
          messages={messages}
          isThinking={false}
          focused={false}
        />
      );
      const output = stripAnsi(lastFrame() ?? '');
      expect(output).toContain('🤖');
      expect(output).toContain('Analyzing the code');
    });

    it('displays tool_progress messages with various icons', () => {
      const messages: TUIMessage[] = [
        createMessage('tool_progress', '> Bash: npm install'),
        createMessage('tool_progress', '📋 Tasks: Update tests'),
      ];
      const { lastFrame } = render(
        <ClaudePanelAgent
          messages={messages}
          isThinking={false}
          focused={false}
        />
      );
      const output = stripAnsi(lastFrame() ?? '');
      expect(output).toContain('>');
      expect(output).toContain('Bash');
      expect(output).toContain('📋');
      expect(output).toContain('Tasks');
    });

    it('ensures Tasks tool results start on a new line even without explicit newline in input', () => {
      const messages: TUIMessage[] = [
        createMessage('tool_progress', '📋 Tasks: Update tests'),
      ];
      const { lastFrame } = render(
        <ClaudePanelAgent
          messages={messages}
          isThinking={false}
          focused={false}
        />
      );
      const output = lastFrame() ?? '';
      const lines = stripAnsi(output).split('\n');

      // Find the line containing "Tasks:"
      const tasksLineIndex = lines.findIndex((l) => l.includes('Tasks:'));
      expect(tasksLineIndex).toBeGreaterThanOrEqual(0);

      // The task content ("Update tests") should NOT be on the same line as "Tasks:"
      expect(lines[tasksLineIndex]).not.toContain('Update tests');

      // It should be on a subsequent line (wrapped in a code block)
      const contentFound = lines
        .slice(tasksLineIndex + 1)
        .some((l) => l.includes('Update tests'));
      expect(contentFound).toBe(true);
    });

    it('strips 4-space prefix and ANSI from tool results', () => {
      // Simulation of formatToolResult output for read_file
      const toolOutput =
        '    \x1b[36m   914│\x1b[0m \x1b[90mline content\x1b[0m';
      const messages: TUIMessage[] = [
        createMessage('tool_progress', '> Read: file.ts\n' + toolOutput),
      ];
      const { lastFrame } = render(
        <ClaudePanelAgent
          messages={messages}
          isThinking={false}
          focused={false}
        />
      );
      const output = stripAnsi(lastFrame() ?? '');
      // The output should contain the tool name and the cleaned content.
      expect(output).toContain('> Read:');
      expect(output).toContain('file.ts');
      expect(output).toContain('914│ line content');
    });

    it('preserves ANSI and protects against markdown in Edit tool results', () => {
      // Simulation of formatToolResult output for Edit tool
      // Includes ANSI for added line and markdown-like characters (backticks)
      const toolOutput =
        '    \x1b[36m    99│\x1b[0m \x1b[32m+\x1b[0m \x1b[42m\x1b[37mconst lines = markdownToLines(`\\n` + longCode);\x1b[0m';
      const messages: TUIMessage[] = [
        createMessage('tool_progress', '> Edit: file.ts\n' + toolOutput),
      ];
      const { lastFrame } = render(
        <ClaudePanelAgent
          messages={messages}
          isThinking={false}
          focused={false}
        />
      );
      const output = stripAnsi(lastFrame() ?? '');
      expect(output).toContain('> Edit:');
      expect(output).toContain('file.ts');
      expect(output).toContain(
        '99│ + const lines = markdownToLines(`\\n` + longCode);'
      );
      // Should NOT contain backticks stripped (since it's in a code block)
      expect(output).toContain('`\\n`');
    });

    it('displays multiple messages in order', () => {
      const messages: TUIMessage[] = [
        createMessage('user', 'First message'),
        createMessage('assistant', 'Second message'),
        createMessage('user', 'Third message'),
      ];
      const { lastFrame } = render(
        <ClaudePanelAgent
          messages={messages}
          isThinking={false}
          focused={false}
        />
      );
      const output = stripAnsi(lastFrame() ?? '');
      expect(output).toContain('First message');
      expect(output).toContain('Second message');
      expect(output).toContain('Third message');
    });
  });

  describe('markdown processing', () => {
    it('strips markdown bold markers (**text**)', () => {
      const messages: TUIMessage[] = [
        createMessage('assistant', 'This is **bold** text'),
      ];
      const { lastFrame } = render(
        <ClaudePanelAgent
          messages={messages}
          isThinking={false}
          focused={false}
        />
      );
      const output = stripAnsi(lastFrame() ?? '');
      expect(output).toContain('bold');
      expect(output).not.toContain('**');
    });
  });

  describe('thinking indicator', () => {
    it('shows spinner when isThinking is true', () => {
      const messages: TUIMessage[] = [createMessage('user', 'Hello')];
      const { lastFrame } = render(
        <ClaudePanelAgent
          messages={messages}
          isThinking={true}
          focused={false}
        />
      );
      expect(stripAnsi(lastFrame() ?? '')).toContain('Thinking');
    });

    it('hides spinner when isThinking is false', () => {
      const messages: TUIMessage[] = [createMessage('user', 'Hello')];
      const { lastFrame } = render(
        <ClaudePanelAgent
          messages={messages}
          isThinking={false}
          focused={false}
        />
      );
      expect(stripAnsi(lastFrame() ?? '')).not.toContain('Thinking');
    });
  });

  describe('streaming paste', () => {
    it('shows paste indicator when streamingPaste is provided', () => {
      const { lastFrame } = render(
        <ClaudePanelAgent
          messages={[]}
          isThinking={false}
          focused={false}
          streamingPaste="Some pasted content"
        />
      );
      const output = stripAnsi(lastFrame() ?? '');
      expect(output).toContain('📋');
      expect(output).toContain('Pasting');
    });

    it('displays streaming paste content', () => {
      const { lastFrame } = render(
        <ClaudePanelAgent
          messages={[]}
          isThinking={false}
          focused={false}
          streamingPaste="function hello() {\n  console.log('world');\n}"
        />
      );
      const output = stripAnsi(lastFrame() ?? '');
      expect(output).toContain('function hello');
      expect(output).toContain("console.log('world')");
    });

    it('does not show paste indicator when streamingPaste is empty', () => {
      const { lastFrame } = render(
        <ClaudePanelAgent
          messages={[]}
          isThinking={false}
          focused={false}
          streamingPaste=""
        />
      );
      expect(lastFrame()).not.toContain('📋');
    });
  });

  describe('focus state', () => {
    it('renders content in both focused and unfocused states', () => {
      const messages: TUIMessage[] = [createMessage('user', 'Test')];
      const { lastFrame: unfocused } = render(
        <ClaudePanelAgent
          messages={messages}
          isThinking={false}
          focused={false}
        />
      );
      const { lastFrame: focused } = render(
        <ClaudePanelAgent
          messages={messages}
          isThinking={false}
          focused={true}
        />
      );
      expect(stripAnsi(unfocused() ?? '')).toContain('Test');
      expect(stripAnsi(focused() ?? '')).toContain('Test');
    });

    it('shows scroll indicator when focused and content overflows', () => {
      // Create many messages to trigger scrolling
      const messages: TUIMessage[] = Array.from({ length: 50 }, (_, i) =>
        createMessage('assistant', `Message ${i + 1}`)
      );
      const { lastFrame } = render(
        <ClaudePanelAgent
          messages={messages}
          isThinking={false}
          focused={true}
        />
      );
      const output = stripAnsi(lastFrame() ?? '');
      // Should show scroll percentage indicator
      expect(output).toMatch(/↕.*%/);
    });
  });

  describe('multiline messages', () => {
    it('preserves line breaks in messages', () => {
      const messages: TUIMessage[] = [
        createMessage('assistant', 'Line 1\nLine 2\nLine 3'),
      ];
      const { lastFrame } = render(
        <ClaudePanelAgent
          messages={messages}
          isThinking={false}
          focused={false}
        />
      );
      const output = stripAnsi(lastFrame() ?? '');
      expect(output).toContain('Line 1');
      expect(output).toContain('Line 2');
      expect(output).toContain('Line 3');
    });

    it('only shows prefix on the first line of a multiline message', () => {
      const messages: TUIMessage[] = [
        createMessage('user', 'User Line 1\nUser Line 2'),
      ];
      const { lastFrame } = render(
        <ClaudePanelAgent
          messages={messages}
          isThinking={false}
          focused={false}
        />
      );
      const output = stripAnsi(lastFrame() ?? '');
      // Green user prefix is "> "
      expect(output).toContain('> User Line 1');
      // Second line should NOT have the prefix
      expect(output).toContain('  User Line 2');
      expect(output).not.toContain('> User Line 2');
    });
  });

  describe('memoization', () => {
    it.skip('maintains referential equality when props unchanged', () => {
      const messages: TUIMessage[] = [createMessage('user', 'Hello')];
      const { rerender, lastFrame } = render(
        <ClaudePanelAgent
          messages={messages}
          isThinking={false}
          focused={false}
        />
      );
      const firstFrame = lastFrame();

      rerender(
        <ClaudePanelAgent
          messages={messages}
          isThinking={false}
          focused={false}
        />
      );
      const secondFrame = lastFrame();

      expect(firstFrame).toBe(secondFrame);
    });

    it('updates when messages change', () => {
      const messages1: TUIMessage[] = [createMessage('user', 'First')];
      const { rerender, lastFrame } = render(
        <ClaudePanelAgent
          messages={messages1}
          isThinking={false}
          focused={false}
        />
      );
      const firstFrame = lastFrame();

      const messages2: TUIMessage[] = [
        ...messages1,
        createMessage('assistant', 'Second'),
      ];
      rerender(
        <ClaudePanelAgent
          messages={messages2}
          isThinking={false}
          focused={false}
        />
      );
      const secondFrame = lastFrame();

      expect(firstFrame).not.toBe(secondFrame);
    });

    it('updates when isThinking changes', () => {
      const messages: TUIMessage[] = [createMessage('user', 'Hello')];
      const { rerender, lastFrame } = render(
        <ClaudePanelAgent
          messages={messages}
          isThinking={false}
          focused={false}
        />
      );
      const firstFrame = lastFrame();

      rerender(
        <ClaudePanelAgent
          messages={messages}
          isThinking={true}
          focused={false}
        />
      );
      const secondFrame = lastFrame();

      expect(firstFrame).not.toBe(secondFrame);
    });
  });

  describe('component structure', () => {
    it('renders without crashing', () => {
      expect(() => {
        render(
          <ClaudePanelAgent messages={[]} isThinking={false} focused={false} />
        );
      }).not.toThrow();
    });
  });
});
