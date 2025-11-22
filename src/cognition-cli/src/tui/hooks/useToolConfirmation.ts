/**
 * Tool Confirmation Hook
 *
 * Manages interactive prompts for tool execution confirmation.
 * Provides a way to ask the user before executing dangerous operations.
 */

import { useState, useCallback, useRef } from 'react';
import {
  checkToolSafety,
  formatToolInput,
  ToolRiskLevel,
} from '../utils/tool-safety.js';

export interface ToolConfirmationState {
  pending: boolean;
  toolName: string;
  input: unknown;
  riskLevel: ToolRiskLevel;
  reason: string;
}

/**
 * Session memory for "always allow" decisions
 */
interface SessionAllowList {
  [pattern: string]: boolean;
}

export function useToolConfirmation() {
  const [confirmationState, setConfirmationState] =
    useState<ToolConfirmationState | null>(null);

  // Session-based allow list (resets when session ends)
  const sessionAllowList = useRef<SessionAllowList>({});

  // Promise resolver for async confirmation
  const confirmationResolver = useRef<
    ((decision: 'allow' | 'deny') => void) | null
  >(null);

  /**
   * Request confirmation and wait for user decision
   * Returns a Promise that resolves with 'allow' or 'deny'
   */
  const requestConfirmation = useCallback(
    (toolName: string, input: unknown): Promise<'allow' | 'deny'> => {
      // Check safety
      const safety = checkToolSafety(toolName, input);

      // Debug logging
      if (process.env.DEBUG_CONFIRMATION) {
        console.error('[Confirmation] Tool:', toolName);
        console.error('[Confirmation] Input:', JSON.stringify(input, null, 2));
        console.error('[Confirmation] Safety:', safety);
      }

      // Auto-allow if safe
      if (!safety.requiresConfirmation) {
        return Promise.resolve('allow');
      }

      // Check session allow list
      const key = `${toolName}:${formatToolInput(toolName, input)}`;

      // Debug logging
      if (process.env.DEBUG_CONFIRMATION) {
        console.error('[Confirmation] Checking Key:', key);
        console.error(
          '[Confirmation] Is in allow list?',
          sessionAllowList.current[key]
        );
        console.error(
          '[Confirmation] All allowed keys:',
          Object.keys(sessionAllowList.current)
        );
      }

      if (sessionAllowList.current[key]) {
        if (process.env.DEBUG_CONFIRMATION) {
          console.error('[Confirmation] Auto-allowing from session list');
        }
        return Promise.resolve('allow');
      }

      // Request user confirmation
      return new Promise((resolve) => {
        confirmationResolver.current = resolve;

        setConfirmationState({
          pending: true,
          toolName,
          input,
          riskLevel: safety.riskLevel,
          reason: safety.reason,
        });
      });
    },
    []
  );

  /**
   * Allow tool execution
   */
  const allow = useCallback(() => {
    if (confirmationResolver.current) {
      confirmationResolver.current('allow');
      confirmationResolver.current = null;
    }
    setConfirmationState(null);
  }, []);

  /**
   * Deny tool execution
   */
  const deny = useCallback(() => {
    if (confirmationResolver.current) {
      confirmationResolver.current('deny');
      confirmationResolver.current = null;
    }
    setConfirmationState(null);
  }, []);

  /**
   * Allow tool and remember for session
   */
  const alwaysAllow = useCallback(() => {
    if (confirmationState) {
      const key = `${confirmationState.toolName}:${formatToolInput(
        confirmationState.toolName,
        confirmationState.input
      )}`;
      sessionAllowList.current[key] = true;

      // Debug logging
      if (process.env.DEBUG_CONFIRMATION) {
        console.error('[Confirmation] Always Allow - Key:', key);
        console.error(
          '[Confirmation] Session Allow List:',
          Object.keys(sessionAllowList.current)
        );
      }
    }

    if (confirmationResolver.current) {
      confirmationResolver.current('allow');
      confirmationResolver.current = null;
    }
    setConfirmationState(null);
  }, [confirmationState]);

  /**
   * Clear session allow list
   */
  const clearSessionAllowList = useCallback(() => {
    sessionAllowList.current = {};
  }, []);

  return {
    confirmationState,
    requestConfirmation,
    allow,
    deny,
    alwaysAllow,
    clearSessionAllowList,
  };
}
