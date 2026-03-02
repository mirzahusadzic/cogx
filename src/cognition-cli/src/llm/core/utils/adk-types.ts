import { Session, Event } from '@google/adk';

/**
 * Internal ADK Event interface for streaming and history.
 */
export interface AdkEvent extends Event {
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    thoughtsTokenCount?: number;
    totalTokenCount?: number;
    cachedContentTokenCount?: number;
  };
  errorCode?: string;
  errorMessage?: string;
  content?: {
    parts?: Array<{
      text?: string;
      thought?: boolean;
      thoughtSignature?: string;
      functionCall?: { name: string; args: Record<string, unknown> };
      functionResponse?: { name: string; response: Record<string, unknown> };
    }>;
  };
}

/**
 * Internal ADK Session interface for history inspection.
 */
export interface AdkSession extends Session {
  events: AdkEvent[];
  sessionId: string;
}

/**
 * Internal storage structure for InMemorySessionService.
 */
export interface AdkSessionService {
  sessions: Record<
    string, // appName
    Record<
      string, // userId
      Record<string, AdkSession> // sessionId -> Session
    >
  >;
}
