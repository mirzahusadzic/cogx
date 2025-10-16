import ts from 'typescript';
import type { ASTParser, StructuralData } from '../../types/structural.js';

export class TypeScriptParser implements ASTParser {
  readonly isNative = true;
  readonly language = 'typescript';

  async parse(content: string): Promise<StructuralData> {
    const sourceFile = ts.createSourceFile(
      'temp.ts',
      content,
      ts.ScriptTarget.Latest,
      true
    );

    const imports: string[] = [];
    const classes: Array<{ name: string; methods: string[] }> = [];
    const functions: Array<{ name: string; params: string[] }> = [];
    const exports: string[] = [];

    const visit = (node: ts.Node) => {
      if (ts.isImportDeclaration(node)) {
        const moduleSpecifier = (node.moduleSpecifier as ts.StringLiteral).text;
        imports.push(moduleSpecifier);
      }

      if (ts.isClassDeclaration(node) && node.name) {
        const className = node.name.text;
        const methods = node.members
          .filter(ts.isMethodDeclaration)
          .map((m) => (m.name as ts.Identifier).text);
        classes.push({ name: className, methods });
      }

      if (ts.isFunctionDeclaration(node) && node.name) {
        const funcName = node.name.text;
        const params = node.parameters.map(
          (p) => (p.name as ts.Identifier).text
        );
        functions.push({ name: funcName, params });
      }

      if (ts.isExportDeclaration(node) || ts.isExportAssignment(node)) {
        exports.push(node.getText(sourceFile));
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);

    return {
      language: 'typescript',
      imports,
      classes,
      functions,
      exports,
      dependencies: imports,
    };
  }
}
