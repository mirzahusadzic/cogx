import React, { useState, useEffect, useRef } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { CommandDropdown } from './CommandDropdown.js';
import { loadCommands, filterCommands, Command } from '../commands/loader.js';

interface InputBoxProps {
  onSubmit: (value: string) => void;
  focused: boolean;
  disabled?: boolean;
  onInterrupt?: () => void;
}

/**
 * Input box for typing messages to Claude
 */
export const InputBox: React.FC<InputBoxProps> = ({
  onSubmit,
  focused,
  disabled = false,
  onInterrupt,
}) => {
  const [value, setValue] = useState('');
  const lastEscapeTime = useRef<number>(0);
  const valueRef = useRef<string>(''); // Track actual current value for paste
  const lastPasteTime = useRef<number>(0);
  const pasteBuffer = useRef<string>(''); // Accumulate paste chunks

  // Command dropdown state
  const [showDropdown, setShowDropdown] = useState(false);
  const [allCommands, setAllCommands] = useState<Map<string, Command>>(new Map());
  const [filteredCommands, setFilteredCommands] = useState<Command[]>([]);
  const [selectedCommandIndex, setSelectedCommandIndex] = useState(0);
  const [commandsLoading, setCommandsLoading] = useState(true);

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
    const now = Date.now();
    const timeSinceLastPaste = now - lastPasteTime.current;

    // Detect if this is a paste (large sudden change or rapid successive calls)
    const isPaste = newValue.length > valueRef.current.length + 5 || timeSinceLastPaste < 10;

    if (isPaste) {
      // Accumulate paste chunks within 50ms window
      if (timeSinceLastPaste < 50) {
        // This is continuation of previous paste
        if (!newValue.startsWith(pasteBuffer.current)) {
          // New chunk, append it
          pasteBuffer.current += newValue;
        } else {
          // Replacement, use longer value
          pasteBuffer.current = newValue.length > pasteBuffer.current.length ? newValue : pasteBuffer.current;
        }
      } else {
        // New paste started
        pasteBuffer.current = newValue;
      }
      lastPasteTime.current = now;

      // Debounce - wait 50ms for more chunks before committing
      setTimeout(() => {
        if (Date.now() - lastPasteTime.current >= 45) {
          // No more chunks, commit the paste
          handleChangeInternal(pasteBuffer.current);
          pasteBuffer.current = '';
        }
      }, 50);

      return; // Don't process yet, wait for all chunks
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
    filtered = filtered.replace(/\x1b\[[\d;]*[a-zA-Z~]/g, ''); // CSI sequences
    filtered = filtered.replace(/\x1b\[<[\d;]+[mM]/g, ''); // SGR mouse
    filtered = filtered.replace(/\[?<\d+;\d+;\d+[Mm]/g, ''); // Legacy mouse

    if (filtered !== valueRef.current) {
      valueRef.current = filtered; // Update ref immediately
      setValue(filtered);

      // Detect slash command and show dropdown
      if (filtered.startsWith('/') && allCommands.size > 0) {
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
        setSelectedCommandIndex((prev) =>
          prev > 0 ? prev - 1 : filteredCommands.length - 1
        );
      } else if (key.downArrow && showDropdown) {
        // Navigate down in dropdown (wrap around)
        setSelectedCommandIndex((prev) =>
          prev < filteredCommands.length - 1 ? prev + 1 : 0
        );
      } else if (key.return && showDropdown && filteredCommands.length > 0) {
        // Select command with Enter (prevent TextInput from submitting)
        const selected = filteredCommands[selectedCommandIndex];
        if (selected) {
          // Replace current input with selected command
          const args = value.split(' ').slice(1).join(' '); // Preserve args if any
          const newValue = `/${selected.name}${args ? ' ' + args : ''}`;
          valueRef.current = newValue;
          setValue(newValue);
          setShowDropdown(false);
        }
        // Prevent event from reaching TextInput's onSubmit
        return false;
      }
    },
    { isActive: focused }
  );

  if (!focused) {
    return (
      <Box borderTop borderBottom borderColor="#30363d" paddingX={1} width="100%">
        <Text color="#8b949e">Press Tab to focus input</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" width="100%">
      <Box borderTop borderBottom borderColor="#56d364" paddingX={1} width="100%">
        <Text color="#56d364">{'> '}</Text>
        <Text color="#56d364">
          <TextInput
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
            // @ts-ignore - these props might not be in type definitions but work
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />
        </Text>
      </Box>

      {/* Loading indicator */}
      {commandsLoading && value.startsWith('/') && focused && (
        <Box marginTop={1} paddingX={1}>
          <Text color="yellow">⏳ Loading commands...</Text>
        </Box>
      )}

      {/* Command dropdown */}
      <CommandDropdown
        commands={filteredCommands}
        selectedIndex={selectedCommandIndex}
        isVisible={showDropdown && focused && !commandsLoading}
      />
    </Box>
  );
};
