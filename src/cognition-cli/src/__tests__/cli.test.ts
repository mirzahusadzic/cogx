import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';

describe('CLI Smoke Test', () => {
  it('should show help message', () => {
    // Testing the actual execution is the most "smoke-y" test
    const output = execSync(`npx tsx src/cli.ts --help`, {
      encoding: 'utf-8',
      env: { ...process.env, NO_COLOR: '1' },
    });

    expect(output).toContain('Usage: cognition-cli');
    expect(output).toContain('init');
    expect(output).toContain('genesis');
    expect(output).toContain('query');
    expect(output).toContain('tui');
  });

  it('should show version', () => {
    const output = execSync(`npx tsx src/cli.ts --version`, {
      encoding: 'utf-8',
    });
    expect(output).toMatch(/\d+\.\d+\.\d+/);
  });
});
