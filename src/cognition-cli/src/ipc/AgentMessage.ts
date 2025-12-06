/**
 * ZeroMQ Pub/Sub Message Protocol
 *
 * Defines message types for inter-agent communication.
 * Each message has a topic (category.action) and a typed payload.
 */

// Base message structure
/**
 * Represents a generic message for inter-agent communication.
 *
 * This is the foundational interface for all messages exchanged over the
 * ZeroMQ bus. It defines the essential fields required for routing,
 * identification, and processing.
 *
 * @interface AgentMessage
 * @template T The type of the message payload.
 *
 * @property {string} id Unique message identifier (UUID v4).
 * @property {string} from The ID of the sending agent.
 * @property {string} to The ID of the recipient agent, or '*' for broadcast.
 * @property {number} timestamp Unix timestamp (in milliseconds) of message creation.
 * @property {string} topic The message topic (e.g., 'code.completed').
 * @property {T} payload The topic-specific data payload.
 */
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

/**
 * Payload for a message indicating code completion.
 *
 * @interface CodeCompletedPayload
 * @property {string[]} files List of file paths that were modified.
 * @property {string} summary A brief summary of the changes implemented.
 * @property {boolean} requestReview If true, an Opus agent should review the code.
 * @property {string} [branch] The Git branch where the changes were made, if applicable.
 */
export interface CodeCompletedPayload {
  files: string[]; // Modified files
  summary: string; // What was implemented
  requestReview: boolean; // Should Opus review?
  branch?: string; // Git branch (if applicable)
}

/**
 * Message sent when a coding task is completed.
 *
 * @typedef {AgentMessage<CodeCompletedPayload>} CodeCompletedMessage
 */
export type CodeCompletedMessage = AgentMessage<CodeCompletedPayload>;

/**
 * Payload for a message requesting a code review.
 *
 * @interface ReviewRequestedPayload
 * @property {string[]} files List of file paths to be reviewed.
 * @property {string} context Specific instructions or context for the reviewer.
 * @property {'low' | 'normal' | 'high'} priority The priority of the review request.
 */
export interface ReviewRequestedPayload {
  files: string[]; // Files to review
  context: string; // What to look for
  priority: 'low' | 'normal' | 'high';
}

/**
 * Message sent to request a code review from another agent.
 *
 * @typedef {AgentMessage<ReviewRequestedPayload>} ReviewRequestedMessage
 */
export type ReviewRequestedMessage = AgentMessage<ReviewRequestedPayload>;

/**
 * Represents a single issue found during a code review.
 *
 * @interface ReviewIssue
 * @property {string} file The file where the issue was found.
 * @property {number} line The line number of the issue.
 * @property {'error' | 'warning' | 'suggestion'} severity The severity of the issue.
 * @property {string} message A description of the issue.
 */
export interface ReviewIssue {
  file: string;
  line: number;
  severity: 'error' | 'warning' | 'suggestion';
  message: string;
}

/**
 * Payload for a message indicating a code review is complete.
 *
 * @interface ReviewCompletedPayload
 * @property {string[]} files List of file paths that were reviewed.
 * @property {ReviewIssue[]} issues A list of issues found during the review.
 * @property {boolean} approved True if the review passed, false otherwise.
 * @property {string} summary A summary of the review findings.
 */
export interface ReviewCompletedPayload {
  files: string[];
  issues: ReviewIssue[];
  approved: boolean;
  summary: string;
}

/**
 * Message sent when a code review has been completed.
 *
 * @typedef {AgentMessage<ReviewCompletedPayload>} ReviewCompletedMessage
 */
export type ReviewCompletedMessage = AgentMessage<ReviewCompletedPayload>;

// ============================================================================
// Architecture Collaboration Messages
// ============================================================================

