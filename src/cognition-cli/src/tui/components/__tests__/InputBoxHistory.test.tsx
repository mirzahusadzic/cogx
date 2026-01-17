import React from 'react';
import { render } from 'ink-testing-library';
import { InputBox } from '../InputBox.js';
import stripAnsi from 'strip-ansi';
import { vi, describe, it, expect, beforeEach } from 'vitest';

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
  clearScrollSignal: vi.fn(),
};

vi.mock('../../context/TUIContext.js', () => ({
  useTUI: () => mockTUIContext,
}));

// Mock the loader
vi.mock('../../commands/loader.js', () => ({
  loadCommands: vi.fn().mockResolvedValue({
    commands: new Map(),
    errors: [],
    warnings: [],
  }),
  filterCommands: vi.fn().mockReturnValue([]),
}));

describe('InputBox History', () => {
  const mockOnSubmit = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('navigates through command history with arrows', async () => {
    const { stdin, lastFrame } = render(
      <InputBox onSubmit={mockOnSubmit} focused={true} />
    );

    // Enter first command
    for (const char of 'first') {
      stdin.write(char);
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    stdin.write('\r');
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(mockOnSubmit).toHaveBeenCalledWith('first');

    // Enter second command
    for (const char of 'second') {
      stdin.write(char);
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    stdin.write('\r');
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(mockOnSubmit).toHaveBeenCalledWith('second');

    // Press Up arrow - should show 'second'
    stdin.write('\u001b[A');
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(stripAnsi(lastFrame() ?? '')).toContain('second');

    // Press Up arrow again - should show 'first'
    stdin.write('\u001b[A');
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(stripAnsi(lastFrame() ?? '')).toContain('first');

    // Press Down arrow - should show 'second'
    stdin.write('\u001b[B');
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(stripAnsi(lastFrame() ?? '')).toContain('second');

    // Press Down arrow again - should show empty (draft)
    stdin.write('\u001b[B');
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(stripAnsi(lastFrame() ?? '')).toContain('Type a message');
  });

  it('preserves draft value when navigating history', async () => {
    const { stdin, lastFrame } = render(
      <InputBox onSubmit={mockOnSubmit} focused={true} />
    );

    // Enter a command to have history
    for (const char of 'old') {
      stdin.write(char);
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    stdin.write('\r');
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Type a draft
    for (const char of 'draft') {
      stdin.write(char);
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(stripAnsi(lastFrame() ?? '')).toContain('draft');

    // Go Up to history
    stdin.write('\u001b[A');
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(stripAnsi(lastFrame() ?? '')).toContain('old');

    // Go Down back to draft
    stdin.write('\u001b[B');
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(stripAnsi(lastFrame() ?? '')).toContain('draft');
  });
});
