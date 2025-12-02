# Inject Message

Inject a specific message from the message queue into the conversation.

## Your Task

1. **Read the message** from `.sigma/message_queue/{agent-id}/{message-id}.json`
2. **Present the message** to the user as if it came from the sending agent
3. **Update status** to `injected` after successful injection
4. **Provide context** about the sender and topic

## Arguments

- `{{FILE_PATH}}` - The message ID to inject (required)

## Output Format

**📨 Injected Message from {from-agent-id}**

**Topic**: `{topic}`
**Received**: `{timestamp}`

---

{message-content}

---

_Message status updated to: injected_

## Error Handling

If message ID not found:

**❌ Error: Message not found**

Message ID `{message-id}` does not exist in the queue.

Use `/pending` to see available messages.
