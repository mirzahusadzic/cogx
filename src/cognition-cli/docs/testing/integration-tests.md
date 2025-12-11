# Integration Tests

## Overview

Integration tests validate the OpenAI Agent Provider against real OpenAI-compatible endpoints. These tests are **optional** and only run when a workbench is available.

## Requirements

- Running eGemma server (or other OpenAI-compatible endpoint)
- Environment variable `WORKBENCH_URL` set to the endpoint
- (Optional) `WORKBENCH_API_KEY` for authentication

## Running Integration Tests

### 1. Start eGemma

```bash
cd ~/src/egemma
uv run uvicorn src.server:app --host localhost --port 8000
```

### 2. Set Environment Variables

```bash
export WORKBENCH_URL=http://localhost:8000
export WORKBENCH_API_KEY=dummy-key  # Optional, has default
```

### 3. Run Tests

```bash
# Run only integration tests
npm test -- openai-agent-provider.integration

# Run all tests including integration
npm test
```

## Test Coverage

Integration tests validate:

1. **Basic functionality:**
   - Provider initialization
   - Model listing
   - Simple prompts without tools

2. **Tool calling:**
   - Bash tool execution
   - Tool input/output formatting
   - Harmony format parsing

3. **Session management:**
   - Conversation creation
   - Session resumption
   - Conversation API integration

4. **Interruption handling:**
   - Abort controller
   - Graceful shutdown

## CI/CD Integration

Integration tests are designed to be **optional in CI**:

```yaml
# .github/workflows/test.yml
- name: Run unit tests (always)
  run: npm test -- --testPathIgnorePatterns=integration

- name: Run integration tests (if workbench available)
  if: env.WORKBENCH_URL
  run: npm test -- openai-agent-provider.integration
```

## Troubleshooting

### Tests are skipped

**Symptom:** You see `⏭️  Skipping integration tests`

**Solution:** Set `WORKBENCH_URL` environment variable

### Workbench not healthy

**Symptom:** You see `⚠️  Workbench not healthy`

**Possible causes:**

1. eGemma server not running
2. Chat model not loaded (check `/health` endpoint)
3. Tool support disabled (`supports_tools: false`)

**Solution:** Check eGemma logs and ensure the model is loaded correctly

### Tool calling tests fail

**Symptom:** `toolUseCalled` is false

**Possible causes:**

1. Harmony format parsing issue (server-side)
2. Model not generating tool calls
3. SDK event parsing issue (client-side)

**Solution:** Check eGemma logs for `[TOOL PARSING]` and `[PARSE_TOOL_CALLS]` messages

## Adding New Integration Tests

When adding new tests:

1. **Always check `shouldRunIntegrationTests` and `isHealthy`:**

   ```typescript
   test('my new test', async () => {
     if (!shouldRunIntegrationTests || !isHealthy) {
       return;
     }
     // Test code here
   });
   ```

2. **Set appropriate timeouts** for model inference:

   ```typescript
   test('my test', async () => {
     // ...
   }, 45000); // 45s timeout
   ```

3. **Use descriptive assertions:**

   ```typescript
   expect(toolUseCalled).toBe(true); // Clear intent
   ```

4. **Clean up resources** if needed (conversations, files, etc.)

## Philosophy

Integration tests serve as:

- **Validation** of OpenAI API compatibility (eGemma)
- **Documentation** of expected behavior
- **Regression prevention** for tool calling and session management

They do NOT replace:

- Unit tests (mocked, always run)
- eGemma's own tests (server-side validation)
