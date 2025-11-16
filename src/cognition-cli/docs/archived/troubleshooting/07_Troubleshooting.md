# Troubleshooting Guide: My Spy Fails But The Code Ran

You're staring at a failing test. The assertion `expect(mySpy).toHaveBeenCalled()` insists the function was never called, but your console is filled with `console.log` output from that exact function. It's a maddening paradox that feels like a bug in the test runner itself.

This is a classic and subtle module mocking issue. This guide explains the root cause and provides a robust, philosophically sound solution.

## The Root Cause: The "Two Phones" Problem

The core of the issue is that **the instance of the module your test is spying on is different from the instance your code is actually executing.**

Imagine you have two identical phones, both with the same phone number.

- Your code-under-test makes a call. **One phone rings.**
- Your test, with its spy, is listening for a call on the **other phone.**

The call was made, the log proves it rang, but your spy heard nothing because it was listening in the wrong place. This "disconnected spy" problem often arises from the complex ways JavaScript modules are loaded, mocked, and cached by modern test runners like Vitest.

## The Solution: Stop Testing the Implementation, Start Testing the Outcome

When internal mocking becomes this brittle, it's a sign that you're testing an _implementation detail_ (that function A calls function B) instead of the **verifiable outcome**. The most robust solution is to shift your perspective.

Instead of asking, "Was my internal function called?" ask, "Did the command produce the final, observable side effect I expected?"

In many CLI tools, the ultimate side effect is text printed to the console. The `console` object is a stable, global dependency that is guaranteed to be the _same instance_ for both your test and your code. It is the perfect place to listen.

### The Robust Pattern: Spy on the Side Effect

Here is the final, working pattern for testing a command's output, immune to module mocking issues.

```typescript
// src/commands/query.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// 1. Import the REAL command. Do NOT mock the module you are testing.
import { queryCommand } from './query.js';
import { PGCManager } from '../core/pgc-manager.js';

// 2. Only mock EXTERNAL dependencies (like the PGCManager).
vi.mock('../core/pgc-manager.js');

describe('queryCommand', () => {
  let consoleLogSpy: vi.SpyInstance;

  beforeEach(() => {
    // 3. Spy on the STABLE, GLOBAL side effect: `console.log`.
    // The mockImplementation prevents test output from being polluted.
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    // (Setup mocks for PGCManager, etc.)
  });

  afterEach(() => {
    // 4. ALWAYS restore the spy to avoid breaking other tests.
    vi.restoreAllMocks();
  });

  it('should produce the correct output when called', async () => {
    // Arrange: Mock the PGCManager to return predictable data.
    // ...

    // Act: Run the real, unmocked command.
    await queryCommand(/*...args...*/);

    // Assert: Check the content of what was printed to the console.

    // 5. Aggregate all calls to the spy into a single string for easy searching.
    const allLogs = consoleLogSpy.mock.calls.flat().join('\n');

    // 6. Assert that the key, observable outputs are present.
    expect(allLogs).toContain('--- Relevant Context ---');
    expect(allLogs).toContain('TheSymbolYouSearchedFor');
    expect(allLogs).not.toContain('AnErrorShouldNotAppear');
  });
});
```

## Architectural Principle

When a test spy on an internal function becomes unreliable, it is a sign to **elevate your test's perspective.** Stop verifying the hidden wiring inside the box. Instead, verify the observable, final output of the box as a whole. This leads to tests that are not only more robust and less brittle but also more aligned with the user's actual experience.
