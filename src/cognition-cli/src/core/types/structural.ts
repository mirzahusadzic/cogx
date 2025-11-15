/**
 * Structural Extraction Types
 *
 * Type definitions for AST-based structural analysis of source code.
 * Supports multi-language parsing with normalized representations of
 * classes, functions, interfaces, and dependencies.
 *
 * DESIGN:
 * The structural type system enables language-agnostic code comprehension:
 * - SourceFile: Language-tagged source file metadata
 * - StructuralData: Complete AST extraction output with fidelity tracking
 * - ClassData/FunctionData/InterfaceData: Normalized code structures
 * - StructuralPatternMetadata: Dual-embedding pattern for similarity + alignment
 *
 * DUAL EMBEDDING ARCHITECTURE:
 * Each pattern maintains two embeddings:
 * 1. Structural embedding: For pattern matching (function signatures, structure)
 * 2. Semantic embedding: For mission alignment (docstrings, purpose)
 *
 * This enables two critical queries:
 * - "Find code with similar structure" → structural similarity
 * - "Find code violating mission principles" → semantic alignment
 *
 * The system supports multiple extraction methods with fidelity scoring:
 * - ast_native: In-process TypeScript AST (highest fidelity)
 * - ast_remote: External parser service (cross-language support)
 * - slm: Small language model fallback (moderate fidelity)
 * - llm_supervised: LLM extraction with verification (lowest fidelity)
 *
 * @example
 * // Parse TypeScript file with native AST
 * const structuralData: StructuralData = {
 *   language: 'typescript',
 *   docstring: 'Authentication handler for JWT tokens',
 *   imports: ['jsonwebtoken', 'bcrypt'],
 *   classes: [{ name: 'AuthHandler', ... }],
 *   functions: [{ name: 'validateToken', ... }],
 *   interfaces: [{ name: 'AuthConfig', ... }],
 *   extraction_method: 'ast_native',
 *   fidelity: 0.98
 * };
 *
 * @example
 * // Dual embedding for pattern matching + mission alignment
 * const pattern: StructuralPatternMetadata = {
 *   symbol: 'AuthHandler.validateToken',
 *   anchor: '/src/auth/handler.ts',
 *   structuralSignature: 'validateToken(token: string): Promise<boolean>',
 *   semanticSignature: 'Validates JWT tokens ensuring secure authentication',
 *   architecturalRole: 'security',
 *   vectorId: 'struct_abc123',
 *   semanticVectorId: 'semantic_def456',
 *   validation: {
 *     sourceHash: 'ghi789...',
 *     embeddingModelVersion: 'text-embedding-3-small-768',
 *     extractionMethod: 'ast_native',
 *     fidelity: 0.98
 *   }
 * };
 */

import { z } from 'zod';

/**
 * Supported programming languages for structural extraction.
 *
 * Each language has a corresponding parser (native or remote) that
 * extracts normalized structural data.
 */
export type Language =
  | 'typescript'
  | 'javascript'
  | 'python'
  | 'java'
  | 'rust'
  | 'go'
  | 'unknown';

/**
 * Zod schema for validating Language type.
 */
export const LanguageSchema = z.enum([
  'typescript',
  'javascript',
  'python',
  'java',
  'rust',
  'go',
  'unknown',
]);

/**
 * Zod schema for validating SourceFile structure.
 */
export const SourceFileSchema = z.object({
  path: z.string(),
  relativePath: z.string(),
  name: z.string(),
  language: LanguageSchema,
  content: z.string(),
});

/**
 * Source code file with language metadata.
 *
 * SourceFile represents a file in the workspace with detected language type.
 * Used as input to structural extraction pipelines.
 *
 * @example
 * const sourceFile: SourceFile = {
 *   path: '/workspace/src/auth/handler.ts',
 *   relativePath: 'src/auth/handler.ts',
 *   name: 'handler.ts',
 *   language: 'typescript',
 *   content: '...'
 * };
 */
export interface SourceFile extends z.infer<typeof SourceFileSchema> {}

/**
 * Zod schema for validating function/method parameters.
 */
export const ParameterDataSchema = z.object({
  name: z.string(),
  type: z.string(),
  optional: z.boolean().optional(),
  default: z.string().optional(),
});

/**
 * Function or method parameter with type information.
 *
 * Captures parameter name, type, optionality, and default values
 * for structural signature generation.
 *
 * @example
 * const param: ParameterData = {
 *   name: 'token',
 *   type: 'string',
 *   optional: false
 * };
 *
 * @example
 * const optionalParam: ParameterData = {
 *   name: 'options',
 *   type: 'AuthOptions',
 *   optional: true,
 *   default: '{}'
 * };
 */
