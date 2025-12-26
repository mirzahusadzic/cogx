import { useCallback } from 'react';
import path from 'path';
import fs from 'fs';
import type { AgentState } from './useAgentState.js';
import type { UseSessionManagerResult } from '../session/useSessionManager.js';
import type { UseTurnAnalysisReturn } from '../analysis/useTurnAnalysis.js';
import type { useTokenCount } from '../tokens/useTokenCount.js';
import type { AnalysisQueueStatus } from '../analysis/types.js';
import { createPendingTurnNode } from '../../../sigma/utils/nodeUtils.js';

interface UseAgentCompressionHandlerOptions {
  state: AgentState;
  sessionManager: UseSessionManagerResult;
  turnAnalysis: UseTurnAnalysisReturn;
  tokenCounter: ReturnType<typeof useTokenCount>;
  cwd: string;
  debug: (message: string, ...args: unknown[]) => void;
  currentSessionId: string;
  anchorId: string;
  modelName?: string;
  // Optional override for compression target size
  compressionTargetSize?: number;
}

// Model-specific configurations
const MODEL_CONFIGS: Record<
  string,
  { compressionTarget: number; requiresReprompt: boolean }
> = {
  gemini: { compressionTarget: 120000, requiresReprompt: true }, // Gemini 1.5/2.0+ large context
  claude: { compressionTarget: 40000, requiresReprompt: false }, // Claude standard
  gpt: { compressionTarget: 20000, requiresReprompt: false }, // GPT-4o
};

function getModelConfig(modelName?: string) {
  const lower = (modelName || '').toLowerCase();
  if (lower.includes('gemini')) return MODEL_CONFIGS.gemini;
  if (lower.includes('claude')) return MODEL_CONFIGS.claude;
  if (lower.includes('gpt')) return MODEL_CONFIGS.gpt;
  return { compressionTarget: 40000, requiresReprompt: false }; // Default
}

