import { TypeScriptParser } from './typescript.js';
import { JavaScriptParser } from './javascript.js';
import type { ASTParser, Language } from '../../../types/structural.js';

/**
 * Registry of available AST parsers for different programming languages.
 * Manages native parsers (TypeScript, JavaScript) and delegates unsupported languages to remote parsing services.
 * This is the central dispatcher for structural extraction in the mining pipeline.
 */
export class ASTParserRegistry {
  private parsers: Map<Language, ASTParser> = new Map();

  constructor() {
    this.parsers.set('typescript', new TypeScriptParser());
    this.parsers.set('javascript', new JavaScriptParser());

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
