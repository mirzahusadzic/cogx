import { z } from 'zod';

export type Language =
  | 'typescript'
  | 'javascript'
  | 'python'
  | 'java'
  | 'rust'
  | 'go'
  | 'unknown';

export const LanguageSchema = z.enum([
  'typescript',
  'javascript',
  'python',
  'java',
  'rust',
  'go',
  'unknown',
]);

export const SourceFileSchema = z.object({
  path: z.string(),
  relativePath: z.string(),
  name: z.string(),
  language: LanguageSchema,
  content: z.string(),
});

export interface SourceFile extends z.infer<typeof SourceFileSchema> {}

export const ParameterDataSchema = z.object({
  name: z.string(),
  type: z.string(),
  optional: z.boolean().optional(),
  default: z.string().optional(),
});

export interface ParameterData extends z.infer<typeof ParameterDataSchema> {}

export const FunctionDataSchema = z.object({
  name: z.string(),
  docstring: z.string(),
  params: z.array(ParameterDataSchema),
  returns: z.string(),
  is_async: z.boolean(),
  decorators: z.array(z.string()),
});

export interface FunctionData extends z.infer<typeof FunctionDataSchema> {}

export const ClassDataSchema = z.object({
  name: z.string(),
  docstring: z.string(),
  base_classes: z.array(z.string()),
  implements_interfaces: z.array(z.string()).optional(),
  methods: z.array(FunctionDataSchema),
  decorators: z.array(z.string()),
});

export interface ClassData extends z.infer<typeof ClassDataSchema> {}

export const PropertyDataSchema = z.object({
  name: z.string(),
  type: z.string(),
  optional: z.boolean().optional(),
});

export interface PropertyData extends z.infer<typeof PropertyDataSchema> {}

export const InterfaceDataSchema = z.object({
  name: z.string(),
  docstring: z.string(),
  properties: z.array(PropertyDataSchema),
});

export interface InterfaceData extends z.infer<typeof InterfaceDataSchema> {}

export const StructuralDataSchema = z.object({
  language: z.string(),
  docstring: z.string(),
  imports: z.array(z.string()),
  classes: z.array(ClassDataSchema),
  functions: z.array(FunctionDataSchema),
  interfaces: z.array(InterfaceDataSchema).optional(),
  exports: z.array(z.string()).optional(),
  dependencies: z.array(z.string()).optional(),
  depth: z.number().optional(), // Added depth
  type: z.string().optional(), // Added type
  relationship: z.string().optional(), // Added relationship
  extraction_method: z.enum([
    'ast_native',
    'ast_remote',
    'slm',
    'llm_supervised',
  ]),
  fidelity: z.number(),
  summary: z.string().optional(),
});

export interface StructuralData extends z.infer<typeof StructuralDataSchema> {}

export interface SummarizeResponse {
  language: string;
  summary: string;
}

export interface ASTParser {
  isNative: boolean;
  language: Language;
  parse(content: string): Promise<StructuralData>;
}

export const StructuralPatternMetadataSchema = z.object({
  symbol: z.string(),
  anchor: z.string(), // File path of the symbol
  structuralSignature: z.string(),
  architecturalRole: z.string(),
  computedAt: z.string(),
  symbolStructuralDataHash: z.string(),
  vectorId: z.string(),
  validation: z.object({
    sourceHash: z.string(),
    embeddingModelVersion: z.string(),
    extractionMethod: z.string(),
    fidelity: z.number(),
  }),
});

export interface StructuralPatternMetadata
  extends z.infer<typeof StructuralPatternMetadataSchema> {}
