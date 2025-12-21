/**
 * Agent Discovery Utilities
 *
 * Shared functions for discovering active agents and resolving agent aliases.
 * Used by both Claude MCP tools and Gemini ADK tools.
 */

import * as fs from 'fs';
import * as path from 'path';
import type { AgentInfo } from './agent-messaging-formatters.js';
import { getMessageQueueDirectory } from './sigma-directory.js';

// Re-export AgentInfo for convenience
export type { AgentInfo } from './agent-messaging-formatters.js';

/**
 * Active threshold for listing agents (30 seconds).
 * Used by getActiveAgents to filter out stale agents.
 */
const ACTIVE_THRESHOLD_LIST = 30000;

/**
 * Active threshold for resolving aliases (5 seconds).
 * More aggressive to ensure messages go to truly active agents.
 */
const ACTIVE_THRESHOLD_RESOLVE = 5000;

/**
 * Get list of active agents from message_queue directory.
 *
 * Scans the .sigma/message_queue directory for agent-info.json files
 * and returns agents that have sent a heartbeat within the threshold.
 *
 * @param projectRoot - Project root directory containing .sigma (used when IPC_SIGMA_BUS is not set)
 * @param excludeAgentId - Agent ID to exclude from results (typically self)
 * @returns Array of active agent info, sorted by alias
 */
export function getActiveAgents(
  projectRoot: string,
  excludeAgentId: string
): AgentInfo[] {
  const queueDir = getMessageQueueDirectory(projectRoot);

  if (!fs.existsSync(queueDir)) {
    return [];
  }

  const agents: AgentInfo[] = [];
  const now = Date.now();

  const entries = fs.readdirSync(queueDir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const infoPath = path.join(queueDir, entry.name, 'agent-info.json');
    if (!fs.existsSync(infoPath)) continue;

    try {
      const info: AgentInfo = JSON.parse(fs.readFileSync(infoPath, 'utf-8'));

      // Check if active (recent heartbeat) and not self
      const isActive =
        info.status === 'active' &&
        now - info.lastHeartbeat < ACTIVE_THRESHOLD_LIST;

      // Exclude self (check both full ID and session ID prefix)
      // If excludeAgentId is "default", match "default-gemini-pro-12345678"
      const isSelf =
        info.agentId === excludeAgentId ||
        entry.name === excludeAgentId ||
        entry.name.startsWith(excludeAgentId + '-');

      if (isActive && !isSelf) {
        agents.push(info);
      }
    } catch {
      // Ignore parse errors
    }
  }

  return agents.sort((a, b) => (a.alias || '').localeCompare(b.alias || ''));
}

/**
 * Resolve alias or partial ID to full agent ID.
 *
 * Prefers active agents over disconnected ones. If multiple agents match
 * the alias (e.g., from old sessions), returns the active one.
 *
 * @param projectRoot - Project root directory containing .sigma (used when IPC_SIGMA_BUS is not set)
 * @param aliasOrId - Alias (e.g., "opus1"), full agent ID, or directory name
 * @returns Full agent ID if found, null otherwise
 */
export function resolveAgentId(
  projectRoot: string,
  aliasOrId: string
): string | null {
  const queueDir = getMessageQueueDirectory(projectRoot);

  if (!fs.existsSync(queueDir)) {
    return null;
  }

  const entries = fs.readdirSync(queueDir, { withFileTypes: true });
  const now = Date.now();
  let fallbackAgentId: string | null = null;

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const infoPath = path.join(queueDir, entry.name, 'agent-info.json');
    if (!fs.existsSync(infoPath)) continue;

    try {
      const info: AgentInfo = JSON.parse(fs.readFileSync(infoPath, 'utf-8'));
      const isActive =
        info.status === 'active' &&
        now - info.lastHeartbeat < ACTIVE_THRESHOLD_RESOLVE;

      // Match by alias (case-insensitive), full agent ID, or directory name
      const aliasMatch =
        info.alias && info.alias.toLowerCase() === aliasOrId.toLowerCase();
      const idMatch = info.agentId === aliasOrId;
      const dirMatch = entry.name === aliasOrId;

      if (aliasMatch || idMatch || dirMatch) {
        if (isActive) {
          // Found active agent - return immediately
          return info.agentId;
        } else if (!fallbackAgentId) {
          // Store first disconnected match as fallback
          fallbackAgentId = info.agentId;
        }
      }
    } catch {
      // Ignore parse errors
    }
  }

  // Return fallback if no active agent found
  return fallbackAgentId;
}
