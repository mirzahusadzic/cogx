import { describe, it, expect } from 'vitest';
import { TypeScriptParser } from './typescript-parser.js';
import type { StructuralData } from '../../types/structural.js';

describe('TypeScriptParser', () => {
  const parser = new TypeScriptParser();

  it('should parse a simple TypeScript file and extract structural data', async () => {
    const tsCode = `
      /**
       * This is a test module for parsing.
       */
      import { injectable } from 'inversify';
      import { SomeType } from './some-module';

      export interface MyInterface {
        id: string;
      }

      @injectable()
      export class MyClass implements MyInterface {
        /**
         * A simple example class.
         * @param name The name of the class.
         */
        constructor(private name: string) {}

        /**
         * A method that returns a greeting.
         * @param greeting The greeting message.
         * @returns A greeting string.
         */
        public myMethod(greeting: string): string {
          return 'Hello, ' + this.name + '! ' + greeting;
        }

        private anotherMethod(): void {
          // internal method
        }
      }

      /**
       * A standalone function.
       * @param param1 First parameter.
       * @param param2 Second parameter.
       * @returns The sum of two numbers.
       */
      export async function myFunction(param1: number, param2: number): Promise<number> {
        return param1 + param2;
      }

      export const myConstant = 123;
    `;

    const result: StructuralData = await parser.parse(tsCode);

    expect(result.language).toBe('typescript');
    expect(result.docstring).toContain('This is a test module for parsing.');
    expect(result.imports).toEqual(['inversify', './some-module']);

    // Test class data
    expect(result.classes).toHaveLength(1);
    const myClass = result.classes[0];
    expect(myClass.name).toBe('MyClass');
    expect(myClass.docstring).toContain('A simple example class.');
    expect(myClass.base_classes).toEqual([]);
    expect(myClass.implements_interfaces).toEqual(['MyInterface']);
    expect(myClass.decorators).toEqual(['injectable()']);

    expect(myClass.methods).toHaveLength(3);
    const constructorMethod = myClass.methods[0];
    expect(constructorMethod.name).toBe('constructor');
    expect(constructorMethod.docstring).toBe(''); // JSDoc for constructor is on the class
    expect(constructorMethod.params).toEqual([
      { name: 'name', type: 'string', optional: false, default: undefined },
    ]);
    expect(constructorMethod.returns).toBe('void');
    expect(constructorMethod.is_async).toBe(false);
    expect(constructorMethod.decorators).toEqual([]);

    const myMethod = myClass.methods[1];
    expect(myMethod.name).toBe('myMethod');
    expect(myMethod.docstring).toContain('A method that returns a greeting.');
    expect(myMethod.params).toEqual([
      { name: 'greeting', type: 'string', optional: false, default: undefined },
    ]);
    expect(myMethod.returns).toBe('string');
    expect(myMethod.is_async).toBe(false);
    expect(myMethod.decorators).toEqual([]);

    const anotherMethod = myClass.methods[2];
    expect(anotherMethod.name).toBe('anotherMethod');
    expect(anotherMethod.docstring).toBe('');
    expect(anotherMethod.params).toEqual([]);
    expect(anotherMethod.returns).toBe('void');
    expect(anotherMethod.is_async).toBe(false);
    expect(anotherMethod.decorators).toEqual([]);

    // Test function data
    expect(result.functions).toHaveLength(1);
    const myFunction = result.functions[0];
    expect(myFunction.name).toBe('myFunction');
    expect(myFunction.docstring).toContain('A standalone function.');
    expect(myFunction.params).toEqual([
      { name: 'param1', type: 'number', optional: false, default: undefined },
      { name: 'param2', type: 'number', optional: false, default: undefined },
    ]);
    expect(myFunction.returns).toBe('Promise<number>');
    expect(myFunction.is_async).toBe(true);
    expect(myFunction.decorators).toEqual([]);

    // Test exports
    expect(result.exports).toEqual([
      'MyInterface',
      'MyClass',
      'myFunction',
      'myConstant',
    ]);
  });

  it('should handle a TypeScript file with syntax errors gracefully', async () => {
    const invalidTsCode = `
      function invalid( {
    `;

    await expect(parser.parse(invalidTsCode)).rejects.toThrow(
      /TypeScript parsing failed/
    );
  });

  it('should return empty arrays for a file with no structural elements', async () => {
    const emptyCode = `
      // Just a comment
      const x = 10;
    `;

    const result: StructuralData = await parser.parse(emptyCode);

    expect(result.language).toBe('typescript');
    expect(result.docstring).toBe('');
    expect(result.imports).toEqual([]);
    expect(result.classes).toEqual([]);
    expect(result.functions).toEqual([]);
    expect(result.exports).toEqual([]);
  });
});