/**
 * Payload for a message proposing an architectural change.
 *
 * @interface ArchProposalPayload
 * @property {string} title The title of the proposal.
 * @property {string} description A detailed description of the proposed architecture.
 * @property {string[]} [diagrams] ASCII or Mermaid diagrams illustrating the proposal.
 * @property {string} tradeoffs A discussion of the tradeoffs considered.
 * @property {string} recommendation The final recommendation.
 */
export interface ArchProposalPayload {
  title: string;
  description: string;
  diagrams?: string[]; // ASCII diagrams or mermaid
  tradeoffs: string;
  recommendation: string;
}

/**
 * Message sent to propose a new architecture or design.
 *
 * @typedef {AgentMessage<ArchProposalPayload>} ArchProposalMessage
 */
export type ArchProposalMessage = AgentMessage<ArchProposalPayload>;

// ============================================================================
// Agent-to-Agent Communication
// ============================================================================

/**
 * Payload for a message asking a question to another agent.
 *
 * @interface AgentQuestionPayload
 * @property {string} to The ID of the agent the question is for.
 * @property {string} question The question being asked.
 * @property {string} [context] Additional context for the question.
 */
export interface AgentQuestionPayload {
  to: string; // Target agent ID
  question: string;
  context?: string;
}

/**
 * Message sent to ask a direct question to another agent.
 *
 * @typedef {AgentMessage<AgentQuestionPayload>} AgentQuestionMessage
 */
export type AgentQuestionMessage = AgentMessage<AgentQuestionPayload>;

/**
 * Payload for a message providing an answer to a question.
 *
 * @interface AgentAnswerPayload
 * @property {string} questionId The ID of the original `AgentQuestionMessage`.
 * @property {string} answer The answer to the question.
 */
export interface AgentAnswerPayload {
  questionId: string; // Original question message ID
  answer: string;
}

/**
 * Message sent to provide an answer to a previous question.
 *
 * @typedef {AgentMessage<AgentAnswerPayload>} AgentAnswerMessage
 */
export type AgentAnswerMessage = AgentMessage<AgentAnswerPayload>;

// ============================================================================
// Task Management Messages
// ============================================================================

/**
 * Payload for a message indicating a task has started.
 *
 * @interface TaskStartedPayload
 * @property {string} taskId A unique ID for the task.
 * @property {string} command The command that initiated the task.
 * @property {string[]} [args] The arguments for the command.
 */
export interface TaskStartedPayload {
  taskId: string;
  command: string; // e.g., '/onboard-project'
  args?: string[];
}

/**
 * Message sent when an agent starts a new task.
 *
 * @typedef {AgentMessage<TaskStartedPayload>} TaskStartedMessage
 */
export type TaskStartedMessage = AgentMessage<TaskStartedPayload>;

/**
 * Payload for a message providing a task progress update.
 *
 * @interface TaskProgressPayload
 * @property {string} taskId The ID of the task in progress.
 * @property {number} progress The progress percentage (0-100).
 * @property {string} message A message describing the current status.
 */
export interface TaskProgressPayload {
  taskId: string;
  progress: number; // 0-100
  message: string;
}

/**
 * Message sent periodically to update the status of a long-running task.
 *
 * @typedef {AgentMessage<TaskProgressPayload>} TaskProgressMessage
 */
export type TaskProgressMessage = AgentMessage<TaskProgressPayload>;

/**
 * Payload for a message indicating a task has completed successfully.
 *
 * @interface TaskCompletedPayload
 * @property {string} taskId The ID of the completed task.
 * @property {string} command The command that initiated the task.
 * @property {unknown} result The result of the task.
 * @property {number} durationMs The total duration of the task in milliseconds.
 */
export interface TaskCompletedPayload {
  taskId: string;
  command: string;
  result: unknown; // Command-specific result
  durationMs: number;
}

/**
 * Message sent when a task completes successfully.
 *
 * @typedef {AgentMessage<TaskCompletedPayload>} TaskCompletedMessage
 */
export type TaskCompletedMessage = AgentMessage<TaskCompletedPayload>;

