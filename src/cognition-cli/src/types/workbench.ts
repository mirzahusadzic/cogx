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
