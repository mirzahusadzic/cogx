# Inject All Messages

Inject all pending messages from the message queue into the conversation.

## Your Task

1. **List all pending messages** from `.sigma/message_queue/{agent-id}/`
2. **Inject each message** in chronological order (oldest first)
3. **Update all statuses** to `injected` after successful injection
4. **Provide summary** of total messages processed

## Output Format

**📨 Injecting {count} Pending Messages**

---

**Message 1/N from {from-agent-id}**
**Topic**: `{topic}`

{message-content}

---

**Message 2/N from {from-agent-id}**
**Topic**: `{topic}`

{message-content}

---

[Repeat for each message]

---

**✅ Summary**

- Total messages injected: {count}
- All message statuses updated to: injected

## Error Handling

If no messages:

**📭 No pending messages to inject**

Your message queue is empty.
