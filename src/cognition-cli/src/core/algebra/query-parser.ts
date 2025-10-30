/**
 * Query Parser for Lattice Algebra
 *
 * Parses ASCII-only lattice expressions into executable operations.
 *
 * DESIGN PRINCIPLE:
 * "Easy to type beats mathematical elegance"
 *
 * SUPPORTED SYNTAX:
 *
 * Set Operations (exact matching):
 *   O1 + O2          Union (all items)
 *   O1 | O2          Union (alternative)
 *   O1 & O2          Intersection (items in both)
 *   O1 AND O2        Intersection (SQL style)
 *   O1 - O2          Difference (in O1, not O2)
 *   O1 \ O2          Difference (alternative)
 *   !O2              Complement (NOT)
 *   NOT O2           Complement (keyword)
 *
 * Semantic Operations (vector similarity):
 *   O2 ~ O4          Meet (alignment via embeddings)
 *   O2 MEET O4       Meet (explicit keyword)
 *   O5 -> O2         Project (query-guided)
 *   O5 TO O2         Project (keyword)
 *
 * Filters:
 *   O2[attacks]                  Filter by type
 *   O2[severity=critical]        Filter by metadata
 *   O2[severity=critical,high]   Multiple values (OR)
 *
 * Composition:
 *   (O2[attacks] ~ O4) - O6      Parentheses for precedence
 *   O1 - (O2 + O4)               Nested operations
 *
 * EXAMPLES:
 *   "O1 - O2"                    Which symbols lack security?
 *   "O2[critical] ~ O4"          Critical attacks aligned with principles
 *   "O5 -> O2"                   Project workflows to security
 *   "(O2 ~ O4) - O2[vulnerability]"  Aligned items minus known issues
 */

import { OverlayRegistry, OverlayId } from './overlay-registry.js';
import {
  meet,
  // project, // TODO: implement project operation
  union,
  intersection,
  difference,
  // complement, // TODO: implement complement operation
} from './lattice-operations.js';
import type {
  OverlayItem,
  OverlayMetadata,
  SetOperationResult,
} from './overlay-algebra.js';

/**
 * Query result type - can be items, Meet results, sets, or set operation results
 */
type QueryResult<T extends OverlayMetadata = OverlayMetadata> =
  | OverlayItem<T>[]
  | Set<string>
  | { itemA: OverlayItem<T>; itemB: OverlayItem<T>; similarity: number }[]
  | SetOperationResult<T>;

// ========================================
// TOKEN TYPES
// ========================================

enum TokenType {
  OVERLAY_ID = 'OVERLAY_ID', // O1, O2, etc.
  FILTER = 'FILTER', // [attacks], [severity=critical]
  UNION = 'UNION', // +, |, OR
  INTERSECTION = 'INTERSECTION', // &, AND
  DIFFERENCE = 'DIFFERENCE', // -, \
  COMPLEMENT = 'COMPLEMENT', // !, NOT
  MEET = 'MEET', // ~, MEET
  PROJECT = 'PROJECT', // ->, TO
  LPAREN = 'LPAREN', // (
  RPAREN = 'RPAREN', // )
  EOF = 'EOF',
}

interface Token {
  type: TokenType;
  value: string;
  position: number;
}

// ========================================
// LEXER (Tokenizer)
// ========================================

class Lexer {
  private position = 0;
  private currentChar: string | null;

  constructor(private input: string) {
    this.currentChar = input.length > 0 ? input[0] : null;
  }

  private advance(): void {
    this.position++;
    this.currentChar =
      this.position < this.input.length ? this.input[this.position] : null;
  }

  private peek(offset: number = 1): string | null {
    const peekPos = this.position + offset;
    return peekPos < this.input.length ? this.input[peekPos] : null;
  }

  private skipWhitespace(): void {
    while (this.currentChar && /\s/.test(this.currentChar)) {
      this.advance();
    }
  }

  private readOverlayId(): Token {
    const start = this.position;
    let value = '';

    // Read 'O' followed by digits
    if (this.currentChar === 'O') {
      value += this.currentChar;
      this.advance();

      while (this.currentChar && /[0-9]/.test(this.currentChar)) {
        value += this.currentChar;
        this.advance();
      }
    }

    return { type: TokenType.OVERLAY_ID, value, position: start };
  }