/**
 * Payload for a message indicating a task has failed.
 *
 * @interface TaskFailedPayload
 * @property {string} taskId The ID of the failed task.
 * @property {string} command The command that initiated the task.
 * @property {string} error The error message.
 * @property {number} durationMs The duration of the task before it failed.
 */
export interface TaskFailedPayload {
  taskId: string;
  command: string;
  error: string;
  durationMs: number;
}

/**
 * Message sent when a task fails.
 *
 * @typedef {AgentMessage<TaskFailedPayload>} TaskFailedMessage
 */
export type TaskFailedMessage = AgentMessage<TaskFailedPayload>;

// ============================================================================
// Agent Registry Messages
// ============================================================================

/**
 * Payload for a message indicating a new agent has registered.
 *
 * @interface AgentRegisteredPayload
 * @property {string} agentId The unique ID of the registered agent.
 * @property {string} model The underlying model of the agent (e.g., 'gemini').
 * @property {'interactive' | 'background'} type The type of agent.
 * @property {string[]} capabilities A list of the agent's capabilities.
 */
export interface AgentRegisteredPayload {
  agentId: string;
  model: string; // 'gemini', 'claude', 'opus'
  type: 'interactive' | 'background';
  capabilities: string[]; // ['code_review', 'architecture_design']
}

/**
 * Message sent when a new agent joins the bus.
 *
 * @typedef {AgentMessage<AgentRegisteredPayload>} AgentRegisteredMessage
 */
export type AgentRegisteredMessage = AgentMessage<AgentRegisteredPayload>;

/**
 * Payload for a message indicating an agent has unregistered.
 *
 * @interface AgentUnregisteredPayload
 * @property {string} agentId The ID of the agent that has unregistered.
 */
export interface AgentUnregisteredPayload {
  agentId: string;
}

/**
 * Message sent when an agent leaves the bus.
 *
 * @typedef {AgentMessage<AgentUnregisteredPayload>} AgentUnregisteredMessage
 */
export type AgentUnregisteredMessage = AgentMessage<AgentUnregisteredPayload>;

/**
 * Payload for a message indicating an agent's status has changed.
 *
 * @interface AgentStatusChangedPayload
 * @property {string} agentId The ID of the agent.
 * @property {'idle' | 'thinking' | 'working'} status The new status of the agent.
 */
export interface AgentStatusChangedPayload {
  agentId: string;
  status: 'idle' | 'thinking' | 'working';
}

/**
 * Message sent to broadcast a change in an agent's status.
 *
 * @typedef {AgentMessage<AgentStatusChangedPayload>} AgentStatusChangedMessage
 */
export type AgentStatusChangedMessage = AgentMessage<AgentStatusChangedPayload>;

// ============================================================================
// User Input Messages (for interactive prompts)
// ============================================================================

/**
 * Payload for a message requesting user input.
 *
 * @interface UserInputRequestedPayload
 * @property {string} requestId A unique ID for the request.
 * @property {string} prompt The message to display to the user.
 * @property {'text' | 'confirm' | 'select'} type The type of input requested.
 * @property {string[]} [options] A list of options for 'select' type prompts.
 */
export interface UserInputRequestedPayload {
  requestId: string;
  prompt: string;
  type: 'text' | 'confirm' | 'select';
  options?: string[]; // For 'select' type
}

/**
 * Message sent when an agent needs to ask the user for input.
 *
 * @typedef {AgentMessage<UserInputRequestedPayload>} UserInputRequestedMessage
 */
export type UserInputRequestedMessage = AgentMessage<UserInputRequestedPayload>;

/**
 * Payload for a message providing user input.
 *
 * @interface UserInputProvidedPayload
 * @property {string} requestId The ID of the original `UserInputRequestedMessage`.
 * @property {string | boolean} value The value provided by the user.
 */
export interface UserInputProvidedPayload {
  requestId: string;
  value: string | boolean;
}

