import { useEffect } from 'react';
import path from 'path';
import fs from 'fs';
import chalk from 'chalk';
import { EmbeddingService } from '../../../core/services/embedding.js';
import { ConversationOverlayRegistry } from '../../../sigma/conversation-registry.js';
import { createRecallMcpServer } from '../../../sigma/recall-tool.js';
import { getBackgroundTaskManager } from '../../services/BackgroundTaskManager.js';
import { createBackgroundTasksMcpServer } from '../../tools/background-tasks-tool.js';
import { createAgentMessagingMcpServer } from '../../tools/agent-messaging-tool.js';
import { createCrossProjectQueryMcpServer } from '../../tools/cross-project-query-tool.js';
import { createSigmaTaskUpdateMcpServer } from '../../tools/sigma-task-update-tool.js';
import { OverlayRegistry } from '../../../core/algebra/overlay-registry.js';
import { checkWorkbenchHealthDetailed } from '../../../utils/workbench-detect.js';
import { loadCommands } from '../../commands/loader.js';
import type { UseAgentOptions } from './types.js';
import type { AgentState } from './useAgentState.js';

interface UseAgentServicesOptions {
  options: UseAgentOptions;
  state: AgentState;
  anchorId: string;
  addSystemMessage: (content: string) => void;
}

export function useAgentServices({
  options,
  state,
  anchorId,
  addSystemMessage,
}: UseAgentServicesOptions) {
  const {
    cwd,
    debug: debugFlag,
    initialWorkbenchHealth,
    getMessagePublisher,
    getMessageQueue,
    sessionId: sessionIdProp,
  } = options;
  const {
    embedderRef,
    conversationRegistryRef,
    recallMcpServerRef,
    backgroundTaskManagerRef,
    backgroundTasksMcpServerRef,
    agentMessagingMcpServerRef,
    crossProjectQueryMcpServerRef,
    sigmaTaskUpdateMcpServerRef,
    projectRegistryRef,
    setWorkbenchHealth,
    setCommandsCache,
  } = state;

  // Initialize LLM providers
  useEffect(() => {
    const initProviders = async () => {
      try {
        const { initializeProviders } = await import('../../../llm/index.js');
        await initializeProviders();
        if (debugFlag) {
          const { registry } = await import('../../../llm/index.js');
          console.log(
            chalk.dim('[Σ] LLM providers initialized:'),
            registry.list().join(', ')
          );
        }
      } catch (error) {
        console.error(
          'Failed to initialize LLM providers:',
          error instanceof Error ? error.message : String(error)
        );
      }
    };

    initProviders();
  }, [debugFlag]);

  // Initialize Sigma services
  useEffect(() => {
    const initSigmaServices = async () => {
      const endpoint = process.env.WORKBENCH_URL || 'http://localhost:8000';
      embedderRef.current = new EmbeddingService(endpoint);
      const sigmaPath = path.join(cwd, '.sigma');
      conversationRegistryRef.current = new ConversationOverlayRegistry(
        sigmaPath,
        endpoint,
        debugFlag
      );

      let claudeAgentSdkModule;
      try {
        const claudeAgentSdkName = '@anthropic-ai/claude-agent-sdk';
        claudeAgentSdkModule = await import(claudeAgentSdkName);
      } catch {
        // SDK not available
      }

      recallMcpServerRef.current = createRecallMcpServer(
        conversationRegistryRef.current,
        claudeAgentSdkModule,
        endpoint
      );

      try {
        backgroundTaskManagerRef.current = getBackgroundTaskManager(cwd);
        backgroundTasksMcpServerRef.current = createBackgroundTasksMcpServer(
          () => backgroundTaskManagerRef.current,
          claudeAgentSdkModule
        );
      } catch {
        // Task manager not needed
      }

      if (getMessagePublisher) {
        agentMessagingMcpServerRef.current = createAgentMessagingMcpServer(
          getMessagePublisher,
          getMessageQueue,
          cwd,
          sessionIdProp || 'unknown',
          claudeAgentSdkModule
        );

        crossProjectQueryMcpServerRef.current =
          createCrossProjectQueryMcpServer(
            getMessagePublisher,
            getMessageQueue,
            cwd,
            sessionIdProp || 'unknown',
            claudeAgentSdkModule,
            addSystemMessage
          );
      }

      sigmaTaskUpdateMcpServerRef.current = createSigmaTaskUpdateMcpServer(
        cwd,
        anchorId,
        claudeAgentSdkModule
      );

      const pgcPath = path.join(cwd, '.open_cognition');
      if (fs.existsSync(pgcPath))
        projectRegistryRef.current = new OverlayRegistry(pgcPath, endpoint);

      const healthResult =
        initialWorkbenchHealth ??
        (await checkWorkbenchHealthDetailed(endpoint, true));
      const hasApiKey = !!process.env.WORKBENCH_API_KEY;

      setWorkbenchHealth({
        reachable: healthResult.reachable,
        embeddingReady: healthResult.embeddingReady,
        summarizationReady: healthResult.summarizationReady,
        hasApiKey,
      });
    };

    initSigmaServices();
  }, [
    cwd,
    debugFlag,
    initialWorkbenchHealth,
    anchorId,
    sessionIdProp,
    getMessagePublisher,
    getMessageQueue,
    addSystemMessage,
    embedderRef,
    conversationRegistryRef,
    recallMcpServerRef,
    backgroundTaskManagerRef,
    backgroundTasksMcpServerRef,
    agentMessagingMcpServerRef,
    crossProjectQueryMcpServerRef,
    sigmaTaskUpdateMcpServerRef,
    projectRegistryRef,
    setWorkbenchHealth,
  ]);

  // Load slash commands
  useEffect(() => {
    loadCommands(cwd)
      .then((result) => {
        setCommandsCache(result.commands);
        if (result.errors.length > 0 && debugFlag) {
          console.error('Command loading errors:', result.errors);
        }
        if (result.warnings.length > 0 && debugFlag) {
          console.warn('Command loading warnings:', result.warnings);
        }
      })
      .catch((error) => {
        console.error('Failed to load commands:', error);
      });
  }, [cwd, debugFlag, setCommandsCache]);
}