export function useAgentCompressionHandler({
  state,
  sessionManager,
  turnAnalysis,
  tokenCounter,
  cwd,
  debug,
  currentSessionId,
  anchorId,
  modelName,
  compressionTargetSize,
}: UseAgentCompressionHandlerOptions) {
  const {
    messages,
    setMessages,
    setIsThinking,
    setInjectedRecap,
    setShouldAutoRespond,
    compressionInProgressRef,
    conversationRegistryRef,
  } = state;

  const updateProgress = useCallback(
    (
      progressMessageIndex: number,
      processed: number,
      total: number,
      elapsed: number
    ) => {
      const elapsedSecs = (elapsed / 1000).toFixed(1);
      const barLength = 10;
      const filled = Math.floor((processed / total) * barLength) || 0;
      const empty = Math.max(0, barLength - filled);
      const progressBar = '[' + '▓'.repeat(filled) + '░'.repeat(empty) + ']';

      setMessages((prev) => {
        if (progressMessageIndex < 0 || progressMessageIndex >= prev.length) {
          return prev;
        }
        const updated = [...prev];
        updated[progressMessageIndex] = {
          ...prev[progressMessageIndex],
          content:
            `⏳ Analyzing conversation turns... ${progressBar} ${processed}/${total}\n` +
            `   Elapsed: ${elapsedSecs}s`,
        };
        return updated;
      });
    },
    [setMessages]
  );

  const handleCompressionTriggered = useCallback(
    async (tokens: number, turns: number, isSemanticEvent: boolean = false) => {
      if (compressionInProgressRef.current) {
        debug(
          '⏭️  Compression already in progress, skipping duplicate request'
        );
        return;
      }

      compressionInProgressRef.current = true;

      try {
        const compressionSessionId = currentSessionId;
        debug(`🗜️  Triggering compression (semantic: ${isSemanticEvent})`);

        // 1. Initialize Progress Message
        let progressMessageIndex = -1;
        setMessages((prev) => {
          progressMessageIndex = prev.length;
          return [
            ...prev,
            {
              type: 'system',
              content:
                `⏳ Preparing context compression at ${(tokens / 1000).toFixed(1)}K tokens\n` +
                `   Analyzing ${turns} conversation turns (this may take 5-10s)...`,
              timestamp: new Date(),
            },
          ];
        });

        const startTime = Date.now();
        const timeout = parseInt(
          process.env.SIGMA_COMPRESSION_TIMEOUT_MS || '60000',
          10
        );

        // 2. Wait for Analysis to Complete
        let lastProgressUpdate = 0;
        const PROGRESS_THROTTLE_MS = 500;

        try {
          await turnAnalysis.waitForCompressionReady(
            timeout,
            (elapsed: number, status: AnalysisQueueStatus) => {
              const now = Date.now();
              if (now - lastProgressUpdate < PROGRESS_THROTTLE_MS) {
                return;
              }
              lastProgressUpdate = now;
              const total = status.totalProcessed + status.queueLength;
              updateProgress(
                progressMessageIndex,
                status.totalProcessed,
                total,
                elapsed
              );
            }
          );
        } catch (waitError) {
          const timeoutSecs = ((Date.now() - startTime) / 1000).toFixed(1);
          setMessages((prev) => [
            ...prev,
            {
              type: 'system',
              content:
                `⚠️  Analysis timeout after ${timeoutSecs}s\n` +
                `   Compression postponed - your conversation continues normally`,
              timestamp: new Date(),
            },
          ]);
          console.error(
            '[Σ] Compression aborted: analysis queue timeout',
            waitError
          );
          return;
        }

        // Final progress update
        const waitTime = Date.now() - startTime;
        const finalStatus = turnAnalysis.queueStatus;
        updateProgress(
          progressMessageIndex,
          finalStatus.totalProcessed,
          finalStatus.totalProcessed,
          waitTime
        );

        setMessages((prev) => [
          ...prev,
          {
            type: 'system',
            content: `✓ Analysis complete (${(waitTime / 1000).toFixed(1)}s) - compressing conversation...`,
            timestamp: new Date(),
          },
        ]);

        // 3. Identify Pending Turn (to preserve verbatim)
        const lastMessage = messages[messages.length - 1];
        const lastAnalyzed =
          turnAnalysis.analyses[turnAnalysis.analyses.length - 1];
        const hasPendingTurn =
          lastMessage &&
          lastMessage.type !== 'system' &&
          lastMessage.type !== 'tool_progress' &&
          (!lastAnalyzed ||
            lastMessage.timestamp.getTime() > lastAnalyzed.timestamp);

        const pendingTurn = hasPendingTurn
          ? {
              message: lastMessage,
              timestamp: lastMessage.timestamp.getTime(),
            }
          : null;

        setMessages((prev) => [
          ...prev,
          {
            type: 'system',
            content:
              `🗜️  Context compression triggered at ${(tokens / 1000).toFixed(1)}K tokens\n` +
              `Compressing ${turns} turns into intelligent recap...`,
            timestamp: new Date(),
          },
        ]);

        setIsThinking(true);

        try {
          // Dynamic imports
          const { compressContext } =
            await import('../../../sigma/compressor.js');
          const { reconstructSessionContext } =
            await import('../../../sigma/context-reconstructor.js');
          const { loadSessionState } =
            await import('../../../sigma/session-state.js');

          // Determine target size
          const modelConfig = getModelConfig(modelName);
          const targetSize =
            compressionTargetSize || modelConfig.compressionTarget;

          const result = await compressContext(turnAnalysis.analyses, {
            target_size: targetSize,
          });

          // Inject pending turn into lattice if needed
          const latticeWithPending = { ...result.lattice };
          if (pendingTurn) {
            const pendingNode = createPendingTurnNode(
              pendingTurn.message,
              pendingTurn.timestamp
            );
            latticeWithPending.nodes = [...result.lattice.nodes, pendingNode];
          }

          const sessionState = loadSessionState(anchorId, cwd);

          const sessionContext = await reconstructSessionContext(
            latticeWithPending,
            cwd,
            conversationRegistryRef.current || undefined,
            modelName,
            sessionState?.todos || undefined
          );

          const recap =
            `COMPRESSED CONVERSATION RECAP (${latticeWithPending.nodes.length} key turns)\n` +
            `${(tokens / 1000).toFixed(1)}K → ${(result.compressed_size / 1000).toFixed(1)}K tokens\n\n` +
            sessionContext.recap;

          // 4. Persist Recap
          try {
            fs.writeFileSync(
              path.join(cwd, '.sigma', `${compressionSessionId}.recap.txt`),
              recap,
              'utf-8'
            );
          } catch (err) {
            console.error('Failed to save recap file:', err);
            setMessages((prev) => [
              ...prev,
              {
                type: 'system',
                content:
                  '⚠️ Recap generated but failed to save to disk. Session resume may be affected.',
                timestamp: new Date(),
              },
            ]);
          }

          setInjectedRecap(recap);
          tokenCounter.reset();

          if (pendingTurn) {
            await turnAnalysis.enqueueAnalysis({
              message: pendingTurn.message,
              messageIndex: messages.length - 1, // Approximate index, fine for requeue
              timestamp: pendingTurn.timestamp,
            });
          }

          setMessages((prev) => [
            ...prev,
            {
              type: 'system',
              content:
                `✅ Compression complete!\n` +
                `   ${result.lattice.nodes.length} key turns preserved (${(tokens / 1000).toFixed(1)}K → ${(result.compressed_size / 1000).toFixed(1)}K tokens)\n` +
                `   Conversation continues with intelligent recap...`,
              timestamp: new Date(),
            },
          ]);

          if (modelConfig.requiresReprompt) {
            setShouldAutoRespond(true);
          }
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          setMessages((prev) => [
            ...prev,
            {
              type: 'system',
              content:
                `❌ Context compression failed: ${errorMessage}\n` +
                `   Starting fresh session anyway to prevent token limit issues.\n` +
                `   Note: Previous context will be lost to the AI, though visible above.`,
              timestamp: new Date(),
            },
          ]);
        } finally {
          sessionManager.resetResumeSession();
        }
      } finally {
        compressionInProgressRef.current = false;
      }
    },
    [
      debug,
      messages,
      turnAnalysis,
      cwd,
      currentSessionId,
      sessionManager,
      setMessages,
      setIsThinking,
      setInjectedRecap,
      setShouldAutoRespond,
      compressionInProgressRef,
      conversationRegistryRef,
      anchorId,
      modelName,
      compressionTargetSize,
      updateProgress,
      tokenCounter,
    ]
  );

  return handleCompressionTriggered;
}
