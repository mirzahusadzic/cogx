import { TUIMessage } from './types.js';
import { terminalFormatter } from '../../../core/services/terminal-formatter/TerminalFormatterService.js';
import { TUITheme } from '../../theme.js';
import { MAX_STREAM_STABILIZATION_LINES } from './constants.js';

export type MessageAction =
  | { type: 'ADD_MESSAGE'; message: TUIMessage }
  | { type: 'APPEND_THINKING'; content: string; thoughtSignature?: string }
  | { type: 'APPEND_ASSISTANT'; content: string; thoughtSignature?: string }
  | {
      type: 'APPEND_TOOL_OUTPUT';
      chunk: string;
      toolCallId?: string;
      activeHeader?: string;
    }
  | {
      type: 'COMPLETE_TOOL_PROGRESS';
      toolCallId?: string;
      activeHeader?: string;
    }
  | { type: 'REPLACE_MESSAGE'; index: number; message: TUIMessage }
  | { type: 'SET_MESSAGES'; messages: TUIMessage[] }
  | {
      type: 'SET_MESSAGES_FUNCTIONAL';
      update: (prev: TUIMessage[]) => TUIMessage[];
    }
  | {
      type: 'FINALIZE_TOOL_RESULT';
      formattedResult: string;
      isStreaming: boolean;
      toolCallId?: string;
      activeHeader?: string;
    };

const grayColor = `${terminalFormatter.hexToAnsi(
  TUITheme.text.secondary
)}${terminalFormatter.ANSI_DIM}`;

