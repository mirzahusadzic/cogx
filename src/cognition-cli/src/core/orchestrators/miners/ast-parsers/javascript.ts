import type {
  ASTParser,
  StructuralData,
  ClassData,
  FunctionData,
  InterfaceData,
  ParameterData,
  PropertyData,
} from '../../../types/structural.js';

import ts, {
  Node,
  MethodDeclaration,
  ConstructorDeclaration,
  FunctionDeclaration,
  isMethodDeclaration,
} from 'typescript';

// The AST Parser Implementation for JavaScript
export class JavaScriptParser implements ASTParser {
  readonly isNative = true;
  readonly language = 'javascript';

  async parse(content: string): Promise<StructuralData> {
    const sourceFile = ts.createSourceFile(
      'temp.js',
      content,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.JS
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
            .map((c: ts.JSDocComment) => c.text || '')
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
    const interfaces: InterfaceData[] = [];
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

      if (ts.isInterfaceDeclaration(node) && node.name) {
        const interfaceName = node.name.text;
        const properties: PropertyData[] = node.members
          .filter(ts.isPropertySignature)
          .map((p) => ({
            name: p.name.getText(sourceFile),
            type: p.type?.getText(sourceFile) || 'any',
            optional: !!p.questionToken,
          }));

        interfaces.push({
          name: interfaceName,
          docstring: getDocstring(node),
          properties,
        });

        if (
          node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
        ) {
          exports.push(interfaceName);
        }
      }

      // Added logic to detect exported `type` aliases and `enum` declarations.
      if (ts.isTypeAliasDeclaration(node)) {
        const typeName = node.name.text;
        if (
          node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
        ) {
          exports.push(typeName);
        }
      }

      if (ts.isEnumDeclaration(node)) {
        const enumName = node.name.text;
        if (
          node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
        ) {
          exports.push(enumName);
        }
      }

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
          .map((m) => {
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
      language: 'javascript',
      docstring: fileDocstring,
      imports,
      classes,
      functions,
      interfaces,
      exports: [...new Set(exports)],
      dependencies: imports,
      extraction_method: 'ast_native',
      fidelity: 1.0,
    };
  }
}
