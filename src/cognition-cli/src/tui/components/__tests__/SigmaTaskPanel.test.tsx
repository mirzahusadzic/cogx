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
    turns: 1,
  };

  it('renders task list header', () => {
    const { lastFrame } = render(
      <SigmaTaskPanel
        sigmaTasks={mockTasks}
        tokenCount={mockTokenCount}
        sessionTokenCount={mockTokenCount}
      />
    );
    expect(stripAnsi(lastFrame()!)).toContain('Σ TASK LIST');
  });

  it('renders task content', () => {
    const { lastFrame } = render(
      <SigmaTaskPanel
        sigmaTasks={mockTasks}
        tokenCount={mockTokenCount}
        sessionTokenCount={mockTokenCount}
      />
    );
    expect(stripAnsi(lastFrame()!)).toContain('Test task');
  });

  it('renders task summary', () => {
    const { lastFrame } = render(
      <SigmaTaskPanel
        sigmaTasks={mockTasks}
        tokenCount={mockTokenCount}
        sessionTokenCount={mockTokenCount}
      />
    );
    expect(stripAnsi(lastFrame()!)).toContain('Task summary');
  });

  it('renders token counts', () => {
    const { lastFrame } = render(
      <SigmaTaskPanel
        sigmaTasks={mockTasks}
        tokenCount={mockTokenCount}
        sessionTokenCount={mockTokenCount}
      />
    );
    // 1500 should be formatted as 1.5k
    expect(stripAnsi(lastFrame()!)).toContain('1.5k');
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
    expect(stripAnsi(lastFrame()!)).toContain('50');
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
    expect(stripAnsi(lastFrame()!)).toContain('75');
  });

  it('renders session token header', () => {
    const { lastFrame } = render(
      <SigmaTaskPanel
        sigmaTasks={mockTasks}
        tokenCount={mockTokenCount}
        sessionTokenCount={mockTokenCount}
      />
    );
    expect(stripAnsi(lastFrame()!)).toContain('Σ SESSION TOKENS');
  });

  it('renders turn counts in session tokens', () => {
    const { lastFrame } = render(
      <SigmaTaskPanel
        sigmaTasks={mockTasks}
        tokenCount={mockTokenCount}
        sessionTokenCount={{ ...mockTokenCount, turns: 5 }}
      />
    );
    expect(stripAnsi(lastFrame()!)).toContain('Reqs: 5');
  });

  it('limits the display to last 7 tasks', () => {
    const manyTasks: SigmaTasks = {
      todos: Array.from({ length: 11 }, (_, i) => ({
        ...mockTask,
        id: `${i + 1}`,
        content: `TASK_NUMBER_${i + 1}`,
      })),
    };
    const { lastFrame } = render(
      <SigmaTaskPanel
        sigmaTasks={manyTasks}
        tokenCount={mockTokenCount}
        sessionTokenCount={mockTokenCount}
      />
    );
    const frame = stripAnsi(lastFrame()!);
    expect(frame).not.toContain('TASK_NUMBER_1\n');
    expect(frame).not.toContain('TASK_NUMBER_1 ');
    expect(frame).toContain('TASK_NUMBER_5');
    expect(frame).toContain('TASK_NUMBER_11');
    expect(frame).toContain('... (4 older tasks)');
  });

  it('shows in_progress tasks even if they are older than the last 7 tasks', () => {
    const mixedTasks: SigmaTasks = {
      todos: [
        { ...mockInProgressTask, id: '1', activeForm: 'Old In Progress' },
        ...Array.from({ length: 11 }, (_, i) => ({
          ...mockTask,
          id: `${i + 2}`,
          content: `TASK_NUMBER_${i + 2}`,
        })),
      ],
    };
    const { lastFrame } = render(
      <SigmaTaskPanel
        sigmaTasks={mixedTasks}
        tokenCount={mockTokenCount}
        sessionTokenCount={mockTokenCount}
      />
    );
    const frame = stripAnsi(lastFrame() || '');
    expect(frame).toContain('Old In Progress');
    expect(frame).toContain('TASK_NUMBER_12');
    expect(frame).not.toContain('TASK_NUMBER_2\n');
    expect(frame).not.toContain('TASK_NUMBER_2 ');
    expect(frame).toContain('... (4 older tasks)');
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
    const frame = stripAnsi(lastFrame() || '');
    const cleanFrame = frame.replace(/\s/g, '');
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
    const frame = stripAnsi(lastFrame()!);
    expect(frame).not.toContain('Summary 1');
    expect(frame).not.toContain('Summary 2');
    expect(frame).not.toContain('Summary 3');
    expect(frame).toContain('Summary 4');
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
    const frame = stripAnsi(lastFrame() || '');
    expect(frame).toContain('Completed Task Content');
    expect(frame).toContain('In Progress Task Active');
    const completedIdx = frame.indexOf('Completed Task Content');
    const inProgressIdx = frame.indexOf('In Progress Task Active');
    expect(completedIdx).toBeLessThan(inProgressIdx);
  });

  it('renders close hint', () => {
    const { lastFrame } = render(
      <SigmaTaskPanel
        sigmaTasks={mockTasks}
        tokenCount={mockTokenCount}
        sessionTokenCount={mockTokenCount}
      />
    );
    expect(stripAnsi(lastFrame()!)).toContain("Press 't' to close");
  });

  it('limits visible tasks to 7 but always shows in-progress tasks', () => {
    const tasks: SigmaTask[] = [];
    for (let i = 1; i <= 15; i++) {
      tasks.push({
        id: `${i}`,
        content: `Task ${i}`,
        activeForm: `Working on ${i}`,
        status: 'completed',
        tokensAtStart: 10,
        tokensUsed: 5,
      });
    }

    // Add one in-progress task at the beginning that would be hidden by the 7-task limit
    const inProgressTask: SigmaTask = {
      id: 'in-progress-1',
      content: 'Important in-progress task',
      activeForm: 'Working on important task',
      status: 'in_progress',
      tokensAtStart: 10,
      tokensUsed: 5,
    };
    tasks.unshift(inProgressTask);

    const { lastFrame } = render(
      <SigmaTaskPanel
        sigmaTasks={{ todos: tasks }}
        tokenCount={mockTokenCount}
        sessionTokenCount={mockTokenCount}
      />
    );

    const output = stripAnsi(lastFrame()!);
    expect(output).toContain('Working on important task');
    expect(output).toContain('Task 15');
    expect(output).not.toContain('[✓] Task 1\n');
    expect(output).toContain('... (8 older tasks)');
  });

  it('only expands the most recent completed task and collapses older ones when many tasks exist', () => {
    const tasks: SigmaTask[] = [
      {
        id: '1',
        content: 'Completed 1',
        activeForm: 'A1',
        status: 'completed',
        result_summary: 'Summary 1',
      },
      {
        id: '2',
        content: 'Completed 2',
        activeForm: 'A2',
        status: 'completed',
        result_summary: 'Summary 2',
      },
      {
        id: '3',
        content: 'Completed 3',
        activeForm: 'A3',
        status: 'completed',
        result_summary: 'Summary 3',
      },
      {
        id: '4',
        content: 'Completed 4',
        activeForm: 'A4',
        status: 'completed',
        result_summary: 'Summary 4',
      },
    ];

    const { lastFrame } = render(
      <SigmaTaskPanel
        sigmaTasks={{ todos: tasks }}
        tokenCount={mockTokenCount}
        sessionTokenCount={mockTokenCount}
      />
    );

    const output = stripAnsi(lastFrame()!);

    // Newest task should be expanded (id: '4')
    expect(output).toContain('Completed 4');
    expect(output).toContain('Summary 4');

    // Older tasks should be visible but their summaries should be hidden (since tasks.length > 3)
    expect(output).toContain('Completed 1');
    expect(output).not.toContain('Summary 1');
    expect(output).toContain('Completed 2');
    expect(output).not.toContain('Summary 2');
    expect(output).toContain('Completed 3');
    expect(output).not.toContain('Summary 3');
  });
});
