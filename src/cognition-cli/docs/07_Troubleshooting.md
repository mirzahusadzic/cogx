# Troubleshooting Guide: When Your Vitest Spy Fails But `stdout` Shows It Ran

You've just spent hours on a test that is failing. The assertion `expect(mySpy).toHaveBeenCalledTimes(1)` insists the spy was called 0 times, but the test output (`stdout`) right above the failure clearly shows the logs from the function you are trying to spy on. It feels impossible, but it's a classic sign of a subtle and frustrating module mocking issue.

This guide explains why it happens and provides a robust, pragmatic solution.

## The Symptom

You have a test setup like this:

```typescript
// test-file.test.ts
import * as myModule from './my-module.js';
vi.spyOn(myModule, 'functionToSpyOn');

// ... test logic that calls myModule.functionUnderTest()
// functionUnderTest() internally calls functionToSpyOn()

expect(myModule.functionToSpyOn).toHaveBeenCalled(); // Fails, says 0 calls
```

But your test runner's console output clearly shows logs from inside `functionToSpyOn`.

## The Root Cause: The "Disconnected Spy"

The core problem is that the instance of the function being called by your code is **different** from the instance your spy is attached to.

Think of it like two different phones with the same phone number. Your code-under-test (`functionUnderTest`) is calling one phone, but your test is listening for a ring on the _other_ one.

This happens due to the complexities of the ES Module system and how test runners like Vitest "hoist" `vi.mock` calls to the very top of the files before they run. This can sometimes create separate module instances or closures, leaving your spy disconnected from the code that's actually executing.

## The Ultimate Solution: Test the Side Effect

When internal mocking becomes this difficult, stop fighting it. Instead of testing the _implementation detail_ (that function A calls function B), test the ultimate, observable **side effect** of the code.

In our case, the ultimate side effect was that the `queryCommand` caused text to be printed to the console. So, we'll test that.

**Step 1: Do NOT mock the module you are testing.**
Let `query.js` be the real module. We want to test its behavior as a whole.

**Step 2: Identify and spy on the global dependency.**
The most reliable thing to spy on is the global `console` object. This is guaranteed to be the same instance for both your test and the code being executed.

**Step 3: Assert against the _content_ of the side effect.**
Instead of checking if a function was called, check that the expected text was actually logged.

## Example: The Final, Working Pattern

Here is the robust pattern that solved our issue.

```typescript
// src/commands/query.test.ts
import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  Mocked,
} from 'vitest';

// 1. Import the module directly without mocking it.
import { queryCommand } from './query.js';
import { PGCManager } from '../core/pgc-manager.js';
// ... other necessary imports

// 2. We only mock EXTERNAL dependencies.
vi.mock('../core/pgc-manager.js');

describe('My Command', () => {
  let consoleLogSpy: vi.SpyInstance;

  beforeEach(() => {
    // 3. Before each test, spy on `console.log`.
    // The mockImplementation prevents logs from spamming the test output.
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    // ... (setup for mocked external dependencies like PGCManager)
  });

  afterEach(() => {
    // 4. IMPORTANT: Restore the original console.log after each test.
    vi.restoreAllMocks();
  });

  it('should produce the correct output', async () => {
    // Arrange: set up mocks for external dependencies to return expected data
    // ...

    // Act: run the real command
    await queryCommand(/* ...args */);

    // Assert: Check the captured console output

    // 5. Combine all captured logs into a single string.
    const allLogs = consoleLogSpy.mock.calls.flat().join('\n');

    // 6. Assert that the key parts of the output are present.
    expect(allLogs).toContain('--- Relevant Context ---');
    expect(allLogs).toContain('extractStructure');
  });
});
```

## Key Takeaway

When a spy on an internal function fails despite evidence it ran, stop trying to mock your own module. **Switch your testing strategy to spy on a stable, external dependency (like `console`) and test the final, observable side effect.** This leads to more robust, less brittle tests that are immune to complex module mocking issues.
