import { describe, it, expect } from 'vitest';
import { McpServerBuilder } from '../../../useAgent/mcpServers.js';
import type { McpSdkServerConfigWithInstance } from '../../../sdk/types.js';

describe('McpServerBuilder', () => {
  const mockServer = {} as McpSdkServerConfigWithInstance;

  it('should return undefined when no servers are provided', () => {
    const builder = new McpServerBuilder({
      recallServer: null,
      backgroundTasksServer: null,
      agentMessagingServer: null,
      crossProjectQueryServer: null,
      sigmaTaskUpdateServer: null,
      hasConversationHistory: false,
    });
    expect(builder.build()).toBeUndefined();
  });

  it('should include recall server only when hasConversationHistory is true', () => {
    const builderWithHistory = new McpServerBuilder({
      recallServer: mockServer,
      backgroundTasksServer: null,
      agentMessagingServer: null,
      crossProjectQueryServer: null,
      sigmaTaskUpdateServer: null,
      hasConversationHistory: true,
    });
    expect(builderWithHistory.build()).toEqual({
      'conversation-memory': mockServer,
    });

    const builderWithoutHistory = new McpServerBuilder({
      recallServer: mockServer,
      backgroundTasksServer: null,
      agentMessagingServer: null,
      crossProjectQueryServer: null,
      sigmaTaskUpdateServer: null,
      hasConversationHistory: false,
    });
    expect(builderWithoutHistory.build()).toBeUndefined();
  });

  it('should include other servers regardless of history', () => {
    const builder = new McpServerBuilder({
      recallServer: null,
      backgroundTasksServer: mockServer,
      agentMessagingServer: mockServer,
      crossProjectQueryServer: mockServer,
      sigmaTaskUpdateServer: mockServer,
      hasConversationHistory: false,
    });
    const result = builder.build();
    expect(result).toEqual({
      'background-tasks': mockServer,
      'agent-messaging': mockServer,
      'cross-project-query': mockServer,
      'sigma-task-update': mockServer,
    });
  });
});
