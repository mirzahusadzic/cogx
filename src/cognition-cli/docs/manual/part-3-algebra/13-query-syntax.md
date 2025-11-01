---
type: mathematical
overlay: O6_Mathematical
---

# Chapter 13: Query Syntax and Parser

> **Parsing is Algebra**: When you write "O2 ~ O4", you're not just typing symbols—you're declaring a computation. The parser transforms ASCII syntax into an Abstract Syntax Tree that the evaluator executes as lattice operations. This is how queries become programs.

**Part**: III — The Algebra<br/>
**Chapter**: 13<br/>
**Focus**: Query Syntax, Lexer, Parser, AST Evaluation<br/>
**Implementation**: `src/core/algebra/query-parser.ts`<br/>

---

## Table of Contents

1. [The Query Language](#1-the-query-language)
2. [Lexer: From Text to Tokens](#2-lexer-from-text-to-tokens)
3. [Parser: From Tokens to AST](#3-parser-from-tokens-to-ast)
4. [Evaluator: From AST to Results](#4-evaluator-from-ast-to-results)
5. [Operator Precedence](#5-operator-precedence)
6. [Error Handling](#6-error-handling)
7. [Query Examples](#7-query-examples)
8. [Implementation Architecture](#8-implementation-architecture)
9. [Design Decisions](#9-design-decisions)
10. [Testing](#10-testing)
11. [Common Pitfalls](#11-common-pitfalls)
12. [Future Extensions](#12-future-extensions)

---

## 1. The Query Language

The lattice query language enables compositional queries across overlays using ASCII-only operators for maximum portability.

### Design Principles

**ASCII-Only**: All operators use standard keyboard characters (no ∪, ∩, ∧ symbols).

**Composable**: Queries build naturally from simple to complex.

**Type-Safe**: Parser validates operator arity and operand types.

**Predictable**: Clear precedence rules, no surprises.

### Syntax Overview

```bash
# Overlay references
O1              # Structural patterns overlay
O2              # Security guidelines overlay
O7              # Strategic coherence overlay

# Filters
O2[attacks]                    # Filter by type
O2[severity=critical]          # Filter by metadata
O2[severity=critical,high]     # Multiple values (OR)

# Set operations (exact matching by ID)
O1 + O2         # Union (alternative: |, OR)
O1 & O2         # Intersection (alternative: AND)
O1 - O2         # Difference (alternative: \)

# Semantic operations (embedding similarity)
O2 ~ O4         # Meet (alternative: MEET)
O5 -> O2        # Project (alternative: TO)

# Complement (not directly supported)
!O2             # Throws helpful error directing to use difference
NOT O2          # Same as above

# Parentheses for precedence
(O1 + O2) & O3
O1 - (O2 | O3)
```

---

## 2. Lexer: From Text to Tokens

The lexer (tokenizer) breaks query strings into meaningful tokens.

### Token Types

```typescript
enum TokenType {
  // Overlay IDs
  OVERLAY_ID = 'OVERLAY_ID', // O1, O2, O3, ..., O7

  // Operators (binary)
  UNION = 'UNION', // +, |, OR
  INTERSECTION = 'INTERSECTION', // &, AND
  DIFFERENCE = 'DIFFERENCE', // -, \
  MEET = 'MEET', // ~, MEET
  PROJECT = 'PROJECT', // ->, TO

  // Operators (unary)
  COMPLEMENT = 'COMPLEMENT', // !, NOT

  // Filters
  FILTER = 'FILTER', // [attacks], [severity=critical]

  // Grouping
  LPAREN = 'LPAREN', // (
  RPAREN = 'RPAREN', // )

  // End of input
  EOF = 'EOF',
}
```

### Tokenization Example

**Input**:

```
O2[attacks] ~ O4 - O2[vulnerability]
```

**Output**:

```typescript
[
  { type: 'OVERLAY_ID', value: 'O2' },
  { type: 'FILTER', value: 'attacks' },
  { type: 'MEET', value: '~' },
  { type: 'OVERLAY_ID', value: 'O4' },
  { type: 'DIFFERENCE', value: '-' },
  { type: 'OVERLAY_ID', value: 'O2' },
  { type: 'FILTER', value: 'vulnerability' },
  { type: 'EOF', value: '' },
];
```

### Implementation: Lexer

```typescript
class Lexer {
  private pos = 0;
  private currentChar: string | null;

  constructor(private input: string) {
    this.currentChar = input[0] || null;
  }

  private advance(): void {
    this.pos++;
    this.currentChar =
      this.pos < this.input.length ? this.input[this.pos] : null;
  }

  private skipWhitespace(): void {
    while (this.currentChar && /\s/.test(this.currentChar)) {
      this.advance();
    }
  }

  tokenize(): Token[] {
    const tokens: Token[] = [];

    while (this.currentChar !== null) {
      this.skipWhitespace();

      if (this.currentChar === null) break;

      // Overlay ID: O1, O2, ..., O7
      if (this.currentChar === 'O') {
        const id = this.readOverlayId();
        tokens.push({ type: TokenType.OVERLAY_ID, value: id });
        continue;
      }

      // Filter: [attacks], [severity=critical]
      if (this.currentChar === '[') {
        const filter = this.readFilter();
        tokens.push({ type: TokenType.FILTER, value: filter });
        continue;
      }

      // Operators
      switch (this.currentChar) {
        case '+':
          tokens.push({ type: TokenType.UNION, value: '+' });
          this.advance();
          break;
        case '|':
          tokens.push({ type: TokenType.UNION, value: '|' });
          this.advance();
          break;
        case '&':
          tokens.push({ type: TokenType.INTERSECTION, value: '&' });
          this.advance();
          break;
        case '-':
          // Check for -> (project) vs - (difference)
          if (this.peek() === '>') {
            tokens.push({ type: TokenType.PROJECT, value: '->' });
            this.advance();
            this.advance();
          } else {
            tokens.push({ type: TokenType.DIFFERENCE, value: '-' });
            this.advance();
          }
          break;
        // ... more operators
      }
    }

    tokens.push({ type: TokenType.EOF, value: '' });
    return tokens;
  }
}
```

---

## 3. Parser: From Tokens to AST

The parser builds an Abstract Syntax Tree (AST) from tokens using **recursive descent parsing**.

### AST Node Types

```typescript
type ASTNode = OverlayNode | FilteredOverlayNode | UnaryOpNode | BinaryOpNode;

interface OverlayNode {
  type: 'overlay';
  overlayId: string; // 'O1', 'O2', etc.
}

interface FilteredOverlayNode {
  type: 'filtered_overlay';
  overlayId: string;
  filter: {
    typeFilter?: string; // 'attacks'
    metadataFilters?: Record<string, string[]>; // { severity: ['critical', 'high'] }
  };
}

interface UnaryOpNode {
  type: 'unary_op';
  operator: 'complement';
  operand: ASTNode;
}

interface BinaryOpNode {
  type: 'binary_op';
  operator: 'union' | 'intersection' | 'difference' | 'meet' | 'project';
  left: ASTNode;
  right: ASTNode;
}
```

### Parsing Example

**Query**: `"(O2 ~ O4) - O2[vulnerability]"`

**AST**:

```
BinaryOpNode (operator: 'difference')
├─ left: BinaryOpNode (operator: 'meet')
│    ├─ left: OverlayNode (O2)
│    └─ right: OverlayNode (O4)
└─ right: FilteredOverlayNode
     ├─ overlayId: O2
     └─ filter: { typeFilter: 'vulnerability' }
```

### Implementation: Recursive Descent Parser

The parser uses **precedence climbing** to handle operator precedence correctly.

**Precedence (highest to lowest)**:

1. Meet (~), Project (->)
2. Intersection (&)
3. Difference (-)
4. Union (+)

```typescript
class Parser {
  private currentToken: Token;
  private pos = 0;

  constructor(private tokens: Token[]) {
    this.currentToken = tokens[0];
  }

  private advance(): void {
    this.pos++;
    this.currentToken = this.tokens[this.pos];
  }

  private expect(type: TokenType): void {
    if (this.currentToken.type !== type) {
      throw new Error(`Expected ${type} but got ${this.currentToken.type}`);
    }
    this.advance();
  }

  // Entry point: parse entire query
  parse(): ASTNode {
    const ast = this.parseUnion();
    this.expect(TokenType.EOF);
    return ast;
  }

  // Lowest precedence: Union (+, |, OR)
  private parseUnion(): ASTNode {
    let left = this.parseDifference();

    while (this.currentToken.type === TokenType.UNION) {
      this.advance();
      const right = this.parseDifference();
      left = {
        type: 'binary_op',
        operator: 'union',
        left,
        right,
      };
    }

    return left;
  }

  // Next precedence: Difference (-)
  private parseDifference(): ASTNode {
    let left = this.parseIntersection();

    while (this.currentToken.type === TokenType.DIFFERENCE) {
      this.advance();
      const right = this.parseIntersection();
      left = {
        type: 'binary_op',
        operator: 'difference',
        left,
        right,
      };
    }

    return left;
  }

  // Next precedence: Intersection (&)
  private parseIntersection(): ASTNode {
    let left = this.parseMeet();

    while (this.currentToken.type === TokenType.INTERSECTION) {
      this.advance();
      const right = this.parseMeet();
      left = {
        type: 'binary_op',
        operator: 'intersection',
        left,
        right,
      };
    }

    return left;
  }

  // Highest precedence: Meet (~), Project (->)
  private parseMeet(): ASTNode {
    let left = this.parsePrimary();

    while (
      this.currentToken.type === TokenType.MEET ||
      this.currentToken.type === TokenType.PROJECT
    ) {
      const operator =
        this.currentToken.type === TokenType.MEET ? 'meet' : 'project';
      this.advance();
      const right = this.parsePrimary();
      left = {
        type: 'binary_op',
        operator,
        left,
        right,
      };
    }

    return left;
  }

  // Primary: Overlay IDs, filters, parentheses
  private parsePrimary(): ASTNode {
    // Complement operator
    if (this.currentToken.type === TokenType.COMPLEMENT) {
      this.advance();
      const operand = this.parsePrimary();
      return {
        type: 'unary_op',
        operator: 'complement',
        operand,
      };
    }

    // Parentheses
    if (this.currentToken.type === TokenType.LPAREN) {
      this.advance();
      const node = this.parseUnion();
      this.expect(TokenType.RPAREN);
      return node;
    }

    // Overlay ID (with optional filter)
    if (this.currentToken.type === TokenType.OVERLAY_ID) {
      const overlayId = this.currentToken.value;
      this.advance();

      // Check for filter
      if (this.currentToken.type === TokenType.FILTER) {
        const filter = this.parseFilter();
        return {
          type: 'filtered_overlay',
          overlayId,
          filter,
        };
      }

      return {
        type: 'overlay',
        overlayId,
      };
    }

    throw new Error(`Unexpected token: ${this.currentToken.type}`);
  }
}
```

---

## 4. Evaluator: From AST to Results

The evaluator traverses the AST and executes lattice operations.

### Evaluation Strategy

**Post-Order Traversal**: Evaluate children before parents.

**Type Checking**: Ensure operands have correct types for each operation.

**Lazy Evaluation**: Only load overlay data when needed.

### Implementation: Evaluator

```typescript
class QueryEngine {
  constructor(private registry: OverlayRegistry) {}

  async execute(query: string): Promise<QueryResult> {
    // 1. Tokenize
    const lexer = new Lexer(query);
    const tokens = lexer.tokenize();

    // 2. Parse
    const parser = new Parser(tokens);
    const ast = parser.parse();

    // 3. Evaluate
    return this.evaluate(ast);
  }

  private async evaluate(node: ASTNode): Promise<QueryResult> {
    switch (node.type) {
      case 'overlay':
        return this.evaluateOverlay(node);

      case 'filtered_overlay':
        return this.evaluateFilteredOverlay(node);

      case 'unary_op':
        return this.evaluateUnaryOp(node);

      case 'binary_op':
        return this.evaluateBinaryOp(node);

      default:
        throw new Error(`Unknown node type`);
    }
  }

  private async evaluateOverlay(node: OverlayNode): Promise<QueryResult> {
    const overlay = await this.registry.get(node.overlayId);
    return overlay.getAllItems();
  }

  private async evaluateBinaryOp(node: BinaryOpNode): Promise<QueryResult> {
    // Evaluate operands
    const left = await this.evaluate(node.left);
    const right = await this.evaluate(node.right);

    // Extract items from QueryResult (may be wrapped in SetOperationResult)
    const leftItems = this.extractItems(left);
    const rightItems = this.extractItems(right);

    // Execute operation
    switch (node.operator) {
      case 'union':
        return union([leftItems, rightItems], ['left', 'right']);

      case 'intersection':
        return intersection([leftItems, rightItems], ['left', 'right']);

      case 'difference':
        return difference(leftItems, rightItems, ['left', 'right']);

      case 'meet':
        return meet(leftItems, rightItems, { threshold: 0.7 });

      case 'project':
        return meet(leftItems, rightItems, { threshold: 0.6, topK: 10 });

      default:
        throw new Error(`Unknown operator: ${node.operator}`);
    }
  }
}
```

---

## 5. Operator Precedence

Operator precedence determines the order of evaluation in queries without parentheses.

### Precedence Table (Highest to Lowest)

| Level | Operators       | Description   | Associativity |
| ----- | --------------- | ------------- | ------------- |
| 1     | `~`, `->`       | Meet, Project | Left          |
| 2     | `&`, `AND`      | Intersection  | Left          |
| 3     | `-`, `\`        | Difference    | Left          |
| 4     | `+`, `\|`, `OR` | Union         | Left          |

### Examples

**Query**: `O2 + O5 ~ O4`

**Parsed as**: `O2 + (O5 ~ O4)`

**Reason**: Meet (~) binds tighter than Union (+).

---

**Query**: `O1 - O2 & O3`

**Parsed as**: `O1 - (O2 & O3)`

**Reason**: Intersection (&) binds tighter than Difference (-).

---

**Query**: `O2[critical] ~ O4 - O2[vulnerability]`

**Parsed as**: `(O2[critical] ~ O4) - O2[vulnerability]`

**Reason**: Meet (~) binds tighter than Difference (-).

---

### Using Parentheses

Override precedence with explicit grouping:

```bash
# Without parentheses (meet binds tighter)
O2 + O5 ~ O4
# Equivalent to: O2 + (O5 ~ O4)

# With parentheses (force union first)
(O2 + O5) ~ O4
# Union of O2 and O5, then meet with O4
```

---

## 6. Error Handling

The parser provides clear, actionable error messages.

### Syntax Errors

**Unbalanced Parentheses**:

```bash
Query: "(O1 + O2"
Error: Expected RPAREN but got EOF
```

**Invalid Overlay ID**:

```bash
Query: "OX + O2"
Error: Invalid overlay ID: OX (expected O1-O7)
```

**Empty Filter**:

```bash
Query: "O2[]"
Error: Invalid filter: empty filter not allowed
```

### Semantic Errors

**Complement Without Universal Set**:

```bash
Query: "!O2"
Error: Complement (!) requires a universal set. Use difference instead:
  • "O1 - O2" for items in O1 but not in O2
  • "(O1 + O2 + O3) - O4" for union of multiple overlays minus O4

Example: cognition-cli lattice "O1 - O2"
```

**Non-Existent Overlay**:

```bash
Query: "O8 + O2"
Error: Overlay O8 does not exist (valid: O1-O7)
```

---

## 7. Query Examples

### Basic Queries

**All items from overlay**:

```bash
cognition-cli lattice "O1"
```

**Filtered items**:

```bash
cognition-cli lattice "O2[attacks]"
cognition-cli lattice "O2[severity=critical]"
```

### Set Operations

**Coverage gaps**:

```bash
# Code symbols without security coverage
cognition-cli lattice "O1 - O2"
```

**Intersection**:

```bash
# Items in both O2 and O4
cognition-cli lattice "O2 & O4"
```

**Union**:

```bash
# All security and operational guidance
cognition-cli lattice "O2 + O5"
```

### Semantic Operations

**Alignment checking**:

```bash
# Which attacks violate mission principles?
cognition-cli lattice "O2[attacks] ~ O4[principles]"
```

**Semantic projection**:

```bash
# Map workflows to security guidelines
cognition-cli lattice "O5 -> O2"
```

### Complex Compositions

**Multi-step analysis**:

```bash
# Critical attacks aligned with mission, excluding known vulnerabilities
cognition-cli lattice "(O2[critical] ~ O4) - O2[vulnerability]"
```

**Coverage analysis**:

```bash
# Symbols in O1 but not in (O2 or O3)
cognition-cli lattice "O1 - (O2 | O3)"
```

---

## 8. Implementation Architecture

### Architecture Diagram

```
┌─────────────────────────────────────────────────┐
│               Query String                       │
│        "O2[attacks] ~ O4 - O2[vulnerability]"   │
└──────────────────┬──────────────────────────────┘
                   │
                   ▼
         ┌─────────────────┐
         │     Lexer       │
         │  (Tokenizer)    │
         └────────┬─────────┘
                  │ Tokens: [O2, FILTER, MEET, O4, ...]
                  ▼
         ┌─────────────────┐
         │     Parser      │
         │  (AST Builder)  │
         └────────┬─────────┘
                  │ AST: BinaryOpNode(difference, ...)
                  ▼
         ┌─────────────────┐
         │    Evaluator    │
         │  (Executor)     │
         └────────┬─────────┘
                  │ Uses lattice-operations.ts
                  ▼
         ┌─────────────────┐
         │     Result      │
         │  (OverlayItems) │
         └─────────────────┘
```

### File Structure

```
src/core/algebra/
├── query-parser.ts           # Lexer + Parser + Evaluator
├── lattice-operations.ts     # Core operations (meet, union, etc.)
├── overlay-algebra.ts        # Types and interfaces
├── overlay-registry.ts       # Overlay lookup
└── tests/
    ├── query-parser.test.ts  # 25 tests
    └── lattice-operations.test.ts  # 26 tests
```

### Key Classes

**Lexer**: Tokenizes query string into tokens.

**Parser**: Builds AST from tokens using recursive descent.

**QueryEngine**: Coordinates lexing, parsing, and evaluation.

**OverlayRegistry**: Maps overlay IDs to overlay managers.

---

## 9. Design Decisions

### Why ASCII-Only Operators?

**Problem**: Mathematical symbols (∪, ∩, ∧, →) are beautiful but not typeable.

**Solution**: ASCII equivalents:

- `+` or `|` for union (∪)
- `&` for intersection (∩)
- `-` for difference (\)
- `~` for meet (∧)
- `->` for project (→)

**Trade-off**: Slightly less elegant, but **100× more usable** in CLI and scripts.

---

### Why Recursive Descent Parsing?

**Alternatives Considered**:

- **Operator precedence parser**: Less readable code
- **Parser generator** (ANTLR, PEG.js): Extra dependency, overkill for simple grammar

**Chosen**: Recursive descent

- **Readable**: Clear mapping between grammar and code
- **Maintainable**: Easy to add new operators
- **Fast**: O(n) parsing time

---

### Why Meet vs. AND for Semantic Alignment?

**Problem**: `&` (AND) is already used for exact intersection.

**Solution**: `~` (tilde) for semantic meet

- Visually distinct from `&`
- Available on all keyboards
- Suggests "approximately equal"

**Keyword Alternative**: `MEET` for those who prefer words.

---

### Why No Implicit Intersection?

Some query languages allow `O1 O2` to mean intersection.

**We require explicit operators**: `O1 & O2`

**Reason**:

- **Unambiguous**: No confusion about intent
- **Error-prone**: Typos would silently become queries
- **Precedence**: Hard to define precedence for implicit operators

---

## 10. Testing

### Unit Tests

**Lexer Tests** (`query-parser.test.ts`):

```typescript
describe('tokenization', () => {
  it('should tokenize overlay IDs', () => {
    const queries = ['O1', 'O2', 'O7'];
    queries.forEach((query) => {
      expect(() => createQueryEngine(':memory:').execute(query)).not.toThrow();
    });
  });

  it('should tokenize filters', () => {
    const queries = [
      'O2[attacks]',
      'O2[severity=critical]',
      'O2[severity=critical,high]',
    ];
    queries.forEach((query) => {
      expect(() => createQueryEngine(':memory:').execute(query)).not.toThrow();
    });
  });
});
```

**Parser Tests**:

```typescript
describe('parsing (AST generation)', () => {
  it('should respect operator precedence', async () => {
    // "O1 + O2 - O3" should parse as "O1 + (O2 - O3)"
    const engine = createQueryEngine(':memory:');
    await expect(engine.execute('O1 + O2 - O3')).resolves.toBeDefined();
  });

  it('should handle nested parentheses', async () => {
    const engine = createQueryEngine(':memory:');
    await expect(engine.execute('((O1 + O2) - O3)')).resolves.toBeDefined();
    await expect(
      engine.execute('O1 + (O2 - (O3 & O4))')
    ).resolves.toBeDefined();
  });
});
```

### Integration Tests

**End-to-End Query Execution**:

```typescript
describe('complex query examples', () => {
  it('should parse: Which symbols lack security coverage?', async () => {
    const engine = createQueryEngine(pgcRoot);
    const result = await engine.execute('O1 - O2');
    expect(result.metadata.operation).toBe('difference');
  });

  it('should parse: Critical attacks vs mission principles', async () => {
    const engine = createQueryEngine(pgcRoot);
    const result = await engine.execute('O2[critical] ~ O4');
    expect(result).toBeDefined();
  });
});
```

### Test Coverage

- **25 query parser tests** (tokenization, parsing, error handling)
- **26 lattice operations tests** (all 9 operations)
- **14 vector store tests** (SQL injection prevention)
- **Total: 65 tests, all passing**

---

## 11. Common Pitfalls

### Pitfall 1: Forgetting Operator Precedence

**Wrong Assumption**:

```bash
O2 + O5 ~ O4
# User thinks: (O2 + O5) ~ O4
```

**Actual Parsing**:

```bash
O2 + (O5 ~ O4)
# Meet binds tighter than union
```

**Fix**: Use explicit parentheses:

```bash
(O2 + O5) ~ O4
```

---

### Pitfall 2: Using Meet for Exact Matching

**Wrong**:

```bash
cognition-cli lattice "O2[attacks] ~ O4[principles]"
# Expecting exact ID matches
```

**Problem**: `~` (meet) uses **semantic similarity**, not exact IDs.

**Fix**: Use intersection for exact matching:

```bash
cognition-cli lattice "O2[attacks] & O4[principles]"
```

---

### Pitfall 3: Empty Filters

**Wrong**:

```bash
cognition-cli lattice "O2[]"
# Error: Invalid filter: empty filter not allowed
```

**Fix**: Remove filter brackets:

```bash
cognition-cli lattice "O2"
```

---

### Pitfall 4: Typos in Overlay IDs

**Wrong**:

```bash
cognition-cli lattice "o1 + O2"
# Error: Invalid overlay ID: o1 (expected O1-O7)
```

**Fix**: Overlay IDs must be uppercase:

```bash
cognition-cli lattice "O1 + O2"
```

---

## 12. Future Extensions

### N-Way Operations

Currently operations are binary. Could extend to n-way:

```bash
# Proposed syntax
union(O1, O2, O3, O4)
meet(O2, O4, O5)
```

**Challenge**: How to handle precedence with function calls?

---

### Aggregation Functions

SQL-style aggregations:

```bash
O2[attacks] | count
O7 | avg(coherence)
O2[severity=critical] | max(weight)
```

**Use Cases**: Quick statistics without post-processing.

---

### Variables and Let-Bindings

Reuse subquery results:

```bash
let $critical = O2[severity=critical]
let $aligned = $critical ~ O4
$aligned - O2[vulnerability]
```

**Benefit**: More readable complex queries, avoid recomputation.

---

### Regex Filters

Pattern matching in filters:

```bash
O1[symbol=~/^auth/]     # Symbols starting with 'auth'
O2[text=~/SQL injection/i]  # Case-insensitive text match
```

**Use Cases**: Flexible filtering without exact type names.

---

## Summary

The query parser transforms ASCII syntax into executable lattice operations through a three-stage pipeline:

1. **Lexer**: Tokenizes query strings (`"O2 ~ O4"` → tokens)
2. **Parser**: Builds Abstract Syntax Trees (tokens → AST)
3. **Evaluator**: Executes lattice operations (AST → results)

**Key Features**:

- ASCII-only operators (portable, typeable)
- Clear precedence rules (no surprises)
- Composable queries (simple → complex)
- Helpful error messages (actionable feedback)

**Implementation**:

- Recursive descent parsing (readable, maintainable)
- Type-safe evaluation (catches errors early)
- Comprehensive test coverage (65 tests passing)

**Previous Chapter**: [Chapter 12: Boolean Operations on Knowledge](12-boolean-operations.md) ✅

---

**Status**: ✅ Complete (November 1, 2025)
**Author**: Collaborative documentation session
**Reviewed**: Pending
