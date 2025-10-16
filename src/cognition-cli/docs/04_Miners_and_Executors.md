# 04 - Miners and Executors: Extracting and Processing Knowledge

This document details the components responsible for extracting structural information from source code and interacting with external services within the `cognition-cli`. These "Miners" and "Executors" form the intelligence layer that transforms raw code into verifiable `StructuralData`.

## 1. StructuralMiner: The Multi-Layered Extraction Engine

The `StructuralMiner` (`src/miners/structural-miner.ts`) is the core component that orchestrates the extraction of structural data from source files. It employs a robust, multi-layered approach to ensure high fidelity and resilience, prioritizing deterministic methods before falling back to AI-driven techniques.

### Extraction Layers

The `extractStructure` method attempts to extract structural data using the following hierarchy:

#### Layer 1: Deterministic AST Parsers (High Fidelity)

- **Native AST Parsing (TypeScript):**
  - **Mechanism:** The `ASTParserRegistry` (`src/miners/ast-parsers/index.ts`) provides access to native parsers. For TypeScript, the `TypeScriptParser` (`src/miners/ast-parsers/typescript-parser.ts`) directly uses the `typescript` library to parse code into an Abstract Syntax Tree (AST). This process extracts detailed information about imports, classes, functions, and exports, including docstrings, parameters, return types, inheritance, and decorators.
  - **Fidelity:** 1.0 (highest confidence).
- **Remote AST Parsing (Python via `eGemma`):**
  - **Mechanism:** For languages like Python, which do not have a native parser implemented directly in `cognition-cli`, the `StructuralMiner` delegates the parsing task to the `WorkbenchClient`'s `parseAST` method. This sends the code to the external `eGemma` server for AST generation.
  - **Fidelity:** 1.0 (highest confidence).
- **Other Languages (e.g., JavaScript, Java, Rust, Go):** Files with these extensions are discovered by the `GenesisOrchestrator`, but currently lack dedicated AST parsers in Layer 1. Their structural extraction will proceed to Layer 2 or Layer 3.

#### Layer 2: Specialized Language Model (SLM) Extraction (Medium Fidelity)

- **Mechanism:** If Layer 1 AST parsing fails or is unavailable, the `SLMExtractor` (`src/miners/slm-extractor.ts`) is engaged. It utilizes the `WorkbenchClient` to send the source file content to `eGemma`'s `/summarize` endpoint, instructing it to act as a `structure_extractor` persona. The `eGemma` server then uses a specialized language model to infer and return structural data in JSON format.
- **Fidelity:** 0.85 (moderate confidence).

#### Layer 3: LLM Supervised Extraction (Lower Fidelity)

- **Mechanism:** As a final fallback, if both Layer 1 and Layer 2 fail, the `LLMSupervisor` (`src/miners/llm-supervisor.ts`) is invoked. It uses the `WorkbenchClient` to send the source file to `eGemma`'s `/summarize` endpoint with a `parser_generator` persona and a goal to "Generate a tree-sitter query to extract structure." Currently, this layer is a placeholder for future implementation where the generated parsing logic would be executed in a sandbox.
- **Fidelity:** 0.7 (lowest confidence).

### Code Reference: StructuralMiner