export interface ParameterData extends z.infer<typeof ParameterDataSchema> {}

/**
 * Zod schema for validating function/method declarations.
 */
export const FunctionDataSchema = z.object({
  name: z.string(),
  docstring: z.string(),
  params: z.array(ParameterDataSchema),
  returns: z.string(),
  is_async: z.boolean(),
  decorators: z.array(z.string()),
});

/**
 * Function or method declaration extracted from source code.
 *
 * Normalized representation of a function including signature,
 * documentation, and metadata for pattern matching.
 *
 * @example
 * const functionData: FunctionData = {
 *   name: 'validateToken',
 *   docstring: 'Validates JWT tokens ensuring secure authentication',
 *   params: [
 *     { name: 'token', type: 'string', optional: false }
 *   ],
 *   returns: 'Promise<boolean>',
 *   is_async: true,
 *   decorators: ['@authenticated']
 * };
 */
export interface FunctionData extends z.infer<typeof FunctionDataSchema> {}

/**
 * Zod schema for validating class declarations.
 */
export const ClassDataSchema = z.object({
  name: z.string(),
  docstring: z.string(),
  base_classes: z.array(z.string()),
  implements_interfaces: z.array(z.string()).optional(),
  methods: z.array(FunctionDataSchema),
  decorators: z.array(z.string()),
});

/**
 * Class declaration extracted from source code.
 *
 * Captures class structure including inheritance, interfaces,
 * methods, and decorators for architectural analysis.
 *
 * @example
 * const classData: ClassData = {
 *   name: 'AuthHandler',
 *   docstring: 'Handles authentication and authorization',
 *   base_classes: ['BaseHandler'],
 *   implements_interfaces: ['IAuthProvider'],
 *   methods: [
 *     { name: 'validateToken', ... },
 *     { name: 'refreshToken', ... }
 *   ],
 *   decorators: ['@injectable']
 * };
 */
export interface ClassData extends z.infer<typeof ClassDataSchema> {}

/**
 * Zod schema for validating class properties and interface fields.
 */
export const PropertyDataSchema = z.object({
  name: z.string(),
  type: z.string(),
  optional: z.boolean().optional(),
});

/**
 * Class property or interface field.
 *
 * Represents typed properties for data structure analysis.
 *
 * @example
 * const property: PropertyData = {
 *   name: 'userId',
 *   type: 'string',
 *   optional: false
 * };
 */
export interface PropertyData extends z.infer<typeof PropertyDataSchema> {}

/**
 * Zod schema for validating interface/type alias declarations.
 */
export const InterfaceDataSchema = z.object({
  name: z.string(),
  docstring: z.string(),
  properties: z.array(PropertyDataSchema),
});

/**
 * Interface or type alias declaration extracted from source code.
 *
 * Normalized type definitions for data structure comprehension.
 *
 * @example
 * const interfaceData: InterfaceData = {
 *   name: 'AuthConfig',
 *   docstring: 'Configuration for authentication system',
 *   properties: [
 *     { name: 'jwtSecret', type: 'string', optional: false },
 *     { name: 'tokenExpiry', type: 'number', optional: true }
 *   ]
 * };
 */
export interface InterfaceData extends z.infer<typeof InterfaceDataSchema> {}

/**
 * Zod schema for validating complete structural analysis output.
 */
export const StructuralDataSchema = z.object({
  language: z.string(),
  docstring: z.string(),
  imports: z.array(z.string()),
  classes: z.array(ClassDataSchema),
  functions: z.array(FunctionDataSchema),
  interfaces: z.array(InterfaceDataSchema).optional(),
  exports: z.array(z.string()).optional(),
  dependencies: z.array(z.string()).optional(),
  depth: z.number().optional(),
  type: z.string().optional(),
  relationship: z.string().optional(),
  extraction_method: z.enum([
    'ast_native',
    'ast_remote',
    'slm',
    'llm_supervised',
  ]),
  fidelity: z.number(),
  summary: z.string().optional(),
});

