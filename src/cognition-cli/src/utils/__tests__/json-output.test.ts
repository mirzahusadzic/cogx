/**
 * JSON Output Tests
 *
 * Tests for JSON output utilities including:
 * - formatJsonOutput
 * - formatPaginatedJsonOutput
 * - isJsonMode
 * - outputJson
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  formatJsonOutput,
  formatPaginatedJsonOutput,
  isJsonMode,
  outputJson,
} from '../json-output.js';

describe('formatJsonOutput', () => {
  it('should format data with metadata', () => {
    const data = { items: [1, 2, 3] };
    const result = formatJsonOutput(data);
    const parsed = JSON.parse(result);

    expect(parsed.data).toEqual({ items: [1, 2, 3] });
    expect(parsed.metadata).toBeDefined();
    expect(parsed.metadata.timestamp).toBeDefined();
    expect(parsed.metadata.version).toBeDefined();
  });

  it('should include command when provided', () => {
    const result = formatJsonOutput({ test: true }, { command: 'query' });
    const parsed = JSON.parse(result);

    expect(parsed.metadata.command).toBe('query');
  });

  it('should include executionTime when provided', () => {
    const result = formatJsonOutput({ test: true }, { executionTime: 1234 });
    const parsed = JSON.parse(result);

    expect(parsed.metadata.executionTime).toBe(1234);
  });

  it('should include errors when provided', () => {
    const result = formatJsonOutput(
      { partial: true },
      { errors: ['Error 1', 'Error 2'] }
    );
    const parsed = JSON.parse(result);

    expect(parsed.errors).toEqual(['Error 1', 'Error 2']);
  });

  it('should include warnings when provided', () => {
    const result = formatJsonOutput(
      { data: true },
      { warnings: ['Warning 1'] }
    );
    const parsed = JSON.parse(result);

    expect(parsed.warnings).toEqual(['Warning 1']);
  });

  it('should pretty print by default', () => {
    const result = formatJsonOutput({ test: true });

    // Pretty printed JSON has newlines
    expect(result).toContain('\n');
    expect(result).toContain('  '); // Indentation
  });

  it('should minify when pretty is false', () => {
    const result = formatJsonOutput({ test: true }, { pretty: false });

    // Minified JSON has no newlines
    expect(result).not.toContain('\n');
  });

  it('should have valid ISO timestamp', () => {
    const result = formatJsonOutput({});
    const parsed = JSON.parse(result);

    const timestamp = new Date(parsed.metadata.timestamp);
    expect(timestamp.toISOString()).toBe(parsed.metadata.timestamp);
  });

  it('should handle null data', () => {
    const result = formatJsonOutput(null);
    const parsed = JSON.parse(result);

    expect(parsed.data).toBeNull();
  });

  it('should handle array data', () => {
    const result = formatJsonOutput([1, 2, 3]);
    const parsed = JSON.parse(result);

    expect(parsed.data).toEqual([1, 2, 3]);
  });

  it('should handle nested objects', () => {
    const data = {
      level1: {
        level2: {
          level3: 'deep',
        },
      },
    };
    const result = formatJsonOutput(data);
    const parsed = JSON.parse(result);

    expect(parsed.data.level1.level2.level3).toBe('deep');
  });
});

describe('formatPaginatedJsonOutput', () => {
  const samplePagination = {
    total: 100,
    count: 10,
    limit: 10,
    offset: 0,
    hasMore: true,
  };

  it('should include items and pagination', () => {
    const items = [{ id: 1 }, { id: 2 }];
    const result = formatPaginatedJsonOutput(items, samplePagination);
    const parsed = JSON.parse(result);

    expect(parsed.data.items).toEqual(items);
    expect(parsed.data.pagination).toEqual(samplePagination);
  });

  it('should include metadata', () => {
    const result = formatPaginatedJsonOutput([], samplePagination, {
      command: 'list',
    });
    const parsed = JSON.parse(result);

    expect(parsed.metadata.command).toBe('list');
  });

  it('should include executionTime when provided', () => {
    const result = formatPaginatedJsonOutput([], samplePagination, {
      executionTime: 500,
    });
    const parsed = JSON.parse(result);

    expect(parsed.metadata.executionTime).toBe(500);
  });

  it('should handle empty items array', () => {
    const result = formatPaginatedJsonOutput([], {
      ...samplePagination,
      count: 0,
      hasMore: false,
    });
    const parsed = JSON.parse(result);

    expect(parsed.data.items).toEqual([]);
    expect(parsed.data.pagination.count).toBe(0);
  });

  it('should preserve pagination metadata', () => {
    const pagination = {
      total: 500,
      count: 50,
      limit: 50,
      offset: 100,
      hasMore: true,
    };
    const result = formatPaginatedJsonOutput([1, 2, 3], pagination);
    const parsed = JSON.parse(result);

    expect(parsed.data.pagination.total).toBe(500);
    expect(parsed.data.pagination.count).toBe(50);
    expect(parsed.data.pagination.limit).toBe(50);
    expect(parsed.data.pagination.offset).toBe(100);
    expect(parsed.data.pagination.hasMore).toBe(true);
  });
});

describe('isJsonMode', () => {
  const originalEnv = process.env.COGNITION_FORMAT;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.COGNITION_FORMAT;
    } else {
      process.env.COGNITION_FORMAT = originalEnv;
    }
  });

  it('should return true when COGNITION_FORMAT is json', () => {
    process.env.COGNITION_FORMAT = 'json';
    expect(isJsonMode()).toBe(true);
  });

  it('should return false when COGNITION_FORMAT is not json', () => {
    process.env.COGNITION_FORMAT = 'text';
    expect(isJsonMode()).toBe(false);
  });

  it('should return false when COGNITION_FORMAT is not set', () => {
    delete process.env.COGNITION_FORMAT;
    expect(isJsonMode()).toBe(false);
  });
});

describe('outputJson', () => {
  const originalEnv = process.env.COGNITION_FORMAT;
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    if (originalEnv === undefined) {
      delete process.env.COGNITION_FORMAT;
    } else {
      process.env.COGNITION_FORMAT = originalEnv;
    }
  });

  it('should output JSON when in JSON mode', () => {
    process.env.COGNITION_FORMAT = 'json';
    const normalFn = vi.fn();

    outputJson({ test: true }, normalFn);

    expect(consoleSpy).toHaveBeenCalled();
    expect(normalFn).not.toHaveBeenCalled();

    // Verify JSON was output
    const output = consoleSpy.mock.calls[0][0];
    const parsed = JSON.parse(output);
    expect(parsed.data.test).toBe(true);
  });

  it('should call normal function when not in JSON mode', () => {
    delete process.env.COGNITION_FORMAT;
    const normalFn = vi.fn();

    outputJson({ test: true }, normalFn);

    expect(consoleSpy).not.toHaveBeenCalled();
    expect(normalFn).toHaveBeenCalled();
  });

  it('should pass options to formatJsonOutput in JSON mode', () => {
    process.env.COGNITION_FORMAT = 'json';

    outputJson({ data: 'test' }, vi.fn(), {
      command: 'test-command',
      executionTime: 100,
    });

    const output = consoleSpy.mock.calls[0][0];
    const parsed = JSON.parse(output);
    expect(parsed.metadata.command).toBe('test-command');
    expect(parsed.metadata.executionTime).toBe(100);
  });
});

describe('Edge Cases', () => {
  it('should handle undefined values in data', () => {
    const data = { defined: 'value', undefined: undefined };
    const result = formatJsonOutput(data);
    const parsed = JSON.parse(result);

    expect(parsed.data.defined).toBe('value');
    // undefined is not serialized in JSON
    expect('undefined' in parsed.data).toBe(false);
  });

  it('should handle Date objects in data', () => {
    const date = new Date('2024-01-15T12:00:00Z');
    const result = formatJsonOutput({ date });
    const parsed = JSON.parse(result);

    expect(parsed.data.date).toBe('2024-01-15T12:00:00.000Z');
  });

  it('should handle very large arrays', () => {
    const largeArray = Array.from({ length: 10000 }, (_, i) => i);
    const result = formatJsonOutput({ items: largeArray });
    const parsed = JSON.parse(result);

    expect(parsed.data.items.length).toBe(10000);
  });

  it('should handle special characters in strings', () => {
    const data = {
      quotes: 'He said "hello"',
      newlines: 'Line 1\nLine 2',
      unicode: 'Hello 世界 🌍',
      backslash: 'path\\to\\file',
    };
    const result = formatJsonOutput(data);
    const parsed = JSON.parse(result);

    expect(parsed.data.quotes).toBe('He said "hello"');
    expect(parsed.data.newlines).toBe('Line 1\nLine 2');
    expect(parsed.data.unicode).toBe('Hello 世界 🌍');
    expect(parsed.data.backslash).toBe('path\\to\\file');
  });

  it('should handle empty objects', () => {
    const result = formatJsonOutput({});
    const parsed = JSON.parse(result);

    expect(parsed.data).toEqual({});
    expect(parsed.metadata).toBeDefined();
  });
});
