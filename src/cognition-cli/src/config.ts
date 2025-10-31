export const DEFAULT_MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

// Model names
export const DEFAULT_SLM_MODEL_NAME = 'gemini-2.5-flash'; // Use Gemini Flash
export const DEFAULT_OPSEC_MODEL_NAME = 'gemini-2.0-flash-thinking-exp-01-21'; // Use Pro/Thinking for more reliable security validation
export const DEFAULT_OPSEC_ENABLED = true; // Enable LLM security filtering by default
export const DEFAULT_EMBEDDING_MODEL_NAME = 'google/embeddinggemma-300m';

// Token limits
export const DEFAULT_MAX_OUTPUT_TOKENS = 8192; // Max output tokens for LLM responses (increased for large documents)

// Persona names (user-controlled, provisional)
// These are defaults that connect to workbench personas
export const PERSONA_AST_ANALYST = 'ast_analyst'; // For SLM-based structural extraction
export const PERSONA_PARSER_GENERATOR = 'parser_generator'; // For LLM-supervised parsing
export const PERSONA_SECURITY_VALIDATOR = 'security_validator'; // For strategic/mission document validation
export const PERSONA_OPERATIONAL_VALIDATOR = 'operational_validator'; // For operational document validation
export const PERSONA_SECURITY_META_VALIDATOR = 'security_meta_validator'; // For security document validation
export const PERSONA_MATHEMATICAL_VALIDATOR = 'mathematical_validator'; // For mathematical document validation
export const PERSONA_QUERY_ANALYST = 'query_analyst'; // For Q&A query deconstruction
export const PERSONA_KNOWLEDGE_ASSISTANT = 'knowledge_assistant'; // For Q&A answer synthesis

// Rate limiting
export const SUMMARIZE_RATE_LIMIT_SECONDS = 60;
export const SUMMARIZE_RATE_LIMIT_CALLS = 2;
export const EMBED_RATE_LIMIT_SECONDS = 10;
export const EMBED_RATE_LIMIT_CALLS = 5;

// Embedding configuration
export const DEFAULT_EMBEDDING_DIMENSIONS = 768;
export const EMBED_PROMPT_NAME = 'Retrieval-document';

export const WORKBENCH_DEPENDENT_EXTRACTION_METHODS = [
  'ast_remote',
  'slm',
  'llm_supervised',
];

export const DEFAULT_FILE_EXTENSIONS = [
  '.ts',
  '.d.ts',
  '.js',
  '.py',
  '.java',
  '.rs',
  '.go',
];
