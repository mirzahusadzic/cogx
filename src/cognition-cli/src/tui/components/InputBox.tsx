import React, { useState } from 'react';
import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';

interface InputBoxProps {
  onSubmit: (value: string) => void;
  focused: boolean;
  disabled?: boolean;
}

/**
 * Input box for typing messages to Claude
 */
export const InputBox: React.FC<InputBoxProps> = ({
  onSubmit,
  focused,
  disabled = false,
}) => {
  const [value, setValue] = useState('');

  const handleChange = (newValue: string) => {
    // Filter out escape sequences (like arrow key codes)
    const filtered = newValue.replace(/\[[\w\d]+/g, '');
    setValue(filtered);
  };

  const handleSubmit = () => {
    if (value.trim() && !disabled) {
      onSubmit(value.trim());
      setValue('');
    }
  };

  if (!focused) {
    return (
      <Box borderStyle="single" borderColor="gray" paddingX={1} width="100%">
        <Text dimColor>Press Tab to focus input</Text>
      </Box>
    );
  }

  return (
    <Box borderStyle="single" borderColor="cyan" paddingX={1} width="100%">
      <Text color="cyan">{'> '}</Text>
      <TextInput
        value={value}
        onChange={handleChange}
        onSubmit={handleSubmit}
        placeholder={disabled ? 'Waiting for Claude...' : 'Type a message...'}
        showCursor={!disabled}
      />
    </Box>
  );
};
