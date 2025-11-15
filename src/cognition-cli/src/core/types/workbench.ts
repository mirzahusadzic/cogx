/**
 * Workbench API Types
 *
 * Type definitions for interacting with the external workbench service.
 * The workbench provides AST parsing, LLM summarization, and embedding generation.
 *
 * DESIGN:
 * These types define the contract between the CLI and the workbench service:
 * - EmbedRequest/EmbedResponse: Vector embedding generation for semantic search
 * - SummarizeRequest: LLM-powered content summarization with persona-based prompting
 * - ASTParseRequest: Language-agnostic structural extraction via remote parsers
 *
 * The workbench service abstracts away the complexity of multiple embedding models,
 * LLM providers, and AST parsers, providing a unified interface for cognitive operations.
 *
 * @example
 * // Generate embeddings for a function signature
 * const embedRequest: EmbedRequest = {
 *   signature: 'function calculateTotal(items: Item[]): number',
 *   dimensions: 768,
 *   prompt_name: 'structural_pattern'
 * };
 *
 * @example
 * // Summarize a file with a specific persona
 * const summarizeRequest: SummarizeRequest = {
 *   content: sourceCode,
 *   filename: 'auth-handler.ts',
 *   persona: 'security_analyst',
 *   goal: 'Identify security constraints and attack vectors',
 *   model_name: 'claude-3-sonnet',
 *   max_tokens: 2048
 * };
 *
 * @example
 * // Parse TypeScript with remote AST service
 * const parseRequest: ASTParseRequest = {
 *   content: sourceCode,
 *   language: 'typescript',
 *   filename: 'database.ts'
 * };
 */

/**
 * Response from embedding API containing the vector and model metadata.
 *
 * The flexible index signature allows for additional fields returned by
 * different embedding providers while ensuring core fields are present.
 *
 * @example
 * const response: EmbedResponse = {
 *   model: 'text-embedding-3-small',
 *   dimensions: 768,
 *   embedding: [0.123, -0.456, ...],
 *   usage: { tokens: 42 }
 * };
 */
export interface EmbedResponse {
  [key: string]: number[] | string | number; // Allow different types
  model: string;
  dimensions: number;
}

/**
 * Supported embedding vector dimensions.
 *
 * Different dimensions offer trade-offs between precision and storage:
 * - 128: Fast, low memory, suitable for large-scale approximate search
 * - 256: Balanced performance and accuracy
 * - 512: Higher precision for complex semantic relationships
 * - 768: Maximum precision, used for mission-critical semantic alignment
 */
export type EmbeddingDimensions = 128 | 256 | 512 | 768;

/**
 * Request to summarize content using an LLM with persona-based prompting.
 *
 * The persona parameter selects a specialized system prompt that guides
 * the LLM's analysis. For example, 'security_analyst' focuses on constraints
 * and attack vectors, while 'architect' emphasizes design patterns.
 *
 * @example
 * const request: SummarizeRequest = {
 *   content: fileContent,
 *   filename: 'payment-processor.ts',
 *   persona: 'security_analyst',
 *   goal: 'Extract security-critical operations',
 *   temperature: 0.3, // Lower for more focused analysis
 *   enable_safety: true
 * };
 */
export interface SummarizeRequest {
  /** The source code or text content to summarize */
  content: string;
  /** Original filename for context */
  filename: string;
  /** Role-specific system prompt (e.g., 'security_analyst', 'architect') */
  persona: string;
  /** Optional specific goal for the summarization task */
  goal?: string;
  /** LLM model identifier (defaults to workbench configuration) */
  model_name?: string;
  /** Maximum tokens in response (defaults to 2048) */
  max_tokens?: number;
  /** Sampling temperature (0.0-1.0, lower = more focused) */
  temperature?: number;
  /** Enable safety filtering for generated content */
  enable_safety?: boolean;
}

/**
 * Request to parse source code using an AST parser.
 *
 * Delegates to language-specific parsers in the workbench service.
 * Returns structural data including classes, functions, and dependencies.
 *
 * @example
 * const request: ASTParseRequest = {
 *   content: pythonCode,
 *   language: 'python',
 *   filename: 'ml_pipeline.py'
 * };
 */
export interface ASTParseRequest {
  /** Source code to parse */
  content: string;
  /** Programming language (typescript, python, rust, go, java) */
  language: string;
  /** Original filename for error reporting */
  filename: string;
}

/**
 * Request to generate an embedding vector from a signature.
 *
 * The signature is a condensed representation of the semantic content.
 * For structural patterns, this is typically a normalized function signature.
 * For semantic patterns, this includes docstrings and type information.
 *
 * @example
 * // Structural signature for pattern matching
 * const structuralRequest: EmbedRequest = {
 *   signature: 'AuthHandler.validateToken(token: string): Promise<boolean>',
 *   dimensions: 768,
 *   prompt_name: 'structural_pattern'
 * };
 *
 * @example
 * // Semantic signature for mission alignment
 * const semanticRequest: EmbedRequest = {
 *   signature: 'Validates JWT tokens ensuring secure authentication',
 *   dimensions: 768,
 *   prompt_name: 'semantic_pattern'
 * };
 */
export interface EmbedRequest {
  /** The signature or text to embed */
  signature: string;
  /** Vector dimension (128, 256, 512, or 768) */
  dimensions: number;
  /** Embedding prompt variant (e.g., 'structural_pattern', 'semantic_pattern') */
  prompt_name?: string;
}
