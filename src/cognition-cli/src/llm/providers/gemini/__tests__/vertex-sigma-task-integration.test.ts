// @vitest-environment node
/**
 * Vertex AI SigmaTask Integration Test
 *
 * This test monitors how the Gemini model interacts with the SigmaTask tool.
 * Specifically, it checks if the model correctly handles task transitions
 * (closing one task before opening another).
 *
 * Runs only if GOOGLE_GENAI_USE_VERTEXAI=true is set.
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { GeminiAgentProvider } from '../agent-provider.js';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';
import {
  createSessionState,
  saveSessionState,
} from '../../../../sigma/session-state.js';

const useVertex = process.env.GOOGLE_GENAI_USE_VERTEXAI === 'true';

describe.skipIf(!useVertex)('Vertex AI SigmaTask Integration', () => {
  let provider: GeminiAgentProvider;
  let tempDir: string;
  let anchorId: string;

  beforeAll(() => {
    // In Vertex mode, we don't pass an API key as it uses application default credentials
    provider = new GeminiAgentProvider();
  });

  beforeEach(() => {
    // Create temp directory for each test
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vertex-sigma-test-'));

    // Create anchorId and initialize session state
    anchorId = `test-${Date.now()}`;
    const state = createSessionState(anchorId, `sdk-${Date.now()}`);
    saveSessionState(state, tempDir);

    // Initialize a dummy git repo with enough commits to stress the task constraint
    try {
      execSync('git init', { cwd: tempDir });
      execSync('git config user.email "test@example.com"', { cwd: tempDir });
      execSync('git config user.name "Test User"', { cwd: tempDir });

      // Commit 1: auth module
      fs.writeFileSync(
        path.join(tempDir, 'auth.ts'),
        'export function login(user: string, pass: string) { return user === pass; }'
      );
      fs.writeFileSync(
        path.join(tempDir, 'auth.test.ts'),
        'import { login } from "./auth"; console.assert(login("a","a"));'
      );
      execSync('git add . && git commit -m "feat(auth): add login function"', {
        cwd: tempDir,
      });

      // Commit 2: security fix in auth
      fs.writeFileSync(
        path.join(tempDir, 'auth.ts'),
        'import bcrypt from "bcrypt";\nexport async function login(user: string, pass: string) { return bcrypt.compare(pass, user); }'
      );
      execSync(
        'git add . && git commit -m "fix(auth): use bcrypt for password comparison"',
        { cwd: tempDir }
      );

      // Commit 3: new API module
      fs.writeFileSync(
        path.join(tempDir, 'api.ts'),
        'export function getUser(id: string) { return { id, name: "test" }; }'
      );
      execSync('git add . && git commit -m "feat(api): add getUser endpoint"', {
        cwd: tempDir,
      });

      // Commit 4: breaking change in API
      fs.writeFileSync(
        path.join(tempDir, 'api.ts'),
        'export function getUser(id: number) { return { id, name: "test" }; }'
      );
      execSync(
        'git add . && git commit -m "refactor(api): change id type from string to number"',
        { cwd: tempDir }
      );

      // Commit 5: config change
      fs.writeFileSync(
        path.join(tempDir, 'config.ts'),
        'export const DB_URL = process.env.DB_URL ?? "localhost:5432";\nexport const SECRET_KEY = process.env.SECRET_KEY ?? "dev-secret";'
      );
      execSync(
        'git add . && git commit -m "chore(config): add DB_URL and SECRET_KEY config"',
        { cwd: tempDir }
      );
    } catch (error) {
      console.error('Failed to setup dummy git repo:', error);
    }
  });

  afterEach(() => {
    // Cleanup temp directory
    if (tempDir) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('should handle multi-step task with SigmaTaskUpdate correctly', async () => {
    const toolCalls: string[] = [];
    const toolErrors: string[] = [];

    // Dedup trackers — bidi streaming re-emits the full messages snapshot on every
    // chunk, so the same tool_use/tool_result messages appear multiple times.
    // Track the last seen message count to only process newly appended messages.
    let lastSeenMessageCount = 0;

    // Prompt designed to tempt the model into parallel task creation
    // via multiple independent concerns — without instructing task management
    // (that is handled by the system prompt and SigmaTask tool description).
    const prompt =
      'Review ALL 5 commits in this repository. For each commit check for security issues, ' +
      'identify any breaking changes, and assess code quality. ' +
      'Use bash to inspect the commits and provide a final summary with recommendations.';

    console.log('Starting agent execution with Vertex AI...');

    try {
      for await (const response of provider.executeAgent({
        prompt,
        model: 'gemini-3-flash-preview',
        cwd: tempDir,
        anchorId,
      })) {
        // Only process messages appended since the last snapshot
        const newMessages = response.messages.slice(lastSeenMessageCount);
        lastSeenMessageCount = response.messages.length;

        for (const msg of newMessages) {
          if (msg.type === 'tool_use') {
            console.log(`Model called tool: ${msg.toolName}`);
            toolCalls.push(msg.toolName!);
          }
          if (
            msg.type === 'tool_result' &&
            typeof msg.content === 'string' &&
            (msg.content.includes('Error') ||
              msg.content.includes('Strict Sequential'))
          ) {
            console.log(
              `Tool error detected: ${msg.content.substring(0, 100)}...`
            );
            toolErrors.push(msg.content);
          }
        }
      }
    } catch (error) {
      console.error('Agent execution failed:', error);
      throw error;
    }

    // Assertions
    console.log('Summary of tool calls:', toolCalls);

    // We expect at least one SigmaTaskUpdate call because the system prompt mandates it
    expect(toolCalls).toContain('SigmaTaskUpdate');

    // Check if there were any "Only ONE task can be in_progress" errors
    const multiTaskErrors = toolErrors.filter(
      (e) =>
        e.includes('Only ONE task can be in_progress') ||
        e.includes('Strict Sequential Workflow')
    );
    if (multiTaskErrors.length > 0) {
      console.warn(
        'CRITICAL DETECTION: Model failed the "one task at a time" constraint.'
      );
      console.warn('Violations:', multiTaskErrors);
    } else {
      console.log(
        'SUCCESS: Model adhered to the "one task at a time" constraint.'
      );
    }

    expect(multiTaskErrors.length).toBe(0);
  }, 300000); // 5 minute timeout for complex agent task
});

describe('Vertex AI SigmaTask Integration Placeholder', () => {
  it.skipIf(useVertex)('skipped without GOOGLE_GENAI_USE_VERTEXAI=true', () => {
    expect(true).toBe(true);
  });
});
