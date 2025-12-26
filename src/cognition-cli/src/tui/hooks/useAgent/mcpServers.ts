import type { McpSdkServerConfigWithInstance } from '../sdk/types.js';

/**
 * McpServerBuilder - Centralizes the construction of MCP server configurations.
 *
 * DESIGN RATIONALE:
 * The original useAgent.ts had a standalone McpServerBuilder function.
 * This refactor encapsulates that logic into a "Builder" pattern
 * to manage the complexity of MCP server composition.
 */
export class McpServerBuilder {
  private servers: Record<string, McpSdkServerConfigWithInstance> = {};

  constructor(
    private options: {
      recallServer: McpSdkServerConfigWithInstance | null;
      backgroundTasksServer: McpSdkServerConfigWithInstance | null;
      agentMessagingServer: McpSdkServerConfigWithInstance | null;
      crossProjectQueryServer: McpSdkServerConfigWithInstance | null;
      sigmaTaskUpdateServer: McpSdkServerConfigWithInstance | null;
      hasConversationHistory: boolean;
    }
  ) {}

  /**
   * Builds and returns the MCP servers record based on provided options and state.
   */
  build(): Record<string, McpSdkServerConfigWithInstance> | undefined {
    this.servers = {};

    // Recall server: only enable when there's conversation history
    if (this.options.recallServer && this.options.hasConversationHistory) {
      this.servers['conversation-memory'] = this.options.recallServer;
    }

    // Background tasks server: always enable when available
    if (this.options.backgroundTasksServer) {
      this.servers['background-tasks'] = this.options.backgroundTasksServer;
    }

    // Agent messaging server: always enable when available
    if (this.options.agentMessagingServer) {
      this.servers['agent-messaging'] = this.options.agentMessagingServer;
    }

    // Cross-project query server: always enable when available
    if (this.options.crossProjectQueryServer) {
      this.servers['cross-project-query'] =
        this.options.crossProjectQueryServer;
    }

    // SigmaTaskUpdate server: always enable when available
    if (this.options.sigmaTaskUpdateServer) {
      this.servers['sigma-task-update'] = this.options.sigmaTaskUpdateServer;
    }

    return Object.keys(this.servers).length > 0 ? this.servers : undefined;
  }
}
