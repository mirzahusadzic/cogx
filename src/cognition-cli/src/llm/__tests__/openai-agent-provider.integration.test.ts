/**
 * Integration tests for OpenAI Agent Provider
 *
 * These tests run against a real OpenAI-compatible endpoint (eGemma or OpenAI).
 * They are OPTIONAL and only run if both WORKBENCH_URL and WORKBENCH_TEST_INTEGRATION are set.
 *
 * To run these tests:
 * 1. Start eGemma: `cd ~/src/egemma && uv run uvicorn src.server:app --host localhost --port 8000`
 * 2. Set environment: `export WORKBENCH_URL=http://localhost:8000`
 * 3. Enable integration tests: `export WORKBENCH_TEST_INTEGRATION=true`
 * 4. Run tests: `npm test -- openai-agent-provider.integration`
 *
 * @vitest-environment node
 */

import { describe, test, expect, beforeAll } from 'vitest';
import { OpenAIAgentProvider } from '../providers/openai/agent-provider.js';

// Check if workbench is available
const WORKBENCH_URL = process.env.WORKBENCH_URL;
const WORKBENCH_TEST_INTEGRATION =
  process.env.WORKBENCH_TEST_INTEGRATION === 'true';
const shouldRunIntegrationTests = !!WORKBENCH_URL && WORKBENCH_TEST_INTEGRATION;

// Helper to check workbench health
async function checkWorkbenchHealth(): Promise<boolean> {
  if (!WORKBENCH_URL) return false;

  try {
    // Health endpoint is at root level, not under /v1
    const healthUrl = WORKBENCH_URL.replace(/\/v1\/?$/, '') + '/health';
    const response = await fetch(healthUrl);
    if (!response.ok) return false;

    const health = await response.json();
    return (
      health.status === 'ok' &&
      health.chat_model?.status === 'loaded' &&
      health.chat_model?.supports_tools === true
    );
  } catch {
    return false;
  }
}

