/**
 * Error Handling Tests
 *
 * Tests for standardized error handling including:
 * - CognitionError class
 * - Predefined error codes
 * - Exit code mapping
 */

import { describe, it, expect } from 'vitest';
import {
  CognitionError,
  ErrorCodes,
  EXIT_CODES,
  getExitCode,
} from '../errors.js';

describe('CognitionError', () => {
  describe('constructor', () => {
    it('should create error with all fields', () => {
      const error = new CognitionError(
        'COG-E001',
        'Test Title',
        'Test message',
        ['Solution 1', 'Solution 2'],
        'https://docs.example.com',
        new Error('Original error')
      );

      expect(error.code).toBe('COG-E001');
      expect(error.title).toBe('Test Title');
      expect(error.message).toBe('Test message');
      expect(error.solutions).toEqual(['Solution 1', 'Solution 2']);
      expect(error.docsLink).toBe('https://docs.example.com');
      expect(error.cause?.message).toBe('Original error');
    });

    it('should set name to CognitionError', () => {
      const error = new CognitionError('COG-E001', 'Title', 'Message', []);
      expect(error.name).toBe('CognitionError');
    });

    it('should work without optional fields', () => {
      const error = new CognitionError('COG-E001', 'Title', 'Message', [
        'Solution',
      ]);

      expect(error.docsLink).toBeUndefined();
      expect(error.cause).toBeUndefined();
    });

    it('should be instance of Error', () => {
      const error = new CognitionError('COG-E001', 'Title', 'Message', []);
      expect(error).toBeInstanceOf(Error);
    });

    it('should have stack trace', () => {
      const error = new CognitionError('COG-E001', 'Title', 'Message', []);
      expect(error.stack).toBeDefined();
    });
  });
});

describe('ErrorCodes', () => {
  describe('MISSING_ARGUMENT', () => {
    it('should create error with argument name', () => {
      const error = ErrorCodes.MISSING_ARGUMENT('--file');

      expect(error.code).toBe('COG-E001');
      expect(error.title).toBe('Missing Required Argument');
      expect(error.message).toContain('--file');
      expect(error.solutions.length).toBeGreaterThan(0);
    });
  });

  describe('INVALID_ARGUMENT', () => {
    it('should create error with argument details', () => {
      const error = ErrorCodes.INVALID_ARGUMENT('--format', 'xyz', 'json|text');

      expect(error.code).toBe('COG-E002');
      expect(error.title).toBe('Invalid Argument Value');
      expect(error.message).toContain('--format');
      expect(error.message).toContain('xyz');
      expect(error.message).toContain('json|text');
    });
  });

  describe('FILE_NOT_FOUND', () => {
    it('should create error with file path', () => {
      const error = ErrorCodes.FILE_NOT_FOUND('/path/to/file.ts');

      expect(error.code).toBe('COG-E003');
      expect(error.title).toBe('File Not Found');
      expect(error.message).toContain('/path/to/file.ts');
    });
  });

  describe('WORKSPACE_NOT_FOUND', () => {
    it('should create error with search path', () => {
      const error = ErrorCodes.WORKSPACE_NOT_FOUND('/home/user/project');

      expect(error.code).toBe('COG-E301');
      expect(error.title).toBe('Workspace Not Found');
      expect(error.message).toContain('/home/user/project');
      expect(error.solutions).toContain(
        'Run "cognition-cli init" to create a new workspace'
      );
    });
  });

  describe('WORKSPACE_CORRUPTED', () => {
    it('should create error with reason', () => {
      const error = ErrorCodes.WORKSPACE_CORRUPTED('missing index.json');

      expect(error.code).toBe('COG-E302');
      expect(error.title).toBe('Workspace Corrupted');
      expect(error.message).toContain('missing index.json');
    });
  });

  describe('WORKBENCH_CONNECTION_FAILED', () => {
    it('should create error with URL', () => {
      const error = ErrorCodes.WORKBENCH_CONNECTION_FAILED(
        'http://localhost:3001'
      );

      expect(error.code).toBe('COG-E201');
      expect(error.title).toBe('Workbench Connection Failed');
      expect(error.message).toContain('http://localhost:3001');
    });

    it('should include cause when provided', () => {
      const cause = new Error('ECONNREFUSED');
      const error = ErrorCodes.WORKBENCH_CONNECTION_FAILED(
        'http://localhost:3001',
        cause
      );

      expect(error.cause?.message).toBe('ECONNREFUSED');
    });
  });

  describe('API_REQUEST_FAILED', () => {
    it('should create error with endpoint and status', () => {
      const error = ErrorCodes.API_REQUEST_FAILED('/api/query', 500);

      expect(error.code).toBe('COG-E202');
      expect(error.title).toBe('API Request Failed');
      expect(error.message).toContain('/api/query');
      expect(error.message).toContain('500');
    });

    it('should include cause when provided', () => {
      const cause = new Error('Network timeout');
      const error = ErrorCodes.API_REQUEST_FAILED('/api/query', 504, cause);

      expect(error.cause?.message).toBe('Network timeout');
    });
  });

  describe('PERMISSION_DENIED', () => {
    it('should create error with path and operation', () => {
      const error = ErrorCodes.PERMISSION_DENIED('/protected/file', 'write');

      expect(error.code).toBe('COG-E101');
      expect(error.title).toBe('Permission Denied');
      expect(error.message).toContain('/protected/file');
      expect(error.message).toContain('write');
    });
  });

  describe('INTERNAL_ERROR', () => {
    it('should create error with context', () => {
      const error = ErrorCodes.INTERNAL_ERROR('unexpected null value');

      expect(error.code).toBe('COG-E401');
      expect(error.title).toBe('Internal Error');
      expect(error.message).toContain('unexpected null value');
      expect(error.solutions).toContain(
        'This is likely a bug - please report it'
      );
    });

    it('should include cause when provided', () => {
      const cause = new TypeError('Cannot read property x of undefined');
      const error = ErrorCodes.INTERNAL_ERROR('processing failed', cause);

      expect(error.cause?.message).toBe('Cannot read property x of undefined');
    });
  });

  describe('NON_INTERACTIVE_MISSING_FLAG', () => {
    it('should create error with flag details', () => {
      const error = ErrorCodes.NON_INTERACTIVE_MISSING_FLAG(
        '--confirm',
        'Confirm destructive action'
      );

      expect(error.code).toBe('COG-E005');
      expect(error.title).toBe('Missing Required Flag');
      expect(error.solutions[0]).toContain('--confirm');
      expect(error.solutions[0]).toContain('Confirm destructive action');
    });
  });
});