/**
 * Complete structural analysis of a source file.
 *
 * Contains all extracted classes, functions, interfaces, dependencies,
 * and metadata about the extraction process.
 *
 * The fidelity score (0.0-1.0) indicates extraction quality:
 * - ast_native: 0.95-1.0 (complete, accurate AST)
 * - ast_remote: 0.90-0.95 (delegated but verified)
 * - slm: 0.70-0.90 (heuristic-based)
 * - llm_supervised: 0.50-0.70 (fallback with verification)
 *
 * @example
 * const structuralData: StructuralData = {
 *   language: 'typescript',
 *   docstring: 'Authentication and authorization module',
 *   imports: ['jsonwebtoken', 'bcrypt', './types'],
 *   classes: [{ name: 'AuthHandler', ... }],
 *   functions: [{ name: 'hashPassword', ... }],
 *   interfaces: [{ name: 'AuthConfig', ... }],
 *   exports: ['AuthHandler', 'hashPassword'],
 *   dependencies: ['jsonwebtoken', 'bcrypt'],
 *   extraction_method: 'ast_native',
 *   fidelity: 0.98
 * };
 */
export interface StructuralData extends z.infer<typeof StructuralDataSchema> {}

/**
 * Response from a summarization operation.
 *
 * Contains the detected language and LLM-generated summary.
 *
 * @example
 * const response: SummarizeResponse = {
 *   language: 'typescript',
 *   summary: 'Implements JWT-based authentication with bcrypt password hashing'
 * };
 */
export interface SummarizeResponse {
  language: string;
  summary: string;
}

/**
 * Interface for AST parsers that extract structural data from source code.
 *
 * Parsers can be native (in-process) or remote (external service).
 * Native parsers offer higher performance and fidelity, while remote
 * parsers enable cross-language support.
 *
 * @example
 * const parser: ASTParser = {
 *   isNative: true,
 *   language: 'typescript',
 *   parse: async (content) => {
 *     const sourceFile = ts.createSourceFile(...);
 *     return extractStructuralData(sourceFile);
 *   }
 * };
 */
export interface ASTParser {
  /** Whether parser runs in-process (true) or delegates to service (false) */
  isNative: boolean;
  /** Language this parser supports */
  language: Language;
  /** Extract structural data from source code */
  parse(content: string): Promise<StructuralData>;
}

/**
 * Zod schema for validating structural pattern metadata.
 *
 * Supports dual embeddings: structural (for pattern matching) and
 * semantic (for mission alignment).
 */
export const StructuralPatternMetadataSchema = z.object({
  symbol: z.string(),
  anchor: z.string(), // File path of the symbol
  structuralSignature: z.string(),
  semanticSignature: z.string().optional(), // Docstring + type name for mission coherence
  architecturalRole: z.string(),
  computedAt: z.string(),
  symbolStructuralDataHash: z.string(),
  vectorId: z.string(), // Structural embedding vector ID
  semanticVectorId: z.string().optional(), // Semantic embedding vector ID
  embeddingHash: z.string().optional(), // Hash of structural embedding
  semanticEmbeddingHash: z.string().optional(), // Hash of semantic embedding
  validation: z.object({
    sourceHash: z.string(),
    embeddingModelVersion: z.string(),
    extractionMethod: z.string(),
    fidelity: z.number(),
  }),
});

/**
 * Metadata for a structural pattern extracted from source code.
 *
 * DUAL EMBEDDING DESIGN:
 * Each pattern maintains two embeddings for different query types:
 * 1. Structural (vectorId): Based on function signature, parameter types
 *    - Used for: "Find similar code patterns"
 *    - Example: All functions accepting (string, AuthConfig) => Promise<User>
 *
 * 2. Semantic (semanticVectorId): Based on docstring, purpose, context
 *    - Used for: "Find code violating mission principles"
 *    - Example: Authentication functions lacking security constraints
 *
 * This enables both syntactic similarity search AND semantic coherence checks.
 *
 * @example
 * const pattern: StructuralPatternMetadata = {
 *   symbol: 'AuthHandler.validateToken',
 *   anchor: '/src/auth/handler.ts',
 *   structuralSignature: 'validateToken(token: string): Promise<boolean>',
 *   semanticSignature: 'Validates JWT tokens ensuring secure authentication',
 *   architecturalRole: 'security',
 *   computedAt: '2025-11-15T10:00:00Z',
 *   symbolStructuralDataHash: 'abc123...',
 *   vectorId: 'struct_def456',
 *   semanticVectorId: 'semantic_ghi789',
 *   embeddingHash: 'jkl012...',
 *   semanticEmbeddingHash: 'mno345...',
 *   validation: {
 *     sourceHash: 'pqr678...',
 *     embeddingModelVersion: 'text-embedding-3-small-768',
 *     extractionMethod: 'ast_native',
 *     fidelity: 0.98
 *   }
 * };
 */
export interface StructuralPatternMetadata
  extends z.infer<typeof StructuralPatternMetadataSchema> {}
