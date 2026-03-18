import { TypeScriptParser } from './typescript.js';
import { JavaScriptParser } from './javascript.js';
import type { ASTParser, Language } from '../../../types/structural.js';
import { BaseRegistry } from '../../../common/registry.js';

/**
 * Registry of available AST parsers for different programming languages.
 * Manages native parsers (TypeScript, JavaScript) and delegates unsupported languages to remote parsing services.
 * This is the central dispatcher for structural extraction in the mining pipeline.
 */
export class ASTParserRegistry extends BaseRegistry<ASTParser> {
  constructor() {
    super('ASTParserRegistry');

    // Register native parsers
    this.register('typescript', new TypeScriptParser());
    this.register('javascript', new JavaScriptParser());

    // Register delegate parsers for non-native languages
    this.register('python', {
      isNative: false,
      language: 'python' as Language,
      parse: async () => {
        throw new Error('Use workbench.parseAST()');
      },
    });
  }

  /**
   * Retrieves an AST parser for the given language.
   *
   * @param language - The language to get the parser for.
   * @returns The AST parser, or undefined if not found.
   */
  // @ts-expect-error - Compatibility override: ASTParserRegistry.get returns undefined instead of throwing
  override get(language: Language): ASTParser | undefined {
    return this.tryGet(language);
  }
}
