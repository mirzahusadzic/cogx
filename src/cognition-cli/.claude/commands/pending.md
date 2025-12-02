# Show Pending Messages

List all pending messages in the agent's message queue.

## Your Task

Display all pending inter-agent messages that have been received via the ZeroMQ bus and stored in the MessageQueue. Show message details including sender, topic, content preview, and message ID.

## Technical Details

Messages are stored in `.sigma/message_queue/{agent-id}/` with:

- Status: `pending`, `read`, `injected`, or `dismissed`
- Format: JSON with `from`, `to`, `topic`, `content`, `timestamp`, `status`
- Index file provides O(1) count lookup

## Output Format

If messages exist:

**📬 Pending Messages ({count})**

---

**Message ID**: `{message-id}`
**From**: `{from-agent-id}`
**Topic**: `{topic}`
**Received**: `{timestamp}`
**Content**:

```
{message-content}
```

---

[Repeat for each message]

**Actions**:

- `/inject {message-id}` - Inject specific message into conversation
- `/inject-all` - Inject all pending messages
- `/dismiss {message-id}` - Dismiss specific message

---

If no messages:

**📭 No pending messages**

Your message queue is empty.
