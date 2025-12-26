export const AUTO_RESPONSE_TRIGGER = '__AUTO_RESPONSE__';

export const COMPRESSION_RECOVERY_PROMPT = `[SYSTEM EVENT: CONTEXT_COMPRESSED]
The conversation history has been compressed to save tokens.
1. Review the "Conversation Recap" above to ground your current state.
2. Check your "Task List" to see if items are pending.
3. If a task was interrupted, resume it. If the last task was completed, confirm readiness.`;
