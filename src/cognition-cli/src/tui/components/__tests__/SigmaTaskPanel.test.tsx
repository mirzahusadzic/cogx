import React from 'react';
import { render } from 'ink-testing-library';
import stripAnsi from 'strip-ansi';
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

  const mockInProgressTask: SigmaTask = {
    id: '2',
    content: 'In progress task',
    activeForm: 'Working on it',
    status: 'in_progress',
    tokensAtStart: 200,
    tokensUsed: 75,
  };

  const mockTasks: SigmaTasks = {
    todos: [mockTask, mockInProgressTask],
  };

  const mockTokenCount = {
    input: 1000,
    output: 500,
    total: 1500,
    costUsd: 0,
    savedCostUsd: 0,
  };

  it('renders task list header', () => {
    const { lastFrame } = render(
      <SigmaTaskPanel
        sigmaTasks={mockTasks}
        tokenCount={mockTokenCount}
        sessionTokenCount={mockTokenCount}
      />
    );
    expect(lastFrame()).toContain('Σ TASK LIST');
  });

  it('renders task content', () => {
    const { lastFrame } = render(
      <SigmaTaskPanel
        sigmaTasks={mockTasks}
        tokenCount={mockTokenCount}
        sessionTokenCount={mockTokenCount}
      />
    );
    expect(lastFrame()).toContain('Test task');
  });

  it('renders task summary', () => {
    const { lastFrame } = render(
      <SigmaTaskPanel
        sigmaTasks={mockTasks}
        tokenCount={mockTokenCount}
        sessionTokenCount={mockTokenCount}
      />
    );
    expect(lastFrame()).toContain('Task summary');
  });

  it('renders token counts', () => {
    const { lastFrame } = render(
      <SigmaTaskPanel
        sigmaTasks={mockTasks}
        tokenCount={mockTokenCount}
        sessionTokenCount={mockTokenCount}
      />
    );
    // 1500 should be formatted as 1,500
    expect(lastFrame()).toContain('1,500');
  });

  it('renders individual task token usage', () => {
    const { lastFrame } = render(
      <SigmaTaskPanel
        sigmaTasks={mockTasks}
        tokenCount={mockTokenCount}
        sessionTokenCount={mockTokenCount}
      />
    );
    // 50 tokens
    expect(lastFrame()).toContain('50');
  });

  it('renders in-progress task token usage', () => {
    const { lastFrame } = render(
      <SigmaTaskPanel
        sigmaTasks={mockTasks}
        tokenCount={mockTokenCount}
        sessionTokenCount={mockTokenCount}
      />
    );
    // 75 tokens
    expect(lastFrame()).toContain('75');
  });

  it('renders session token header', () => {
    const { lastFrame } = render(
      <SigmaTaskPanel
        sigmaTasks={mockTasks}
        tokenCount={mockTokenCount}
        sessionTokenCount={mockTokenCount}
      />
    );
    expect(lastFrame()).toContain('Σ SESSION TOKENS');
  });

  it('truncates long task summaries', () => {
    const longSummary = 'A'.repeat(200);
    const tasksWithLongSummary: SigmaTasks = {
      todos: [{ ...mockTask, result_summary: longSummary }],
    };
    const { lastFrame } = render(
      <SigmaTaskPanel
        sigmaTasks={tasksWithLongSummary}
        tokenCount={mockTokenCount}
        sessionTokenCount={mockTokenCount}
      />
    );
    // Should be truncated
    const frame = lastFrame() || '';
    const cleanFrame = stripAnsi(frame).replace(/\s/g, '');
    expect(cleanFrame).toContain('A'.repeat(140) + '...');
    expect(cleanFrame).not.toContain('A'.repeat(200));
  });

  it('hides summaries when there are more than 3 tasks, except for the last completed one', () => {
    const manyTasks: SigmaTasks = {
      todos: [
        { ...mockTask, id: '1', result_summary: 'Summary 1' },
        { ...mockTask, id: '2', result_summary: 'Summary 2' },
        { ...mockTask, id: '3', result_summary: 'Summary 3' },
        { ...mockTask, id: '4', result_summary: 'Summary 4' },
      ],
    };
    const { lastFrame } = render(
      <SigmaTaskPanel
        sigmaTasks={manyTasks}
        tokenCount={mockTokenCount}
        sessionTokenCount={mockTokenCount}
      />
    );
    expect(lastFrame()).not.toContain('Summary 1');
    expect(lastFrame()).not.toContain('Summary 2');
    expect(lastFrame()).not.toContain('Summary 3');
    expect(lastFrame()).toContain('Summary 4');
  });

  it('renders completed tasks before in_progress tasks', () => {
    const unorderedTasks: SigmaTasks = {
      todos: [
        {
          ...mockTask,
          id: '1',
          content: 'In Progress Task Content',
          activeForm: 'In Progress Task Active',
          status: 'in_progress',
        },
        {
          ...mockTask,
          id: '2',
          content: 'Completed Task Content',
          status: 'completed',
        },
      ],
    };
    const { lastFrame } = render(
      <SigmaTaskPanel
        sigmaTasks={unorderedTasks}
        tokenCount={mockTokenCount}
        sessionTokenCount={mockTokenCount}
      />
    );
    const frame = lastFrame() || '';
    expect(frame).toContain('Completed Task Content');
    expect(frame).toContain('In Progress Task Active');
    const completedIdx = frame.indexOf('Completed Task Content');
    const inProgressIdx = frame.indexOf('In Progress Task Active');
    expect(completedIdx).toBeLessThan(inProgressIdx);
  });
});
