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
  extractBaseCommand,
  ToolRiskLevel,
} from '../utils/tool-safety.js';
import { systemLog } from '../../utils/debug-logger.js';

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
        systemLog('tui', '[Confirmation] Tool:', { toolName });
        systemLog('tui', '[Confirmation] Input:', {
          input: JSON.stringify(input, null, 2),
        });
        systemLog('tui', '[Confirmation] Safety:', {
          safety: safety as unknown as Record<string, unknown>,
        });
      }

      // Auto-allow if safe
      if (!safety.requiresConfirmation) {
        return Promise.resolve('allow');
      }

      // Check session allow list - try multiple keys
      const keysToCheck: string[] = [];

      // 1. Tool-level key (e.g., "bash")
      keysToCheck.push(toolName);

      // 2. For bash, also check command-level key (e.g., "bash:cognition-cli")
      if (toolName.toLowerCase() === 'bash') {
        const command = formatToolInput(toolName, input);
        const baseCommand = extractBaseCommand(command);
        if (baseCommand) {
          keysToCheck.push(`bash:${baseCommand}`);
        }
      }

      // 3. Specific command key (full args)
      const specificKey = `${toolName}:${formatToolInput(toolName, input)}`;
      keysToCheck.push(specificKey);

      // Debug logging
      if (process.env.DEBUG_CONFIRMATION) {
        systemLog('tui', '[Confirmation] Checking keys:', { keysToCheck });
        systemLog('tui', '[Confirmation] Allow list:', {
          keys: Object.keys(sessionAllowList.current),
        });
      }

      // Check if any key is allowed
      for (const key of keysToCheck) {
        if (sessionAllowList.current[key]) {
          if (process.env.DEBUG_CONFIRMATION) {
            systemLog('tui', '[Confirmation] Auto-allowing via key:', { key });
          }
          return Promise.resolve('allow');
        }
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
   * Allow tool and remember for session (approves command, not just specific args)
   * For bash commands, approves the base command (e.g., "cognition-cli", "git")
   * For other tools, approves the tool itself
   */
  const alwaysAllow = useCallback(() => {
    if (confirmationState) {
      let key = confirmationState.toolName;

      // For bash commands, extract the actual command being run
      if (confirmationState.toolName.toLowerCase() === 'bash') {
        const command = formatToolInput('bash', confirmationState.input);
        const baseCommand = extractBaseCommand(command);
        if (baseCommand) {
          // Use "bash:command" as key (e.g., "bash:cognition-cli")
          key = `bash:${baseCommand}`;
        }
      }

      sessionAllowList.current[key] = true;

      // Debug logging
      if (process.env.DEBUG_CONFIRMATION) {
        systemLog('tui', '[Confirmation] Always Allow - Key:', { key });
        systemLog('tui', '[Confirmation] Session Allow List:', {
          keys: Object.keys(sessionAllowList.current),
        });
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
