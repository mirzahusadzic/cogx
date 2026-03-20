import { describe, it, expect } from 'vitest';
import { 
  ParameterDataSchema, 
  PropertyDataSchema, 
  FunctionDataSchema, 
  ClassDataSchema, 
  InterfaceDataSchema,
  StructuralDataSchema 
} from '../structural.js';

describe('Structural Data Schemas', () => {
  describe('Modern Data Support', () => {
    it('should validate modern ParameterData', () => {
      const data = {
        type: 'parameter',
        name: 'token',
        dataType: 'string'
      };
      const result = ParameterDataSchema.parse(data);
      expect(result.type).toBe('parameter');
      expect(result.dataType).toBe('string');
    });

    it('should validate modern StructuralData', () => {
      const data = {
        type: 'source_file',
        language: 'typescript',
        docstring: 'test',
        imports: [],
        classes: [],
        functions: [],
        extraction_method: 'ast_native',
        fidelity: 1.0
      };
      const result = StructuralDataSchema.parse(data);
      expect(result.type).toBe('source_file');
    });
  });

  describe('Legacy Support (Backward Compatibility)', () => {
    describe('ParameterDataSchema', () => {
    it('should transform legacy type field to dataType and inject parameter discriminator', () => {
      const legacyData = {
        name: 'token',
        type: 'string', // In legacy, 'type' was the data type string
        optional: false
      };
      
      const result = ParameterDataSchema.parse(legacyData);
      expect(result.type).toBe('parameter');
      expect(result.dataType).toBe('string');
      expect(result.name).toBe('token');
    });

    it('should keep existing dataType and inject parameter discriminator if type is missing', () => {
      const legacyData = {
        name: 'token',
        dataType: 'string'
      };
      
      const result = ParameterDataSchema.parse(legacyData);
      expect(result.type).toBe('parameter');
      expect(result.dataType).toBe('string');
    });
  });

  describe('PropertyDataSchema', () => {
    it('should transform legacy type field to dataType and inject property discriminator', () => {
      const legacyData = {
        name: 'id',
        type: 'number'
      };
      
      const result = PropertyDataSchema.parse(legacyData);
      expect(result.type).toBe('property');
      expect(result.dataType).toBe('number');
    });
  });

  describe('FunctionDataSchema', () => {
    it('should inject function discriminator', () => {
      const legacyData = {
        name: 'validate',
        docstring: 'test',
        params: [],
        returns: 'void',
        is_async: false,
        decorators: []
      };
      
      const result = FunctionDataSchema.parse(legacyData);
      expect(result.type).toBe('function');
    });

    it('should handle legacy parameters within a function', () => {
      const legacyData = {
        name: 'validate',
        docstring: 'test',
        params: [
          { name: 'p1', type: 'string' }
        ],
        returns: 'void',
        is_async: false,
        decorators: []
      };
      
      const result = FunctionDataSchema.parse(legacyData);
      expect(result.params[0].type).toBe('parameter');
      expect(result.params[0].dataType).toBe('string');
    });
  });

  describe('ClassDataSchema', () => {
    it('should inject class discriminator and handle legacy methods', () => {
      const legacyData = {
        name: 'Auth',
        docstring: 'test',
        base_classes: [],
        methods: [
          {
            name: 'login',
            docstring: 'test',
            params: [],
            returns: 'void',
            is_async: true,
            decorators: []
          }
        ],
        decorators: []
      };
      
      const result = ClassDataSchema.parse(legacyData);
      expect(result.type).toBe('class');
      expect(result.methods[0].type).toBe('function');
    });
  });

  describe('InterfaceDataSchema', () => {
    it('should inject interface discriminator and handle legacy properties', () => {
      const legacyData = {
        name: 'Config',
        docstring: 'test',
        properties: [
          { name: 'debug', type: 'boolean' }
        ]
      };
      
      const result = InterfaceDataSchema.parse(legacyData);
      expect(result.type).toBe('interface');
      expect(result.properties[0].type).toBe('property');
      expect(result.properties[0].dataType).toBe('boolean');
    });
  });

  describe('StructuralDataSchema', () => {
    it('should inject source_file discriminator and handle legacy members', () => {
      const legacyData = {
        language: 'typescript',
        docstring: 'test',
        imports: [],
        classes: [
          {
            name: 'C',
            docstring: 'test',
            base_classes: [],
            methods: [],
            decorators: []
          }
        ],
        functions: [],
        extraction_method: 'ast_native',
        fidelity: 1.0
      };
      
      const result = StructuralDataSchema.parse(legacyData);
      expect(result.type).toBe('source_file');
      expect(result.classes[0].type).toBe('class');
    });

    it('should handle "structural" as legacy type for source_file', () => {
       const legacyData = {
        type: 'structural',
        language: 'typescript',
        docstring: 'test',
        imports: [],
        classes: [],
        functions: [],
        extraction_method: 'ast_native',
        fidelity: 1.0
      };
      
      const result = StructuralDataSchema.parse(legacyData);
      expect(result.type).toBe('source_file');
    });
  });
});
});
