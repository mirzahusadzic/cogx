import React, { useState, useEffect, useRef } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';

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

        if (disabled && onInterrupt) {
          // When thinking, single ESC interrupts
          onInterrupt();
        } else if (timeSinceLastEsc < 500) {
          // Double ESC within 500ms clears input
          setValue('');
        }

        lastEscapeTime.current = now;
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
  );
};
