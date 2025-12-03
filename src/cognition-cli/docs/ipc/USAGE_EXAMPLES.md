# MessagePublisher Usage Examples

This file shows how agents can use the MessagePublisher API to communicate with other agents.

## Prerequisites

The MessagePublisher is available in the TUI via `messagePublisherRef.current`. It's initialized when the session starts.

## Basic Usage

### 1. Send a Simple Message

```typescript
// Send a text message to another agent
await messagePublisher.sendMessage('gemini-a123', 'Please review my code');
```

### 2. Request Code Review

```typescript
// Request another agent to review specific files
await messagePublisher.requestCodeReview(
  'gemini-a123',
  ['src/foo.ts', 'src/bar.ts'],
  'Added new feature X, please check for edge cases'
);
```

### 3. Notify Task Completion

```typescript
// Notify another agent that a task is done
await messagePublisher.notifyTaskComplete(
  'opus-b456',
  'Implemented authentication feature as requested'
);
```

### 4. Broadcast to All Agents

```typescript
// Send a message to all subscribed agents
await messagePublisher.broadcast('agent.notification', {
  type: 'build_complete',
  status: 'success',
  duration: 1234,
});
```

### 5. Custom Topic

```typescript
// Send with a custom topic for specific workflows
await messagePublisher.sendTo('claude-c789', 'code.analysis_ready', {
  analysisType: 'security',
  findings: 5,
  severity: 'medium',
});
```

---

## Agent-to-Agent Workflow Example

### Scenario: Code Review Workflow

**Agent Sonnet (Me):**

```typescript
// 1. User asks me to implement a feature
// 2. I implement the code
// 3. I notify Gemini to review it
await messagePublisher.requestCodeReview(
  'gemini-a123',
  ['src/auth.ts'],
  'Implemented JWT authentication. Please verify security.'
);
```

**Agent Gemini:**

```typescript
// 1. Sees: "📬 1 message" in overlay bar
// 2. Runs: /pending (built-in command)
// 3. Runs: /inject {message-id} (built-in command)
// 4. Reviews the code
// 5. Sends response back

await messagePublisher.sendMessage(
  'sonnet-x456',
  'Code review complete. Found 2 issues: [list issues]. Please fix and resubmit.'
);
```

**Agent Sonnet (Me):**

```typescript
// 1. Receives Gemini's response
// 2. Fixes the issues
// 3. Notifies Gemini again

await messagePublisher.notifyTaskComplete(
  'gemini-a123',
  'Fixed the 2 issues you mentioned. Ready for re-review.'
);
```

---

## Built-in Slash Commands

These commands are available in the TUI for managing inter-agent messages:

| Command                      | Description                            |
| ---------------------------- | -------------------------------------- |
| `/pending`                   | Show pending messages in queue         |
| `/inject <id>`               | Inject a message into the conversation |
| `/inject-all`                | Inject all pending messages            |
| `/send <agent-id> <message>` | Send a message to another agent        |
| `/dismiss <id>`              | Dismiss a message from queue           |

---

## Message Topics

Common topics for agent communication:

| Topic                  | Purpose               | Example Content                                 |
| ---------------------- | --------------------- | ----------------------------------------------- |
| `agent.message`        | General text messages | `{ type: "text", message: "..." }`              |
| `agent.notification`   | Status updates        | `{ type: "task_complete", description: "..." }` |
| `agent.command`        | Direct commands       | `{ command: "review", args: [...] }`            |
| `code.review_request`  | Code review requests  | `{ files: [...], context: "..." }`              |
| `code.review_complete` | Review results        | `{ status: "approved", issues: [...] }`         |
| `test.results`         | Test run results      | `{ passed: 42, failed: 0 }`                     |
| `build.complete`       | Build completion      | `{ status: "success", artifacts: [...] }`       |

---

## Error Handling

```typescript
try {
  await messagePublisher.sendMessage('invalid-agent', 'Hello');
} catch (err) {
  console.error('Failed to send message:', err);
  // ZeroMQ errors are typically transient (connection issues)
  // Retry logic could be added here
}
```

---

## Best Practices

1. **Use Descriptive Topics**: Choose topics that clearly indicate message purpose
2. **Include Context**: Provide enough information for the recipient to act
3. **Broadcast Sparingly**: Use targeted messages when possible to avoid noise
4. **Check Recipient Status**: Consider if the recipient agent is running
5. **Handle Async**: Messages are fire-and-forget; don't expect immediate response

---

## Future Enhancements

Potential additions to the MessagePublisher API:

- **Message Priorities**: Urgent vs. normal messages
- **Delivery Confirmation**: ACK/NACK responses
- **Message Expiry**: Auto-dismiss old messages
- **Agent Discovery**: Query which agents are online
- **Conversation Threads**: Link related messages together
