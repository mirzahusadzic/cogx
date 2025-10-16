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
