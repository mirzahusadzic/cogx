import React, { useState, useEffect, useRef } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { CommandDropdown } from './CommandDropdown.js';
import { loadCommands, filterCommands, Command } from '../commands/loader.js';
import { writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

interface InputBoxProps {
  onSubmit: (value: string) => void;
  focused: boolean;
  disabled?: boolean;
  onInterrupt?: () => void;
  onDropdownVisibleChange?: (visible: boolean) => void;
  onPasteContent?: (content: string, filepath: string) => void;
}

/**
 * Input box for typing messages to Claude
 */
export const InputBox: React.FC<InputBoxProps> = ({
  onSubmit,
  focused,
  disabled = false,
  onInterrupt,
  onDropdownVisibleChange,
  onPasteContent,
}) => {
  const [value, setValue] = useState('');
  const [inputKey, setInputKey] = useState(0); // Force remount to reset cursor position
  const lastEscapeTime = useRef<number>(0);
  const valueRef = useRef<string>(''); // Track actual current value for paste detection
  const [pasteNotification, setPasteNotification] = useState<string>('');
  const pasteBuffer = useRef<string>(''); // Accumulate paste chunks
  const lastPasteTime = useRef<number>(0);
  const pasteTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
          console.error('Command loading errors:', result.errors);
        }
        if (result.warnings.length > 0) {
          console.warn('Command loading warnings:', result.warnings);
        }
      })
      .catch((error) => {
        console.error('Failed to load commands:', error);
        setCommandsLoading(false);
      });
  }, []);

  const handleChange = (newValue: string) => {
    const previousValue = valueRef.current;
    const now = Date.now();

    // Paste detection: large change (10+ chars) OR contains newlines
    const changeSize = Math.abs(newValue.length - previousValue.length);
    const hasNewlines = newValue.includes('\n') || newValue.includes('\r');
    const isPaste = changeSize > 10 || hasNewlines;

    if (isPaste) {
      const timeSinceLastPaste = now - lastPasteTime.current;

      // If this is a continuation of a previous paste (within 200ms), accumulate
      if (timeSinceLastPaste < 200 && pasteBuffer.current) {
        // Check if this is overlapping (newValue starts with buffer) or separate chunk
        if (newValue.startsWith(pasteBuffer.current)) {
          // Progressive chunk - keep the longer one
          pasteBuffer.current = newValue;
        } else if (pasteBuffer.current.startsWith(newValue)) {
          // Old buffer is longer, keep it
          // (do nothing)
        } else {
          // Separate chunk - append it
          pasteBuffer.current += newValue;
        }
      } else {
        // New paste started
        pasteBuffer.current = newValue;
      }
      lastPasteTime.current = now;

      // Immediately clear the input to prevent UI overflow
      valueRef.current = '';
      setValue('');

      // Clear any existing timeout
      if (pasteTimeoutRef.current) {
        clearTimeout(pasteTimeoutRef.current);
      }

      // Debounce - wait 200ms for more chunks before saving
      pasteTimeoutRef.current = setTimeout(() => {
        const content = pasteBuffer.current;
        pasteBuffer.current = '';
        pasteTimeoutRef.current = null;

        // Normalize line endings and clean up escape sequences
        const normalizedContent = content
          .replace(/\r\n/g, '\n')
          .replace(/\r/g, '\n')
          .replace(/\[200~/g, '') // Bracketed paste start
          .replace(/\[201~/g, ''); // Bracketed paste end

        // Save to temp file
        const timestamp = Date.now();
        const filename = `cognition-paste-${timestamp}.txt`;
        const filepath = join(tmpdir(), filename);

        try {
          writeFileSync(filepath, normalizedContent, 'utf-8');

          // Show notification
          setPasteNotification(`📋 Paste saved to: ${filepath}`);

          // Notify parent to display the content
          if (onPasteContent) {
            onPasteContent(normalizedContent, filepath);
          }

          // Clear notification after 5 seconds
          setTimeout(() => setPasteNotification(''), 5000);
        } catch (error) {
          // If save fails, just paste normally
          console.error('Failed to save paste:', error);
          handleChangeInternal(normalizedContent);
        }
      }, 200);

      return;
    }

    // Normal typing
    handleChangeInternal(newValue);
  };

  const handleChangeInternal = (newValue: string) => {
    // Use ref for comparison
    if (newValue === valueRef.current) return;

    // Filter out escape sequences and mouse events
    // eslint-disable-next-line no-control-regex
    let filtered = newValue;

    // Comprehensive escape sequence removal
    // eslint-disable-next-line no-control-regex
    filtered = filtered.replace(/\x1b\[[\d;]*[a-zA-Z~]/g, ''); // CSI sequences
    // eslint-disable-next-line no-control-regex
    filtered = filtered.replace(/\x1b\[<[\d;]+[mM]/g, ''); // SGR mouse
    filtered = filtered.replace(/\[?<\d+;\d+;\d+[Mm]/g, ''); // Legacy mouse

    if (filtered !== valueRef.current) {
      valueRef.current = filtered; // Update ref immediately
      setValue(filtered);

      // Detect slash command and show dropdown
      // Only treat as command if it starts with / but is NOT a file path
      // File paths have another / in the first word (e.g., /home/user/file.txt)
      const firstWord = filtered.split(' ')[0];
      const isCommand =
        filtered.startsWith('/') && !firstWord.slice(1).includes('/'); // No / after first character

      if (isCommand && allCommands.size > 0) {
        const prefix = filtered.slice(1).split(' ')[0]; // Get command part only
        const filtered2 = filterCommands(prefix, allCommands);

        setFilteredCommands(filtered2);
        setShowDropdown(filtered2.length > 0);
        setSelectedCommandIndex(0); // Reset selection
      } else {
        setShowDropdown(false);
      }
    }
  };

  const handleSubmit = () => {
    // Don't submit if dropdown is open - let the dropdown handle Enter
    if (showDropdown) {
      return;
    }

    if (value.trim() && !disabled) {
      onSubmit(value.trim());
      valueRef.current = '';
      setValue('');
    }
  };

  // Handle double ESC to clear input, or ESC to interrupt when thinking
  useInput(
    (input, key) => {
      if (key.ctrl && input === 'c') {
        // Force immediate exit - process.abort() bypasses event loop
        try {
          process.stdout.write('\x1b[0m');
        } catch (e) {
          // Ignore
        }
        process.abort();
      } else if (key.escape) {
        const now = Date.now();
        const timeSinceLastEsc = now - lastEscapeTime.current;

        // If dropdown is visible, ESC closes it
        if (showDropdown) {
          setShowDropdown(false);
          lastEscapeTime.current = now;
          return;
        }

        if (disabled && onInterrupt) {
          // When thinking, single ESC interrupts
          onInterrupt();
        } else if (timeSinceLastEsc < 500) {
          // Double ESC within 500ms clears input
          valueRef.current = '';
          setValue('');
        }

        lastEscapeTime.current = now;
      } else if (key.upArrow && showDropdown) {
        // Navigate up in dropdown (wrap around)
        // Use functional update to avoid triggering re-renders with same value
        setSelectedCommandIndex((prev) => {
          const next = prev > 0 ? prev - 1 : filteredCommands.length - 1;
          return next === prev ? prev : next;
        });
      } else if (key.downArrow && showDropdown) {
        // Navigate down in dropdown (wrap around)
        // Use functional update to avoid triggering re-renders with same value
        setSelectedCommandIndex((prev) => {
          const next = prev < filteredCommands.length - 1 ? prev + 1 : 0;
          return next === prev ? prev : next;
        });
      } else if (key.return && showDropdown && filteredCommands.length > 0) {
        // Select command with Enter (prevent TextInput from submitting)
        const selected = filteredCommands[selectedCommandIndex];
        if (selected) {
          // Replace current input with selected command
          const args = value.split(' ').slice(1).join(' '); // Preserve args if any
          // Add trailing space to position cursor at end (ready for argument typing)
          const newValue = `/${selected.name} ${args}`.trim() + ' ';
          valueRef.current = newValue;
          setValue(newValue);
          setShowDropdown(false);
          // Force TextInput remount to reset cursor position to end
          setInputKey((prev) => prev + 1);
        }
        // Prevent event from reaching TextInput's onSubmit
        return false;
      }
    },
    { isActive: focused }
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
    <Box flexDirection="column" width="100%">
      {/* Paste notification - show ABOVE input */}
      {pasteNotification && (
        <Box paddingX={1} paddingY={0}>
          <Text color="#2eb572">{pasteNotification}</Text>
        </Box>
      )}

      {/* Command dropdown - render ABOVE input, overlaying the chat area */}
      {showDropdown && focused && !commandsLoading && (
        <CommandDropdown
          commands={filteredCommands}
          selectedIndex={selectedCommandIndex}
          isVisible={true}
        />
      )}

      <Box
        borderTop
        borderBottom
        borderColor="#56d364"
        paddingX={1}
        width="100%"
      >
        <Text color="#56d364">{'> '}</Text>
        <Text color="#56d364">
          <TextInput
            key={inputKey}
            value={value}
            onChange={handleChange}
            onSubmit={handleSubmit}
            placeholder={
              disabled
                ? 'Claude is thinking... (ESC to interrupt)'
                : 'Type a message... (ESC ESC to clear)'
            }
            showCursor={!disabled}
            // Disable any autocorrect/autocomplete features
            // @ts-expect-error - these props might not be in type definitions but work
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />
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
