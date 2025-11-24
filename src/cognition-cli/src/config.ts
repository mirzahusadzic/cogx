/**
 * Global Configuration Constants
 *
 * Central configuration for the cognition-cli system including:
 * - File processing limits
 * - Model selection (SLM/LLM/embedding)
 * - Persona mappings for workbench integration
 * - Rate limiting and retry policies
 * - Embedding parameters
 *
 * DESIGN:
 * This is a single source of truth for configuration values used across
 * the CLI, avoiding magic numbers and making system behavior transparent.
 * All constants are exported for easy override in tests or specialized deployments.
 *
 * ARCHITECTURE:
 * - Model Selection: Uses Gemini Flash for speed, Thinking models for security
 * - Persona System: Maps CLI operations to workbench personas for consistency
 * - Rate Limiting: Protects external APIs (workbench) from overload
 * - Retry Logic: Exponential backoff with caps for 429 rate limit errors
 *
 * @example
 * // Import specific constants as needed
 * import { DEFAULT_SLM_MODEL_NAME, PERSONA_AST_ANALYST } from './config.js';
 *
 * // Use in workbench client
 * const response = await workbench.summarize(text, {
 *   model: DEFAULT_SLM_MODEL_NAME,
 *   maxTokens: DEFAULT_MAX_OUTPUT_TOKENS
 * });
 *
 * @example
 * // Override for testing
 * import * as config from './config.js';
 * config.MAX_RETRIES = 1; // Fast failure in tests
 */

// ========================================
// FILE PROCESSING LIMITS
// ========================================

/**
 * Maximum file size for processing (10 MB)
 * Prevents memory exhaustion on extremely large files
 */
export const DEFAULT_MAX_FILE_SIZE = 10 * 1024 * 1024;

// ========================================
// MODEL SELECTION
// ========================================

/**
 * Default small language model for fast operations (parsing, extraction)
 * Uses Gemini Flash for speed and cost efficiency
 */
export const DEFAULT_SLM_MODEL_NAME = 'gemini-2.5-flash';

/**
 * Model for tool output summarization (eGemma compression)
 * Uses Gemini 2.0 Flash for separate quota pool (4M TPM, unlimited RPD)
 * This offloads summarization from the main agent's quota
 */
export const DEFAULT_SUMMARIZER_MODEL_NAME = 'gemini-2.0-flash';

/**
 * Model for security validation (mission document analysis)
 * Uses Gemini Thinking model for deeper reasoning and threat detection
 */
export const DEFAULT_OPSEC_MODEL_NAME = 'gemini-2.0-flash-thinking-exp-01-21';

/**
 * Enable LLM-based security filtering by default
 * Set to false to disable mission drift detection and validation
 */
export const DEFAULT_OPSEC_ENABLED = true;

/**
 * Embedding model for semantic search
 * Uses EmbeddingGemma 300M for efficient vector generation
 */
export const DEFAULT_EMBEDDING_MODEL_NAME = 'google/embeddinggemma-300m';

// ========================================
// TOKEN LIMITS
// ========================================

/**
 * Maximum output tokens for LLM responses
 * Increased to 8192 to handle large document summaries and extractions
 */
export const DEFAULT_MAX_OUTPUT_TOKENS = 8192;

/**
 * Dedicated token budget for memory recall synthesis (32K = 2^15)
 * Prevents truncation when reconstructing long conversation histories
 * across session boundaries in the TUI
 */
export const MEMORY_RECALL_MAX_TOKENS = 32768;

// ========================================
// PERSONA MAPPINGS
// ========================================
// These connect CLI operations to workbench personas for consistent behavior
// Personas are user-controlled and configured in the workbench

/**
 * Persona for AST-based structural extraction
 * Used by genesis command for fast code analysis
 */
export const PERSONA_AST_ANALYST = 'ast_analyst';

/**
 * Persona for LLM-supervised parsing
 * Used when AST extraction needs enhancement or validation
 */
export const PERSONA_PARSER_GENERATOR = 'parser_generator';

