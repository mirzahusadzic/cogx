import React from 'react';
import { render } from 'ink-testing-library';
import { InputBox } from '../InputBox.js';
import stripAnsi from 'strip-ansi';
import { vi, describe, it, expect } from 'vitest';

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

describe('InputBox', () => {
  it('types characters', async () => {
    const { stdin, lastFrame } = render(
      <InputBox onSubmit={() => {}} focused={true} />
    );

    stdin.write('h');
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(stripAnsi(lastFrame() ?? '')).toContain('h');
  });
});