describe('OpenAI Agent Provider - Integration Tests', () => {
  let isHealthy = false;

  beforeAll(async () => {
    if (!shouldRunIntegrationTests) {
      console.log(
        '⏭️  Skipping integration tests (set WORKBENCH_URL and WORKBENCH_TEST_INTEGRATION=true to enable)'
      );
      return;
    }

    isHealthy = await checkWorkbenchHealth();
    if (!isHealthy) {
      console.log('⚠️  Workbench not healthy, skipping integration tests');
    } else {
      console.log('✅ Workbench healthy, running integration tests');
    }
  });

  test('should skip if workbench not available', () => {
    if (!shouldRunIntegrationTests || !isHealthy) {
      expect(true).toBe(true); // Placeholder to prevent empty test suite
    }
  });

  test('should create provider and list models', async () => {
    if (!shouldRunIntegrationTests || !isHealthy) {
      return;
    }

    const provider = new OpenAIAgentProvider({
      baseUrl: WORKBENCH_URL,
      apiKey: process.env.WORKBENCH_API_KEY || 'dummy-key',
    });

    expect(provider.name).toBe('openai');
    expect(provider.models.length).toBeGreaterThan(0);
  });

  test('should execute simple prompt without tools', async () => {
    if (!shouldRunIntegrationTests || !isHealthy) {
      return;
    }

    const provider = new OpenAIAgentProvider({
      baseUrl: WORKBENCH_URL,
      apiKey: process.env.WORKBENCH_API_KEY || 'dummy-key',
    });

    const responses = [];
    for await (const response of provider.executeAgent({
      prompt: 'Say hello in one word',
      model: 'gpt-oss-20b',
      cwd: process.cwd(),
    })) {
      responses.push(response);
    }

    // Should have at least one response
    expect(responses.length).toBeGreaterThan(0);

    // Last response should have messages
    const lastResponse = responses[responses.length - 1];
    expect(lastResponse.messages.length).toBeGreaterThan(0);

    // Should have user message and assistant response
    const userMsg = lastResponse.messages.find((m) => m.role === 'user');
    const assistantMsg = lastResponse.messages.find(
      (m) => m.role === 'assistant'
    );

    expect(userMsg).toBeDefined();
    expect(assistantMsg).toBeDefined();
    expect(assistantMsg?.content).toBeTruthy();
  }, 30000); // 30s timeout for model inference

  test('should call bash tool when requested', async () => {
    if (!shouldRunIntegrationTests || !isHealthy) {
      return;
    }

    const provider = new OpenAIAgentProvider({
      baseUrl: WORKBENCH_URL,
      apiKey: process.env.WORKBENCH_API_KEY || 'dummy-key',
    });

    const responses = [];
    let toolUseCalled = false;

    for await (const response of provider.executeAgent({
      prompt: 'Use the bash tool to echo hello',
      model: 'gpt-oss-20b',
      cwd: process.cwd(),
    })) {
      responses.push(response);

      // Check if any message is a tool_use
      if (response.messages.some((m) => m.type === 'tool_use')) {
        toolUseCalled = true;
      }
    }

    expect(toolUseCalled).toBe(true);

    // Last response should have tool-related messages
    const lastResponse = responses[responses.length - 1];
    const toolUseMsg = lastResponse.messages.find((m) => m.type === 'tool_use');
    const toolResultMsg = lastResponse.messages.find(
      (m) => m.type === 'tool_result'
    );

    expect(toolUseMsg).toBeDefined();
    expect(toolUseMsg?.toolName).toBe('bash');
    expect(toolResultMsg).toBeDefined();
  }, 45000); // 45s timeout for tool execution

  test('should handle conversation sessions', async () => {
    if (!shouldRunIntegrationTests || !isHealthy) {
      return;
    }

    const provider = new OpenAIAgentProvider({
      baseUrl: WORKBENCH_URL,
      apiKey: process.env.WORKBENCH_API_KEY || 'dummy-key',
    });

    // First query - should create new session
    let sessionId: string | undefined;
    const responses1 = [];

    for await (const response of provider.executeAgent({
      prompt: 'Remember this number: 42',
      model: 'gpt-oss-20b',
      cwd: process.cwd(),
    })) {
      responses1.push(response);
      if (response.sessionId) {
        sessionId = response.sessionId;
      }
    }

    expect(sessionId).toBeDefined();

    // Second query - should resume session
    const responses2 = [];
    for await (const response of provider.executeAgent({
      prompt: 'What number did I tell you to remember?',
      model: 'gpt-oss-20b',
      cwd: process.cwd(),
      resumeSessionId: sessionId,
    })) {
      responses2.push(response);
    }

    // Should have same session ID
    const lastResponse = responses2[responses2.length - 1];
    expect(lastResponse.sessionId).toBe(sessionId);

    // Model should reference 42 in its response (basic memory check)
    const assistantMsg = lastResponse.messages.find(
      (m) => m.role === 'assistant' && m.content.includes('42')
    );
    expect(assistantMsg).toBeDefined();
  }, 60000); // 60s timeout for two inference rounds

  test('should handle provider interrupt', async () => {
    if (!shouldRunIntegrationTests || !isHealthy) {
      return;
    }

    const provider = new OpenAIAgentProvider({
      baseUrl: WORKBENCH_URL,
      apiKey: process.env.WORKBENCH_API_KEY || 'dummy-key',
    });

    // Start a long-running task
    const generator = provider.executeAgent({
      prompt: 'Count from 1 to 100 slowly',
      model: 'gpt-oss-20b',
      cwd: process.cwd(),
    });

    // Interrupt after first response
    let count = 0;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for await (const _response of generator) {
      count++;
      if (count === 2) {
        await provider.interrupt();
        break;
      }
    }

    expect(count).toBe(2);
  }, 30000);
});