  private readFilter(): Token {
    const start = this.position;
    let value = '';

    // Skip opening [
    this.advance();

    // Read until closing ]
    while (this.currentChar && this.currentChar !== ']') {
      value += this.currentChar;
      this.advance();
    }

    // Skip closing ]
    if (this.currentChar === ']') {
      this.advance();
    }

    return { type: TokenType.FILTER, value, position: start };
  }

  private readKeyword(): Token {
    const start = this.position;
    let value = '';

    while (this.currentChar && /[A-Z]/.test(this.currentChar)) {
      value += this.currentChar;
      this.advance();
    }

    // Map keywords to token types
    switch (value) {
      case 'AND':
        return { type: TokenType.INTERSECTION, value, position: start };
      case 'OR':
        return { type: TokenType.UNION, value, position: start };
      case 'NOT':
        return { type: TokenType.COMPLEMENT, value, position: start };
      case 'MEET':
        return { type: TokenType.MEET, value, position: start };
      case 'TO':
        return { type: TokenType.PROJECT, value, position: start };
      default:
        throw new Error(`Unknown keyword: ${value} at position ${start}`);
    }
  }

  tokenize(): Token[] {
    const tokens: Token[] = [];

    while (this.currentChar !== null) {
      this.skipWhitespace();

      if (this.currentChar === null) break;

      const start = this.position;

      // Overlay ID (O1, O2, etc.)
      if (
        this.currentChar === 'O' &&
        this.peek() &&
        /[0-9]/.test(this.peek()!)
      ) {
        tokens.push(this.readOverlayId());
        continue;
      }

      // Filter [...]
      if (this.currentChar === '[') {
        tokens.push(this.readFilter());
        continue;
      }

      // Keywords (AND, OR, NOT, MEET, TO)
      if (/[A-Z]/.test(this.currentChar)) {
        tokens.push(this.readKeyword());
        continue;
      }

      // Single-character operators
      switch (this.currentChar) {
        case '+':
        case '|':
          tokens.push({
            type: TokenType.UNION,
            value: this.currentChar,
            position: start,
          });
          this.advance();
          break;

        case '&':
          tokens.push({
            type: TokenType.INTERSECTION,
            value: this.currentChar,
            position: start,
          });
          this.advance();
          break;

        case '-':
          // Check for -> (project operator)
          if (this.peek() === '>') {
            this.advance(); // skip -
            this.advance(); // skip >
            tokens.push({
              type: TokenType.PROJECT,
              value: '->',
              position: start,
            });
          } else {
            tokens.push({
              type: TokenType.DIFFERENCE,
              value: this.currentChar,
              position: start,
            });
            this.advance();
          }
          break;

        case '\\':
          tokens.push({
            type: TokenType.DIFFERENCE,
            value: this.currentChar,
            position: start,
          });
          this.advance();
          break;

        case '!':
          tokens.push({
            type: TokenType.COMPLEMENT,
            value: this.currentChar,
            position: start,
          });
          this.advance();
          break;

        case '~':
          tokens.push({
            type: TokenType.MEET,
            value: this.currentChar,
            position: start,
          });
          this.advance();
          break;

        case '(':
          tokens.push({
            type: TokenType.LPAREN,
            value: this.currentChar,
            position: start,
          });
          this.advance();
          break;

        case ')':
          tokens.push({
            type: TokenType.RPAREN,
            value: this.currentChar,
            position: start,
          });
          this.advance();
          break;

        default:
          throw new Error(
            `Unexpected character: '${this.currentChar}' at position ${start}`
          );
      }
    }

    tokens.push({ type: TokenType.EOF, value: '', position: this.position });
    return tokens;
  }
}

// ========================================
// AST NODES
// ========================================

type ASTNode = OverlayNode | UnaryOpNode | BinaryOpNode | FilteredOverlayNode;

interface OverlayNode {
  type: 'overlay';
  overlayId: OverlayId;
}

