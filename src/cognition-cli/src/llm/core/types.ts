/**
 * Unified streaming chunk for LLM providers.
 *
 * Normalizes different provider-specific streaming events (ADK, OpenAI, Claude)
 * into a single format that the BaseAgentProvider can process.
 */
export interface UnifiedStreamingChunk {
  /** Type of content in this chunk */
  type: 'text' | 'thinking' | 'tool_call' | 'tool_response' | 'usage';

  /** Text delta (for type 'text') */
  delta?: string;

  /** Thinking/reasoning delta (for type 'thinking') */
  thought?: string;

  /**
   * Encrypted reasoning state for Gemini 3.
   * Required for maintaining reasoning state across turns.
   */
  thoughtSignature?: string;

  /** Tool call information (for type 'tool_call') */
  toolCall?: {
    id?: string;
    name: string;
    args: string | Record<string, unknown>;
    index?: number;
  };

  /** Tool response information (for type 'tool_response') */
  toolResponse?: {
    id?: string;
    name: string;
    response: unknown;
  };

  /** Token usage (for type 'usage') */
  usage?: {
    prompt: number;
    completion: number;
    total: number;
    cached?: number;
  };

  /** Number of retries attempted so far */
  retryCount?: number;

  /** Total number of agent turns (tool calls) so far */
  numTurns?: number;
}

export interface ToolResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  content: string; // The full content (e.g., for read_file) or formatted output
}
