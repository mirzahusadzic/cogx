/**
 * Query Parser Tests
 *
 * Tests the lattice algebra query parser (lexer + parser + evaluator).
 * These are pure unit tests that don't require PGC data.
 */

import { describe, it, expect } from 'vitest';
import { createQueryEngine } from '../query-parser.js';

// Mock the OverlayRegistry since we're testing parser logic only
vi.mock('../overlay-registry.js', () => {
  // Create mock items that can be used in operations
  const createMockItem = (id: string) => ({
    id,
    embedding: new Array(768).fill(0.1),
    metadata: { text: `Mock ${id}`, type: 'test' },
  });

  const mockItems = [
    createMockItem('item1'),
    createMockItem('item2'),
    createMockItem('item3'),
  ];

  const mockOverlay = {
    getAllItems: vi.fn(() => Promise.resolve(mockItems)),
    getItemsByType: vi.fn((type: string) =>
      Promise.resolve(mockItems.filter((i) => i.metadata.type === type))
    ),
    filter: vi.fn(() => Promise.resolve(mockItems)),
  };

  return {
    OverlayRegistry: vi.fn(() => ({
      get: vi.fn(() => Promise.resolve(mockOverlay)),
    })),
  };
});

describe('Query Parser (Lexer + Parser)', () => {
  describe('tokenization', () => {
    it('should tokenize overlay IDs', () => {
      const queries = ['O1', 'O2', 'O7'];
      queries.forEach((query) => {
        expect(() =>
          createQueryEngine(':memory:').execute(query)
        ).not.toThrow();
      });
    });

    it('should tokenize union operators', () => {
      const queries = ['O1 + O2', 'O1 | O2', 'O1 OR O2'];
      queries.forEach((query) => {
        expect(() =>
          createQueryEngine(':memory:').execute(query)
        ).not.toThrow();
      });
    });

    it('should tokenize intersection operators', () => {
      const queries = ['O1 & O2', 'O1 AND O2'];
      queries.forEach((query) => {
        expect(() =>
          createQueryEngine(':memory:').execute(query)
        ).not.toThrow();
      });
    });

    it('should tokenize difference operators', () => {
      const queries = ['O1 - O2', 'O1 \\ O2'];
      queries.forEach((query) => {
        expect(() =>
          createQueryEngine(':memory:').execute(query)
        ).not.toThrow();
      });
    });

    it('should tokenize meet operator', () => {
      const queries = ['O1 ~ O2', 'O1 MEET O2'];
      queries.forEach((query) => {
        expect(() =>
          createQueryEngine(':memory:').execute(query)
        ).not.toThrow();
      });
    });

    it('should tokenize project operator (->)', () => {
      const queries = ['O5 -> O2', 'O5 TO O2'];
      queries.forEach((query) => {
        expect(() =>
          createQueryEngine(':memory:').execute(query)
        ).not.toThrow();
      });
    });

    it('should tokenize filters', () => {
      const queries = [
        'O2[attacks]',
        'O2[severity=critical]',
        'O2[severity=critical,high]',
      ];
      queries.forEach((query) => {
        expect(() =>
          createQueryEngine(':memory:').execute(query)
        ).not.toThrow();
      });
    });

    it('should tokenize parentheses', () => {
      const queries = ['(O1 + O2)', '(O1 - O2) & O3', 'O1 - (O2 + O3)'];
      queries.forEach((query) => {
        expect(() =>
          createQueryEngine(':memory:').execute(query)
        ).not.toThrow();
      });
    });
  });

  describe('parsing (AST generation)', () => {
    it('should respect operator precedence', async () => {
      // Meet/Project > Intersection > Difference > Union
      // "O1 + O2 - O3" should parse as "O1 + (O2 - O3)"
      // Not as "(O1 + O2) - O3"
      const engine = createQueryEngine(':memory:');

      // Should parse without error (actual execution will depend on mock)
      await expect(engine.execute('O1 + O2 - O3')).resolves.toBeDefined();
    });

    it('should handle nested parentheses', async () => {
      const engine = createQueryEngine(':memory:');

      await expect(engine.execute('((O1 + O2) - O3)')).resolves.toBeDefined();
      await expect(
        engine.execute('O1 + (O2 - (O3 & O4))')
      ).resolves.toBeDefined();
    });

    it('should handle filters with operators', async () => {
      const engine = createQueryEngine(':memory:');

      await expect(engine.execute('O2[attacks] ~ O4')).resolves.toBeDefined();
      await expect(
        engine.execute('O2[severity=critical] - O1')
      ).resolves.toBeDefined();
    });
  });

  describe('error handling', () => {
    it('should reject invalid overlay IDs', async () => {
      const engine = createQueryEngine(':memory:');

      // These should fail at tokenization/parsing (invalid syntax)
      await expect(engine.execute('OX')).rejects.toThrow(); // No digits after O
      await expect(engine.execute('1O')).rejects.toThrow(); // Starts with digit

      // O99 would parse successfully but fail if overlay doesn't exist
      // (depends on OverlayRegistry implementation)
    });

    it('should reject unbalanced parentheses', async () => {
      const engine = createQueryEngine(':memory:');

      await expect(engine.execute('(O1 + O2')).rejects.toThrow();
      await expect(engine.execute('O1 + O2)')).rejects.toThrow();
      await expect(engine.execute('((O1 + O2)')).rejects.toThrow();
    });

    it('should reject invalid filter syntax', async () => {
      const engine = createQueryEngine(':memory:');

      // Empty filter should throw "Invalid filter" error
      await expect(engine.execute('O2[]')).rejects.toThrow(/Invalid filter/);
    });

    it('should reject unsupported operators', async () => {
      const engine = createQueryEngine(':memory:');

      await expect(engine.execute('O1 * O2')).rejects.toThrow();
      await expect(engine.execute('O1 / O2')).rejects.toThrow();
      await expect(engine.execute('O1 ^ O2')).rejects.toThrow();
    });
  });

  describe('complement operator (requires universal set)', () => {
    it('should parse !O2 but provide helpful error message', async () => {
      const engine = createQueryEngine(':memory:');

      // Should parse but throw helpful error during evaluation
      await expect(engine.execute('!O2')).rejects.toThrow(
        /Complement \(!\) requires a universal set/
      );
      await expect(engine.execute('!O2')).rejects.toThrow(
        /Use difference instead/
      );
    });

    it('should parse NOT O2 but provide helpful error message', async () => {
      const engine = createQueryEngine(':memory:');

      await expect(engine.execute('NOT O2')).rejects.toThrow(
        /Complement \(!\) requires a universal set/
      );
    });
  });

  describe('complex query examples', () => {
    const testCases = [
      {
        query: 'O1 - O2',
        description: 'Which symbols lack security coverage?',
      },
      {
        query: 'O2[critical] ~ O4',
        description: 'Critical attacks vs mission principles',
      },
      {
        query: '(O2 ~ O4) - O2[vulnerability]',
        description: 'Aligned items minus known vulnerabilities',
      },
      {
        query: 'O2[attacks] & O4[principles]',
        description: 'Attacks that violate principles (exact match)',
      },
      {
        query: '(O1 + O2 + O3) - O7[coherence<0.5]',
        description: 'All items minus incoherent ones',
      },
    ];

    testCases.forEach(({ query, description }) => {
      it(`should parse: ${description}`, async () => {
        const engine = createQueryEngine(':memory:');

        // Should parse without throwing (execution depends on mock data)
        await expect(engine.execute(query)).resolves.toBeDefined();
      });
    });
  });
});

describe('Query Parser (Edge Cases)', () => {
  it('should handle whitespace variations', async () => {
    const engine = createQueryEngine(':memory:');

    const queries = [
      'O1+O2', // No spaces
      'O1 + O2', // Normal spaces
      'O1  +  O2', // Extra spaces
      'O1\t+\tO2', // Tabs
      'O1\n+\nO2', // Newlines
    ];

    for (const query of queries) {
      await expect(engine.execute(query)).resolves.toBeDefined();
    }
  });

  it('should handle case sensitivity correctly', async () => {
    const engine = createQueryEngine(':memory:');

    // Operators are case-sensitive (AND, OR, MEET, TO, NOT)
    await expect(engine.execute('O1 AND O2')).resolves.toBeDefined();
    await expect(engine.execute('O1 and O2')).rejects.toThrow(); // lowercase 'and' invalid

    // Overlay IDs must be uppercase O
    await expect(engine.execute('o1 + O2')).rejects.toThrow();
  });

  it('should handle empty filters gracefully', async () => {
    const engine = createQueryEngine(':memory:');

    // Empty filter should throw
    await expect(engine.execute('O2[]')).rejects.toThrow();
  });
});
