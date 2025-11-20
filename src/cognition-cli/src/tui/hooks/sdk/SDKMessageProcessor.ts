/**
 * SDK Message Processor
 *
 * Processes SDK messages and extracts relevant information for TUI display and state management.
 * Handles session ID extraction, token updates, tool use formatting, and streaming content.
 *
 * DESIGN:
 * The SDK Message Processor acts as a translation layer between the raw SDK message stream
 * and the TUI's internal message representation. It implements a dispatcher pattern to
 * route different message types to specialized processing functions.
 *
 * Message Type Handlers:
 * - extractSessionId: Extract session IDs for resumption
 * - processAssistantMessage: Handle assistant responses and tool uses
 * - processStreamEvent: Handle streaming events (text deltas, token updates, tool starts)
 * - processToolProgress: Handle tool execution progress updates
 * - processResult: Handle final query results with usage statistics
 * - processSystemMessage: Handle system initialization messages
 *
 * The main dispatcher (processSDKMessage) routes messages to appropriate handlers
 * and aggregates results into a unified ProcessingResult.
 *
 * ALGORITHM (Main Dispatcher):
 * 1. Create empty ProcessingResult
 * 2. Extract session ID (present in all messages)
 * 3. Switch on message type:
 *    - 'assistant': Process tool uses and content
 *    - 'stream_event': Process streaming updates (tokens, deltas, tool starts)
 *    - 'tool_progress': Process tool execution timing
 *    - 'result': Process final outcome and costs
 *    - 'system': Process initialization events
 * 4. Aggregate all extracted information into ProcessingResult
 * 5. Return unified result for state updates
 *
 * @example
 * // Processing a message stream
 * for await (const sdkMessage of query) {
 *   const result = processSDKMessage(sdkMessage);
 *
 *   if (result.sessionId) {
 *     setResumeSessionId(result.sessionId);
 *   }
 *
 *   if (result.tokenUpdate) {
 *     updateTokenCount(result.tokenUpdate.total);
 *   }
 *
 *   result.messages.forEach(msg => appendToDisplay(msg));
 * }
 *
 * @example
 * // Handling specific message types
 * const assistantMessages = processAssistantMessage(sdkMessage);
 * const streamData = processStreamEvent(sdkMessage);
 * const resultData = processResult(sdkMessage);
 *
 * Extracted from useClaudeAgent.ts as part of Week 2 Day 6-8 refactor.
 */

