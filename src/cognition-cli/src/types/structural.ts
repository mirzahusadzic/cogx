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

export interface ParameterData {
  name: string;
  type: string;
  optional: boolean;
  default?: string;
}

export interface FunctionData {
  name: string;
  docstring: string;
  params: ParameterData[];
  returns: string;
  is_async: boolean;
  decorators: string[];
}

export interface ClassData {
  name: string;
  docstring: string;
  base_classes: string[];
  implements_interfaces: string[];
  methods: FunctionData[];
  decorators: string[];
}

export interface StructuralData {
  language: string;
  docstring: string;
  imports: string[];
  classes: ClassData[];
  functions: FunctionData[];
  exports: string[]; // Can be enhanced further if needed
  dependencies?: string[];
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
