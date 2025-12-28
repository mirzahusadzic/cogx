import { describe, it, expect } from 'vitest';

/**
 * Helper to coerce string | number to number
 */
const coerceNumber = (val: string | number | undefined): number | undefined => {
  if (val === undefined) return undefined;
  if (typeof val === 'number') return val;
  const parsed = Number(val);
  return isNaN(parsed) ? undefined : parsed;
};

/**
 * Helper to coerce string | boolean to boolean
 */
const coerceBoolean = (
  val: string | boolean | undefined
): boolean | undefined => {
  if (val === undefined) return undefined;
  if (typeof val === 'boolean') return val;
  return val === 'true';
};

describe('Tool Parameter Coercion', () => {
  describe('coerceNumber', () => {
    it('should return undefined for undefined input', () => {
      expect(coerceNumber(undefined)).toBeUndefined();
    });

    it('should return the same number for number input', () => {
      expect(coerceNumber(123)).toBe(123);
      expect(coerceNumber(0)).toBe(0);
      expect(coerceNumber(-1)).toBe(-1);
    });

    it('should parse valid number strings', () => {
      expect(coerceNumber('123')).toBe(123);
      expect(coerceNumber('0')).toBe(0);
      expect(coerceNumber('-1')).toBe(-1);
      expect(coerceNumber('123.45')).toBe(123.45);
    });

    it('should return undefined for invalid number strings', () => {
      expect(coerceNumber('abc')).toBeUndefined();
      expect(coerceNumber('')).toBe(0); // Number('') is 0 in JS
      expect(coerceNumber(' ')).toBe(0); // Number(' ') is 0 in JS
    });
  });

  describe('coerceBoolean', () => {
    it('should return undefined for undefined input', () => {
      expect(coerceBoolean(undefined)).toBeUndefined();
    });

    it('should return the same boolean for boolean input', () => {
      expect(coerceBoolean(true)).toBe(true);
      expect(coerceBoolean(false)).toBe(false);
    });

    it('should parse "true" string as true', () => {
      expect(coerceBoolean('true')).toBe(true);
    });

    it('should parse other strings as false (current behavior)', () => {
      expect(coerceBoolean('false')).toBe(false);
      expect(coerceBoolean('yes')).toBe(false);
      expect(coerceBoolean('1')).toBe(false);
      expect(coerceBoolean('')).toBe(false);
    });

    it('should be case-sensitive (current behavior)', () => {
      expect(coerceBoolean('True')).toBe(false);
    });
  });
});
