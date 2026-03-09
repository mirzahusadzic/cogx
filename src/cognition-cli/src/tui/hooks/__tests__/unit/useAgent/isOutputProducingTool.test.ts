import { describe, it, expect } from 'vitest';
import { isOutputProducingTool } from '../../../useAgent/useAgentHandlers.js';

describe('isOutputProducingTool', () => {
  it('should return true for output producing tools', () => {
    expect(isOutputProducingTool('bash')).toBe(true);
    expect(isOutputProducingTool('read_file')).toBe(true);
    expect(isOutputProducingTool('grep')).toBe(true);
    expect(isOutputProducingTool('glob')).toBe(true);
    expect(isOutputProducingTool('fetch_url')).toBe(true);
    expect(isOutputProducingTool('sigmataskupdate')).toBe(true);
    expect(isOutputProducingTool('recall_past_conversation')).toBe(true);
    expect(isOutputProducingTool('get_background_tasks')).toBe(true);
  });

  it('should handle normalization correctly', () => {
    expect(isOutputProducingTool('READ_FILE')).toBe(true);
    expect(isOutputProducingTool('mcp__server__read_file')).toBe(true);
    expect(isOutputProducingTool('mcp__filesystem__read_file')).toBe(true);
    expect(isOutputProducingTool('execute_bash')).toBe(true);
    expect(isOutputProducingTool('list_agents')).toBe(true);
  });

  it('should return false for non-output producing tools', () => {
    expect(isOutputProducingTool('write_file')).toBe(false);
    expect(isOutputProducingTool('edit_file')).toBe(false);
    expect(isOutputProducingTool('delete_file')).toBe(false);
    expect(isOutputProducingTool('unknown_tool')).toBe(false);
  });

  it('should handle undefined and empty names', () => {
    expect(isOutputProducingTool(undefined)).toBe(false);
    expect(isOutputProducingTool('')).toBe(false);
  });
});
