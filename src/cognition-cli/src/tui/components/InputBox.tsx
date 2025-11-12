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

  // Command dropdown state
  const [showDropdown, setShowDropdown] = useState(false);
  const [allCommands, setAllCommands] = useState<Map<string, Command>>(new Map());
  const [filteredCommands, setFilteredCommands] = useState<Command[]>([]);
  const [selectedCommandIndex, setSelectedCommandIndex] = useState(0);

  // Load commands on mount
  useEffect(() => {
    loadCommands(process.cwd()).then((result) => {
      setAllCommands(result.commands);
      // Log any errors/warnings
      if (result.errors.length > 0) {
        console.error('Command loading errors:', result.errors);
      }
      if (result.warnings.length > 0) {
        console.warn('Command loading warnings:', result.warnings);
      }
    });
  }, []);

  const handleChange = (newValue: string) => {
    // Only update if the value actually changed (prevent re-render loops)
    if (newValue === value) return;

    // Filter out ALL escape sequences and mouse events aggressively
    // eslint-disable-next-line no-control-regex
    let filtered = newValue.replace(/\x1b\[[^\x1b]*[a-zA-Z~]/g, ''); // Standard escape sequences
    filtered = filtered.replace(/\[?<\d+;\d+;\d+[Mm]/g, ''); // Mouse: [<64;76;16M or <64;76;16M
    filtered = filtered.replace(/\[<\d+;\d+;\d+[Mm]/g, ''); // Mouse: [<64;76;16M explicitly
    filtered = filtered.replace(/<\d+;\d+;\d+[Mm]/g, ''); // Mouse: <64;76;16M without bracket
    // Note: Removed overly aggressive bracket filter that blocked legitimate input like [O2]

    if (filtered !== value) {
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
    if (value.trim() && !disabled) {
      onSubmit(value.trim());
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
      } else if (key.return && showDropdown) {
        // Select command with Enter
        const selected = filteredCommands[selectedCommandIndex];
        if (selected) {
          // Replace current input with selected command
          const args = value.split(' ').slice(1).join(' '); // Preserve args if any
          setValue(`/${selected.name}${args ? ' ' + args : ''}`);
          setShowDropdown(false);
        }
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

      {/* Command dropdown */}
      <CommandDropdown
        commands={filteredCommands}
        selectedIndex={selectedCommandIndex}
        isVisible={showDropdown && focused}
      />
    </Box>
  );
};
