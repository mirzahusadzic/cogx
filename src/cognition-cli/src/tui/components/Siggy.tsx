import React, { useEffect, useRef, useState } from 'react';
import { Box, useStdout, Text } from 'ink';
import chalk from 'chalk';
import { ThinkingState } from '../hooks/useAgent/types.js';
import { SIGGY_ANIMATIONS } from '../constants.js';

/**
 * Props for Siggy mascot component
 */
export interface SiggyProps {
  /** Current thinking state for animation */
  state: ThinkingState;
  /** Color for Siggy */
  color?: string;
  /** Terminal row offset from the bottom (height of input area) */
  terminalOffset: number;
  /** Total number of terminal rows for absolute positioning */
  terminalRows: number;
}

/**
 * Animated mascot component for the TUI.
 * Uses a hybrid rendering approach:
 * 1. For TYPING state, uses standard Ink rendering to prevent flickering
 *    during frequent repaints caused by keystrokes.
 * 2. For all other states (IDLE, etc.), uses direct terminal writes to
 *    preserve terminal selection and reduce CPU usage.
 */
export const Siggy: React.FC<SiggyProps> = React.memo(
  ({ state, color = 'cyan', terminalOffset, terminalRows }) => {
    const { stdout } = useStdout();
    const frameRef = useRef(0);
    const [typingFrame, setTypingFrame] = useState(0);
    const lastPosRef = useRef<{
      line: number;
      col: number;
      frame: string;
    } | null>(null);

    const isTyping = state === ThinkingState.TYPING;
    const isTest = process.env.NODE_ENV === 'test';

    // Use refs for layout-related props to allow the animation loop to use
    // the latest values without restarting the effect.
    const layoutRef = useRef({ terminalOffset, terminalRows });
    useEffect(() => {
      layoutRef.current = { terminalOffset, terminalRows };
    }, [terminalOffset, terminalRows]);

    useEffect(() => {
      if (!stdout || isTest) return;

      const animation =
        SIGGY_ANIMATIONS[state] || SIGGY_ANIMATIONS[ThinkingState.IDLE];
      const frames = animation.frames;

      // Reset animation to first frame on state change
      frameRef.current = 0;
      if (isTyping) setTypingFrame(0);

      // Determine color function
      let colorFn = chalk.cyan;
      try {
        if (color.startsWith('#')) {
          colorFn = chalk.hex(color);
        } else if (color in chalk) {
          const potentialColorFn = (
            chalk as unknown as Record<string, unknown>
          )[color];
          if (typeof potentialColorFn === 'function') {
            colorFn = potentialColorFn as typeof chalk.cyan;
          }
        }
      } catch {
        // fallback to cyan
      }

      // Determine interval based on state
      const intervalTime = animation.interval;

      const render = (force = false) => {
        // Skip direct writes if we are in TYPING state (handled by Ink)
        if (isTyping) return;

        const { terminalOffset: offset, terminalRows: rows } =
          layoutRef.current;
        const displayFrame = frames[frameRef.current] || frames[0];

        // Siggy frames are now standardized to 12 columns in constants.ts
        const paddedFrame = displayFrame;

        // Calculate terminal position
        const line = rows - offset;
        const col = 2; // Fixed column for Siggy in ClaudePanelAgent layout

        // Safety check - don't write outside terminal bounds
        if (line <= 0 || line > rows) return;

        // Only write if position or content changed, or if forced
        const hasChanged =
          force ||
          !lastPosRef.current ||
          lastPosRef.current.line !== line ||
          lastPosRef.current.col !== col ||
          lastPosRef.current.frame !== paddedFrame;

        if (hasChanged) {
          // If position changed, clear the old one
          if (
            lastPosRef.current &&
            (lastPosRef.current.line !== line || lastPosRef.current.col !== col)
          ) {
            stdout.write('\u001b[s'); // Save cursor
            stdout.write(
              `\u001b[${lastPosRef.current.line};${lastPosRef.current.col}H`
            );
            stdout.write(' '.repeat(12));
            stdout.write('\u001b[u'); // Restore cursor
          }

          // Write new frame
          stdout.write('\u001b[s'); // Save cursor
          stdout.write(`\u001b[${line};${col}H`); // Move to Siggy position
          stdout.write(colorFn(paddedFrame));
          stdout.write('\u001b[u'); // Restore cursor

          lastPosRef.current = { line, col, frame: paddedFrame };
        }
      };

      // Render first frame immediately
      render(true);

      const interval = setInterval(() => {
        frameRef.current = (frameRef.current + 1) % frames.length;
        if (isTyping) {
          setTypingFrame(frameRef.current);
        } else {
          render();
        }
      }, intervalTime);

      return () => {
        clearInterval(interval);
      };
    }, [state, color, stdout, isTyping]);

    // Handle position changes and re-renders immediately for non-typing states
    useEffect(() => {
      // Skip direct writes if we are in TYPING state (handled by Ink)
      if (isTyping || isTest) {
        // Clear any leftover direct write if we just switched to typing
        if (stdout && lastPosRef.current) {
          const { line, col } = lastPosRef.current;
          stdout.write('\u001b[s');
          stdout.write(`\u001b[${line};${col}H`);
          stdout.write(' '.repeat(12));
          stdout.write('\u001b[u');
          lastPosRef.current = null;
        }
        return;
      }

      const { terminalRows: rows, terminalOffset: offset } = layoutRef.current;
      const line = rows - offset;
      const col = 2;

      if (line <= 0 || line > rows || !stdout) return;

      const animation =
        SIGGY_ANIMATIONS[state] || SIGGY_ANIMATIONS[ThinkingState.IDLE];
      const frames = animation.frames;
      const displayFrame = frames[frameRef.current] || frames[0];

      // Determine color function
      let colorFn = chalk.cyan;
      if (color && color in chalk) {
        const potentialColorFn = (chalk as unknown as Record<string, unknown>)[
          color
        ];
        if (typeof potentialColorFn === 'function')
          colorFn = potentialColorFn as typeof chalk.cyan;
      }

      // If position changed, we MUST clear the old one first
      if (
        lastPosRef.current &&
        (lastPosRef.current.line !== line || lastPosRef.current.col !== col)
      ) {
        stdout.write('\u001b[s');
        stdout.write(
          `\u001b[${lastPosRef.current.line};${lastPosRef.current.col}H`
        );
        stdout.write(' '.repeat(12));
        stdout.write('\u001b[u');
      }

      // Always re-write on every React render to prevent flicker from Ink repaints
      stdout.write('\u001b[s');
      stdout.write(`\u001b[${line};${col}H`);
      stdout.write(colorFn(displayFrame));
      stdout.write('\u001b[u');

      lastPosRef.current = { line, col, frame: displayFrame };
    }); // No dependency array - runs on every render

    // Final cleanup on unmount
    useEffect(() => {
      return () => {
        if (stdout && lastPosRef.current) {
          const { line, col } = lastPosRef.current;
          stdout.write('\u001b[s');
          stdout.write(`\u001b[${line};${col}H`);
          stdout.write(' '.repeat(12));
          stdout.write('\u001b[u');
        }
      };
    }, [stdout]);

    // Return a box with consistent dimensions to maintain layout.
    // If typing, render the frame inside the box via Ink.
    if (isTyping || isTest) {
      const frames = isTyping
        ? SIGGY_ANIMATIONS[ThinkingState.TYPING].frames
        : (SIGGY_ANIMATIONS[state] || SIGGY_ANIMATIONS[ThinkingState.IDLE])
            .frames;
      const displayFrame =
        frames[isTyping ? typingFrame : frameRef.current] || frames[0];
      return (
        <Box width={12} height={1}>
          <Text color={color}>{displayFrame}</Text>
        </Box>
      );
    }

    return <Box width={12} height={1} />;
  }
);