describe('EXIT_CODES', () => {
  it('should map user input errors to exit 2-3', () => {
    expect(EXIT_CODES['COG-E001']).toBe(2);
    expect(EXIT_CODES['COG-E002']).toBe(3);
    expect(EXIT_CODES['COG-E003']).toBe(3);
    expect(EXIT_CODES['COG-E005']).toBe(2);
  });

  it('should map system errors to exit 7', () => {
    expect(EXIT_CODES['COG-E101']).toBe(7);
  });

  it('should map network errors to exit 5-6', () => {
    expect(EXIT_CODES['COG-E201']).toBe(5);
    expect(EXIT_CODES['COG-E202']).toBe(6);
  });

  it('should map PGC errors to exit 4', () => {
    expect(EXIT_CODES['COG-E301']).toBe(4);
    expect(EXIT_CODES['COG-E302']).toBe(4);
  });

  it('should map internal errors to exit 8', () => {
    expect(EXIT_CODES['COG-E401']).toBe(8);
  });
});

describe('getExitCode', () => {
  it('should return exit code for CognitionError', () => {
    const error = ErrorCodes.MISSING_ARGUMENT('--file');
    expect(getExitCode(error)).toBe(2);
  });

  it('should return exit code for error code string', () => {
    expect(getExitCode('COG-E301')).toBe(4);
    expect(getExitCode('COG-E201')).toBe(5);
  });

  it('should return 1 for unknown error codes', () => {
    expect(getExitCode('COG-E999')).toBe(1);
    expect(getExitCode('UNKNOWN')).toBe(1);
  });

  it('should handle all mapped error codes', () => {
    const knownCodes = Object.keys(EXIT_CODES);
    for (const code of knownCodes) {
      const exitCode = getExitCode(code);
      expect(exitCode).toBeGreaterThan(0);
      expect(exitCode).toBeLessThan(10);
    }
  });
});
