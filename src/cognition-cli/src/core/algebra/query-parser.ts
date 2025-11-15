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
import { meet, union, intersection, difference } from './lattice-operations.js';
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

/**
 * Lexer for tokenizing lattice query expressions
 *
 * Converts raw query strings into a stream of tokens for parsing.
 * Supports overlay IDs, filters, operators, and keywords.
 *
 * @internal
 */
class Lexer {
  private position = 0;
  private currentChar: string | null;

  /**
   * Create a new lexer
   *
   * @param input - Query string to tokenize
   */
  constructor(private input: string) {
    this.currentChar = input.length > 0 ? input[0] : null;
  }

  /**
   * Advance to next character in input stream
   * @private
   */
  private advance(): void {
    this.position++;
    this.currentChar =
      this.position < this.input.length ? this.input[this.position] : null;
  }

  /**
   * Peek ahead at upcoming character without consuming it
   * @param offset - Number of characters to look ahead (default: 1)
   * @returns Character at peek position or null if out of bounds
   * @private
   */
  private peek(offset: number = 1): string | null {
    const peekPos = this.position + offset;
    return peekPos < this.input.length ? this.input[peekPos] : null;
  }

  /**
   * Skip whitespace characters in input stream
   * @private
   */
  private skipWhitespace(): void {
    while (this.currentChar && /\s/.test(this.currentChar)) {
      this.advance();
    }
  }

  /**
   * Read overlay identifier token (e.g., O1, O2, O7)
   * @returns Token containing overlay ID
   * @private
   */
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

  /**
   * Read filter expression token (e.g., [attacks], [severity=critical])
   * @returns Token containing filter expression
   * @private
   */
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

  /**
   * Read keyword token (AND, OR, NOT, MEET, TO)
   * @returns Token with mapped keyword type
   * @throws Error if keyword is unknown
   * @private
   */
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

  /**
   * Tokenize the input query string into array of tokens
   * @returns Array of tokens representing the query
   * @throws Error if unexpected character is encountered
   */
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

/**
 * Recursive descent parser for lattice query expressions
 *
 * Parses token stream into Abstract Syntax Tree (AST) following
 * operator precedence rules. Supports parentheses, filters, and
 * all lattice operations.
 *
 * @internal
 */
class Parser {
  private position = 0;
  private currentToken: Token;

  /**
   * Create a new parser
   *
   * @param tokens - Array of tokens from lexer
   */
  constructor(private tokens: Token[]) {
    this.currentToken = tokens[0];
  }

  /**
   * Advance to next token in stream
   * @private
   */
  private advance(): void {
    this.position++;
    this.currentToken = this.tokens[this.position];
  }

  /**
   * Consume current token if it matches expected type
   * @param type - Expected token type
   * @returns The consumed token
   * @throws Error if token type doesn't match
   * @private
   */
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
   *
   * @param filterValue - Filter string content (without brackets)
   * @returns Parsed filter expression object
   * @private
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
   *
   * Handles: overlay IDs, filtered overlays, parenthesized expressions, and unary complement
   *
   * @returns AST node representing the primary expression
   * @throws Error if unexpected token encountered
   * @private
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
   *
   * @returns AST node representing the expression
   * @private
   */
  private parseExpression(): ASTNode {
    return this.parseUnion();
  }

  /**
   * Parse union operations (lowest precedence)
   * @returns AST node for union expression
   * @private
   */
  private parseUnion(): ASTNode {
    let left = this.parseDifference();

    while (this.currentToken.type === TokenType.UNION) {
      this.advance();
      const right = this.parseDifference();
      left = { type: 'binary_op', operator: 'union', left, right };
    }

    return left;
  }

  /**
   * Parse difference operations
   * @returns AST node for difference expression
   * @private
   */
  private parseDifference(): ASTNode {
    let left = this.parseIntersection();

    while (this.currentToken.type === TokenType.DIFFERENCE) {
      this.advance();
      const right = this.parseIntersection();
      left = { type: 'binary_op', operator: 'difference', left, right };
    }

    return left;
  }

  /**
   * Parse intersection operations
   * @returns AST node for intersection expression
   * @private
   */
  private parseIntersection(): ASTNode {
    let left = this.parseMeet();

    while (this.currentToken.type === TokenType.INTERSECTION) {
      this.advance();
      const right = this.parseMeet();
      left = { type: 'binary_op', operator: 'intersection', left, right };
    }

    return left;
  }

  /**
   * Parse meet and project operations (highest precedence)
   * @returns AST node for meet/project expression
   * @private
   */
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

  /**
   * Parse token stream into Abstract Syntax Tree
   * @returns Root AST node representing the query
   * @throws Error if parse fails or EOF not reached
   */
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
  /**
   * Create a new query engine
   *
   * @param registry - Overlay registry for accessing overlay managers
   */
  constructor(private registry: OverlayRegistry) {}

  /**
   * Parse and execute a lattice query
   *
   * @param query - Query string in lattice algebra syntax
   * @returns Promise resolving to query result (items, sets, or meet results)
   * @throws Error if query is invalid or execution fails
   *
   * @example
   * const engine = new QueryEngine(registry);
   * const result = await engine.execute('O1 - O2');
   * console.log(`Found ${result.items.length} symbols without security coverage`);
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
   *
   * @param node - AST node to evaluate
   * @returns Promise resolving to evaluation result
   * @throws Error if node type is unknown or evaluation fails
   * @private
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

  /**
   * Evaluate overlay node by fetching all items from the overlay
   * @param node - Overlay AST node
   * @returns Promise resolving to array of overlay items
   * @private
   */
  private async evaluateOverlay(node: OverlayNode): Promise<OverlayItem[]> {
    const overlay = await this.registry.get(node.overlayId);
    return overlay.getAllItems();
  }