export function messagesReducer(
  state: TUIMessage[],
  action: MessageAction
): TUIMessage[] {
  switch (action.type) {
    case 'ADD_MESSAGE':
      return [...state, action.message];

    case 'APPEND_THINKING': {
      const last = state[state.length - 1];
      if (last && last.type === 'thinking') {
        const newMessages = [...state];
        newMessages[newMessages.length - 1] = {
          ...last,
          content: last.content + action.content,
          thoughtSignature: action.thoughtSignature ?? last.thoughtSignature,
        };
        return newMessages;
      } else {
        return [
          ...state,
          {
            type: 'thinking',
            content: action.content,
            timestamp: new Date(),
            thoughtSignature: action.thoughtSignature,
          },
        ];
      }
    }

    case 'APPEND_ASSISTANT': {
      const last = state[state.length - 1];
      if (last && last.type === 'assistant') {
        const newMessages = [...state];
        newMessages[newMessages.length - 1] = {
          ...last,
          content: last.content + action.content,
          thoughtSignature: action.thoughtSignature ?? last.thoughtSignature,
        };
        return newMessages;
      } else {
        return [
          ...state,
          {
            type: 'assistant',
            content: action.content,
            timestamp: new Date(),
            thoughtSignature: action.thoughtSignature,
          },
        ];
      }
    }

    case 'APPEND_TOOL_OUTPUT': {
      const { chunk, toolCallId, activeHeader } = action;
      let targetIdx = -1;

      // 1. Try finding by toolCallId if available
      if (toolCallId) {
        for (let i = state.length - 1; i >= 0; i--) {
          const msg = state[i];
          if (msg.type === 'tool_progress' && msg.toolCallId === toolCallId) {
            targetIdx = i;
            break;
          }
        }
      }

      // 2. Fallback to matching by active header
      if (targetIdx === -1) {
        for (let i = state.length - 1; i >= 0; i--) {
          const msg = state[i];
          if (msg.type === 'tool_progress') {
            if (activeHeader) {
              if (msg.content.startsWith(activeHeader)) {
                targetIdx = i;
                break;
              }
            } else {
              targetIdx = i;
              break;
            }
          }
        }
      }

      if (targetIdx === -1) return state;

      const target = state[targetIdx];
      const cleanChunk = terminalFormatter.cleanAnsi(
        terminalFormatter.stripCursorSequences(chunk)
      );

      // Strip existing streaming marker if present from previous chunk
      let content = target.content.replace(
        // eslint-disable-next-line no-control-regex
        /(?:\r?\n)*(?:\x1b\[[0-9;]*m)*(?:\.\.\. )?\((?:streaming|tail of stream)\)(?:\x1b\[[0-9;]*m)*$/,
        ''
      );

      let effectiveChunk = cleanChunk;
      if (content.length > 0) {
        // If we are appending to existing content, avoid double newlines at the split
        effectiveChunk = effectiveChunk.replace(/^(\r?\n)+/, '');
      }

      // Append with exactly one newline separator if needed
      if (content.length > 0 && !content.endsWith('\n')) {
        content += '\n';
      }
      content += effectiveChunk;

      // FLOATING WINDOW LOGIC:
      // If output becomes too long, truncate it to keep only the last N lines
      const lines = content.split(/\r?\n/);

      // Use activeHeader if provided to accurately identify where the output starts
      const headerLineCount = activeHeader
        ? activeHeader.split(/\r?\n/).length
        : 1;
      const headerContent = lines.slice(0, headerLineCount).join('\n');
      const outputPart = lines.slice(headerLineCount).join('\n');
      const outputLines = outputPart.split(/\r?\n/);

      if (outputLines.length > MAX_STREAM_STABILIZATION_LINES) {
        const keptLines = outputLines.slice(-MAX_STREAM_STABILIZATION_LINES);
        content =
          headerContent +
          `\n${grayColor}... (tail of stream)${terminalFormatter.ANSI_RESET}\n` +
          keptLines.join('\n');
      }

      // Add streaming marker to the end
      if (!content.endsWith('\n')) {
        content += '\n';
      }
      content += `${grayColor}(streaming)${terminalFormatter.ANSI_RESET}`;

      const newMessages = [...state];
      newMessages[targetIdx] = {
        ...target,
        content,
      };
      return newMessages;
    }

    case 'COMPLETE_TOOL_PROGRESS': {
      const { toolCallId, activeHeader } = action;
      let targetIdx = -1;

      if (toolCallId) {
        for (let i = state.length - 1; i >= 0; i--) {
          const msg = state[i];
          if (msg.type === 'tool_progress' && msg.toolCallId === toolCallId) {
            targetIdx = i;
            break;
          }
        }
      }

      if (targetIdx === -1) {
        for (let i = state.length - 1; i >= 0; i--) {
          const msg = state[i];
          if (msg.type === 'tool_progress') {
            if (activeHeader) {
              if (msg.content.startsWith(activeHeader)) {
                targetIdx = i;
                break;
              }
            } else {
              targetIdx = i;
              break;
            }
          }
        }
      }

      if (targetIdx === -1) return state;

      const target = state[targetIdx];
      const newMessages = [...state];
      newMessages[targetIdx] = {
        ...target,
        content: target.content.replace(
          // eslint-disable-next-line no-control-regex
          /(?:\r?\n)*(?:\x1b\[[0-9;]*m)*\(streaming\)(?:\x1b\[[0-9;]*m)*$/,
          ''
        ),
      };
      return newMessages;
    }

    case 'REPLACE_MESSAGE': {
      const newMessages = [...state];
      newMessages[action.index] = action.message;
      return newMessages;
    }

    case 'SET_MESSAGES':
      return action.messages;

    case 'SET_MESSAGES_FUNCTIONAL':
      return action.update(state);

    case 'FINALIZE_TOOL_RESULT': {
      const { formattedResult, toolCallId, activeHeader } = action;
      let targetIdx = -1;

      // 1. Try finding by toolCallId if available
      if (toolCallId) {
        for (let i = state.length - 1; i >= 0; i--) {
          const msg = state[i];
          if (msg.type === 'tool_progress' && msg.toolCallId === toolCallId) {
            targetIdx = i;
            break;
          }
        }
      }

      // 2. Fallback to matching by active header
      if (targetIdx === -1) {
        for (let i = state.length - 1; i >= 0; i--) {
          const msg = state[i];
          if (msg.type === 'tool_progress') {
            if (activeHeader) {
              if (msg.content.startsWith(activeHeader)) {
                targetIdx = i;
                break;
              }
            } else {
              targetIdx = i;
              break;
            }
          }
        }
      }

      const cleanedState = [...state];
      if (targetIdx !== -1) {
        // Clean up any remaining streaming markers from the invocation message
        cleanedState[targetIdx] = {
          ...cleanedState[targetIdx],
          content: cleanedState[targetIdx].content.replace(
            // eslint-disable-next-line no-control-regex
            /(?:\r?\n)*(?:\x1b\[[0-9;]*m)*(?:\.\.\. )?\((?:streaming|tail of stream)\)(?:\x1b\[[0-9;]*m)*$/,
            ''
          ),
        };
      }

      // ALWAYS add the result as a new message to ensure TUI rendering (header at start of message).
      // This ensures the result header (↪) is correctly detected for coloring and indentation.
      return [
        ...cleanedState,
        {
          type: 'tool_progress',
          content: formattedResult,
          timestamp: new Date(),
          toolCallId,
        },
      ];
    }

    default:
      return state;
  }
}