interface FilteredOverlayNode {
  type: 'filtered_overlay';
  overlayId: OverlayId;
  filter: FilterExpression;
}

interface FilterExpression {
  field?: string; // e.g., 'severity'
  value?: string | string[]; // e.g., 'critical' or ['critical', 'high']
  typeFilter?: string; // e.g., 'attacks' (shorthand for type=attacks)
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

// ========================================
// PARSER
// ========================================

class Parser {
  private position = 0;
  private currentToken: Token;

  constructor(private tokens: Token[]) {
    this.currentToken = tokens[0];
  }

  private advance(): void {
    this.position++;
    this.currentToken = this.tokens[this.position];
  }

  private expect(type: TokenType): Token {
    if (this.currentToken.type !== type) {
      throw new Error(
        `Expected ${type} but got ${this.currentToken.type} at position ${this.currentToken.position}`
      );
    }
    const token = this.currentToken;
    this.advance();
    return token;
  }

  /**
   * Parse filter expression: [attacks] or [severity=critical] or [severity=critical,high]
   */
  private parseFilter(filterValue: string): FilterExpression {
    // Simple type filter: [attacks]
    if (!filterValue.includes('=')) {
      return { typeFilter: filterValue };
    }

    // Metadata filter: [severity=critical] or [severity=critical,high]
    const [field, valueStr] = filterValue.split('=');
    const values = valueStr.split(',');

    return {
      field: field.trim(),
      value:
        values.length === 1 ? values[0].trim() : values.map((v) => v.trim()),
    };
  }

  /**
   * Parse primary expression (overlay with optional filter)
   */
  private parsePrimary(): ASTNode {
    // Parenthesized expression
    if (this.currentToken.type === TokenType.LPAREN) {
      this.advance(); // skip (
      const expr = this.parseExpression();
      this.expect(TokenType.RPAREN);
      return expr;
    }

    // Unary complement: !O2 or NOT O2
    if (this.currentToken.type === TokenType.COMPLEMENT) {
      this.advance(); // skip ! or NOT
      const operand = this.parsePrimary();
      return { type: 'unary_op', operator: 'complement', operand };
    }

    // Overlay ID
    if (this.currentToken.type === TokenType.OVERLAY_ID) {
      const overlayId = this.currentToken.value as OverlayId;
      this.advance();

      // Check for filter (after advance, token type changes)
      const nextToken = this.currentToken;
      if (nextToken.type === TokenType.FILTER) {
        const filter = this.parseFilter(nextToken.value);
        this.advance();
        return { type: 'filtered_overlay', overlayId, filter };
      }

      return { type: 'overlay', overlayId };
    }

    throw new Error(
      `Unexpected token: ${this.currentToken.type} at position ${this.currentToken.position}`
    );
  }

  /**
   * Parse binary operations with precedence
   *
   * Precedence (highest to lowest):
   * 1. ~ (meet), -> (project)
   * 2. & (intersection)
   * 3. - (difference), \ (difference)
   * 4. + (union), | (union)
   */
  private parseExpression(): ASTNode {
    return this.parseUnion();
  }

  private parseUnion(): ASTNode {
    let left = this.parseDifference();

    while (this.currentToken.type === TokenType.UNION) {
      this.advance();
      const right = this.parseDifference();
      left = { type: 'binary_op', operator: 'union', left, right };
    }

    return left;
  }

  private parseDifference(): ASTNode {
    let left = this.parseIntersection();

    while (this.currentToken.type === TokenType.DIFFERENCE) {
      this.advance();
      const right = this.parseIntersection();
      left = { type: 'binary_op', operator: 'difference', left, right };
    }

    return left;
  }

  private parseIntersection(): ASTNode {
    let left = this.parseMeet();

    while (this.currentToken.type === TokenType.INTERSECTION) {
      this.advance();
      const right = this.parseMeet();
      left = { type: 'binary_op', operator: 'intersection', left, right };
    }

    return left;
  }

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
        operator: operator as 'meet' | 'project',
        left,
        right,
      };
    }

    return left;
  }

  parse(): ASTNode {
    const ast = this.parseExpression();
    this.expect(TokenType.EOF);
    return ast;
  }
}

