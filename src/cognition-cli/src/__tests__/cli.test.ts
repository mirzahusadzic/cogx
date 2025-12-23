import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('CLI Smoke Test', () => {
  const tempHome = path.join(os.tmpdir(), `cognition-test-home-${Date.now()}`);

  beforeAll(() => {
    // Create a mock home directory with security acknowledgment
    fs.mkdirSync(path.join(tempHome, '.cognition-cli'), { recursive: true });
    const settings = {
      version: '1.0',
      dual_use_acknowledgment: {
        timestamp: new Date().toISOString(),
        user: 'test-user',
        hostname: 'test-host',
        version: '1.0',
        acknowledged: true,
      },
    };
    fs.writeFileSync(
      path.join(tempHome, '.cognition-cli', 'settings.json'),
      JSON.stringify(settings)
    );
  });

  afterAll(() => {
    fs.rmSync(tempHome, { recursive: true, force: true });
  });

  it('should show help message', () => {
    // Testing the actual execution is the most "smoke-y" test
    const output = execSync(`npx tsx src/cli.ts --help`, {
      encoding: 'utf-8',
      env: {
        ...process.env,
        NO_COLOR: '1',
        COGNITION_HOME_DIR: tempHome,
      },
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
      env: {
        ...process.env,
        COGNITION_HOME_DIR: tempHome,
      },
    });
    expect(output).toMatch(/\d+\.\d+\.\d+/);
  });
});
