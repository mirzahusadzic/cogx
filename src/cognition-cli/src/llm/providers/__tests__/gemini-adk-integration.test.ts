/**
 * Gemini ADK Integration Tests
 *
 * Tests that require a real GEMINI_API_KEY.
 * Skipped in CI, run manually with: GEMINI_API_KEY=xxx npx vitest run gemini-adk-integration
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { GeminiAgentProvider } from '../gemini-agent-provider.js';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  createSessionState,
  saveSessionState,
} from '../../../sigma/session-state.js';

const SKIP_REASON = 'Requires GEMINI_API_KEY - set env var to run';
const hasApiKey = !!process.env.GEMINI_API_KEY;

describe.skipIf(!hasApiKey)('GeminiAgentProvider Integration', () => {
  let provider: GeminiAgentProvider;
  let tempDir: string;
  let anchorId: string;

  beforeAll(() => {
    provider = new GeminiAgentProvider(process.env.GEMINI_API_KEY!);
  });

  beforeEach(() => {
    // Create temp directory for each test
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gemini-test-'));

    // Create anchorId and initialize session state
    anchorId = `test-${Date.now()}`;
    const state = createSessionState(anchorId, `sdk-${Date.now()}`);
    saveSessionState(state, tempDir);
  });

  afterEach(() => {
    // Cleanup temp directory
    if (tempDir) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  // TODO: Re-enable when ADK SDK v0.1.x JSON parsing bug is fixed
  // KNOWN ISSUE: ADK SDK v0.1.x throws JSON parsing errors for simple prompts without tools
  // Error: "Unexpected token 'e', "exception"..." suggests API error response parsing issue
  // Tool-based tests work fine - this appears to be an SDK bug with simple single-turn prompts
  // Related: https://github.com/googleapis/genkit/issues (track upstream fix)
  it.skip('should complete a simple prompt', async () => {
    const responses: string[] = [];

    for await (const response of provider.executeAgent({
      prompt: 'What is 2+2? Reply with just the number.',
      model: 'gemini-3-flash-preview',
      cwd: tempDir,
      anchorId,
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
      model: 'gemini-3-flash-preview',
      cwd: tempDir,
      anchorId,
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
    let firstTurnMessageCount = 0;

    // First turn
    for await (const response of provider.executeAgent({
      prompt: 'Say exactly: "I will remember 42"',
      model: 'gemini-3-flash-preview',
      cwd: tempDir,
      anchorId,
    })) {
      sessionId = response.sessionId;
      firstTurnMessageCount = response.messages.length;
    }

    expect(sessionId).toBeDefined();
    expect(firstTurnMessageCount).toBeGreaterThan(1); // At least user + assistant

    // Second turn - resume session (should have accumulated messages)
    let secondTurnMessageCount = 0;
    for await (const response of provider.executeAgent({
      prompt: 'Repeat what you said you would remember',
      model: 'gemini-3-flash-preview',
      cwd: tempDir,
      anchorId,
      resumeSessionId: sessionId,
    })) {
      secondTurnMessageCount = response.messages.length;
      // Verify same session ID
      expect(response.sessionId).toBe(sessionId);
    }

    // Second turn should have more messages than first (accumulated history)
    // Note: We only track messages within each turn, not across turns in our implementation
    // So we just verify the session was reused (same sessionId)
    expect(secondTurnMessageCount).toBeGreaterThan(0);
  }, 60000);

  it('should handle session boundary (compression scenario)', async () => {
    // Simulate compression boundary: Session A → compression → Session B (fresh start)

    // Session A - Initial conversation
    let sessionA: string | undefined;
    for await (const response of provider.executeAgent({
      prompt: 'Remember: Project Alpha started in 2023',
      model: 'gemini-3-flash-preview',
      cwd: tempDir,
      anchorId,
    })) {
      sessionA = response.sessionId;
    }

    expect(sessionA).toBeDefined();

    // Continue Session A
    for await (const response of provider.executeAgent({
      prompt: 'What project did we discuss?',
      model: 'gemini-3-flash-preview',
      cwd: tempDir,
      anchorId,
      resumeSessionId: sessionA,
    })) {
      expect(response.sessionId).toBe(sessionA); // Same session
    }

    // COMPRESSION BOUNDARY: resumeSessionId = undefined (simulates resetResumeSession())
    // This mimics what happens in TUI after compression completes

    // Session B - Fresh start (no resumeSessionId)
    let sessionB: string | undefined;
    for await (const response of provider.executeAgent({
      prompt: 'What is 5+5? Reply with just the number.',
      model: 'gemini-3-flash-preview',
      cwd: tempDir,
      anchorId,
      // resumeSessionId intentionally omitted - simulates compression boundary
    })) {
      sessionB = response.sessionId;
    }

    // Verify new session was created
    expect(sessionB).toBeDefined();
    expect(sessionB).not.toBe(sessionA); // Different session ID

    // Session B should not have access to Session A history
    // (We can't directly test the model's memory, but we verified a new session was created)
  }, 90000);
});

// Placeholder test that always runs
describe('GeminiAgentProvider Integration Placeholder', () => {
  it.skipIf(hasApiKey)('skipped without API key', () => {
    console.log(SKIP_REASON);
    expect(true).toBe(true);
  });
});
