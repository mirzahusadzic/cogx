/**
 * Payload definitions for inter-agent communication.
 * Each payload is associated with a specific topic.
 */

// ============================================================================
// Code Collaboration Messages
// ============================================================================

/**
 * Payload for a message indicating code completion.
 */
export interface CodeCompletedPayload {
  files: string[]; // Modified files
  summary: string; // What was implemented
  requestReview: boolean; // Should Opus review?
  branch?: string; // Git branch (if applicable)
}

/**
 * Payload for a message requesting a code review.
 */
export interface ReviewRequestedPayload {
  files: string[]; // Files to review
  context: string; // What to look for
  priority: 'low' | 'normal' | 'high';
}

/**
 * Represents a single issue found during a code review.
 */
export interface ReviewIssue {
  file: string;
  line: number;
  severity: 'error' | 'warning' | 'suggestion';
  message: string;
}

/**
 * Payload for a message indicating a code review is complete.
 */
export interface ReviewCompletedPayload {
  files: string[];
  issues: ReviewIssue[];
  approved: boolean;
  summary: string;
}

// ============================================================================
// Architecture Collaboration Messages
// ============================================================================

/**
 * Payload for a message proposing an architectural change.
 */
export interface ArchProposalPayload {
  title: string;
  description: string;
  diagrams?: string[]; // ASCII diagrams or mermaid
  tradeoffs: string;
  recommendation: string;
}

// ============================================================================
// Agent-to-Agent Communication
// ============================================================================

/**
 * Payload for a message asking a question to another agent.
 */
export interface AgentQuestionPayload {
  to: string; // Target agent ID
  question: string;
  context?: string;
}

/**
 * Payload for a message providing an answer to a question.
 */
export interface AgentAnswerPayload {
  questionId: string; // Original question message ID
  answer: string;
}

// ============================================================================
// Task Management Messages
// ============================================================================

/**
 * Payload for a message indicating a task has started.
 */
export interface TaskStartedPayload {
  taskId: string;
  command: string; // e.g., '/onboard-project'
  args?: string[];
}

/**
 * Payload for a message providing a task progress update.
 */
export interface TaskProgressPayload {
  taskId: string;
  progress: number; // 0-100
  message: string;
}

/**
 * Payload for a message indicating a task has completed successfully.
 */
export interface TaskCompletedPayload {
  taskId: string;
  command: string;
  result: unknown; // Command-specific result
  durationMs: number;
}

/**
 * Payload for a message indicating a task has failed.
 */
export interface TaskFailedPayload {
  taskId: string;
  command: string;
  error: string;
  durationMs: number;
}

// ============================================================================
// Agent Registry Messages
// ============================================================================

/**
 * Payload for a message indicating a new agent has registered.
 */
export interface AgentRegisteredPayload {
  agentId: string;
  model: string; // 'gemini', 'claude', 'opus'
  type: 'interactive' | 'background';
  capabilities: string[]; // ['code_review', 'architecture_design']
  projectRoot?: string; // Absolute path to project directory
  projectName?: string; // Inferred from package.json or folder name
  scope?: string; // Subsystem/path this agent manages
}

/**
 * Payload for a message indicating an agent has unregistered.
 */
export interface AgentUnregisteredPayload {
  agentId: string;
}

/**
 * Payload for a message indicating an agent's status has changed.
 */
export interface AgentStatusChangedPayload {
  agentId: string;
  status: 'idle' | 'thinking' | 'working';
}

// ============================================================================
// User Input Messages (for interactive prompts)
// ============================================================================

/**
 * Payload for a message requesting user input.
 */
export interface UserInputRequestedPayload {
  requestId: string;
  prompt: string;
  type: 'text' | 'confirm' | 'select';
  options?: string[]; // For 'select' type
}

/**
 * Payload for a message providing user input.
 */
export interface UserInputProvidedPayload {
  requestId: string;
  value: string | boolean;
}