/**
 * Persona for validating strategic/mission documents
 * Detects semantic drift and policy violations in VISION.md, etc.
 */
export const PERSONA_SECURITY_VALIDATOR = 'security_validator';

/**
 * Persona for validating operational workflow documents
 * Ensures operational patterns align with best practices
 */
export const PERSONA_OPERATIONAL_VALIDATOR = 'operational_validator';

/**
 * Persona for validating security guideline documents
 * Meta-validator for security documentation (validates the validators)
 */
export const PERSONA_SECURITY_META_VALIDATOR = 'security_meta_validator';

/**
 * Persona for validating mathematical proofs and theorems
 * Checks formal correctness and logical consistency
 */
export const PERSONA_MATHEMATICAL_VALIDATOR = 'mathematical_validator';

/**
 * Persona for Q&A query deconstruction
 * Breaks down complex queries into searchable sub-queries
 */
export const PERSONA_QUERY_ANALYST = 'query_analyst';

/**
 * Persona for Q&A answer synthesis
 * Combines retrieved context into coherent answers
 */
export const PERSONA_KNOWLEDGE_ASSISTANT = 'knowledge_assistant';

/**
 * Persona for conversation memory recall synthesis
 * Reconstructs relevant conversation history from compressed state
 */
export const PERSONA_CONVERSATION_MEMORY_ASSISTANT =
  'conversation_memory_assistant';

/**
 * Persona for intelligent tool output summarization
 * Compresses large tool outputs while preserving critical info (errors, key findings)
 */
export const PERSONA_TOOL_OUTPUT_SUMMARIZER = 'tool_output_summarizer';

// ========================================
// RATE LIMITING
// ========================================

/**
 * Rate limit window for /summarize endpoint (seconds)
 * Allows SUMMARIZE_RATE_LIMIT_CALLS within this window
 */
export const SUMMARIZE_RATE_LIMIT_SECONDS = 60;

/**
 * Maximum /summarize calls per window
 * 2 calls per 60 seconds prevents workbench overload
 */
export const SUMMARIZE_RATE_LIMIT_CALLS = 2;

/**
 * Rate limit window for /embed endpoint (seconds)
 */
export const EMBED_RATE_LIMIT_SECONDS = 10;

/**
 * Maximum /embed calls per window
 * 5 calls per 10 seconds balances throughput and protection
 */
export const EMBED_RATE_LIMIT_CALLS = 10;

// ========================================
// RETRY CONFIGURATION
// ========================================
// Used in WorkbenchClient for /summarize and /embed endpoints

/**
 * Maximum retry attempts for 429 rate limit errors
 * Uses exponential backoff between attempts
 */
export const MAX_RETRIES = 5;

/**
 * Maximum retry delay (milliseconds)
 * Caps exponential backoff at 3 seconds for responsive TUI experience
 */
export const MAX_RETRY_DELAY_MS = 3000;

// ========================================
// EMBEDDING CONFIGURATION
// ========================================

/**
 * Vector dimensionality for embeddings
 * EmbeddingGemma produces 768-dimensional vectors
 */
export const DEFAULT_EMBEDDING_DIMENSIONS = 768;

/**
 * Embedding prompt type for retrieval
 * Optimizes embeddings for document retrieval use cases
 */
export const EMBED_PROMPT_NAME = 'Retrieval-document';

// ========================================
// EXTRACTION METHODS
// ========================================

/**
 * Extraction methods that require workbench connection
 * These cannot run offline and will fail without WORKBENCH_URL
 */
export const WORKBENCH_DEPENDENT_EXTRACTION_METHODS = [
  'ast_remote',
  'slm',
  'llm_supervised',
];

// ========================================
// FILE TYPE SUPPORT
// ========================================

/**
 * Supported file extensions for code analysis
 * Genesis command processes these file types by default
 */
export const DEFAULT_FILE_EXTENSIONS = [
  '.ts',
  '.tsx',
  '.d.ts',
  '.js',
  '.jsx',
  '.py',
  '.java',
  '.rs',
  '.go',
];
