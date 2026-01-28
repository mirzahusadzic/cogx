import { useState, useEffect, useRef, useMemo } from 'react';
import { MessageQueueMonitor } from '../../ipc/MessageQueueMonitor.js';
import { MessageQueue } from '../../ipc/MessageQueue.js';
import { MessagePublisher } from '../../ipc/MessagePublisher.js';
import { BusCoordinator } from '../../ipc/BusCoordinator.js';
import { getSigmaDirectory } from '../../ipc/sigma-directory.js';
import { systemLog } from '../../utils/debug-logger.js';

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
  const [pendingMessageCount, setPendingMessageCount] = useState(0);
  const [monitorError, setMonitorError] = useState<string | null>(null);
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
        const sigmaDir = getSigmaDirectory(projectRoot);

        const coordinator = new BusCoordinator(projectRoot);
        const bus = await coordinator.connectWithFallback();

        if (!mounted) return;

        const topics = ['agent.command', 'agent.notification', 'agent.message'];
        const modelName = model || provider || 'agent';

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
          setPendingMessageCount(count);
        };

        messageQueue.on('countChanged', handleCountChanged);

        const initialCount = await messageQueue.getPendingCount();
        setPendingMessageCount(initialCount);
        setMonitorError(null);

        cleanupFn = () => {
          messageQueue.off('countChanged', handleCountChanged);
          monitor.stop().catch((err) => {
            if (debug) {
              systemLog('tui', `[MessageQueueMonitor] Stop error: ${err}`);
            }
          });
        };
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        setMonitorError(`Failed to initialize message monitor: ${errorMsg}`);
        if (debug) {
          systemLog(
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

  return useMemo(
    () => ({ pendingMessageCount, monitorError }),
    [pendingMessageCount, monitorError]
  );
}