/**
 * Message sent from the TUI to an agent with the user's response.
 *
 * @typedef {AgentMessage<UserInputProvidedPayload>} UserInputProvidedMessage
 */
export type UserInputProvidedMessage = AgentMessage<UserInputProvidedPayload>;

// ============================================================================
// Topic Constants
// ============================================================================

/**
 * A frozen object of constants for all message topics.
 *
 * Using `Topics.CODE_COMPLETED` is preferred over the raw string 'code.completed'
 * to prevent typos and enable static analysis.
 *
 * @enum {string}
 * @example
 * const msg = MessageFactory.create(from, to, Topics.CODE_COMPLETED, payload);
 */
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

/**
 * A factory class for creating `AgentMessage` instances.
 *
 * This class provides a consistent way to create messages, automatically
 * handling the generation of IDs and timestamps. It also includes
 * convenience methods for creating messages of specific types.
 *
 * @class MessageFactory
 *
 * @example
 * const message = MessageFactory.codeCompleted('gemini-1', 'opus-1', {
 *   files: ['src/index.ts'],
 *   summary: 'Implemented feature X',
 *   requestReview: true,
 * });
 */
export class MessageFactory {
  /**
   * Creates a new `AgentMessage` with a generated ID and timestamp.
   *
   * This is the base method for creating all messages.
   *
   * @template T The type of the message payload.
   * @param {string} from The ID of the sending agent.
   * @param {string} to The ID of the recipient agent, or '*' for broadcast.
   * @param {string} topic The message topic.
   * @param {T} payload The message payload.
   * @returns {AgentMessage<T>} The newly created agent message.
   *
   * @example
   * const genericMessage = MessageFactory.create(
   *   'agent-1',
   *   '*',
   *   'custom.topic',
   *   { customData: 123 }
   * );
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

  /**
   * Creates a `CodeCompletedMessage`.
   *
   * @param {string} from The ID of the sending agent.
   * @param {string} to The ID of the recipient agent.
   * @param {CodeCompletedPayload} payload The message payload.
   * @returns {CodeCompletedMessage} The created message.
   */
  static codeCompleted(
    from: string,
    to: string,
    payload: CodeCompletedPayload
  ): CodeCompletedMessage {
    return this.create(from, to, Topics.CODE_COMPLETED, payload);
  }

  /**
   * Creates a `ReviewRequestedMessage`.
   *
   * @param {string} from The ID of the sending agent.
   * @param {string} to The ID of the recipient agent.
   * @param {ReviewRequestedPayload} payload The message payload.
   * @returns {ReviewRequestedMessage} The created message.
   *
   * @example
   * const msg = AgentMessage.reviewRequested('gemini-1', 'opus-1', {
   *   files: ['src/index.ts'],
   *   context: 'Check for bugs',
   *   requestedBy: 'gemini-1',
   *   requestedAt: Date.now()
   * });
   */
  static reviewRequested(
    from: string,
    to: string,
    payload: ReviewRequestedPayload
  ): ReviewRequestedMessage {
    return this.create(from, to, Topics.CODE_REVIEW_REQUESTED, payload);
  }

  /**
   * Creates a `ReviewCompletedMessage`.
   *
   * @param {string} from The ID of the sending agent.
   * @param {string} to The ID of the recipient agent.
   * @param {ReviewCompletedPayload} payload The message payload.
   * @returns {ReviewCompletedMessage} The created message.
   *
   * @example
   * const msg = AgentMessage.reviewCompleted('opus-1', 'gemini-1', {
   *   file: 'src/index.ts',
   *   approved: true,
   *   comments: ['Great job!'],
   *   reviewedBy: 'opus-1',
   *   reviewedAt: Date.now()
   * });
   */
  static reviewCompleted(
    from: string,
    to: string,
    payload: ReviewCompletedPayload
  ): ReviewCompletedMessage {
    return this.create(from, to, Topics.CODE_REVIEW_COMPLETED, payload);
  }

