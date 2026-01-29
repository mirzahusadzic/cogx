export const AUTO_RESPONSE_TRIGGER = '__AUTO_RESPONSE__';

export const COMPRESSION_RECOVERY_PROMPT = `[SYSTEM EVENT: CONTEXT_COMPRESSED]
The conversation history has been compressed to save tokens.
1. Review the "Conversation Recap" above to ground your current state.
2. Check your "Task List" to see if items are pending.
3. If a task was interrupted, resume it.
4. If the last task was completed, respond ONLY with "Context restored. Ready for next instructions." Do NOT propose new tasks or generate code.`;

/**
 * Providers that require aggressive context management and proactive token pressure warnings.
 * These typically have lower TPM (Tokens Per Minute) quotas or benefit from early semantic cleanup.
 */
export const CONTEXT_SENSITIVE_PROVIDERS = ['gemini', 'openai'];

/**
 * The maximum number of lines to show in the streaming tool output block.
 * This is used to maintain visual stability in the TUI while content is streaming.
 */
export const MAX_STREAM_STABILIZATION_LINES = 20;

/**
 * Total height reserved for fixed UI elements (header, footer, thinking indicator, input prompt, etc.)
 * This is used to calculate the available space for the main scrollable message area.
 */
export const TUI_LAYOUT_OVERHEAD = 8;

/**
 * Check if a provider/model combination is context-sensitive.
 */
export function isProviderContextSensitive(
  provider: string,
  model?: string
): boolean {
  const lowerProvider = provider.toLowerCase();
  const lowerModel = (model || '').toLowerCase();

  return (
    CONTEXT_SENSITIVE_PROVIDERS.includes(lowerProvider) ||
    lowerModel.includes('gemini') ||
    lowerModel.includes('gpt-oss') ||
    lowerModel.includes('egemma')
  );
}