```typescript
// src/miners/structural-miner.ts
import { WorkbenchClient } from '../executors/workbench-client.js';
import { ASTParserRegistry } from './ast-parsers/index.js';
import { SLMExtractor } from './slm-extractor.js';
import { LLMSupervisor } from './llm-supervisor.js';
import type { SourceFile, StructuralData } from '../types/structural.js';

export class StructuralMiner {
  private astParsers: ASTParserRegistry;
  private slmExtractor: SLMExtractor;
  private llmSupervisor: LLMSupervisor;

  constructor(private workbench: WorkbenchClient) {
    this.astParsers = new ASTParserRegistry();
    this.slmExtractor = new SLMExtractor(workbench);
    this.llmSupervisor = new LLMSupervisor(workbench);
  }

  async extractStructure(file: SourceFile): Promise<StructuralData> {
    // Layer 1: Try deterministic AST parser first (native)
    const parser = this.astParsers.get(file.language);
    if (parser && parser.isNative) {
      try {
        const result = await parser.parse(file.content);
        return {
          ...result,
          extraction_method: 'ast_native',
          fidelity: 1.0,
        };
      } catch (e) {
        console.warn(
          `Native AST parsing failed for ${file.path}: ${(e as Error).message}`
        );
      }
    }

    // Layer 1b: Try remote AST parser (for Python via egemma)
    if (parser && !parser.isNative) {
      try {
        const result = await this.workbench.parseAST({
          content: file.content,
          language: file.language,
          filename: file.name,
        });
        return {
          ...result,
          extraction_method: 'ast_remote',
          fidelity: 1.0,
        };
      } catch (e: any) {
        console.warn(`Remote AST parsing failed for ${file.path}:`);
        if (e.data) {
          console.warn('Validation Error:', JSON.stringify(e.data, null, 2));
        } else {
          console.warn('Full Error Object:', e);
        }
      }
    }

    // Layer 2: Fallback to specialized SLM
    try {
      const result = await this.slmExtractor.extract(file);
      return {
        ...result,
        extraction_method: 'slm',
        fidelity: 0.85,
      };
    } catch (e: any) {
      console.warn(`SLM extraction failed for ${file.path}:`);
      if (e.data) {
        console.warn('Validation Error:', JSON.stringify(e.data, null, 2));
      } else {
        console.warn('Full Error Object:', e);
      }
    }

    // Layer 3: LLM supervisor generates parser and executes
    console.log(`Escalating ${file.path} to LLM supervisor`);
    const result = await this.llmSupervisor.generateAndExecuteParser(file);
    return {
      ...result,
      extraction_method: 'llm_supervised',
      fidelity: 0.7,
    };
  }
}
```

## 2. ASTParserRegistry: Managing Language Parsers

The `ASTParserRegistry` (`src/miners/ast-parsers/index.ts`) acts as a central repository for different AST parsers, mapping programming languages to their respective parsing implementations.

### Code Reference: ASTParserRegistry

```typescript
// src/miners/ast-parsers/index.ts
import { TypeScriptParser } from './typescript-parser.js';
import type { ASTParser, Language } from '../../types/structural.js';

export class ASTParserRegistry {
  private parsers: Map<Language, ASTParser> = new Map();

  constructor() {
    this.parsers.set('typescript', new TypeScriptParser());

    this.parsers.set('python', {
      isNative: false,
      language: 'python',
      parse: async () => {
        throw new Error('Use workbench.parseAST()');
      },
    });
  }

  get(language: Language): ASTParser | undefined {
    return this.parsers.get(language);
  }

  has(language: Language): boolean {
    return this.parsers.has(language);
  }
}
```

## 3. TypeScriptParser: Native TypeScript AST Extraction

The `TypeScriptParser` (`src/miners/ast-parsers/typescript-parser.ts`) is responsible for natively parsing TypeScript source code into `StructuralData`.

### Code Reference: TypeScriptParser