import type { SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import { stripANSICodes } from '../rendering/MessageRenderer.js';
import { formatToolUse } from '../rendering/ToolFormatter.js';

/**
 * Processed message for TUI display
 *
 * Represents a message that has been processed from SDK format
 * into the TUI's internal representation.
 */
export interface ProcessedMessage {
  /**
   * Message type determines styling and handling in UI
   */
  type: 'user' | 'assistant' | 'system' | 'tool_progress';

  /**
   * Message content (already formatted and stripped of ANSI codes)
   */
  content: string;

  /**
   * When the message was processed
   */
  timestamp: Date;
}

/**
 * Stream event data extracted from SDK streaming events
 *
 * Represents parsed data from various stream event types,
 * unified into a single discriminated union.
 */
export interface StreamEventData {
  /**
   * Type of stream event
   */
  type: 'tool_start' | 'text_delta' | 'token_update' | 'unknown';

  /**
   * Tool name for tool_start events
   */
  toolName?: string;

  /**
   * Text content for text_delta events (ANSI codes stripped)
   */
  textDelta?: string;

  /**
   * Token usage for token_update events
   */
  tokenUpdate?: {
    input: number;
    output: number;
    total: number;
  };
}

/**
 * Result of processing a single SDK message
 *
 * Aggregates all information extracted from an SDK message,
 * including session state, displayable messages, and token updates.
 */
export interface ProcessingResult {
  /**
   * Session ID for resumption (if present in message)
   */
  sessionId?: string;

  /**
   * Messages to display in TUI (may be empty)
   */
  messages: ProcessedMessage[];

  /**
   * Token update from this message (if any)
   */
  tokenUpdate?: {
    input: number;
    output: number;
    total: number;
  };
}

/**
 * Extract session ID from SDK message
 *
 * Session IDs are present in all SDK messages and enable session resumption.
 * Extracts the session ID if present for storage and later use.
 *
 * @param sdkMessage - SDK message to extract from
 * @returns Session ID string if present, undefined otherwise
 *
 * @example
 * const sessionId = extractSessionId(sdkMessage);
 * if (sessionId) {
 *   localStorage.setItem('lastSessionId', sessionId);
 * }
 */
export function extractSessionId(sdkMessage: SDKMessage): string | undefined {
  if ('session_id' in sdkMessage && sdkMessage.session_id) {
    return sdkMessage.session_id as string;
  }
  return undefined;
}

/**
 * Process assistant message (including tool uses)
 *
 * Extracts tool uses from assistant messages and formats them for display.
 * Assistant messages may contain multiple content blocks, including tool_use blocks.
 *
 * ALGORITHM:
 * 1. Verify message type is 'assistant'
 * 2. Filter content blocks for tool_use type
 * 3. For each tool use:
 *    a. Format using ToolFormatter (handles special cases like Edit diffs)
 *    b. Create ProcessedMessage with tool_progress type
 *    c. Add to messages array
 * 4. Return all tool use messages
 *
 * @param sdkMessage - SDK message to process
 * @returns Array of processed messages (empty if not assistant or no tools)
 *
 * @example
 * const messages = processAssistantMessage(sdkMessage);
 * messages.forEach(msg => {
 *   console.log(`${msg.content}`); // "Edit: file.ts (diff shown)"
 * });
 */
export function processAssistantMessage(
  sdkMessage: SDKMessage
): ProcessedMessage[] {
  if (sdkMessage.type !== 'assistant') {
    return [];
  }

  const messages: ProcessedMessage[] = [];

  // Check for tool uses
  const toolUses = sdkMessage.message.content.filter(
    (c: { type: string }) => c.type === 'tool_use'
  ) as Array<{ name: string; input: Record<string, unknown> }>;

  if (toolUses.length > 0) {
    toolUses.forEach((tool: any) => {
      const formatted = formatToolUse(tool);
      messages.push({
        type: 'tool_progress',
        content: `${formatted.icon} ${formatted.name}: ${formatted.description}`,
        timestamp: new Date(),
      });
    });
  }

  return messages;
}

/**
 * Process stream event
 *
 * Handles streaming events from SDK which provide real-time updates during query execution.
 * Extracts token updates, text deltas, and tool start events.
 *
 * ALGORITHM:
 * 1. Verify message type is 'stream_event'
 * 2. Check event.type:
 *    a. 'message_delta' with usage: Extract token update
 *       - Sum input tokens (base + cache creation + cache read)
 *       - Return token_update with totals
 *    b. 'content_block_start' with tool_use: Extract tool name
 *       - Return tool_start event
 *    c. 'content_block_delta' with text_delta: Extract streaming text
 *       - Strip ANSI codes for clean display
 *       - Return text_delta event
 * 3. Return 'unknown' for unhandled event types
 *
 * @param sdkMessage - SDK message to process
 * @returns Parsed stream event data
 *
 * @example
 * const data = processStreamEvent(sdkMessage);
 * switch (data.type) {
 *   case 'token_update':
 *     updatePGCUsage(data.tokenUpdate);
 *     break;
 *   case 'text_delta':
 *     appendStreamingText(data.textDelta);
 *     break;
 *   case 'tool_start':
 *     showToolIndicator(data.toolName);
 *     break;
 * }
 */
export function processStreamEvent(sdkMessage: SDKMessage): StreamEventData {
  if (sdkMessage.type !== 'stream_event') {
    return { type: 'unknown' };
  }

  const event = sdkMessage.event as {
    type: string;
    content_block?: { type: string; name: string };
    delta?: { type: string; text: string };
    usage?: {
      input_tokens: number;
      output_tokens: number;
      cache_creation_input_tokens?: number;
      cache_read_input_tokens?: number;
    };
  };

  // Token update from message_delta
  if (event.type === 'message_delta' && event.usage) {
    const usage = event.usage;
    const totalInput =
      usage.input_tokens +
      (usage.cache_creation_input_tokens || 0) +
      (usage.cache_read_input_tokens || 0);
    const totalOutput = usage.output_tokens;

    return {
      type: 'token_update',
      tokenUpdate: {
        input: totalInput,
        output: totalOutput,
        total: totalInput + totalOutput,
      },
    };
  }

  // Tool start
  if (
    event.type === 'content_block_start' &&
    event.content_block?.type === 'tool_use'
  ) {
    return {
      type: 'tool_start',
      toolName: event.content_block.name,
    };
  }

  // Text delta (streaming content)
  if (
    event.type === 'content_block_delta' &&
    event.delta?.type === 'text_delta'
  ) {
    const colorReplacedText = stripANSICodes(event.delta.text);
    return {
      type: 'text_delta',
      textDelta: colorReplacedText,
    };
  }

  return { type: 'unknown' };
}

/**
 * Process tool progress message
 *
 * Handles tool execution progress updates which report how long tools have been running.
 * Useful for displaying execution time of long-running tools.
 *
 * @param sdkMessage - SDK message to process
 * @returns Processed message with tool timing, or null if not tool_progress type
 *
 * @example
 * const message = processToolProgress(sdkMessage);
 * if (message) {
 *   console.log(message.content); // "⏱️ Bash (5s)"
 * }
 */
export function processToolProgress(
  sdkMessage: SDKMessage
): ProcessedMessage | null {
  if (sdkMessage.type !== 'tool_progress') {
    return null;
  }

  return {
    type: 'tool_progress',
    content: `⏱️ ${sdkMessage.tool_name} (${Math.round(sdkMessage.elapsed_time_seconds)}s)`,
    timestamp: new Date(),
  };
}

/**
 * Process result message
 *
 * Handles final result messages which indicate query completion.
 * Includes usage statistics, cost, and success/failure status.
 *
 * ALGORITHM:
 * 1. Verify message type is 'result'
 * 2. Check subtype:
 *    a. 'success': Extract usage stats, format completion message
 *       - Calculate total tokens (input + output)
 *       - Format with turn count and cost
 *       - Return with token update for final PGC tally
 *    b. Other (error): Format error message
 *       - Return without token update
 *
 * @param sdkMessage - SDK message to process
 * @returns Result data with message and optional token update, or null if not result type
 *
 * @example
 * const result = processResult(sdkMessage);
 * if (result?.tokenUpdate) {
 *   recordFinalTokenCount(result.tokenUpdate.total);
 * }
 * console.log(result.message.content); // "✓ Complete (3 turns, $0.0042)"
 */
export function processResult(sdkMessage: SDKMessage): {
  message: ProcessedMessage;
  tokenUpdate?: { input: number; output: number; total: number };
} | null {
  if (sdkMessage.type !== 'result') {
    return null;
  }

  if (sdkMessage.subtype === 'success') {
    const usage = sdkMessage.usage;
    const resultTotal = usage.input_tokens + usage.output_tokens;

    return {
      message: {
        type: 'system',
        content: `✓ Complete (${sdkMessage.num_turns} turns, $${sdkMessage.total_cost_usd.toFixed(4)})`,
        timestamp: new Date(),
      },
      tokenUpdate: {
        input: usage.input_tokens,
        output: usage.output_tokens,
        total: resultTotal,
      },
    };
  } else {
    return {
      message: {
        type: 'system',
        content: `✗ Error: ${sdkMessage.subtype}`,
        timestamp: new Date(),
      },
    };
  }
}

/**
 * Process system message
 *
 * Handles system initialization messages which indicate SDK connection status.
 * Currently only processes 'init' subtype.
 *
 * @param sdkMessage - SDK message to process
 * @returns Processed system message, or null if not system type or unhandled subtype
 *
 * @example
 * const message = processSystemMessage(sdkMessage);
 * if (message) {
 *   console.log(message.content); // "Connected to Claude (claude-sonnet-4-5)"
 * }
 */
export function processSystemMessage(
  sdkMessage: SDKMessage
): ProcessedMessage | null {
  if (sdkMessage.type !== 'system') {
    return null;
  }

  if (sdkMessage.subtype === 'init') {
    return {
      type: 'system',
      content: `Connected to Claude (${sdkMessage.model})`,
      timestamp: new Date(),
    };
  }

  return null;
}

/**
 * Main message processor - dispatches to specific handlers
 *
 * Central dispatcher that routes SDK messages to appropriate processing functions
 * and aggregates results into a unified ProcessingResult.
 *
 * ALGORITHM:
 * 1. Initialize empty ProcessingResult
 * 2. Extract session ID (present in all messages)
 * 3. Dispatch based on message type:
 *    - 'assistant': Process tool uses
 *    - 'stream_event': Process streaming updates (tokens, text, tool starts)
 *    - 'tool_progress': Process tool timing updates
 *    - 'result': Process final outcome and usage
 *    - 'system': Process initialization messages
 * 4. Aggregate all messages and updates into result
 * 5. Return unified ProcessingResult
 *
 * DESIGN RATIONALE:
 * This dispatcher pattern enables:
 * - Testability (each handler can be tested independently)
 * - Maintainability (handlers are focused on single message types)
 * - Extensibility (new message types can be added easily)
 * - Type safety (TypeScript ensures all message types handled)
 *
 * @param sdkMessage - SDK message to process
 * @returns Aggregated processing result with messages, session ID, and token updates
 *
 * @example
 * for await (const sdkMessage of query) {
 *   const result = processSDKMessage(sdkMessage);
 *
 *   if (result.sessionId) {
 *     setResumeSessionId(result.sessionId);
 *   }
 *
 *   if (result.tokenUpdate) {
 *     setTokenCount(prev => prev + result.tokenUpdate.total);
 *   }
 *
 *   result.messages.forEach(msg => {
 *     appendMessage(msg);
 *   });
 * }
 */
export function processSDKMessage(sdkMessage: SDKMessage): ProcessingResult {
  const result: ProcessingResult = {
    messages: [],
  };

  // Extract session ID (present in all SDK messages)
  const sessionId = extractSessionId(sdkMessage);
  if (sessionId) {
    result.sessionId = sessionId;
  }

  // Process based on message type
  switch (sdkMessage.type) {
    case 'assistant': {
      const messages = processAssistantMessage(sdkMessage);
      result.messages.push(...messages);
      break;
    }

    case 'stream_event': {
      const streamData = processStreamEvent(sdkMessage);

      if (streamData.type === 'token_update' && streamData.tokenUpdate) {
        result.tokenUpdate = streamData.tokenUpdate;
      } else if (streamData.type === 'tool_start' && streamData.toolName) {
        result.messages.push({
          type: 'tool_progress',
          content: `🔧 ${streamData.toolName}...`,
          timestamp: new Date(),
        });
      } else if (streamData.type === 'text_delta' && streamData.textDelta) {
        // Text delta handled separately in the hook (needs state management)
        // We just return it in a special format
        result.messages.push({
          type: 'assistant',
          content: streamData.textDelta,
          timestamp: new Date(),
        });
      }
      break;
    }

    case 'tool_progress': {
      const message = processToolProgress(sdkMessage);
      if (message) {
        result.messages.push(message);
      }
      break;
    }

    case 'result': {
      const resultData = processResult(sdkMessage);
      if (resultData) {
        result.messages.push(resultData.message);
        if (resultData.tokenUpdate) {
          result.tokenUpdate = resultData.tokenUpdate;
        }
      }
      break;
    }

    case 'system': {
      const message = processSystemMessage(sdkMessage);
      if (message) {
        result.messages.push(message);
      }
      break;
    }
  }

  return result;
}
