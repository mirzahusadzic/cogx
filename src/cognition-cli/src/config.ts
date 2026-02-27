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
 * Uses Gemini 3 Flash for speed and cost efficiency as 2.x models reach EOL
 */
export const DEFAULT_SLM_MODEL_NAME = 'gemini-3-flash-preview';

/**
 * Model for tool output summarization (eGemma compression)
 * Uses Gemini 3 Flash for efficiency and unified quota
 * This offloads summarization from the main agent's quota
 */
export const DEFAULT_SUMMARIZER_MODEL_NAME = 'gemini-3-flash-preview';

/**
 * Max tokens for tool output summarization
 * Generous limit to handle large tool outputs efficiently
 */
export const DEFAULT_SUMMARIZER_MAX_TOKENS = 8192;

/**
 * Model for security validation (mission document analysis)
 * Uses Gemini 3 Pro for deeper reasoning and threat detection
 */
export const DEFAULT_OPSEC_MODEL_NAME = 'gemini-3.1-pro-preview';

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

/**
 * Maximum number of completed tasks to include in the system prompt
 * Ensures the model has context of recent achievements without bloating prompt
 */
export const SYSTEM_PROMPT_MAX_COMPLETED_TASKS = 10;

/**
 * Maximum character limit for SIGMA.md content to prevent context bloat.
 * Approximately 1000 tokens.
 */
export const MAX_SIGMA_MD_CHARS = 4000;

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
// RATE LIMITING (Fallback Defaults)
// ========================================
// These are fallback defaults used when the eGemma server is unreachable.
// WorkbenchClient fetches actual limits from GET /rate-limits on first use.
// Keep these in sync with eGemma's src/config.py for optimal fallback behavior.

/**
 * Fallback rate limit window for /summarize endpoint (seconds)
 */
export const SUMMARIZE_RATE_LIMIT_SECONDS = 60;

/**
 * Fallback maximum /summarize calls per window
 * Should match eGemma's SUMMARIZE_RATE_LIMIT_CALLS
 */
export const SUMMARIZE_RATE_LIMIT_CALLS = 2;

/**
 * Fallback rate limit window for /embed endpoint (seconds)
 */
export const EMBED_RATE_LIMIT_SECONDS = 10;

/**
 * Fallback maximum /embed calls per window
 * Should match eGemma's EMBED_RATE_LIMIT_CALLS (currently 5)
 */
export const EMBED_RATE_LIMIT_CALLS = 5;

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
// FILE TYPE SUPPORT - SINGLE SOURCE OF TRUTH
// ========================================

/**
 * Language configuration - THE ONLY PLACE TO EDIT when adding new languages
 *
 * Each entry defines:
 * - ext: file extension (e.g., '.ts')
 * - displayName: human-readable name (e.g., 'TypeScript')
 * - lang: internal language type (e.g., 'typescript')
 *
 * To add a new language, just add an entry here - everything else derives automatically.
 */
export const LANGUAGE_CONFIG = [
  { ext: '.ts', displayName: 'TypeScript', lang: 'typescript' },
  { ext: '.tsx', displayName: 'TypeScript (React)', lang: 'typescript' },
  { ext: '.js', displayName: 'JavaScript', lang: 'javascript' },
  { ext: '.jsx', displayName: 'JavaScript (React)', lang: 'javascript' },
  { ext: '.py', displayName: 'Python', lang: 'python' },
] as const;

/** Supported language types - must match unique lang values in LANGUAGE_CONFIG */
export const SUPPORTED_LANGUAGES = [
  'typescript',
  'javascript',
  'python',
  'unknown',
] as const;

/** Language type for the type system */
export type LanguageType = (typeof SUPPORTED_LANGUAGES)[number];

/** Supported file extensions (derived) */
export const DEFAULT_FILE_EXTENSIONS = LANGUAGE_CONFIG.map((c) => c.ext);

/** Extension to display name mapping (derived) */
export const LANGUAGE_MAP: Record<string, string> = Object.fromEntries(
  LANGUAGE_CONFIG.map((c) => [c.ext, c.displayName])
);

/** Extension to language type mapping (derived) */
export const EXTENSION_TO_LANGUAGE: Record<string, LanguageType> =
  Object.fromEntries(LANGUAGE_CONFIG.map((c) => [c.ext, c.lang]));

/**
 * Get Language type from file extension
 * @param ext - File extension including dot (e.g., '.ts')
 * @returns Language type or 'unknown' if not supported
 */
export function getLanguageFromExtension(ext: string): LanguageType {
  return EXTENSION_TO_LANGUAGE[ext] || 'unknown';
}