```typescript
// src/miners/ast-parsers/typescript-parser.ts
import type {
  ASTParser,
  StructuralData,
  ParameterData,
  FunctionData,
  ClassData,
} from '../../types/structural.js';

import ts, {
  Node,
  Diagnostic,
  DiagnosticCategory,
  MethodDeclaration,
  ConstructorDeclaration,
  FunctionDeclaration,
  isMethodDeclaration,
} from 'typescript';

export class TypeScriptParser implements ASTParser {
  readonly isNative = true;
  readonly language = 'typescript';

  async parse(content: string): Promise<StructuralData> {
    const transpileResult = ts.transpileModule(content, {
      reportDiagnostics: true,
      compilerOptions: {
        target: ts.ScriptTarget.Latest,
        noEmit: true,
      },
    });

    const syntaxErrors = transpileResult.diagnostics?.filter(
      (diagnostic: Diagnostic) =>
        diagnostic.category === DiagnosticCategory.Error
    );

    if (syntaxErrors && syntaxErrors.length > 0) {
      const errorMessage = syntaxErrors
        .map((error: Diagnostic) => {
          const message = ts.flattenDiagnosticMessageText(
            error.messageText,
            '\n'
          );
          if (error.file && typeof error.start === 'number') {
            const { line, character } =
              error.file.getLineAndCharacterOfPosition(error.start);
            return `Error at ${line + 1}:${character + 1}: ${message}`;
          }
          return `Error: ${message}`;
        })
        .join('\n');
      throw new Error(`TypeScript parsing failed:\n${errorMessage}`);
    }

    const sourceFile = ts.createSourceFile(
      'temp.ts',
      content,
      ts.ScriptTarget.Latest,
      true
    );

    const getDocstring = (node: ts.Node): string => {
      if (
        'jsDoc' in node &&
        Array.isArray(node.jsDoc) &&
        node.jsDoc.length > 0
      ) {
        const docNode = node.jsDoc[0];
        if (typeof docNode.comment === 'string') {
          return docNode.comment.trim();
        }
        if (Array.isArray(docNode.comment)) {
          const text = docNode.comment
            .map((c: ts.JSDocComment) => {
              if (typeof c === 'string') return c;
              return c.text || '';
            })
            .join('')
            .trim();
          if (text) return text;
        }
        const fullText = docNode.getText(sourceFile);
        if (fullText) {
          const match = fullText.match(/\/\*\*([\s\S]*?)\*\//);
          if (match && match[1]) {
            return match[1]
              .split('\n')
              .map((line: string) => line.replace(/^\s*\*\s?/, '').trim())
              .filter((line: string) => line && !line.startsWith('@'))
              .join(' ')
              .trim();
          }
        }
      }
      return '';
    };

    const parseFunction = (
      node: FunctionDeclaration | MethodDeclaration
    ): FunctionData => {
      const name = node.name?.getText(sourceFile) || '[Anonymous]';
      const params: ParameterData[] = node.parameters.map((p) => ({
        name: p.name.getText(sourceFile),
        type: p.type?.getText(sourceFile) || 'any',
        optional: !!p.questionToken,
        default: p.initializer?.getText(sourceFile),
      }));
      const is_async = !!node.modifiers?.some(
        (mod) => mod.kind === ts.SyntaxKind.AsyncKeyword
      );
      let decorators: string[] = [];
      if (ts.canHaveDecorators(node)) {
        decorators =
          ts
            .getDecorators(node)
            ?.map((decorator) => decorator.expression.getText(sourceFile)) ||
          [];
      }
      return {
        name,
        docstring: getDocstring(node),
        params,
        returns: node.type?.getText(sourceFile) || 'any',
        is_async,
        decorators,
      };
    };

    const imports: string[] = [];
    const classes: ClassData[] = [];
    const functions: FunctionData[] = [];
    const exports: string[] = [];

    const visit = (node: Node) => {
      if (ts.isImportDeclaration(node)) {
        imports.push((node.moduleSpecifier as ts.StringLiteral).text);
      }

      if (ts.isFunctionDeclaration(node) && node.name) {
        functions.push(parseFunction(node));
        if (
          node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
        ) {
          exports.push(node.name.text);
        }
      }

      // FIX: Add handling for exported interfaces
      if (ts.isInterfaceDeclaration(node)) {
        if (
          node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
        ) {
          exports.push(node.name.text);
        }
      }

      // FIX: Add handling for exported variables/constants
      if (ts.isVariableStatement(node)) {
        if (
          node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
        ) {
          node.declarationList.declarations.forEach((declaration) => {
            if (ts.isIdentifier(declaration.name)) {
              exports.push(declaration.name.text);
            }
          });
        }
      }

      if (ts.isClassDeclaration(node) && node.name) {
        const className = node.name.text;
        const base_classes: string[] = [];
        const implements_interfaces: string[] = [];

        if (node.heritageClauses) {
          for (const clause of node.heritageClauses) {
            const types = clause.types.map((t) =>
              t.expression.getText(sourceFile)
            );
            if (clause.token === ts.SyntaxKind.ExtendsKeyword) {
              base_classes.push(...types);
            } else if (clause.token === ts.SyntaxKind.ImplementsKeyword) {
              implements_interfaces.push(...types);
            }
          }
        }

        let classDocstring = getDocstring(node);

        const constructorNode = node.members.find(
          (member): member is ConstructorDeclaration =>
            ts.isConstructorDeclaration(member)
        );

        if (!classDocstring && constructorNode) {
          classDocstring = getDocstring(constructorNode);
        }

        const methods = node.members
          .filter(
            (m): m is MethodDeclaration | ConstructorDeclaration =>
              isMethodDeclaration(m) || ts.isConstructorDeclaration(m)
          )
          .map((m: MethodDeclaration | ConstructorDeclaration) => {
            if (ts.isConstructorDeclaration(m)) {
              const params: ParameterData[] = m.parameters.map((p) => ({
                name: p.name.getText(sourceFile),
                type: p.type?.getText(sourceFile) || 'any',
                optional: !!p.questionToken,
                default: p.initializer?.getText(sourceFile),
              }));
              const is_async = !!m.modifiers?.some(
                (mod) => mod.kind === ts.SyntaxKind.AsyncKeyword
              );
              let decorators: string[] = [];
              if (ts.canHaveDecorators(m)) {
                decorators =
                  ts
                    .getDecorators(m)
                    ?.map((decorator) =>
                      decorator.expression.getText(sourceFile)
                    ) || [];
              }
              return {
                name: 'constructor',
                docstring: getDocstring(m),
                params,
                returns: 'void',
                is_async,
                decorators,
              };
            }
            return parseFunction(m);
          });

        const constructorMethod = methods.find((m) => m.name === 'constructor');
        if (constructorMethod && classDocstring) {
          constructorMethod.docstring = '';
        }

        let classDecorators: string[] = [];
        if (ts.canHaveDecorators(node)) {
          classDecorators =
            ts
              .getDecorators(node)
              ?.map((decorator) => decorator.expression.getText(sourceFile)) ||
            [];
        }

        classes.push({
          name: className,
          docstring: classDocstring,
          base_classes,
          implements_interfaces,
          methods,
          decorators: classDecorators,
        });

        if (
          node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
        ) {
          exports.push(className);
        }
      }

      if (
        ts.isExportDeclaration(node) &&
        node.exportClause &&
        ts.isNamedExports(node.exportClause)
      ) {
        node.exportClause.elements.forEach((el) => {
          exports.push(el.name.text);
        });
      }

      if (ts.isExportAssignment(node)) {
        exports.push(`default: ${node.expression.getText(sourceFile)}`);
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);

    const fileDocstring =
      sourceFile.statements.length > 0
        ? getDocstring(sourceFile.statements[0])
        : '';

    return {
      language: 'typescript',
      docstring: fileDocstring,
      imports,
      classes,
      functions,
      exports: [...new Set(exports)],
      dependencies: imports,
    };
  }
}
```

