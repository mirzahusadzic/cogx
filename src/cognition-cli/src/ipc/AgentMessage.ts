import { Topics } from './Topics.js';
import {
  CodeCompletedPayload,
  ReviewRequestedPayload,
  ReviewCompletedPayload,
  ArchProposalPayload,
  AgentQuestionPayload,
  AgentAnswerPayload,
  TaskStartedPayload,
  TaskProgressPayload,
  TaskCompletedPayload,
  TaskFailedPayload,
  AgentRegisteredPayload,
  AgentUnregisteredPayload,
  AgentStatusChangedPayload,
  UserInputRequestedPayload,
  UserInputProvidedPayload,
} from './Payloads.js';

/**
 * AgentMessage (Domain Model)
 *
 * This class represents a rich internal message object used by agents
 * and the TUI. It is decoupled from the network wire format (DTO).
 *
 * @template T The type of the message payload.
 */
export class AgentMessage<T = unknown> {
  constructor(
    /** Unique message identifier (UUID v4) */
    public readonly id: string,

    /** The ID of the sending agent */
    public readonly from: string,

    /** The ID of the recipient agent, or '*' for broadcast */
    public readonly to: string,

    /** Unix timestamp (milliseconds) of message creation */
    public readonly timestamp: number,

    /** The message topic (e.g., 'code.completed') */
    public readonly topic: string,

    /** The topic-specific data payload */
    public readonly payload: T
  ) {}

  /**
   * Returns true if the message is a broadcast.
   */
  public isBroadcast(): boolean {
    return this.to === '*';
  }

  /**
   * Returns true if the message is intended for the given agent ID.
   * Includes broadcasts.
   */
  public isToMe(agentId: string): boolean {
    return this.to === '*' || this.to === agentId;
  }
}

// ============================================================================
// Type Aliases for common messages (for backwards compatibility & convenience)
// ============================================================================

export type CodeCompletedMessage = AgentMessage<CodeCompletedPayload>;
export type ReviewRequestedMessage = AgentMessage<ReviewRequestedPayload>;
export type ReviewCompletedMessage = AgentMessage<ReviewCompletedPayload>;
export type ArchProposalMessage = AgentMessage<ArchProposalPayload>;
export type AgentQuestionMessage = AgentMessage<AgentQuestionPayload>;
export type AgentAnswerMessage = AgentMessage<AgentAnswerPayload>;
export type TaskStartedMessage = AgentMessage<TaskStartedPayload>;
export type TaskProgressMessage = AgentMessage<TaskProgressPayload>;
export type TaskCompletedMessage = AgentMessage<TaskCompletedPayload>;
export type TaskFailedMessage = AgentMessage<TaskFailedPayload>;
export type AgentRegisteredMessage = AgentMessage<AgentRegisteredPayload>;
export type AgentUnregisteredMessage = AgentMessage<AgentUnregisteredPayload>;
export type AgentStatusChangedMessage = AgentMessage<AgentStatusChangedPayload>;
export type UserInputRequestedMessage = AgentMessage<UserInputRequestedPayload>;
export type UserInputProvidedMessage = AgentMessage<UserInputProvidedPayload>;

// ============================================================================
// Message Factory
// ============================================================================

/**
 * A factory class for creating `AgentMessage` instances.
 *
 * Handles automatic generation of IDs and timestamps.
 */
export class MessageFactory {
  /**
   * Creates a new `AgentMessage` with a generated ID and timestamp.
   */
  static create<T>(
    from: string,
    to: string,
    topic: string,
    payload: T
  ): AgentMessage<T> {
    return new AgentMessage(
      crypto.randomUUID(),
      from,
      to,
      Date.now(),
      topic,
      payload
    );
  }

  // Convenience methods

  static codeCompleted(
    from: string,
    to: string,
    payload: CodeCompletedPayload
  ): CodeCompletedMessage {
    return this.create(from, to, Topics.CODE_COMPLETED, payload);
  }

  static reviewRequested(
    from: string,
    to: string,
    payload: ReviewRequestedPayload
  ): ReviewRequestedMessage {
    return this.create(from, to, Topics.CODE_REVIEW_REQUESTED, payload);
  }

  static reviewCompleted(
    from: string,
    to: string,
    payload: ReviewCompletedPayload
  ): ReviewCompletedMessage {
    return this.create(from, to, Topics.CODE_REVIEW_COMPLETED, payload);
  }

  static archProposal(
    from: string,
    to: string,
    payload: ArchProposalPayload
  ): ArchProposalMessage {
    return this.create(from, to, Topics.ARCH_PROPOSAL_READY, payload);
  }

  static agentQuestion(
    from: string,
    to: string,
    payload: AgentQuestionPayload
  ): AgentQuestionMessage {
    return this.create(from, to, Topics.AGENT_QUESTION, payload);
  }

  static agentRegistered(
    from: string,
    to: string,
    payload: AgentRegisteredPayload
  ): AgentRegisteredMessage {
    return this.create(from, to, Topics.AGENT_REGISTERED, payload);
  }

  static taskStarted(
    from: string,
    to: string,
    payload: TaskStartedPayload
  ): TaskStartedMessage {
    return this.create(from, to, Topics.TASK_STARTED, payload);
  }

  static taskCompleted(
    from: string,
    to: string,
    payload: TaskCompletedPayload
  ): TaskCompletedMessage {
    return this.create(from, to, Topics.TASK_COMPLETED, payload);
  }
}
