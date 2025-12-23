# TUI MCP Tools

This directory contains **MCP (Model Context Protocol) tools** exposed to the AI agent during TUI sessions. These tools enable the agent to interact with the Cognition system beyond basic code editing.

## Tool Categories

### 🔗 Agent Messaging (`agent-messaging-tool.ts`)

Enables agent-to-agent communication over the IPC bus.

| Tool                      | Description                                                 |
| ------------------------- | ----------------------------------------------------------- |
| `list_agents`             | Discover active agents on the bus (aliases, models, status) |
| `send_agent_message`      | Send a direct message to a specific agent                   |
| `broadcast_agent_message` | Broadcast a message to all agents                           |
| `list_pending_messages`   | View unread messages in the queue                           |
| `mark_message_read`       | Mark a message as processed                                 |

**Use case**: Coordination between agents, task handoff, status updates.

```typescript
// Discover who's online
list_agents();

// Send to specific agent
send_agent_message('opus1', 'Can you review the auth changes?');

// Broadcast to all
broadcast_agent_message('Starting database migration...');
```

---

### 🔍 Cross-Project Query (`cross-project-query-tool.ts`)

Enables semantic queries to other agents' knowledge graphs.

| Tool          | Description                               |
| ------------- | ----------------------------------------- |
| `query_agent` | Ask a question, get a PGC-grounded answer |

**Use case**: Ask specialists about their domain without reading their code.

```typescript
// Query the backend expert about API contracts
query_agent('backend-agent', 'What is the payload for POST /users?');

// Query the auth expert about security
query_agent('auth-agent', 'What token validation is required?');
```

**Token efficiency**: Get a 50-token answer instead of reading 100k tokens of source.

---

### ⏳ Background Tasks (`background-tasks-tool.ts`)

Provides awareness of long-running operations.

| Tool                   | Description                                       |
| ---------------------- | ------------------------------------------------- |
| `get_background_tasks` | Query status of genesis, overlay generation, etc. |

**Use case**: Check if background work is in progress before starting new tasks.

```typescript
// Check what's running
get_background_tasks({ filter: 'active' });

// See completed work
get_background_tasks({ filter: 'completed' });
```

---

### 📋 SigmaTaskUpdate (`sigma-task-update-tool.ts`)

Task management with delegation support. Replaces the native `TodoWrite` tool with enhanced features.

| Field                 | Description                                           |
| --------------------- | ----------------------------------------------------- |
| `id`                  | Unique stable identifier for the task                 |
| `content`             | What needs to be done (imperative)                    |
| `activeForm`          | Present continuous form ("Running tests")             |
| `status`              | `pending` / `in_progress` / `completed` / `delegated` |
| `delegated_to`        | Agent ID for delegation (e.g., `flash1`)              |
| `acceptance_criteria` | Array of success criteria for delegated tasks         |
| `context`             | Additional context for the worker                     |

**Delegation workflow**:

```typescript
// Manager creates delegated task
SigmaTaskUpdate({
  todos: [
    {
      id: 'fix-auth-bug',
      content: 'Fix authentication timeout',
      activeForm: 'Fixing authentication timeout',
      status: 'delegated',
      delegated_to: 'flash1',
      acceptance_criteria: ['Tests pass', 'No breaking changes'],
      context: 'The bug is in src/auth/session.ts',
    },
  ],
});

// Manager sends task via IPC
send_agent_message('flash1', JSON.stringify(taskPayload));

// Worker completes and reports back
send_agent_message(
  'opus1',
  JSON.stringify({ taskId: 'fix-auth-bug', result: 'Done' })
);

// Manager verifies and marks complete
SigmaTaskUpdate({ todos: [{ ...task, status: 'completed' }] });
```

---

## Related Tools (Other Locations)

### 🧠 Recall Past Conversation (`src/sigma/recall-tool.ts`)

Semantic search across conversation history. Retrieves full untruncated messages from past turns.

| Tool                       | Description                                            |
| -------------------------- | ------------------------------------------------------ |
| `recall_past_conversation` | Query conversation history across all overlays (O1-O7) |

**Use case**: Retrieve details that were truncated in the recap, or find past discussions.

```typescript
// Find what was discussed about a topic
recall_past_conversation('What did we discuss about TUI scrolling?');

// Retrieve specific details
recall_past_conversation('What were the goals mentioned earlier?');
```

**Note**: Uses LanceDB semantic search - ask about topics, not exact phrases.

---

## Architecture Notes

- All tools use the **Claude Agent SDK** `createSdkMcpServer` pattern
- Tools are dynamically loaded only when the SDK is available
- IPC-related tools require an active ZeroMQ bus connection
- Tools return structured `{ content: [{ type: 'text', text: ... }] }` responses
