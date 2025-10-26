export const DEFAULT_MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
export const DEFAULT_SLM_MODEL_NAME = 'gemini-2.5-flash';
export const DEFAULT_OPSEC_MODEL_NAME = 'gemini-2.5-flash'; // Valid Gemini model for security
export const DEFAULT_OPSEC_ENABLED = true; // Enable LLM security filtering by default
export const SUMMARIZE_RATE_LIMIT_SECONDS = 60;
export const SUMMARIZE_RATE_LIMIT_CALLS = 2;
export const EMBED_RATE_LIMIT_SECONDS = 10;
export const EMBED_RATE_LIMIT_CALLS = 5;
export const DEFAULT_EMBEDDING_DIMENSIONS = 768;
export const DEFAULT_EMBEDDING_MODEL_NAME = 'google/embeddinggemma-300m';
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