## 4. SLMExtractor: Specialized Language Model Extraction

The `SLMExtractor` (`src/miners/slm-extractor.ts`) provides a fallback mechanism for structural extraction using Specialized Language Models (SLMs) hosted on the `eGemma` workbench.

### Code Reference: SLMExtractor

```typescript
// src/miners/slm-extractor.ts
import type { WorkbenchClient } from '../executors/workbench-client.js';
import type {
  Language,
  SourceFile,
  StructuralData,
} from '../types/structural.js';

export class SLMExtractor {
  constructor(private workbench: WorkbenchClient) {}

  async extract(file: SourceFile): Promise<StructuralData> {
    const response = await this.workbench.summarize({
      content: file.content,
      filename: file.name,
      persona: 'structure_extractor',
      model_name: 'gemini-2.0-flash-exp',
      max_tokens: 2000,
      temperature: 0.1,
    });

    try {
      const structural = JSON.parse(
        response.summary
      ) as Partial<StructuralData>;
      return this.validateAndNormalize(structural, file.language);
    } catch (e) {
      throw new Error(
        `SLM returned invalid JSON for ${file.path}: ${(e as Error).message}`
      );
    }
  }

  private validateAndNormalize(
    data: Partial<StructuralData>,
    language: string
  ): StructuralData {
    return {
      language:
        (data.language as Language) || (language as Language) || 'unknown',
      docstring: data.docstring || '',
      imports: data.imports || [],
      classes: data.classes || [],
      functions: data.functions || [],
      exports: data.exports || [],
      dependencies: data.dependencies || data.imports || [],
    };
  }
}
```

