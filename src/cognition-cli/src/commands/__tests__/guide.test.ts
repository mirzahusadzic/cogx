import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import chalk from 'chalk';
import { createGuideCommand } from '../guide.js';

describe('guide command', () => {
  beforeEach(() => {
    chalk.level = 0;
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should create guide command', () => {
    const guideCmd = createGuideCommand();
    expect(guideCmd).toBeDefined();
    expect(guideCmd.name()).toBe('guide');
  });

  it('should have correct description mentioning guides', () => {
    const guideCmd = createGuideCommand();
    const desc = guideCmd.description();
    expect(desc.toLowerCase()).toContain('guide');
  });

  it('should accept optional topic argument', () => {
    const guideCmd = createGuideCommand();
    const usage = guideCmd.usage();
    expect(usage).toMatch(/\[topic\]/);
  });

  it('should mention available guides in help', () => {
    const guideCmd = createGuideCommand();
    const helpText = guideCmd.helpInformation();
    // Should mention some guide topics
    expect(helpText).toContain('topic');
  });
});
