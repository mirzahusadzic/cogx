export interface EmbedResponse {
  [key: string]: number[] | string | number; // Allow different types
  model: string;
  dimensions: number;
}

// Helper type for embedding dimensions
export type EmbeddingDimensions = 128 | 256 | 512 | 768;

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

export interface ASTParseRequest {
  content: string;
  language: string;
  filename: string;
}

export interface EmbedRequest {
  signature: string;
  dimensions: number;
  prompt_name?: string;
}
