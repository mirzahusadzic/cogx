export type Language =
  | 'typescript'
  | 'javascript'
  | 'python'
  | 'java'
  | 'rust'
  | 'go'
  | 'unknown';

export interface SourceFile {
  path: string;
  relativePath: string;
  name: string;
  language: Language;
  content: string;
}

export interface StructuralData {
  language: string;
  imports: string[];
  classes: Array<{ name: string; methods: string[] }>;
  functions: Array<{ name: string; params: string[] }>;
  exports: string[];
  dependencies: string[];
  extraction_method?: 'ast_native' | 'ast_remote' | 'slm' | 'llm_supervised';
  fidelity?: number;
  summary?: string;
}

export interface SummarizeResponse {
  language: string;
  summary: string;
}

export interface ASTParser {
  isNative: boolean;
  language: Language;
  parse(content: string): Promise<StructuralData>;
}
