# Task: Error Handling & Resilience Review for Cognition Σ

## Context

Comprehensive analysis of error handling, edge cases, and system resilience in the Cognition Σ CLI codebase. Focus on reliability, user experience during failures, and graceful degradation.
Phase 1: Error Coverage Analysis (30 min)
Unhandled Errors

    Promise rejection audit:
        Search for async functions without try-catch
        Find .then() calls without .catch()
        Identify Promise.all() without error handling
        Check for floating promises (fire-and-forget without await)

    Synchronous error handling:
        Find throw statements without surrounding try-catch
        Identify error-prone operations (JSON.parse, parseInt, etc.)
        Check for missing null/undefined checks

    Event-driven errors:
        Event emitters without error listeners
        Stream error handling
        Process event handlers (uncaughtException, unhandledRejection)

Code Patterns to Search For

// Anti-patterns:
async function foo() {
await riskyOperation(); // No try-catch
}

promise.then(result => ...); // No .catch()

JSON.parse(untrustedInput); // No try-catch

array[0].property; // No null check

Phase 2: User-Facing Error Quality (25 min)
Error Message Analysis

    Clarity audit:
        Are error messages jargon-free?
        Do they explain WHAT went wrong?
        Do they suggest HOW to fix it?
        Are technical stack traces hidden from users?

    Actionability:
        Do errors include next steps?
        Are file paths/line numbers shown when relevant?
        Is there a link to docs/help?

    Consistency:
        Is error formatting consistent across commands?
        Are similar errors worded similarly?
        Is error severity indicated (warning vs error vs fatal)?

Examples to Collect

    Best error message found
    Worst error message found
    Most common error
    Most confusing error

Phase 3: Recovery Mechanisms (25 min)
Retry Logic

    Current retry patterns:
        Find retry implementations
        Check for exponential backoff
        Identify max retry limits
        Verify idempotency of retried operations

    Missing retry opportunities:
        Network requests without retry
        Database operations without retry
        File I/O failures that could be retried
        Transient failures (race conditions, locks)

Graceful Degradation

    Fallback strategies:
        When LanceDB is unavailable, what happens?
        When embedding API fails, is there a fallback?
        When config file is corrupt, are defaults used?
        When dependencies are missing, is user informed?

    Partial failure handling:
        If batch operation fails mid-way, is progress saved?
        Can operations resume from checkpoint?
        Are atomic operations truly atomic?

Phase 4: Edge Case Handling (25 min)
Input Validation

    Boundary conditions:
        Empty arrays/objects
        Null/undefined values
        Zero/negative numbers where positive expected
        Very large inputs (arrays, files, strings)

    Type safety gaps:
        Use of any type
        Unchecked type assertions (as Type)
        Missing runtime validation
        Schema validation for external data

    File system edge cases:
        Non-existent files/directories
        Permission errors
        Disk full scenarios
        Symbolic link handling
        Path traversal vulnerabilities

Command-Line Specific

    Missing required arguments
    Invalid argument types
    Conflicting flags
    Unknown commands/subcommands

Phase 5: Failure Mode Analysis (20 min)
Critical Dependencies

For each critical dependency, answer:

    What happens when it fails?
    Is failure detected quickly?
    Is there a helpful error message?
    Can the system recover?

    LanceDB failure modes:
        Database file corruption
        Schema migration failures
        Query timeouts
        Lock conflicts

    File system failure modes:
        .sigma/ or .open_cognition/ missing
        Corrupt PGC files
        Concurrent file access
        Out of disk space

    External API failures (if applicable):
        Network timeouts
        Rate limiting
        Authentication failures
        API version mismatches

    Resource exhaustion:
        Memory limits exceeded
        CPU throttling
        Open file descriptor limits
        Stack overflow (deep recursion)

Phase 6: Logging & Observability (15 min)
Error Logging

    What gets logged?:
        Are all errors logged before throwing?
        Is context included (user action, input, state)?
        Are stack traces preserved?
        Is there a distinction between expected vs unexpected errors?

    Log levels:
        Are error severities categorized (debug, info, warn, error, fatal)?
        Can verbosity be controlled?
        Are logs structured (JSON) or unstructured?

    Debugging support:
        Is there a debug mode?
        Can users attach logs to bug reports easily?
        Are error IDs/codes used for searchability?

