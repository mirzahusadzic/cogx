import { describe, it, expect } from 'vitest';
import { stripSigmaMarkers } from '../../../../../utils/string-utils.js';

describe('stripSigmaMarkers', () => {
  it('should strip sigma markers and clean up resulting empty lines', () => {
    const input = 'Header\n<!-- sigma-task: task-1 -->\nContent';
    const expected = 'Header\nContent';
    expect(stripSigmaMarkers(input)).toBe(expected);
  });

  it('should strip multiple markers', () => {
    const input =
      '<!-- sigma-task: task-1 -->\nHeader\n<!-- sigma-task: task-2 -->\nContent';
    const expected = 'Header\nContent';
    expect(stripSigmaMarkers(input)).toBe(expected);
  });

  it('should trim resulting output', () => {
    const input = '  <!-- sigma-task: task-1 -->  \n  Content  ';
    const expected = '  Content';
    expect(stripSigmaMarkers(input)).toBe(expected);
  });

  it('should handle bash-style output with exit code and trailing marker', () => {
    const input = 'Exit code: \x1b[32m0\x1b[0m\n\n<!-- sigma-task: task-1 -->';
    const expected = 'Exit code: \x1b[32m0\x1b[0m';
    expect(stripSigmaMarkers(input)).toBe(expected);
  });
});
