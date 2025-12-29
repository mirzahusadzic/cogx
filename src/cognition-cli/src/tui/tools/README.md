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

Task management with delegation and PGC grounding support, using the **v2.0 Protocol**. This tool replaces the native `TodoWrite` with enhanced features for structured task management, delegation, and robust knowledge grounding.

**v2.0 Protocol**: Uses three parallel top-level arrays (`todos`, `grounding`, `grounding_evidence`) that correlate via a shared `id` to reduce schema complexity.

#### `todos` Array (Core Task Information)

| Field                 | Description                                                                           |
| --------------------- | ------------------------------------------------------------------------------------- |
| `id`                  | Unique stable identifier for the task (e.g., `fix-ruff-api`)                          |
| `content`             | Imperative form describing the task (e.g., "Run tests")                               |
| `activeForm`          | Present continuous form for UI display (e.g., "Running tests")                        |
| `status`              | `pending` / `in_progress` / `completed` / `delegated`                                 |
| `delegated_to`        | Agent ID this task was delegated to (e.g., `flash1`). Set when status is `delegated`. |
| `acceptance_criteria` | Array of strings defining success criteria. **Required when delegating.**             |
| `context`             | Additional context for the delegated worker                                           |
| `delegate_session_id` | Worker's session ID (for audit trail)                                                 |
| `result_summary`      | Worker's completion report                                                            |

#### `grounding` Array (PGC Grounding Instructions for Worker)

| Field               | Description                                                                            |
| ------------------- | -------------------------------------------------------------------------------------- |
| `id`                | Correlates with a `todo` item's `id`.                                                  |
| `strategy`          | PGC grounding strategy: `pgc_first`, `pgc_verify`, `pgc_cite`, `none`                  |
| `overlay_hints`     | Hints about which PGC overlays (O1-O7) are most relevant                               |
| `query_hints`       | Semantic query hints for the worker's PGC                                              |
| `evidence_required` | `true`/`false` or `"true"`/`"false"` (string bool) if evidence citations are required. |

#### `grounding_evidence` Array (Structured Evidence Returned by Worker)

| Field                  | Description                                                                          |
| ---------------------- | ------------------------------------------------------------------------------------ |
| `id`                   | Correlates with a `todo` item's `id`.                                                |
| `queries_executed`     | List of semantic queries run by the worker                                           |
| `overlays_consulted`   | List of PGC overlays (O1-O7) consulted by the worker                                 |
| `citations`            | Array of objects with `overlay`, `content`, `relevance`, and `file_path` (optional). |
| `grounding_confidence` | Worker's confidence in grounding: `high`, `medium`, `low`                            |
| `overlay_warnings`     | Any warnings encountered during overlay consultation                                 |

**Example Usage**:

```typescript
// Manager creates a delegated task with PGC grounding requirements
SigmaTaskUpdate({
  todos: [
    {
      id: 'refactor-user-auth',
      content: 'Refactor user authentication module',
      activeForm: 'Refactoring user authentication module',
      status: 'delegated',
      delegated_to: 'auth-expert-agent',
      acceptance_criteria: [
        'All auth tests pass',
        'No regressions in OAuth flow',
        'Code adheres to security standards',
      ],
      context: 'Focus on improving token validation and session management.',
    },
  ],
  grounding: [
    {
      id: 'refactor-user-auth',
      strategy: 'pgc_verify',
      overlay_hints: ['O2', 'O4'], // Security, Mission overlays
      query_hints: ['security standards', 'token validation best practices'],
      evidence_required: true,
    },
  ],
});

// Worker completes the task and reports back with grounding evidence
SigmaTaskUpdate({
  todos: [
    {
      id: 'refactor-user-auth',
      content: 'Refactor user authentication module',
      activeForm: 'Refactoring user authentication module',
      status: 'completed',
      delegated_to: 'auth-expert-agent',
      result_summary: 'Auth module refactored, new tests added, all passing.',
    },
  ],
  grounding_evidence: [
    {
      id: 'refactor-user-auth',
      queries_executed: [
        'semantic search for "token validation"',
        '"auth best practices" in PGC',
      ],
      overlays_consulted: ['O2', 'O4'],
      citations: [
        {
          overlay: 'O2',
          content: 'Recommended token expiry is 1 hour for session tokens.',
          relevance: 'Directly applied to session token configuration.',
          file_path: 'src/auth/config.ts',
        },
      ],
      grounding_confidence: 'high',
      overlay_warnings: [],
    },
  ],
});
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