Deliverable Format

## Error Handling & Resilience Review Report

## Executive Summary

- **Overall Resilience Score**: [X/10 with justification]
- **Most Critical Gap**: [Biggest risk to users]
- **User Experience Impact**: [How errors affect UX]
- **Quick Win**: [Easiest high-impact improvement]

## Critical Issues (Fix Immediately)

### 1. [Issue Name]

- **Location**: `file/path.ts:123`
- **Risk Level**: Critical/High/Medium
- **Problem**: [Specific error handling gap]
- **User Impact**: [What happens to users]
- **Fix**: [Concrete solution with code example]
- **Effort**: [Hours to implement]

[Repeat for each critical issue]

## Error Coverage Findings

### Unhandled Errors

| Location    | Error Type                  | Impact    | Fix Effort |
| ----------- | --------------------------- | --------- | ---------- |
| file.ts:123 | Unhandled promise rejection | App crash | 30min      |

**Statistics**:

- Async functions without try-catch: X
- Promises without .catch(): Y
- Floating promises: Z
- Missing null checks: N

**Top 3 Recommendations**:

1. [Specific fix with code example]
2. ...

### User-Facing Error Quality

**Best Error Example**:

Error: Failed to initialize .sigma directory at /path/to/project Cause: Permission denied (EACCES) Solution: Run with appropriate permissions or choose a different directory Help: <https://docs.cognition-sigma.dev/troubleshooting#init-permission>

**Worst Error Example**:

Error: undefined at Object.<anonymous> (/src/index.js:42:11) ... [30 lines of stack trace]

**Error Quality Metrics**:

- Errors with actionable messages: X%
- Errors with help links: Y%
- Errors with stack traces exposed to users: Z% (should be 0%)
- Average error message clarity score: N/10

**Top 5 Most Common Errors**:

1. [Error + frequency]
2. ...

**Recommendations**:

1. Standardize error formatting with template
2. Add error recovery suggestions
3. Create error code system for documentation
4. Hide technical stack traces, show user-friendly summary

## Recovery Mechanisms

### Retry Logic Audit

- **Operations with retry**: [Count + examples]
- **Operations missing retry**: [Count + critical examples]
- **Retry configurations**: [Timeouts, max attempts, backoff]

**Recommendations**:

1. Implement retry wrapper for network operations
2. Add exponential backoff to LanceDB queries
3. Make retry limits configurable

### Graceful Degradation Assessment

| Dependency  | Failure Mode | Current Behavior | Desired Behavior    | Gap |
| ----------- | ------------ | ---------------- | ------------------- | --- |
| LanceDB     | Unavailable  | CLI crashes      | Use fallback/warn   | Yes |
| Config file | Corrupt      | Error + exit     | Use defaults + warn | Yes |

**Recommendations**:

1. [Specific degradation strategy]
2. ...

## Edge Case Handling

### Input Validation Gaps

- **Missing validations**: X instances
- **Type safety gaps**: Y uses of `any`
- **Schema validation**: Z missing checks

**Critical Edge Cases Found**:

1. **Empty array handling** - `file.ts:123`
   - Problem: No check before `array[0]`
   - Fix: Add length check or optional chaining
2. **Large file handling** - `file.ts:456`
   - Problem: Loads entire file into memory
   - Fix: Use streaming for files >10MB

**Recommendations**:

1. Add Zod/Joi schema validation at boundaries
2. Implement input sanitization helpers
3. Add file size checks before loading

### File System Edge Cases

- **Permission errors**: [Handling quality]
- **Missing directories**: [Auto-create or error?]
- **Corrupt files**: [Detection + recovery]
- **Concurrent access**: [Lock mechanisms]

**Recommendations**:

1. [Specific edge case fix]
2. ...

## Failure Mode Analysis

### Dependency Failure Matrix

#### LanceDB Failures

| Failure       | Detection | Error Message | Recovery   | Grade |
| ------------- | --------- | ------------- | ---------- | ----- |
| DB corrupt    | ❌ No     | ❌ Generic    | ❌ No      | F     |
| Query timeout | ✅ Yes    | ⚠️ Technical  | ⚠️ Partial | C     |

