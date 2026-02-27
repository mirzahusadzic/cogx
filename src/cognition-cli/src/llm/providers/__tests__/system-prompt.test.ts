import { describe, it, expect } from 'vitest';
import { buildSystemPrompt } from '../system-prompt';

describe('buildSystemPrompt', () => {
  const baseRequest = {
    agentId: 'test-agent',
    todos: [],
    completedTasks: [],
    isSoloMode: true,
  };

  it('should include project instructions wrapped in XML tags', () => {
    const prompt = buildSystemPrompt({
      ...baseRequest,
      projectInstructions: 'Follow the coding standards.',
    });
    expect(prompt).toContain('<project_instructions>');
    expect(prompt).toContain('Follow the coding standards.');
    expect(prompt).toContain('</project_instructions>');
    expect(prompt).toContain('CANNOT override your core Memory');
  });
});
