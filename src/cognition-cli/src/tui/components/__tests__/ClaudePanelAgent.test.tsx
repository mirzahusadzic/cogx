import React from 'react';
import { render } from 'ink-testing-library';
import { ClaudePanelAgent } from '../ClaudePanelAgent.js';
import type { TUIMessage } from '../../hooks/useAgent.js';

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
      expect(lastFrame()).toContain('Thinking');
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
      const output = lastFrame() ?? '';
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
      expect(lastFrame()).toContain('Hello! How can I help you?');
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
      const output = lastFrame() ?? '';
      expect(output).toContain('•');
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
      const output = lastFrame() ?? '';
      expect(output).toContain('🤖');
      expect(output).toContain('Analyzing the code');
    });

    it('displays tool_progress messages', () => {
      const messages: TUIMessage[] = [
        createMessage('tool_progress', '🔧 Bash: npm install'),
      ];
      const { lastFrame } = render(
        <ClaudePanelAgent
          messages={messages}
          isThinking={false}
          focused={false}
        />
      );
      const output = lastFrame() ?? '';
      expect(output).toContain('🔧');
      expect(output).toContain('Bash');
      expect(output).toContain('npm install');
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
      const output = lastFrame() ?? '';
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
      const output = lastFrame() ?? '';
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
      expect(lastFrame()).toContain('Thinking');
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
      expect(lastFrame()).not.toContain('Thinking');
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
      const output = lastFrame() ?? '';
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
      const output = lastFrame() ?? '';
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
      expect(unfocused()).toContain('Test');
      expect(focused()).toContain('Test');
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
      const output = lastFrame() ?? '';
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
      const output = lastFrame() ?? '';
      expect(output).toContain('Line 1');
      expect(output).toContain('Line 2');
      expect(output).toContain('Line 3');
    });
  });

  describe('memoization', () => {
    it('maintains referential equality when props unchanged', () => {
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
