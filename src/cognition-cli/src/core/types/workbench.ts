/**
 * Represents the response from an embedding API call.
 */
export interface EmbedResponse {
  [key: string]: number[] | string | number; // Allow different types
  model: string;
  dimensions: number;
}

/**
 * Supported embedding vector dimensions.
 */
export type EmbeddingDimensions = 128 | 256 | 512 | 768;

/**
 * Represents a request to summarize content using an LLM.
 */
export interface SummarizeRequest {
  content: string;
  filename: string;
  persona: string;
  goal?: string;
  model_name?: string;
  max_tokens?: number;
  temperature?: number;
  enable_safety?: boolean;
}

/**
 * Represents a request to parse source code using an AST parser.
 */
export interface ASTParseRequest {
  content: string;
  language: string;
  filename: string;
}

/**
 * Represents a request to generate an embedding vector from a signature.
 */
export interface EmbedRequest {
  signature: string;
  dimensions: number;
  prompt_name?: string;
}
