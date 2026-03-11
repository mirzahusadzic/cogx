/**
 * AgentMessageDTO (Data Transfer Object)
 *
 * This interface defines the "Wire Format" for messages transmitted over the
 * ZeroMQ bus. It is optimized for low-latency, cross-process communication.
 *
 * KEY SHORTENING RATIONALE:
 * In high-frequency messaging environments (like TUI updates or streaming tokens),
 * reducing the size of JSON keys can significantly lower bandwidth usage and
 * parsing overhead.
 */
export interface AgentMessageDTO<T = unknown> {
  /** Protocol Version (e.g., "1.0") */
  v: string;

  /** Message Unique Identifier (UUID v4) */
  mid: string;

  /** Unix Timestamp (milliseconds) */
  ts: number;

  /** Message Topic (e.g., 'task.progress') */
  top: string;

  /** Source Agent ID (sender) */
  src: string;

  /** Destination Agent ID (recipient or '*' for broadcast) */
  dst: string;

  /** Topic-specific data payload */
  pay: T;

  /** Optional network or routing metadata */
  meta?: Record<string, string>;
}
