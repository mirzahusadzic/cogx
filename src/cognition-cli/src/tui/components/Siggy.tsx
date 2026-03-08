import React, { useState, useEffect } from 'react';
import { Text } from 'ink';
import { ThinkingState } from '../hooks/useAgent/types.js';
import { SIGGY_ANIMATIONS } from '../constants.js';

/**
 * Props for Siggy mascot component
 */
export interface SiggyProps {
  /** Current thinking state for animation */
  state: ThinkingState;
}

/**
 * Animated mascot component for the TUI.
 * Cycles through frames based on the current thinking state.
 */
export const Siggy: React.FC<SiggyProps> = ({ state }) => {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const frames =
      SIGGY_ANIMATIONS[state] || SIGGY_ANIMATIONS[ThinkingState.IDLE];

    // Reset to first frame when state changes
    setFrame(0);

    if (frames.length <= 1) {
      return;
    }

    // Determine interval based on state
    let intervalTime = 250;
    if (state === ThinkingState.IDLE) {
      intervalTime = 800; // Slower blink
    } else if (state === ThinkingState.PROCESSING) {
      intervalTime = 150; // Fast scan
    } else if (state === ThinkingState.EXECUTING) {
      intervalTime = 200; // Zap speed
    } else if (state === ThinkingState.TYPING) {
      intervalTime = 200; // Focused typing
    } else if (state === ThinkingState.WAITING) {
      intervalTime = 600; // Natural peek speed
    }

    const interval = setInterval(() => {
      setFrame((f) => (f + 1) % frames.length);
    }, intervalTime);

    return () => clearInterval(interval);
  }, [state]);

  const frames =
    SIGGY_ANIMATIONS[state] || SIGGY_ANIMATIONS[ThinkingState.IDLE];
  const displayFrame = frames[frame % frames.length] || frames[0];

  return <Text>{displayFrame}</Text>;
};
