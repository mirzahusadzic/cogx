import { tool } from '@openai/agents';
import { FunctionTool, type ToolContext } from '@google/adk';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import type { ToolDefinition } from './definitions.js';
import type { OnCanUseTool } from '../core/utils/tool-helpers.js';
import type { ToolResult } from '../core/types.js';

// We need to use 'as unknown' and specific target types to satisfy both
// the linter and the provider-specific constructors without resorting to 'any'.
type OpenAIToolOptions = Parameters<typeof tool>[0];
type GeminiToolOptions = ConstructorParameters<typeof FunctionTool>[0];

/**
 * Common tool provider interface
 */
export interface ProviderToolFactory {
  createOpenAITool<T extends z.ZodObject<z.ZodRawShape>>(
    definition: ToolDefinition<T>,
    execute: (args: z.infer<T>) => Promise<string | ToolResult>,
    onCanUseTool?: OnCanUseTool,
    overrides?: { name?: string; description?: string }
  ): ReturnType<typeof tool>;

  createMinimaxTool<T extends z.ZodObject<z.ZodRawShape>>(
    definition: ToolDefinition<T>,
    onCanUseTool?: OnCanUseTool,
    overrides?: { name?: string; description?: string }
  ): { name: string; description: string; input_schema: unknown };

  createGeminiTool<T extends z.ZodObject<z.ZodRawShape>>(
    definition: ToolDefinition<T>,
    execute: (
      args: z.infer<T>,
      context?: ToolContext
    ) => Promise<string | ToolResult>,
    onCanUseTool?: OnCanUseTool,
    overrides?: { name?: string; description?: string }
  ): FunctionTool;
}

/**
 * Helper to wrap tool implementation with permission check
 */
function withPermission<T>(
  name: string,
  execute: (input: T) => Promise<string | ToolResult>,
  onCanUseTool?: OnCanUseTool
): (input: T) => Promise<string | ToolResult> {
  if (!onCanUseTool) {
    return execute;
  }

  return async (input: T) => {
    // Call permission callback
    const decision = await onCanUseTool(name, input);

    // If denied, return denial message
    if (decision.behavior === 'deny') {
      return `User declined this action. Please continue with alternative approaches without asking why.`;
    }

    // Execute with potentially updated input
    const finalInput = (decision.updatedInput ?? input) as T;
    return execute(finalInput);
  };
}

/**
 * Implementation of the provider tool factory
 */
export const providerToolFactory: ProviderToolFactory = {
  /**
   * Transforms a generic ToolDefinition into an OpenAI Agent tool
   */
  createOpenAITool<T extends z.ZodObject<z.ZodRawShape>>(
    definition: ToolDefinition<T>,
    execute: (args: z.infer<T>) => Promise<string | ToolResult>,
    onCanUseTool?: OnCanUseTool,
    overrides?: { name?: string; description?: string }
  ) {
    const safeExecute = withPermission(
      overrides?.name ?? definition.name,
      execute,
      onCanUseTool
    );

    return tool({
      name: overrides?.name ?? definition.name,
      description: overrides?.description ?? definition.description,
      parameters: definition.parameters,
      execute: async (args: unknown) => {
        // Use Zod to parse and potentially coerce arguments
        const parsedArgs = definition.parameters.parse(args);
        const result = await safeExecute(parsedArgs as z.infer<T>);
        return typeof result === 'string' ? result : result.content;
      },
    } as unknown as OpenAIToolOptions);
  },

  /**
   * Transforms a generic ToolDefinition into a Minimax (JSON Schema) format
   */
  createMinimaxTool<T extends z.ZodObject<z.ZodRawShape>>(
    definition: ToolDefinition<T>,
    onCanUseTool?: OnCanUseTool, // Not directly used here as Minimax execution is external
    overrides?: { name?: string; description?: string }
  ) {
    const jsonSchema = zodToJsonSchema(definition.parameters);

    // Minimax/Anthropic-like tool format
    return {
      name: overrides?.name ?? definition.name,
      description: overrides?.description ?? definition.description,
      input_schema: jsonSchema,
    };
  },

  /**
   * Transforms a generic ToolDefinition into a Gemini (ADK) format
   */
  createGeminiTool<T extends z.ZodObject<z.ZodRawShape>>(
    definition: ToolDefinition<T>,
    execute: (
      args: z.infer<T>,
      context?: ToolContext
    ) => Promise<string | ToolResult>,
    onCanUseTool?: OnCanUseTool,
    overrides?: { name?: string; description?: string }
  ) {
    const safeExecute = async (
      args: z.infer<T>,
      context?: ToolContext
    ): Promise<string | ToolResult> => {
      if (!onCanUseTool) {
        return execute(args, context);
      }

      // Gemini specific: we pass context to execute if needed
      const decision = await onCanUseTool(
        overrides?.name ?? definition.name,
        args
      );
      if (decision.behavior === 'deny') {
        return `User declined this action. Please continue with alternative approaches without asking why.`;
      }

      const finalInput = (decision.updatedInput ?? args) as z.infer<T>;
      return execute(finalInput, context);
    };

    return new FunctionTool({
      name: overrides?.name ?? definition.name,
      description: overrides?.description ?? definition.description,
      parameters: definition.parameters,
      execute: async (args: unknown, context?: ToolContext) => {
        // Use Zod to parse and potentially coerce arguments
        const parsedArgs = definition.parameters.parse(args);
        const result = await safeExecute(parsedArgs as z.infer<T>, context);
        return result;
      },
    } as unknown as GeminiToolOptions);
  },
};
