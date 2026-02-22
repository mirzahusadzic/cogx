import React from 'react';
import { render } from 'ink-testing-library';
import { SigmaTaskPanel } from '../SigmaTaskPanel.js';
import { SigmaTasks, SigmaTask } from '../../hooks/useAgent/types.js';

describe('SigmaTaskPanel', () => {
  const mockTask: SigmaTask = {
    id: '1',
    content: 'Test task',
    activeForm: 'Testing task',
    status: 'completed',
    result_summary: 'Task summary',
    tokensAtStart: 100,
    tokensUsed: 50,
  };

  const mockTasks: SigmaTasks = {
    todos: [mockTask],
  };

  const mockTokenCount = {
    input: 1000,
    output: 500,
    total: 1500,
  };

  it('renders task list header', () => {
    const { lastFrame } = render(
      <SigmaTaskPanel sigmaTasks={mockTasks} tokenCount={mockTokenCount} />
    );
    expect(lastFrame()).toContain('Σ TASK LIST');
  });

  it('renders task content', () => {
    const { lastFrame } = render(
      <SigmaTaskPanel sigmaTasks={mockTasks} tokenCount={mockTokenCount} />
    );
    expect(lastFrame()).toContain('Test task');
  });

  it('renders task summary', () => {
    const { lastFrame } = render(
      <SigmaTaskPanel sigmaTasks={mockTasks} tokenCount={mockTokenCount} />
    );
    expect(lastFrame()).toContain('Task summary');
  });

  it('renders token counts', () => {
    const { lastFrame } = render(
      <SigmaTaskPanel sigmaTasks={mockTasks} tokenCount={mockTokenCount} />
    );
    // 1500 should be formatted as 1,500
    expect(lastFrame()).toContain('1,500');
  });

  it('renders individual task token usage', () => {
    const { lastFrame } = render(
      <SigmaTaskPanel sigmaTasks={mockTasks} tokenCount={mockTokenCount} />
    );
    // 50 tokens
    expect(lastFrame()).toContain('50');
  });
});
