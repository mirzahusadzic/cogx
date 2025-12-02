# Dismiss Message

Dismiss a specific message from the message queue without injecting it.

## Your Task

1. **Read the message** from `.sigma/message_queue/{agent-id}/{message-id}.json`
2. **Update status** to `dismissed`
3. **Confirm dismissal** to the user

## Arguments

- `{{FILE_PATH}}` - The message ID to dismiss (required)

## Output Format

**✓ Message Dismissed**

**Message ID**: `{message-id}`
**From**: `{from-agent-id}`
**Topic**: `{topic}`

The message has been marked as dismissed and will not appear in pending messages.

Use `/pending` to see remaining messages.

## Error Handling

If message ID not found:

**❌ Error: Message not found**

Message ID `{message-id}` does not exist in the queue.

Use `/pending` to see available messages.
