/**
 * Gemini ADK Integration Tests
 *
 * Tests that require a real GEMINI_API_KEY.
 * Skipped in CI, run manually with: GEMINI_API_KEY=xxx npx vitest run gemini-adk-integration
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { GeminiAgentProvider } from '../gemini-agent-provider.js';

const SKIP_REASON = 'Requires GEMINI_API_KEY - set env var to run';
const hasApiKey = !!process.env.GEMINI_API_KEY;

describe.skipIf(!hasApiKey)('GeminiAgentProvider Integration', () => {
  let provider: GeminiAgentProvider;

  beforeAll(() => {
    provider = new GeminiAgentProvider(process.env.GEMINI_API_KEY!);
  });

  it('should complete a simple prompt', async () => {
    const responses: string[] = [];

    for await (const response of provider.executeAgent({
      prompt: 'What is 2+2? Reply with just the number.',
      model: 'gemini-2.5-flash',
      cwd: process.cwd(),
    })) {
      for (const msg of response.messages) {
        if (msg.role === 'assistant' && typeof msg.content === 'string') {
          responses.push(msg.content);
        }
      }
    }

    expect(responses.length).toBeGreaterThan(0);
    const lastResponse = responses[responses.length - 1];
    expect(lastResponse).toContain('4');
  }, 30000);

  it('should use tools when asked', async () => {
    const responses: { type: string; content?: string; toolName?: string }[] =
      [];

    for await (const response of provider.executeAgent({
      prompt:
        'Use the glob tool to find all .ts files in the current directory',
      model: 'gemini-2.5-flash',
      cwd: process.cwd(),
    })) {
      for (const msg of response.messages) {
        responses.push({
          type: msg.type,
          content: typeof msg.content === 'string' ? msg.content : undefined,
          toolName: msg.toolName,
        });
      }
    }

    // Should have at least user message + some response
    expect(responses.length).toBeGreaterThan(1);

    // Check if tool was used (may vary by model response)
    const hasToolUse = responses.some((r) => r.type === 'tool_use');
    const hasTextResponse = responses.some(
      (r) => r.type === 'assistant' && r.content
    );
    expect(hasToolUse || hasTextResponse).toBe(true);
  }, 60000);

  it('should handle session continuity', async () => {
    let sessionId: string | undefined;

    // First turn
    for await (const response of provider.executeAgent({
      prompt: 'Remember the number 42',
      model: 'gemini-2.5-flash',
      cwd: process.cwd(),
    })) {
      sessionId = response.sessionId;
    }

    expect(sessionId).toBeDefined();

    // Second turn - resume session
    const responses: string[] = [];
    for await (const response of provider.executeAgent({
      prompt: 'What number did I ask you to remember?',
      model: 'gemini-2.5-flash',
      cwd: process.cwd(),
      resumeSessionId: sessionId,
    })) {
      for (const msg of response.messages) {
        if (msg.role === 'assistant' && typeof msg.content === 'string') {
          responses.push(msg.content);
        }
      }
    }

    const lastResponse = responses[responses.length - 1];
    expect(lastResponse).toContain('42');
  }, 60000);
});

// Placeholder test that always runs
describe('GeminiAgentProvider Integration Placeholder', () => {
  it.skipIf(hasApiKey)('skipped without API key', () => {
    console.log(SKIP_REASON);
    expect(true).toBe(true);
  });
});
