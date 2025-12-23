import { describe, it, expect } from 'vitest';
import {
  getLanguageFromExtension,
  LANGUAGE_MAP,
  EXTENSION_TO_LANGUAGE,
  DEFAULT_FILE_EXTENSIONS,
} from '../config.js';

describe('config', () => {
  describe('getLanguageFromExtension', () => {
    it('should identify TypeScript files', () => {
      expect(getLanguageFromExtension('.ts')).toBe('typescript');
      expect(getLanguageFromExtension('.tsx')).toBe('typescript');
    });

    it('should identify JavaScript files', () => {
      expect(getLanguageFromExtension('.js')).toBe('javascript');
      expect(getLanguageFromExtension('.jsx')).toBe('javascript');
    });

    it('should identify Python files', () => {
      expect(getLanguageFromExtension('.py')).toBe('python');
    });

    it('should return unknown for unsupported extensions', () => {
      expect(getLanguageFromExtension('.txt')).toBe('unknown');
      expect(getLanguageFromExtension('.md')).toBe('unknown');
      expect(getLanguageFromExtension('')).toBe('unknown');
    });
  });

  describe('Mappings', () => {
    it('should have consistent LANGUAGE_MAP', () => {
      expect(LANGUAGE_MAP['.ts']).toBe('TypeScript');
      expect(LANGUAGE_MAP['.py']).toBe('Python');
    });

    it('should have consistent EXTENSION_TO_LANGUAGE', () => {
      expect(EXTENSION_TO_LANGUAGE['.ts']).toBe('typescript');
      expect(EXTENSION_TO_LANGUAGE['.py']).toBe('python');
    });

    it('should include all supported extensions in DEFAULT_FILE_EXTENSIONS', () => {
      expect(DEFAULT_FILE_EXTENSIONS).toContain('.ts');
      expect(DEFAULT_FILE_EXTENSIONS).toContain('.tsx');
      expect(DEFAULT_FILE_EXTENSIONS).toContain('.js');
      expect(DEFAULT_FILE_EXTENSIONS).toContain('.jsx');
      expect(DEFAULT_FILE_EXTENSIONS).toContain('.py');
    });
  });
});
