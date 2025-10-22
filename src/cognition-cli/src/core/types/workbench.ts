export interface SummarizeRequest {
  content: string;
  filename: string;
  persona: string;
  goal?: string;
  model_name?: string;
  max_tokens?: number;
  temperature?: number;
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

export interface EmbedResponse {
  [key: string]: number[];
}
