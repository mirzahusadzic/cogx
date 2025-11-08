import { describe, it, expect } from 'vitest';
import { JavaScriptParser } from '../javascript.js';
import type { StructuralData } from '../../../types/structural.js';

describe('JavaScriptParser', () => {
  const parser = new JavaScriptParser();

  it('should parse a simple JavaScript file and extract structural data', async () => {
    const jsCode = `
      /**
       * This is a test module for parsing.
       */
      import { SomeType } from './some-module';

      /**
       * A simple example class.
       * @param name The name of the class.
       */
      class MyClass {
        constructor(name) {
          this.name = name;
        }

        /**
         * A method that returns a greeting.
         * @param greeting The greeting message.
         * @returns A greeting string.
         */
        myMethod(greeting) {
          return 'Hello, ' + this.name + '! ' + greeting;
        }

        anotherMethod() {
          // internal method
        }
      }

      /**
       * A standalone function.
       * @param param1 First parameter.
       * @param param2 Second parameter.
       * @returns The sum of two numbers.
       */
      async function myFunction(param1, param2) {
        return param1 + param2;
      }

      const myConstant = 123;

      export { MyClass, myFunction, myConstant };
    `;

    const result: StructuralData = await parser.parse(jsCode);

    expect(result.language).toBe('javascript');
    expect(result.docstring).toContain('This is a test module for parsing.');
    expect(result.imports).toEqual(['./some-module']);

    // Test class data
    expect(result.classes).toHaveLength(1);
    const myClass = result.classes[0];
    expect(myClass.name).toBe('MyClass');
    expect(myClass.docstring).toContain('A simple example class.');
    expect(myClass.base_classes).toEqual([]);
    expect(myClass.implements_interfaces).toEqual([]);
    expect(myClass.decorators).toEqual([]);

    expect(myClass.methods).toHaveLength(3);
    const constructorMethod = myClass.methods[0];
    expect(constructorMethod.name).toBe('constructor');
    expect(constructorMethod.docstring).toBe(''); // JSDoc for constructor is on the class
    expect(constructorMethod.params).toEqual([
      { name: 'name', type: 'any', optional: false, default: undefined },
    ]);
    expect(constructorMethod.returns).toBe('void');
    expect(constructorMethod.is_async).toBe(false);
    expect(constructorMethod.decorators).toEqual([]);

    const myMethod = myClass.methods[1];
    expect(myMethod.name).toBe('myMethod');
    expect(myMethod.docstring).toContain('A method that returns a greeting.');
    expect(myMethod.params).toEqual([
      { name: 'greeting', type: 'any', optional: false, default: undefined },
    ]);
    expect(myMethod.returns).toBe('any');
    expect(myMethod.is_async).toBe(false);
    expect(myMethod.decorators).toEqual([]);

    const anotherMethod = myClass.methods[2];
    expect(anotherMethod.name).toBe('anotherMethod');
    expect(anotherMethod.docstring).toBe('');
    expect(anotherMethod.params).toEqual([]);
    expect(anotherMethod.returns).toBe('any');
    expect(anotherMethod.is_async).toBe(false);
    expect(anotherMethod.decorators).toEqual([]);

    // Test function data
    expect(result.functions).toHaveLength(1);
    const myFunction = result.functions[0];
    expect(myFunction.name).toBe('myFunction');
    expect(myFunction.docstring).toContain('A standalone function.');
    expect(myFunction.params).toEqual([
      { name: 'param1', type: 'any', optional: false, default: undefined },
      { name: 'param2', type: 'any', optional: false, default: undefined },
    ]);
    expect(myFunction.returns).toBe('any');
    expect(myFunction.is_async).toBe(true);
    expect(myFunction.decorators).toEqual([]);

    // Test exports
    expect(result.exports).toEqual(['MyClass', 'myFunction', 'myConstant']);
  });

  it('should return empty arrays for a file with no structural elements', async () => {
    const emptyCode = `
      // Just a comment
      const x = 10;
    `;

    const result: StructuralData = await parser.parse(emptyCode);

    expect(result.language).toBe('javascript');
    expect(result.docstring).toBe('');
    expect(result.imports).toEqual([]);
    expect(result.classes).toEqual([]);
    expect(result.functions).toEqual([]);
    expect(result.exports).toEqual([]);
  });
});
