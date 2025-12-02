/**
 * ZeroMQ Pub/Sub Message Protocol
 *
 * Defines message types for inter-agent communication.
 * Each message has a topic (category.action) and a typed payload.
 */

// Base message structure
export interface AgentMessage<T = unknown> {
  id: string; // Unique message ID (uuid)
  from: string; // Sender agent ID (e.g., 'gemini-1', 'claude-1')
  to: string; // Recipient agent ID (e.g., 'claude-1') or '*' for broadcast
  timestamp: number; // Unix timestamp (milliseconds)
  topic: string; // Event topic (e.g., 'code.completed')
  payload: T; // Topic-specific payload
}

// ============================================================================
// Code Collaboration Messages
// ============================================================================

export interface CodeCompletedPayload {
  files: string[]; // Modified files
  summary: string; // What was implemented
  requestReview: boolean; // Should Opus review?
  branch?: string; // Git branch (if applicable)
}

export type CodeCompletedMessage = AgentMessage<CodeCompletedPayload>;

export interface ReviewRequestedPayload {
  files: string[]; // Files to review
  context: string; // What to look for
  priority: 'low' | 'normal' | 'high';
}

export type ReviewRequestedMessage = AgentMessage<ReviewRequestedPayload>;

export interface ReviewIssue {
  file: string;
  line: number;
  severity: 'error' | 'warning' | 'suggestion';
  message: string;
}

export interface ReviewCompletedPayload {
  files: string[];
  issues: ReviewIssue[];
  approved: boolean;
  summary: string;
}

export type ReviewCompletedMessage = AgentMessage<ReviewCompletedPayload>;

// ============================================================================
// Architecture Collaboration Messages
// ============================================================================

export interface ArchProposalPayload {
  title: string;
  description: string;
  diagrams?: string[]; // ASCII diagrams or mermaid
  tradeoffs: string;
  recommendation: string;
}

export type ArchProposalMessage = AgentMessage<ArchProposalPayload>;

// ============================================================================
// Agent-to-Agent Communication
// ============================================================================

export interface AgentQuestionPayload {
  to: string; // Target agent ID
  question: string;
  context?: string;
}

export type AgentQuestionMessage = AgentMessage<AgentQuestionPayload>;

export interface AgentAnswerPayload {
  questionId: string; // Original question message ID
  answer: string;
}

export type AgentAnswerMessage = AgentMessage<AgentAnswerPayload>;

// ============================================================================
// Task Management Messages
// ============================================================================

export interface TaskStartedPayload {
  taskId: string;
  command: string; // e.g., '/onboard-project'
  args?: string[];
}

export type TaskStartedMessage = AgentMessage<TaskStartedPayload>;

export interface TaskProgressPayload {
  taskId: string;
  progress: number; // 0-100
  message: string;
}

export type TaskProgressMessage = AgentMessage<TaskProgressPayload>;

export interface TaskCompletedPayload {
  taskId: string;
  command: string;
  result: unknown; // Command-specific result
  durationMs: number;
}

export type TaskCompletedMessage = AgentMessage<TaskCompletedPayload>;

export interface TaskFailedPayload {
  taskId: string;
  command: string;
  error: string;
  durationMs: number;
}

export type TaskFailedMessage = AgentMessage<TaskFailedPayload>;

// ============================================================================
// Agent Registry Messages
// ============================================================================

export interface AgentRegisteredPayload {
  agentId: string;
  model: string; // 'gemini', 'claude', 'opus'
  type: 'interactive' | 'background';
  capabilities: string[]; // ['code_review', 'architecture_design']
}

export type AgentRegisteredMessage = AgentMessage<AgentRegisteredPayload>;

export interface AgentUnregisteredPayload {
  agentId: string;
}

export type AgentUnregisteredMessage = AgentMessage<AgentUnregisteredPayload>;

export interface AgentStatusChangedPayload {
  agentId: string;
  status: 'idle' | 'thinking' | 'working';
}

export type AgentStatusChangedMessage = AgentMessage<AgentStatusChangedPayload>;

// ============================================================================
// User Input Messages (for interactive prompts)
// ============================================================================

export interface UserInputRequestedPayload {
  requestId: string;
  prompt: string;
  type: 'text' | 'confirm' | 'select';
  options?: string[]; // For 'select' type
}

export type UserInputRequestedMessage = AgentMessage<UserInputRequestedPayload>;

export interface UserInputProvidedPayload {
  requestId: string;
  value: string | boolean;
}

export type UserInputProvidedMessage = AgentMessage<UserInputProvidedPayload>;

// ============================================================================
// Topic Constants
// ============================================================================

export const Topics = {
  // Code collaboration
  CODE_COMPLETED: 'code.completed',
  CODE_REVIEW_REQUESTED: 'code.review_requested',
  CODE_REVIEW_COMPLETED: 'code.review_completed',

  // Architecture collaboration
  ARCH_PROPOSAL_READY: 'arch.proposal_ready',
  ARCH_FEEDBACK: 'arch.feedback',

  // Agent communication
  AGENT_QUESTION: 'agent.question',
  AGENT_ANSWER: 'agent.answer',
  AGENT_REGISTERED: 'agent.registered',
  AGENT_UNREGISTERED: 'agent.unregistered',
  AGENT_STATUS_CHANGED: 'agent.status_changed',

  // Task management
  TASK_STARTED: 'task.started',
  TASK_PROGRESS: 'task.progress',
  TASK_COMPLETED: 'task.completed',
  TASK_FAILED: 'task.failed',

  // User input
  USER_INPUT_REQUESTED: 'user.input_requested',
  USER_INPUT_PROVIDED: 'user.input_provided',

  // Meta
  META_NEW_TOPIC: 'meta.new_topic',
} as const;

// ============================================================================
// Message Factory
// ============================================================================

export class MessageFactory {
  /**
   * Create a new message with auto-generated ID and timestamp
   */
  static create<T>(
    from: string,
    to: string,
    topic: string,
    payload: T
  ): AgentMessage<T> {
    return {
      id: crypto.randomUUID(),
      from,
      to,
      timestamp: Date.now(),
      topic,
      payload,
    };
  }

  // Convenience methods for common message types
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