  /**
   * Evaluate filtered overlay node by applying type or metadata filters
   * @param node - Filtered overlay AST node
   * @returns Promise resolving to filtered array of overlay items
   * @throws Error if filter is invalid
   * @private
   */
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

  /**
   * Evaluate unary operation node (complement)
   * @param node - Unary operation AST node
   * @returns Promise resolving to operation result
   * @throws Error - Complement operation requires explicit difference syntax
   * @private
   */
  private async evaluateUnaryOp(node: UnaryOpNode): Promise<QueryResult> {
    if (node.operator === 'complement') {
      // Complement requires a universal set context
      // The syntax "!O2" is ambiguous - complement relative to what?
      //
      // Use difference instead:
      //   - "O1 - O2" for items in O1 but not in O2
      //   - "(O1 + O2 + O3) - O4" for union minus O4
      throw new Error(
        'Complement (!) requires a universal set. Use difference instead:\n' +
          '  • "O1 - O2" for items in O1 but not in O2\n' +
          '  • "(O1 + O2 + O3) - O4" for union of multiple overlays minus O4\n\n' +
          'Example: cognition-cli lattice "O1 - O2"'
      );
    }

    throw new Error(`Unknown unary operator: ${node.operator}`);
  }

  /**
   * Evaluate binary operation node (union, intersection, difference, meet, project)
   * @param node - Binary operation AST node
   * @returns Promise resolving to operation result
   * @throws Error if operands are invalid for the operation
   * @private
   */
  private async evaluateBinaryOp(node: BinaryOpNode): Promise<QueryResult> {
    const left = await this.evaluate(node.left);
    const right = await this.evaluate(node.right);

    // Helper: Extract OverlayItem array from QueryResult
    const extractItems = (
      value: QueryResult
    ): OverlayItem<OverlayMetadata>[] | null => {
      // Already an array of OverlayItems
      if (isOverlayItemArray(value)) {
        return value;
      }
      // SetOperationResult with items
      if (isSetOperationResult(value)) {
        return value.items;
      }
      // MeetResult array - extract all unique items from both sides
      if (isMeetResultArray(value)) {
        const seen = new Set<string>();
        const items: OverlayItem<OverlayMetadata>[] = [];
        for (const result of value) {
          if (!seen.has(result.itemA.id)) {
            seen.add(result.itemA.id);
            items.push(result.itemA);
          }
          if (!seen.has(result.itemB.id)) {
            seen.add(result.itemB.id);
            items.push(result.itemB);
          }
        }
        return items;
      }
      // Can't extract items from other types (Set)
      return null;
    };

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

    // Type guard for SetOperationResult
    const isSetOperationResult = (
      value: QueryResult
    ): value is SetOperationResult<OverlayMetadata> => {
      return (
        value !== null &&
        typeof value === 'object' &&
        'items' in value &&
        'metadata' in value &&
        Array.isArray((value as SetOperationResult<OverlayMetadata>).items)
      );
    };

    // Type guard for MeetResult array
    const isMeetResultArray = (
      value: QueryResult
    ): value is {
      itemA: OverlayItem<OverlayMetadata>;
      itemB: OverlayItem<OverlayMetadata>;
      similarity: number;
    }[] => {
      return (
        Array.isArray(value) &&
        (value.length === 0 ||
          (value[0] &&
            'itemA' in value[0] &&
            'itemB' in value[0] &&
            'similarity' in value[0]))
      );
    };

    // Extract item arrays from QueryResults
    const leftItems = extractItems(left);
    const rightItems = extractItems(right);

    switch (node.operator) {
      case 'union':
        if (!leftItems || !rightItems) {
          throw new Error('Union requires OverlayItem arrays as operands');
        }
        return union([leftItems, rightItems], ['left', 'right']);

      case 'intersection':
        if (!leftItems || !rightItems) {
          throw new Error(
            'Intersection requires OverlayItem arrays as operands'
          );
        }
        return intersection([leftItems, rightItems], ['left', 'right']);

      case 'difference':
        if (!leftItems || !rightItems) {
          throw new Error('Difference requires OverlayItem arrays as operands');
        }
        return difference(leftItems, rightItems, ['left', 'right']);

      case 'meet':
        if (!leftItems || !rightItems) {
          throw new Error('Meet requires OverlayItem arrays as operands');
        }
        return meet(leftItems, rightItems, { threshold: 0.7 });

      case 'project':
        // Project: Semantic projection from left to right overlay
        // Syntax: O5 -> O2 (project O5 items to O2)
        // Semantics: Find O2 items aligned with O5 items
        if (!leftItems || !rightItems) {
          throw new Error('Project requires OverlayItem arrays as operands');
        }
        return meet(leftItems, rightItems, { threshold: 0.6, topK: 10 });

      default:
        throw new Error(`Unknown binary operator: ${node.operator}`);
    }
  }
}

/**
 * Create a query engine for a PGC root
 *
 * @param pgcRoot - Root directory of the PGC (Grounded Context Pool)
 * @param workbenchUrl - Optional URL for workbench API access
 * @returns New QueryEngine instance
 *
 * @example
 * const engine = createQueryEngine('/path/to/pgc');
 * const result = await engine.execute('O2[critical] ~ O4');
 * console.log(`Found ${result.length} critical items aligned with mission`);
 */
export function createQueryEngine(
  pgcRoot: string,
  workbenchUrl?: string
): QueryEngine {
  const registry = new OverlayRegistry(pgcRoot, workbenchUrl);
  return new QueryEngine(registry);
}