## 5. LLMSupervisor: Large Language Model Orchestration

The `LLMSupervisor` (`src/miners/llm-supervisor.ts`) acts as the final fallback in the structural extraction pipeline. It leverages Large Language Models (LLMs) via the `eGemma` workbench to generate parsing logic when other methods fail.

### Code Reference: LLMSupervisor

```typescript
// src/miners/llm-supervisor.ts
import type { WorkbenchClient } from '../executors/workbench-client.js';
import type { SourceFile, StructuralData } from '../types/structural.js';

export class LLMSupervisor {
  constructor(private workbench: WorkbenchClient) {}

  async generateAndExecuteParser(file: SourceFile): Promise<StructuralData> {
    const parserScript = await this.workbench.summarize({
      filename: file.path,
      content: file.content,
      persona: 'parser_generator',
      goal: 'Generate a tree-sitter query to extract structure',
    });

    // This is a placeholder for a more complex implementation
    // that would execute the generated script in a sandbox.
    console.log(`Generated parser for ${file.path}:`, parserScript);
    return {
      language: file.language as string,
      docstring: '',
      imports: [],
      classes: [],
      functions: [],
      exports: [],
      dependencies: [],
    };
  }
}
```

## 6. WorkbenchClient: Interfacing with eGemma

The `WorkbenchClient` (`src/executors/workbench-client.ts`) is the dedicated client for communicating with the external `eGemma` server. `eGemma` provides advanced language processing capabilities, including remote AST parsing and specialized/large language model inference.

### Code Reference: WorkbenchClient

```typescript
// src/executors/workbench-client.ts
import { fetch, FormData } from 'undici';
import type { BodyInit } from 'undici';
import { Blob } from 'node:buffer';
import type { StructuralData, SummarizeResponse } from '../types/structural.js';

interface SummarizeRequest {
  content: string;
  filename: string;
  persona: string;
  goal?: string;
  model_name?: string;
  max_tokens?: number;
  temperature?: number;
}

interface ASTParseRequest {
  content: string;
  language: string;
  filename: string;
}

export class WorkbenchClient {
  private apiKey: string;

  constructor(private baseUrl: string) {
    this.apiKey = process.env.WORKBENCH_API_KEY || '';
    if (!this.apiKey) {
      console.warn(
        'WORKBENCH_API_KEY not set. This is required for production.'
      );
    }
  }

  async health() {
    const response = await fetch(`${this.baseUrl}/health`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }
    return await response.json();
  }

  async summarize(request: SummarizeRequest): Promise<SummarizeResponse> {
    const formData = new FormData();
    const fileBuffer = Buffer.from(request.content);

    const blob = new Blob([fileBuffer], { type: 'text/plain' });
    formData.set('file', blob, request.filename);

    formData.set('persona', request.persona);
    if (request.goal) formData.set('goal', request.goal);
    if (request.model_name) formData.set('model_name', request.model_name);
    if (request.max_tokens)
      formData.set('max_tokens', request.max_tokens.toString());
    if (request.temperature)
      formData.set('temperature', request.temperature.toString());

    const response = await fetch(`${this.baseUrl}/summarize`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: formData as unknown as BodyInit,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Summarize request failed:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText,
      });
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    return (await response.json()) as SummarizeResponse;
  }

  async parseAST(request: ASTParseRequest): Promise<StructuralData> {
    const formData = new FormData();
    const fileBuffer = Buffer.from(request.content);

    const blob = new Blob([fileBuffer], { type: 'text/x-python' });
    formData.set('file', blob, request.filename);

    formData.set('language', request.language);

    const response = await fetch(`${this.baseUrl}/parse-ast`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: formData as unknown as BodyInit,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Parse AST request failed:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText,
      });
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    return (await response.json()) as StructuralData;
  }
}
```
