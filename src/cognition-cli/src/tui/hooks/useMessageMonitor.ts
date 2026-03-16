import { useEffect, useRef } from 'react';
import { MessageQueueMonitor } from '../../ipc/MessageQueueMonitor.js';
import { MessageQueue } from '../../ipc/MessageQueue.js';
import { MessagePublisher } from '../../ipc/MessagePublisher.js';
import { BusCoordinator } from '../../ipc/BusCoordinator.js';
import { environmentService } from '../../core/services/environment/EnvironmentService.js';
import { getModelShortName } from './session/useSessionManager.js';
import { systemDiagnosticsService } from '../../core/services/diagnostics/SystemDiagnosticsService.js';
import { tuiSyncManager } from '../../core/state/tui-sync/TUISyncManager.js';

interface UseMessageMonitorOptions {
  anchorId: string | null;
  projectRoot: string;
  debug?: boolean;
  model?: string;
  provider?: string;
  messageQueueMonitorRef: React.RefObject<MessageQueueMonitor | null>;
  messageQueueRef: React.RefObject<MessageQueue | null>;
  messagePublisherRef: React.RefObject<MessagePublisher | null>;
}

export function useMessageMonitor({
  anchorId,
  projectRoot,
  debug,
  model,
  provider,
  messageQueueMonitorRef,
  messageQueueRef,
  messagePublisherRef,
}: UseMessageMonitorOptions) {
  const monitorInitializedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!anchorId || !projectRoot) {
      return;
    }

    if (monitorInitializedRef.current === anchorId) {
      return;
    }

    if (
      messageQueueMonitorRef.current &&
      monitorInitializedRef.current !== anchorId
    ) {
      messageQueueMonitorRef.current.stop().catch(() => {});
      messageQueueMonitorRef.current = null;
      messagePublisherRef.current = null;
      messageQueueRef.current = null;
    }

    monitorInitializedRef.current = anchorId;

    let mounted = true;
    let cleanupFn: (() => void) | null = null;

    const initializeMonitor = async () => {
      try {
        const agentId = anchorId;
        const sigmaDir = environmentService.resolveSigmaDir(projectRoot);

        const coordinator = new BusCoordinator(projectRoot);
        const bus = await coordinator.connectWithFallback();

        if (!mounted) return;

        const topics = ['agent.command', 'agent.notification', 'agent.message'];
        const modelName =
          getModelShortName(model) || model || provider || 'agent';

        const monitor = new MessageQueueMonitor(
          agentId,
          bus,
          topics,
          sigmaDir,
          modelName,
          projectRoot
        );
        await monitor.start();

        if (!mounted) {
          await monitor.stop();
          return;
        }

        messageQueueMonitorRef.current = monitor;

        const monitorAgentId = monitor.getQueue().getAgentId();
        const publisher = new MessagePublisher(bus, monitorAgentId);
        messagePublisherRef.current = publisher;

        const messageQueue = monitor.getQueue();
        messageQueueRef.current = messageQueue;

        const handleCountChanged = (...args: unknown[]) => {
          const count = args[0] as number;
          tuiSyncManager.handleEvent({
            type: 'PENDING_MESSAGES_UPDATE',
            count,
          });
        };

        messageQueue.on('countChanged', handleCountChanged);

        const initialCount = await messageQueue.getPendingCount();
        tuiSyncManager.handleEvent({
          type: 'PENDING_MESSAGES_UPDATE',
          count: initialCount,
        });
        tuiSyncManager.handleEvent({ type: 'MONITOR_ERROR', error: null });

        cleanupFn = () => {
          messageQueue.off('countChanged', handleCountChanged);
          monitor.stop().catch((err) => {
            if (debug) {
              systemDiagnosticsService.systemLog(
                'tui',
                `[MessageQueueMonitor] Stop error: ${err}`
              );
            }
          });
        };
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        tuiSyncManager.handleEvent({ type: 'MONITOR_ERROR', error: errorMsg });
        if (debug) {
          systemDiagnosticsService.systemLog(
            'tui',
            `[MessageQueueMonitor] Initialization error: ${err}`
          );
        }
      }
    };

    initializeMonitor();

    return () => {
      mounted = false;
      if (cleanupFn) cleanupFn();
    };
  }, [
    anchorId,
    projectRoot,
    debug,
    model,
    provider,
    messageQueueMonitorRef,
    messagePublisherRef,
    messageQueueRef,
  ]);

  return null;
}
