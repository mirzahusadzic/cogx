/**
 * SDK Message Processor
 *
 * Processes SDK messages and extracts relevant information.
 * Handles session ID extraction, token updates, and message content.
 *
 * Extracted from useClaudeAgent.ts as part of Week 2 Day 6-8 refactor.
 */

import type { SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import { stripANSICodes } from '../rendering/MessageRenderer.js';
import { formatToolUse } from '../rendering/ToolFormatter.js';

export interface ProcessedMessage {
  type: 'user' | 'assistant' | 'system' | 'tool_progress';
  content: string;
  timestamp: Date;
}

export interface StreamEventData {
  type: 'tool_start' | 'text_delta' | 'token_update' | 'unknown';
  toolName?: string;
  textDelta?: string;
  tokenUpdate?: {
    input: number;
    output: number;
    total: number;
  };
}

export interface ProcessingResult {
  sessionId?: string;
  messages: ProcessedMessage[];
  tokenUpdate?: {
    input: number;
    output: number;
    total: number;
  };
}

/**
 * Extract session ID from SDK message
 */
export function extractSessionId(sdkMessage: SDKMessage): string | undefined {
  if ('session_id' in sdkMessage && sdkMessage.session_id) {
    return sdkMessage.session_id as string;
  }
  return undefined;
}

/**
 * Process assistant message (including tool uses)
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
  );

  if (toolUses.length > 0) {
    toolUses.forEach(
      (tool: { name: string; input: Record<string, unknown> }) => {
        const formatted = formatToolUse(tool);
        messages.push({
          type: 'tool_progress',
          content: `${formatted.icon} ${formatted.name}: ${formatted.description}`,
          timestamp: new Date(),
        });
      }
    );
  }

  return messages;
}

/**
 * Process stream event
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