// ========================================
// QUERY ENGINE (Evaluator)
// ========================================

export class QueryEngine {
  constructor(private registry: OverlayRegistry) {}

  /**
   * Parse and execute a lattice query
   */
  async execute(query: string): Promise<QueryResult> {
    // Tokenize
    const lexer = new Lexer(query);
    const tokens = lexer.tokenize();

    // Parse
    const parser = new Parser(tokens);
    const ast = parser.parse();

    // Evaluate
    return this.evaluate(ast);
  }

  /**
   * Evaluate AST node recursively
   */
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
        throw new Error(
          `Unknown node type: ${(node as { type: string }).type}`
        );
    }
  }

  private async evaluateOverlay(node: OverlayNode): Promise<OverlayItem[]> {
    const overlay = await this.registry.get(node.overlayId);
    return overlay.getAllItems();
  }

  private async evaluateFilteredOverlay(
    node: FilteredOverlayNode
  ): Promise<OverlayItem[]> {
    const overlay = await this.registry.get(node.overlayId);
    const filter = node.filter;

    // Type filter: O2[attacks]
    if (filter.typeFilter) {
      return overlay.getItemsByType(filter.typeFilter);
    }

    // Metadata filter: O2[severity=critical]
    if (filter.field && filter.value) {
      const values = Array.isArray(filter.value)
        ? filter.value
        : [filter.value];
      return overlay.filter((metadata) => {
        const fieldValue = metadata[filter.field!];
        return values.includes(String(fieldValue));
      });
    }

    throw new Error(`Invalid filter: ${JSON.stringify(filter)}`);
  }

  private async evaluateUnaryOp(node: UnaryOpNode): Promise<QueryResult> {
    await this.evaluate(node.operand);

    if (node.operator === 'complement') {
      // For complement, we need a universal set
      // For now, throw error (need to specify relative to what)
      throw new Error(
        'Complement operation requires universal set. Use "O1 - O2" instead.'
      );
    }

    throw new Error(`Unknown unary operator: ${node.operator}`);
  }

  private async evaluateBinaryOp(node: BinaryOpNode): Promise<QueryResult> {
    const left = await this.evaluate(node.left);
    const right = await this.evaluate(node.right);

    // Type guard: ensure we have OverlayItem arrays for set operations
    const isOverlayItemArray = (
      value: QueryResult
    ): value is OverlayItem<OverlayMetadata>[] => {
      return (
        Array.isArray(value) &&
        (value.length === 0 ||
          (value[0] &&
            'id' in value[0] &&
            'embedding' in value[0] &&
            'metadata' in value[0]))
      );
    };

    switch (node.operator) {
      case 'union':
        if (!isOverlayItemArray(left) || !isOverlayItemArray(right)) {
          throw new Error('Union requires OverlayItem arrays as operands');
        }
        return union([left, right], ['left', 'right']);

      case 'intersection':
        if (!isOverlayItemArray(left) || !isOverlayItemArray(right)) {
          throw new Error(
            'Intersection requires OverlayItem arrays as operands'
          );
        }
        return intersection([left, right], ['left', 'right']);

      case 'difference':
        if (!isOverlayItemArray(left) || !isOverlayItemArray(right)) {
          throw new Error('Difference requires OverlayItem arrays as operands');
        }
        return difference(left, right, ['left', 'right']);

      case 'meet':
        if (!isOverlayItemArray(left) || !isOverlayItemArray(right)) {
          throw new Error('Meet requires OverlayItem arrays as operands');
        }
        return meet(left, right, { threshold: 0.7 });

      case 'project':
        // Project needs query string - for now, throw error
        throw new Error(
          'Project operation requires query string. Use project(query, from, to) directly.'
        );

      default:
        throw new Error(`Unknown binary operator: ${node.operator}`);
    }
  }
}

/**
 * Create a query engine for a PGC root
 */
export function createQueryEngine(
  pgcRoot: string,
  workbenchUrl?: string
): QueryEngine {
  const registry = new OverlayRegistry(pgcRoot, workbenchUrl);
  return new QueryEngine(registry);
}
