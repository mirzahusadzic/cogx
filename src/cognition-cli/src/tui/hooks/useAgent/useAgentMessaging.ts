import { useEffect } from 'react';
import { formatPendingMessages } from '../../../ipc/agent-messaging-formatters.js';
import { useAgentBaseContext } from '../../contexts/AgentContext.js';

export function useAgentMessaging() {
  const { options, state } = useAgentBaseContext();
  const { getMessageQueue, autoResponse } = options;
  const {
    setPendingMessageNotification,
    setShouldAutoRespond,
    setMessages,
    autoResponseTimestamps,
  } = state;

  const AUTO_RESPONSE_WINDOW_MS = 60000;
  const AUTO_RESPONSE_MAX_IN_WINDOW = 5;

  useEffect(() => {
    if (!getMessageQueue) return;

    let previousCount = 0;
    let cleanup: (() => void) | null = null;
    let pollInterval: ReturnType<typeof setInterval> | null = null;

    const handleCountChanged = async (...args: unknown[]) => {
      const newCount = args[0] as number;

      if (newCount > previousCount && newCount > 0) {
        const queue = getMessageQueue();
        if (queue) {
          const pendingMessages = await queue.getMessages('pending');
          if (pendingMessages.length > 0) {
            const formattedMessages = formatPendingMessages(pendingMessages);
            const notification = `📬 **New messages from other agents:**\n\n${formattedMessages}\n\nPlease acknowledge and respond to these messages.`;
            setPendingMessageNotification(notification);

            if (autoResponse) {
              const now = Date.now();
              const windowStart = now - AUTO_RESPONSE_WINDOW_MS;
              autoResponseTimestamps.current =
                autoResponseTimestamps.current.filter(
                  (t: number) => t > windowStart
                );

              if (
                autoResponseTimestamps.current.length <
                AUTO_RESPONSE_MAX_IN_WINDOW
              ) {
                autoResponseTimestamps.current.push(now);
                setShouldAutoRespond(true);
              } else {
                setMessages((prev) => [
                  ...prev,
                  {
                    type: 'system',
                    content: `⚠️ Auto-response rate limit hit (${AUTO_RESPONSE_MAX_IN_WINDOW}/min). Send a message to respond.`,
                    timestamp: new Date(),
                  },
                ]);
              }
            }

            setMessages((prev) => [
              ...prev,
              {
                type: 'system',
                content: `📬 ${pendingMessages.length} pending message${pendingMessages.length > 1 ? 's' : ''} injected into context`,
                timestamp: new Date(),
              },
            ]);
          }
        }
      }

      previousCount = newCount;
    };

    const setupListener = () => {
      const queue = getMessageQueue();
      if (!queue) return false;

      queue.on('countChanged', handleCountChanged);

      queue.getPendingCount().then((count: number) => {
        previousCount = count;
      });

      cleanup = () => {
        queue.off('countChanged', handleCountChanged);
      };

      return true;
    };

    if (!setupListener()) {
      pollInterval = setInterval(() => {
        if (setupListener() && pollInterval) {
          clearInterval(pollInterval);
          pollInterval = null;
        }
      }, 500);
    }

    return () => {
      if (pollInterval) clearInterval(pollInterval);
      if (cleanup) cleanup();
    };
  }, [
    getMessageQueue,
    autoResponse,
    setPendingMessageNotification,
    setShouldAutoRespond,
    setMessages,
    autoResponseTimestamps,
  ]);
}
