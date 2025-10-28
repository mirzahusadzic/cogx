import { z } from 'zod';

/**
 * Supported programming languages for structural extraction.
 */
export type Language =
  | 'typescript'
  | 'javascript'
  | 'python'
  | 'java'
  | 'rust'
  | 'go'
  | 'unknown';

/**
 * Zod schema for validating Language type.
 */
export const LanguageSchema = z.enum([
  'typescript',
  'javascript',
  'python',
  'java',
  'rust',
  'go',
  'unknown',
]);

/**
 * Zod schema for validating SourceFile structure.
 */
export const SourceFileSchema = z.object({
  path: z.string(),
  relativePath: z.string(),
  name: z.string(),
  language: LanguageSchema,
  content: z.string(),
});

/**
 * Represents a source code file with language metadata.
 */
export interface SourceFile extends z.infer<typeof SourceFileSchema> {}

/**
 * Represents a function or method parameter
 */
export const ParameterDataSchema = z.object({
  name: z.string(),
  type: z.string(),
  optional: z.boolean().optional(),
  default: z.string().optional(),
});

/**
 * Represents a function or method parameter
 */
export interface ParameterData extends z.infer<typeof ParameterDataSchema> {}

/**
 * Represents a function or method declaration extracted from source code
 */
export const FunctionDataSchema = z.object({
  name: z.string(),
  docstring: z.string(),
  params: z.array(ParameterDataSchema),
  returns: z.string(),
  is_async: z.boolean(),
  decorators: z.array(z.string()),
});

/**
 * Represents a function or method declaration extracted from source code
 */
export interface FunctionData extends z.infer<typeof FunctionDataSchema> {}

/**
 * Represents a class declaration extracted from source code
 */
export const ClassDataSchema = z.object({
  name: z.string(),
  docstring: z.string(),
  base_classes: z.array(z.string()),
  implements_interfaces: z.array(z.string()).optional(),
  methods: z.array(FunctionDataSchema),
  decorators: z.array(z.string()),
});

/**
 * Represents a class declaration extracted from source code
 */
export interface ClassData extends z.infer<typeof ClassDataSchema> {}

/**
 * Represents a class property or interface field
 */
export const PropertyDataSchema = z.object({
  name: z.string(),
  type: z.string(),
  optional: z.boolean().optional(),
});

/**
 * Represents a class property or interface field
 */
export interface PropertyData extends z.infer<typeof PropertyDataSchema> {}

/**
 * Represents an interface or type alias declaration extracted from source code
 */
export const InterfaceDataSchema = z.object({
  name: z.string(),
  docstring: z.string(),
  properties: z.array(PropertyDataSchema),
});

/**
 * Represents an interface or type alias declaration extracted from source code
 */
export interface InterfaceData extends z.infer<typeof InterfaceDataSchema> {}

/**
 * Represents the complete structural analysis of a source file
 * Includes all classes, functions, interfaces extracted via AST parsing
 */
export const StructuralDataSchema = z.object({
  language: z.string(),
  docstring: z.string(),
  imports: z.array(z.string()),
  classes: z.array(ClassDataSchema),
  functions: z.array(FunctionDataSchema),
  interfaces: z.array(InterfaceDataSchema).optional(),
  exports: z.array(z.string()).optional(),
  dependencies: z.array(z.string()).optional(),
  depth: z.number().optional(),
  type: z.string().optional(),
  relationship: z.string().optional(),
  extraction_method: z.enum([
    'ast_native',
    'ast_remote',
    'slm',
    'llm_supervised',
  ]),
  fidelity: z.number(),
  summary: z.string().optional(),
});

/**
 * Represents the complete structural analysis of a source file
 * Includes all classes, functions, interfaces extracted via AST parsing
 */
export interface StructuralData extends z.infer<typeof StructuralDataSchema> {}

/**
 * Represents the response from a summarization operation.
 */
export interface SummarizeResponse {
  language: string;
  summary: string;
}

/**
 * Interface for AST parsers that extract structural data from source code
 * Native parsers run in-process, remote parsers delegate to external services
 */
export interface ASTParser {
  isNative: boolean;
  language: Language;
  parse(content: string): Promise<StructuralData>;
}

/**
 * Zod schema for validating structural pattern metadata.
 * Supports dual embeddings: structural (for pattern matching) and semantic (for mission alignment).
 */
export const StructuralPatternMetadataSchema = z.object({
  symbol: z.string(),
  anchor: z.string(), // File path of the symbol
  structuralSignature: z.string(),
  semanticSignature: z.string().optional(), // Docstring + type name for mission coherence
  architecturalRole: z.string(),
  computedAt: z.string(),
  symbolStructuralDataHash: z.string(),
  vectorId: z.string(), // Structural embedding vector ID
  semanticVectorId: z.string().optional(), // Semantic embedding vector ID
  embeddingHash: z.string().optional(), // Hash of structural embedding
  semanticEmbeddingHash: z.string().optional(), // Hash of semantic embedding
  validation: z.object({
    sourceHash: z.string(),
    embeddingModelVersion: z.string(),
    extractionMethod: z.string(),
    fidelity: z.number(),
  }),
});

/**
 * Represents metadata for a structural pattern extracted from source code.
 */
export interface StructuralPatternMetadata
  extends z.infer<typeof StructuralPatternMetadataSchema> {}