  /**
   * Creates an `ArchProposalMessage`.
   *
   * @param {string} from The ID of the sending agent.
   * @param {string} to The ID of the recipient agent.
   * @param {ArchProposalPayload} payload The message payload.
   * @returns {ArchProposalMessage} The created message.
   *
   * @example
   * const msg = AgentMessage.archProposal('architect-1', 'dev-1', {
   *   proposalId: 'prop-123',
   *   title: 'New IPC Architecture',
   *   description: 'Proposal to switch to ZeroMQ',
   *   proposedBy: 'architect-1',
   *   proposedAt: Date.now()
   * });
   */
  static archProposal(
    from: string,
    to: string,
    payload: ArchProposalPayload
  ): ArchProposalMessage {
    return this.create(from, to, Topics.ARCH_PROPOSAL_READY, payload);
  }

  /**
   * Creates an `AgentQuestionMessage`.
   *
   * @param {string} from The ID of the sending agent.
   * @param {string} to The ID of the recipient agent.
   * @param {AgentQuestionPayload} payload The message payload.
   * @returns {AgentQuestionMessage} The created message.
   *
   * @example
   * const msg = AgentMessage.agentQuestion('gemini-1', 'opus-1', {
   *   question: 'How do I access the DB?',
   *   context: 'I am trying to save a user'
   * });
   */
  static agentQuestion(
    from: string,
    to: string,
    payload: AgentQuestionPayload
  ): AgentQuestionMessage {
    return this.create(from, to, Topics.AGENT_QUESTION, payload);
  }

  /**
   * Creates an `AgentRegisteredMessage`.
   *
   * @param {string} from The ID of the sending agent.
   * @param {string} to The ID of the recipient agent.
   * @param {AgentRegisteredPayload} payload The message payload.
   * @returns {AgentRegisteredMessage} The created message.
   *
   * @example
   * const msg = AgentMessage.agentRegistered('gemini-1', '*', {
   *   agentId: 'gemini-1',
   *   role: 'coder',
   *   capabilities: ['coding', 'testing'],
   *   registeredAt: Date.now()
   * });
   */
  static agentRegistered(
    from: string,
    to: string,
    payload: AgentRegisteredPayload
  ): AgentRegisteredMessage {
    return this.create(from, to, Topics.AGENT_REGISTERED, payload);
  }

  /**
   * Creates a `TaskStartedMessage`.
   *
   * @param {string} from The ID of the sending agent.
   * @param {string} to The ID of the recipient agent.
   * @param {TaskStartedPayload} payload The message payload.
   * @returns {TaskStartedMessage} The created message.
   *
   * @example
   * const msg = AgentMessage.taskStarted('gemini-1', 'manager-1', {
   *   taskId: 'task-123',
   *   name: 'Implement Login',
   *   startedBy: 'gemini-1',
   *   startedAt: Date.now()
   * });
   */
  static taskStarted(
    from: string,
    to: string,
    payload: TaskStartedPayload
  ): TaskStartedMessage {
    return this.create(from, to, Topics.TASK_STARTED, payload);
  }

  /**
   * Creates a `TaskCompletedMessage`.
   *
   * @param {string} from The ID of the sending agent.
   * @param {string} to The ID of the recipient agent.
   * @param {TaskCompletedPayload} payload The message payload.
   * @returns {TaskCompletedMessage} The created message.
   *
   * @example
   * const msg = AgentMessage.taskCompleted('gemini-1', 'manager-1', {
   *   taskId: 'task-123',
   *   result: { success: true },
   *   completedBy: 'gemini-1',
   *   completedAt: Date.now()
   * });
   */
  static taskCompleted(
    from: string,
    to: string,
    payload: TaskCompletedPayload
  ): TaskCompletedMessage {
    return this.create(from, to, Topics.TASK_COMPLETED, payload);
  }
}