**Critical Gaps**:

1. No detection of corrupted database files
2. No automatic recovery from schema migrations
3. Lock conflicts not handled gracefully

**Recommendations**:

1. Add DB integrity checks on startup
2. Implement migration rollback
3. Add lock retry with timeout

#### File System Failures

[Similar matrix for FS failures]

#### Resource Exhaustion

- **Memory limits**: [How handled?]
- **Disk space**: [Checked proactively?]
- **Open files**: [Limits respected?]

**Recommendations**:

1. Add disk space check before large writes
2. Implement streaming for memory-intensive operations
3. Add resource usage monitoring in debug mode

## Logging & Observability

### Current State

- **Logging library**: [Name + version]
- **Log levels used**: [debug/info/warn/error/fatal]
- **Structured logging**: ✅/❌
- **Debug mode available**: ✅/❌

### Gaps

- [ ] Errors not consistently logged
- [ ] Missing context in log messages
- [ ] No correlation IDs for request tracing
- [ ] Stack traces not preserved

### Recommendations

1. Standardize logging with wrapper
2. Add request/operation correlation IDs
3. Implement structured error logging
4. Create debug mode with verbose output

## Error Handling Best Practices Compliance

- [ ] All async functions have error handling (X% compliance)
- [ ] All external calls have retry logic (Y% compliance)
- [ ] All user input is validated (Z% compliance)
- [ ] All errors have user-friendly messages (N% compliance)
- [ ] All critical operations are atomic (M% compliance)

## Code Examples

### Example 1: Unhandled Promise

**Before:**

```typescript
async function fetchData() {
  const data = await api.get('/data');  // Can throw
  return data;
}

After:

async function fetchData() {
  try {
    const data = await api.get('/data');
    return data;
  } catch (error) {
    logger.error('Failed to fetch data', { error, url: '/data' });
    throw new UserFacingError(
      'Unable to fetch data from server',
      'Check your internet connection and try again',
      error
    );
  }
}

Example 2: Missing Input Validation

Before:

function processItems(items: any[]) {
  return items.map(item => item.name.toUpperCase());
}

After:

function processItems(items: unknown): string[] {
  if (!Array.isArray(items)) {
    throw new ValidationError('Expected array of items');
  }
  return items.map(item => {
    if (!item || typeof item.name !== 'string') {
      throw new ValidationError('Each item must have a string name');
    }
    return item.name.toUpperCase();
  });
}

Resilience Roadmap
Phase 1: Critical Fixes (1-2 days)

    Add global unhandled rejection handler
    Fix top 5 crash-causing errors
    Add input validation to CLI commands

Phase 2: Error Quality (3-5 days)

    Standardize error messages
    Add recovery suggestions
    Implement error code system
    Create troubleshooting docs

Phase 3: Defensive Programming (1-2 weeks)

    Add retry logic to network operations
    Implement graceful degradation for dependencies
    Add schema validation at boundaries
    Comprehensive edge case handling

Phase 4: Observability (1 week)

    Structured logging system
    Debug mode implementation
    Error analytics/tracking
    Performance monitoring

Recommended Patterns
Error Wrapper Pattern

class CognitionError extends Error {
  constructor(
    public userMessage: string,
    public technicalMessage: string,
    public suggestion: string,
    public docsLink?: string,
    public originalError?: Error
  ) {
    super(technicalMessage);
  }
}

Retry Wrapper

async function withRetry<T>(
  operation: () => Promise<T>,
  options: { maxAttempts: number; backoff: number }
): Promise<T> {
  // Implementation
}

Summary Metrics:

    Critical unhandled errors: X
    Error message quality score: Y/10
    Resilience score: Z/10
    Estimated implementation effort: H hours


## Success Criteria

✅ All unhandled error paths identified
✅ User-facing error quality assessed
✅ Recovery mechanisms evaluated
✅ Edge cases catalogued
✅ Failure modes mapped
✅ Concrete remediation roadmap

---

Focus on user impact - how do errors affect the user experience?
```
