import React, { useState, useEffect, useRef } from 'react';
import { Box, Text, useInput } from 'ink';
// import TextInput from 'ink-text-input'; // Replaced with custom multi-line input
import { CommandDropdown } from './CommandDropdown.js';
import { ToolConfirmationModal } from './ToolConfirmationModal.js';
import { loadCommands, filterCommands, Command } from '../commands/loader.js';
import { writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { systemLog } from '../../utils/debug-logger.js';
import type { ToolConfirmationState } from '../hooks/useToolConfirmation.js';
import type { WizardConfirmationState } from '../hooks/useOnboardingWizard.js';
import { WizardConfirmationModal } from './WizardConfirmationModal.js';
import { useTUI } from '../context/TUIContext.js';

/**
 * Props for InputBox component
 */
export interface InputBoxProps {
  /** Callback invoked when user submits input (Enter key) */
  onSubmit: (value: string) => void;

  /** Whether this input box has keyboard focus */
  focused: boolean;

  /** Whether input is disabled (e.g., during agent processing) */
  disabled?: boolean;

  /** Callback invoked when user interrupts (ESC ESC) */
  onInterrupt?: () => void;

  /** Callback when slash command dropdown visibility changes */
  onDropdownVisibleChange?: (visible: boolean) => void;

  /** Callback when file paste content is ready */
  onPasteContent?: (content: string, filepath: string) => void;

  /** Callback when input value changes */
  onInputChange?: (value: string) => void;

  /** Name of AI provider for prompt display */
  providerName?: string;

  /** Tool confirmation state for rendering confirmation modal */
  confirmationState?: ToolConfirmationState | null;

  /** Wizard confirmation state for rendering wizard modal */
  wizardConfirmationState?: WizardConfirmationState | null;
}

/**
 * Input Box Component for TUI Message Entry.
 *
 * Interactive text input with slash command autocomplete, paste detection,
 * and tool confirmation modal. This is the primary user input interface
 * for the Cognition Σ CLI TUI.
 *
 * **Features**:
 * - Slash command autocomplete (triggered by "/")
 * - Large paste detection and file handling (>10KB → temp file)
 * - Tool confirmation modal integration
 * - Multiline editing with Ctrl+O to insert newlines
 * - Arrow Up/Down to navigate between lines
 * - Ctrl+A/Cmd+A to jump to start of block
 * - Ctrl+E/Cmd+E to jump to end of block
 * - Double ESC to interrupt/clear
 * - Ctrl+C to quit
 * - Visual focus indicators
 *
 * **Paste Handling**:
 * - Small pastes (<10KB): Inserted directly into input
 * - Large pastes (≥10KB): Saved to temp file, inserted as [PASTE:filepath]
 * - Accumulates rapid paste chunks (within 200ms)
 * - Shows paste notifications to user
 *
 * **Slash Commands**:
 * - Type "/" to show command dropdown
 * - ↑↓ to navigate commands
 * - Enter to select, Esc to cancel
 * - Commands loaded from .claude/commands/
 *
 * **Tool Confirmation**:
 * - Displays modal when confirmationState is provided
 * - Y/N/A/Esc keyboard controls (handled by parent)
 * - Blocks normal input during confirmation
 *
 * @component
 * @param {InputBoxProps} props - Component props
 *
 * @example
 * <InputBox
 *   onSubmit={handleMessage}
 *   focused={!panelFocused}
 *   disabled={isThinking}
 *   onInterrupt={handleInterrupt}
 *   providerName="claude"
 *   confirmationState={toolConfirmation}
 * />
 */
export const InputBox: React.FC<InputBoxProps> = ({
  onSubmit,
  focused,
  disabled = false,
  onInterrupt,
  onDropdownVisibleChange,
  onPasteContent,
  onInputChange,
  providerName = 'AI',
  confirmationState = null,
  wizardConfirmationState = null,
}) => {
  const { sendScrollSignal } = useTUI();

  // Derive confirmation pending state (either tool OR wizard)
  const confirmationPending =
    (confirmationState?.pending ?? false) ||
    (wizardConfirmationState?.pending ?? false);
  const [value, setValue] = useState('');
  const [cursorPosition, setCursorPosition] = useState(0);
  const [cursorVisible, setCursorVisible] = useState(true); // For blinking cursor
  const [renderKey, setRenderKey] = useState(0); // Force re-render workaround

  useEffect(() => {
    const blinkInterval = setInterval(() => {
      setCursorVisible((prev) => !prev);
    }, 500);
    return () => clearInterval(blinkInterval);
  }, []);

  // Debug: Track when disabled prop changes
  useEffect(() => {
    if (process.env.DEBUG_ESC_INPUT) {
      systemLog(
        'tui',
        `[InputBox] disabled prop changed to: ${disabled}`,
        {},
        'error'
      );
    }
  }, [disabled]);

  // Debug: Track when focused prop changes
  useEffect(() => {
    if (process.env.DEBUG_ESC_INPUT) {
      systemLog(
        'tui',
        `[InputBox] focused prop changed to: ${focused}`,
        {},
        'error'
      );
    }
  }, [focused]);

  // Debug: Track when confirmationPending changes
  useEffect(() => {
    if (process.env.DEBUG_ESC_INPUT) {
      systemLog(
        'tui',
        `[InputBox] confirmationPending changed to: ${confirmationPending}`,
        {},
        'error'
      );
    }
  }, [confirmationPending]);

  // Debug: Log the isActive state for useInput
  const isInputActive = focused && !confirmationPending;
  useEffect(() => {
    if (process.env.DEBUG_ESC_INPUT) {
      systemLog(
        'tui',
        `[InputBox] useInput isActive: ${isInputActive} (focused: ${focused} confirmationPending: ${confirmationPending})`,
        {},
        'error'
      );
    }
  }, [isInputActive, focused, confirmationPending]);

  const lastEscapeTime = useRef<number>(0);
  const valueRef = useRef<string>(''); // Track actual current value for paste detection
  const pasteBuffer = useRef<string | null>(null); // Accumulate paste chunks, null when not in paste mode

  // Function to process paste content (save to file, notify, etc.)
  // Returns object with type and value (either content to insert or filepath)
  const processPasteContent = (
    content: string
  ):
    | { type: 'content'; value: string }
    | { type: 'file'; filepath: string } => {
    if (process.env.DEBUG_INPUT) {
      systemLog(
        'tui',
        `PASTE DEBUG: Processing paste, length: ${content.length}`,
        {},
        'error'
      );
      systemLog(
        'tui',
        `PASTE DEBUG: Raw content: ${JSON.stringify(content.substring(0, 200))}`,
        {},
        'error'
      );
    }

    // Normalize line endings and clean up escape sequences
    const normalizedContent = content
      .replace(/\r\n/g, '\n') // First handle Windows line endings (\r\n -> \n)
      .replace(/\r/g, '\n') // Convert remaining \r to \n (Mac/terminal line endings)
      .replace(/\[200~/g, '') // Bracketed paste start
      .replace(/\[201~/g, ''); // Bracketed paste end

    if (process.env.DEBUG_INPUT) {
      systemLog(
        'tui',
        `PASTE DEBUG: Normalized content: ${JSON.stringify(normalizedContent.substring(0, 200))}`,
        {},
        'error'
      );
    }

    // If content is very small, just insert it directly without saving to file
    // This threshold can be adjusted, e.g., 500 characters or less
    if (normalizedContent.length < 500) {
      if (process.env.DEBUG_INPUT) {
        systemLog(
          'tui',
          'PASTE DEBUG: Small paste, inserting directly',
          {},
          'error'
        );
      }
      return { type: 'content', value: normalizedContent };
    }

    // Save to temp file
    const timestamp = Date.now();
    const filename = `cognition-paste-${timestamp}.txt`;
    const filepath = join(tmpdir(), filename);

    try {
      writeFileSync(filepath, normalizedContent, 'utf-8');

      if (process.env.DEBUG_INPUT) {
        systemLog(
          'tui',
          `PASTE DEBUG: Large paste saved to: ${filepath}`,
          {},
          'error'
        );
      }

      // Notify parent to display the content
      if (onPasteContent) {
        onPasteContent(normalizedContent, filepath);
      }

      // Don't clear notification here - it will be cleared after input box updates
      return { type: 'file', filepath }; // Successfully saved to file
    } catch (error) {
      // If save fails, just return content to be pasted normally into input
      systemLog('tui', `Failed to save paste: ${error}`, {}, 'error');
      return { type: 'content', value: normalizedContent };
    }
  };

  // Command dropdown state
  const [showDropdown, setShowDropdown] = useState(false);
  const [allCommands, setAllCommands] = useState<Map<string, Command>>(
    new Map()
  );
  const [filteredCommands, setFilteredCommands] = useState<Command[]>([]);
  const [selectedCommandIndex, setSelectedCommandIndex] = useState(0);
  const [commandsLoading, setCommandsLoading] = useState(true);

  // Notify parent when dropdown visibility changes
  // Including onDropdownVisibleChange to satisfy React exhaustive-deps
  useEffect(() => {
    if (onDropdownVisibleChange) {
      onDropdownVisibleChange(showDropdown && focused && !commandsLoading);
    }
  }, [showDropdown, focused, commandsLoading, onDropdownVisibleChange]);

  // Load commands on mount
  useEffect(() => {
    setCommandsLoading(true);
    loadCommands(process.cwd())
      .then((result) => {
        setAllCommands(result.commands);
        setCommandsLoading(false);
        // Log any errors/warnings
        if (result.errors.length > 0) {
          systemLog(
            'tui',
            `Command loading errors: ${result.errors}`,
            {},
            'error'
          );
        }
        if (result.warnings.length > 0) {
          systemLog(
            'tui',
            `Command loading warnings: ${result.warnings}`,
            {},
            'warn'
          );
        }
      })
      .catch((error) => {
        systemLog('tui', `Failed to load commands: ${error}`, {}, 'error');
        setCommandsLoading(false);
      });
  }, []);

  useInput(
    (input, key) => {
      // Debug logging - remove after testing
      if (process.env.DEBUG_INPUT) {
        systemLog(
          'tui',
          `INPUT DEBUG: ${JSON.stringify({ input, key, value, cursorPosition })}`,
          {},
          'error'
        );
      }

      // Support multiple ways to trigger Page Up/Down
      const isPageUpAction =
        key.pageUp || (key.ctrl && input === 'u') || input === '\x1b[5~';
      const isPageDownAction =
        key.pageDown || (key.ctrl && input === 'd') || input === '\x1b[6~';

      // Debug PageUp/PageDown in InputBox
      if (process.env.DEBUG_INPUT && (isPageUpAction || isPageDownAction)) {
        systemLog(
          'tui',
          `[InputBox] ${isPageUpAction ? 'PageUp' : 'PageDown'} action received`,
          {
            focused,
            disabled,
            confirmationPending,
            method: key.pageUp || key.pageDown ? 'key' : 'manual',
          }
        );
      }

      let newValue = value;
      let newCursorPosition = cursorPosition;
      // Global exit via Ctrl+C
      if (key.ctrl && input === 'c') {
        try {
          process.stdout.write('\x1b[0m');
        } catch (e) {
          systemLog(
            'tui',
            `Cleanup error: ${e instanceof Error ? e.message : String(e)}`,
            {},
            'error'
          );
        }
        process.abort();
      }

      // Only process input if focused, not disabled, and not confirming tool
      if (!focused || disabled || confirmationPending) {
        return;
      }

      // Handle command dropdown navigation/selection FIRST
      // Only intercept specific keys when dropdown is visible
      if (showDropdown) {
        if (key.escape) {
          setShowDropdown(false);
          lastEscapeTime.current = Date.now();
          return;
        }

        if (key.upArrow) {
          setSelectedCommandIndex((prev) =>
            prev > 0 ? prev - 1 : filteredCommands.length - 1
          );
          return;
        }

        if (key.downArrow) {
          setSelectedCommandIndex((prev) =>
            prev < filteredCommands.length - 1 ? prev + 1 : 0
          );
          return;
        }

        if (key.return && filteredCommands.length > 0) {
          const selected = filteredCommands[selectedCommandIndex];
          if (selected) {
            const args = value.split(' ').slice(1).join(' ');
            const newValue = `/${selected.name} ${args}`.trim() + ' ';
            valueRef.current = newValue;
            setValue(newValue);
            setCursorPosition(newValue.length); // Move cursor to end
            setShowDropdown(false);
            if (onInputChange) {
              onInputChange(newValue);
            }
          }
          return; // Prevent further processing of Enter
        }

        // For all other keys when dropdown is showing, fall through to normal handling
        // This allows typing to continue filtering, backspace to work, etc.
      }

      // --- Paste Detection ---
      const BRACKETED_PASTE_START = '\x1b[200~';
      const BRACKETED_PASTE_END = '\x1b[201~';

      // Detect bracketed paste (handle both \x1b[200~ and [200~)
      if (
        input.startsWith(BRACKETED_PASTE_START) ||
        input.startsWith('[200~')
      ) {
        pasteBuffer.current = ''; // Initialize paste buffer
        // If the entire input is just the start sequence, we're waiting for content
        if (input === BRACKETED_PASTE_START || input === '[200~') return;
        // If content is immediately after start sequence (rare but possible),
        // capture it and remove the start sequence.
        if (input.startsWith(BRACKETED_PASTE_START)) {
          input = input.substring(BRACKETED_PASTE_START.length);
        } else {
          input = input.substring('[200~'.length);
        }
      }

      if (pasteBuffer.current !== null) {
        if (input.endsWith(BRACKETED_PASTE_END) || input === '[201~') {
          // End of paste (handle both \x1b[201~ and just [201~)
          let pastedContent = pasteBuffer.current;
          if (input.endsWith(BRACKETED_PASTE_END)) {
            pastedContent += input.substring(
              0,
              input.length - BRACKETED_PASTE_END.length
            );
          } else if (input !== '[201~') {
            // If it's not just the end marker, include the input
            pastedContent += input;
          }
          pasteBuffer.current = null; // Reset paste buffer
          // Process the pasted content (save to file, or insert directly if small)
          const pasteResult = processPasteContent(pastedContent);
          if (pasteResult.type === 'content') {
            // Small paste: insert directly at cursor
            newValue =
              value.substring(0, newCursorPosition) +
              pasteResult.value +
              value.substring(newCursorPosition);
            newCursorPosition = newCursorPosition + pasteResult.value.length;
          } else {
            // Large paste: saved to file, clear input
            newValue = '';
            newCursorPosition = 0;
          }
          // Update state immediately for pastes
          if (process.env.DEBUG_INPUT) {
            systemLog(
              'tui',
              `PASTE DEBUG: Setting value to: ${JSON.stringify(newValue.substring(0, 100))}`,
              {},
              'error'
            );
            systemLog(
              'tui',
              `PASTE DEBUG: Cursor position: ${newCursorPosition}`,
              {},
              'error'
            );
            systemLog(
              'tui',
              `PASTE DEBUG: Previous value was: ${JSON.stringify(value.substring(0, 100))}`,
              {},
              'error'
            );
          }
          // Update state using functional form to ensure clean update
          const wasEmpty = value.length === 0;
          valueRef.current = newValue;
          setValue(() => newValue);
          setCursorPosition(() => newCursorPosition);

          // For empty box paste, force re-renders to fix display bug
          if (wasEmpty) {
            // Increment render key multiple times to force clean re-render
            setTimeout(() => {
              setRenderKey((k) => k + 1);
            }, 5);
            setTimeout(() => {
              setRenderKey((k) => k + 1);
            }, 20);
            setTimeout(() => {
              setRenderKey((k) => k + 1);
            }, 50);
          }

          // Call onInputChange AFTER state updates to prevent race conditions
          if (onInputChange) {
            // Use setTimeout to defer callback to next tick
            setTimeout(() => onInputChange(newValue), 0);
          }
          return; // Paste handled, no further input processing for this event
        } else if (key.escape || key.backspace || key.delete) {
          // Allow ESC/Backspace/Delete to cancel stuck paste mode
          pasteBuffer.current = null;
          // Fall through to normal key handling
        } else {
          // Accumulate paste content
          pasteBuffer.current += input;
          return; // Still in paste mode, don't process as normal input
        }
      }

      // Handle backspace - some terminals send delete instead of backspace
      // Always delete character before cursor for backspace-like behavior
      if (key.backspace || key.delete) {
        if (newCursorPosition > 0) {
          newValue =
            value.substring(0, newCursorPosition - 1) +
            value.substring(newCursorPosition);
          newCursorPosition--;
        }
      } else if (key.leftArrow) {
        newCursorPosition = Math.max(0, newCursorPosition - 1);
      } else if (key.rightArrow) {
        newCursorPosition = Math.min(value.length, newCursorPosition + 1);
      } else if (isPageUpAction) {
        sendScrollSignal('pageUp');
      } else if (isPageDownAction) {
        sendScrollSignal('pageDown');
      } else if (key.upArrow && !showDropdown) {
        // Shift+Up scrolls chat, normal Up moves cursor
        if (key.shift) {
          sendScrollSignal('pageUp');
          return;
        }
        // Move cursor up one line in multiline input
        const textBefore = value.substring(0, newCursorPosition);
        const lastNewline = textBefore.lastIndexOf('\n');
        if (lastNewline >= 0) {
          // Find column position in current line
          const currentCol = newCursorPosition - lastNewline - 1;
          // Find start of previous line
          const prevNewline = textBefore.lastIndexOf('\n', lastNewline - 1);
          const prevLineStart = prevNewline + 1;
          const prevLineLength = lastNewline - prevLineStart;
          // Move to same column or end of previous line
          newCursorPosition =
            prevLineStart + Math.min(currentCol, prevLineLength);
        }
      } else if (key.downArrow && !showDropdown) {
        // Shift+Down scrolls chat, normal Down moves cursor
        if (key.shift) {
          sendScrollSignal('pageDown');
          return;
        }
        // Move cursor down one line in multiline input
        const textAfter = value.substring(newCursorPosition);
        const nextNewline = textAfter.indexOf('\n');
        if (nextNewline >= 0) {
          // Find column position in current line
          const textBefore = value.substring(0, newCursorPosition);
          const lastNewline = textBefore.lastIndexOf('\n');
          const currentCol =
            lastNewline >= 0
              ? newCursorPosition - lastNewline - 1
              : newCursorPosition;
          // Find end of next line
          const nextLineStart = newCursorPosition + nextNewline + 1;
          const afterNextLine = value.substring(nextLineStart);
          const nextLineEnd = afterNextLine.indexOf('\n');
          const nextLineLength =
            nextLineEnd >= 0 ? nextLineEnd : afterNextLine.length;
          // Move to same column or end of next line
          newCursorPosition =
            nextLineStart + Math.min(currentCol, nextLineLength);
        }
      } else if ((key.meta || key.ctrl) && input === 'a') {
        // Ctrl+A / Cmd+A: Move to start of entire block
        newCursorPosition = 0;
      } else if ((key.meta || key.ctrl) && input === 'e') {
        // Ctrl+E / Cmd+E: Move to end of entire block
        newCursorPosition = value.length;
      } else if (input === '\n' && !key.return) {
        // Shift+Enter sends \n directly (not as key.return) in some terminals
        newValue =
          value.substring(0, newCursorPosition) +
          '\n' +
          value.substring(newCursorPosition);
        newCursorPosition++;
      } else if (key.return) {
        // Check for Alt+Enter (meta+return) or Ctrl+Enter for newline
        if (key.meta || key.ctrl) {
          newValue =
            value.substring(0, newCursorPosition) +
            '\n' +
            value.substring(newCursorPosition);
          newCursorPosition++;
        } else if (key.shift) {
          // Some terminals do support key.shift with return
          newValue =
            value.substring(0, newCursorPosition) +
            '\n' +
            value.substring(newCursorPosition);
          newCursorPosition++;
        } else if (!showDropdown) {
          // Regular Enter for submission, if dropdown not active
          if (value.trim()) {
            onSubmit(value.trim());
            newValue = '';
            newCursorPosition = 0;
          }
        }
      } else if ((key.meta || key.ctrl) && input === 'o') {
        // Ctrl+O or Alt+O as alternative for newline
        newValue =
          value.substring(0, newCursorPosition) +
          '\n' +
          value.substring(newCursorPosition);
        newCursorPosition++;
      } else if (key.escape) {
        // Double ESC to clear input if not disabled and no dropdown
        const now = Date.now();
        const timeSinceLastEsc = now - lastEscapeTime.current;

        if (process.env.DEBUG_ESC_INPUT) {
          systemLog(
            'tui',
            'ESC pressed',
            {
              disabled,
              onInterrupt: !!onInterrupt,
              timeSinceLastEsc,
            },
            'debug'
          );
        }

        if (disabled && onInterrupt) {
          if (process.env.DEBUG_ESC_INPUT) {
            systemLog('tui', 'Calling onInterrupt()', undefined, 'debug');
          }
          onInterrupt();
        } else if (timeSinceLastEsc < 500) {
          if (process.env.DEBUG_ESC_INPUT) {
            systemLog('tui', 'Double ESC - clearing input', undefined, 'debug');
          }
          newValue = '';
          newCursorPosition = 0;
        }
        lastEscapeTime.current = now;
      } else if (
        input && // Only process if there's an actual input character
        !key.ctrl &&
        !key.meta &&
        input.length === 1 // Ensure it's a single character (not an escape sequence)
      ) {
        // Insert character at cursor position
        newValue =
          value.substring(0, newCursorPosition) +
          input +
          value.substring(newCursorPosition);
        newCursorPosition++;
      }

      // Update state only if something changed
      const valueChanged = newValue !== value;
      const cursorChanged = newCursorPosition !== cursorPosition;

      if (valueChanged) {
        setValue(newValue);
        valueRef.current = newValue;
        if (onInputChange) {
          onInputChange(newValue);
        }
      }

      if (cursorChanged) {
        setCursorPosition(newCursorPosition);
      }

      // Update dropdown visibility based on new value if not explicitly handled by command selection
      // If enter was pressed and command dropdown was active, don't re-evaluate until next key
      if (valueChanged && !(key.return && showDropdown)) {
        const firstWord = newValue.split(' ')[0];
        // Exclude glob patterns (*, ?, [) from being treated as commands
        const isGlobPattern = /[*?[]/.test(firstWord);
        const isCommand =
          newValue.startsWith('/') &&
          !firstWord.slice(1).includes('/') &&
          !isGlobPattern;

        if (isCommand && allCommands.size > 0) {
          const prefix = newValue.slice(1).split(' ')[0];
          const filtered2 = filterCommands(prefix, allCommands);
          setFilteredCommands(filtered2);
          setShowDropdown(filtered2.length > 0);
          // Reset selected index if commands change or it's out of bounds
          if (
            filtered2.length > 0 &&
            selectedCommandIndex >= filtered2.length
          ) {
            setSelectedCommandIndex(0);
          }
        } else {
          setShowDropdown(false);
        }
      }
    },
    { isActive: isInputActive }
  );

  if (!focused) {
    return (
      <Box
        borderTop
        borderBottom
        borderColor="#30363d"
        paddingX={1}
        width="100%"
      >
        <Text color="#8b949e">Press Tab to focus input</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" width="100%" key={renderKey}>
      {/* Tool Confirmation Modal - render ABOVE input, SAME placement as dropdown */}
      {confirmationState && confirmationState.pending && (
        <ToolConfirmationModal state={confirmationState} />
      )}

      {/* Wizard Confirmation Modal - render ABOVE input, SAME placement as tool modal */}
      {wizardConfirmationState && wizardConfirmationState.pending && (
        <WizardConfirmationModal state={wizardConfirmationState} />
      )}

      {/* Command dropdown - render ABOVE input, overlaying the chat area */}
      {showDropdown && focused && !commandsLoading && !confirmationPending && (
        <CommandDropdown
          commands={filteredCommands}
          selectedIndex={selectedCommandIndex}
          isVisible={true}
        />
      )}

      <Box width="100%" flexDirection="column">
        {/* Top border */}
        <Text color={confirmationPending ? '#f85149' : '#3a3f4b'}>
          {'─'.repeat(process.stdout.columns || 80)}
        </Text>

        {/* Input content area */}
        <Box flexDirection="column" minHeight={1}>
          {confirmationPending ? (
            /* Show static tip when confirmation modal is active - EXACT pattern from tool confirmation */
            <>
              <Text color="#f85149">{'> '}</Text>
              <Text dimColor color="#8b949e">
                {wizardConfirmationState?.pending
                  ? wizardConfirmationState.mode === 'select'
                    ? `${wizardConfirmationState.title || 'Select items'} - Use ↑↓ arrows, Space to toggle, Enter to confirm, Esc to cancel`
                    : `${wizardConfirmationState.title || 'Confirm'} - Press Y to confirm, N to skip, Esc to cancel`
                  : 'Waiting for tool confirmation... (See prompt above)'}
              </Text>
            </>
          ) : (
            /* Normal input rendering when NOT confirming */
            <>
              {(() => {
                const beforeCursor = value.substring(0, cursorPosition);
                const afterCursor = value.substring(cursorPosition);
                const fullText = beforeCursor + '█' + afterCursor;
                const lines = fullText.split('\n');

                if (
                  process.env.DEBUG_INPUT &&
                  value.length > 0 &&
                  lines.length > 3
                ) {
                  systemLog(
                    'tui',
                    `RENDER DEBUG: Value has ${lines.length} lines`,
                    {},
                    'error'
                  );
                  systemLog(
                    'tui',
                    `RENDER DEBUG: Value: ${JSON.stringify(value.substring(0, 100))}`,
                    {},
                    'error'
                  );
                  systemLog(
                    'tui',
                    `RENDER DEBUG: First 3 lines: ${lines
                      .slice(0, 3)
                      .map((l) => JSON.stringify(l))
                      .join(', ')}`,
                    {},
                    'error'
                  );
                }

                return lines.map((line, idx) => {
                  const cursorIndex = line.indexOf('█');
                  const prefix = idx === 0 ? '> ' : '  ';

                  return (
                    <Box key={idx}>
                      <Text color="white">{prefix}</Text>
                      <Text color="#56d364">
                        {cursorIndex === -1 ? (
                          line
                        ) : (
                          <>
                            {line.substring(0, cursorIndex)}
                            {focused && !confirmationPending && !disabled ? (
                              <Text
                                backgroundColor={
                                  cursorVisible ? 'white' : undefined
                                }
                                color={cursorVisible ? 'black' : '#56d364'}
                              >
                                {line.substring(
                                  cursorIndex + 1,
                                  cursorIndex + 2
                                ) || ' '}
                              </Text>
                            ) : (
                              line.substring(
                                cursorIndex + 1,
                                cursorIndex + 2
                              ) || ' '
                            )}
                            {line.substring(cursorIndex + 2)}
                          </>
                        )}
                      </Text>
                      {value.length === 0 && idx === 0 && (
                        <Text dimColor color="#8b949e">
                          {disabled
                            ? ` ${providerName.charAt(0).toUpperCase() + providerName.slice(1)} is thinking... (ESC to interrupt)`
                            : ' Type a message... (Ctrl+O for newline, ESC ESC to clear)'}
                        </Text>
                      )}
                    </Box>
                  );
                });
              })()}
            </>
          )}
        </Box>

        {/* Bottom border */}
        <Text color={confirmationPending ? '#f85149' : '#3a3f4b'}>
          {'─'.repeat(process.stdout.columns || 80)}
        </Text>
      </Box>

      {/* Loading indicator */}
      {commandsLoading && value.startsWith('/') && focused && (
        <Box paddingX={1}>
          <Text color="yellow">⏳ Loading...</Text>
        </Box>
      )}
    </Box>
  );
};
