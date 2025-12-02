# Send Message

Send a message to another agent via the ZeroMQ message bus.

## Your Task

Send a message from this agent to another agent using the MessagePublisher API. The message will be delivered via ZeroMQ and stored in the recipient's MessageQueue.

## Arguments

- `{{FILE_PATH}}` - Target agent ID (e.g., "gemini-a123", "opus-b456")
- `{{ALL_ARGS}}` - Complete message content (everything after agent ID)

## How It Works

1. **Message is published** via ZeroMQ to topic `agent.message`
2. **Recipient's MessageQueueMonitor** receives it (if they're subscribed)
3. **Message is stored** in `.sigma/message_queue/{recipient-id}/`
4. **Recipient sees** `📬 N messages` in their overlay bar
5. **Recipient runs** `/pending` to view and `/inject` to read

## Technical Details

Uses MessagePublisher API:

```typescript
await messagePublisher.sendMessage(toAgentId, message);
```

This publishes an AgentMessage with:

- `from`: Current agent ID
- `to`: Target agent ID
- `topic`: "agent.message"
- `content`: { type: "text", message: "..." }
- `timestamp`: Current time

## Usage Example

```
/send gemini-a123 Please review the code I just implemented in src/foo.ts
```

This sends to agent "gemini-a123" with message:

> "Please review the code I just implemented in src/foo.ts"

## Output Format

**📤 Message Sent**

**To**: `{target-agent-id}`
**Topic**: `agent.message`
**Content**: `{message-text}`

The recipient will see this in their message queue when they run `/pending`.

---

**Next Steps for Recipient:**

1. Recipient sees `📬 1 message` in overlay bar
2. Recipient runs `/pending` to list messages
3. Recipient runs `/inject {message-id}` to bring it into conversation

## Error Handling

If target agent ID is not provided:

**❌ Error: Missing agent ID**

Usage: `/send <agent-id> <message>`

Example: `/send gemini-a123 Please review my code`
