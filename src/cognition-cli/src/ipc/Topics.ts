/**
 * A frozen object of constants for all message topics.
 *
 * Using `Topics.CODE_COMPLETED` is preferred over the raw string 'code.completed'
 * to prevent typos and enable static analysis.
 *
 * @enum {string}
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
  AGENT_QUERY_REQUEST: 'agent.query_request',
  AGENT_QUERY_RESPONSE: 'agent.query_response',
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
