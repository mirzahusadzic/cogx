# IPC Module - Multi-Agent Communication Bus

The **IPC (Inter-Process Communication)** module enables different AI agents (TUI instances, headless workers, tools) to discover each other and collaborate in real-time.

It implements a **decentralized message bus** using ZeroMQ, allowing agents to coordinate tasks, share context, and execute complex workflows without a central "brain".

## 🚀 Key Features

- **Zero-Config Discovery**: Agents automatically find the bus master or elect themselves as master.
- **Topic-Based Pub/Sub**: Efficient broadcasting of events (heartbeats, notifications).
- **Direct Messaging**: Reliable 1:1 communication between specific agents.
- **Agent Registry**: Real-time tracking of active agents, their capabilities, and status.
- **Message Queues**: Persistent mailboxes for every agent (file-based backup).

## 🏗️ Architecture

The system is built on a **Brokerless ZeroMQ** architecture with a unified abstraction layer.

```mermaid
graph TD
    AgentA["TUI Agent"] <-->|ZeroMQ| AgentB["Background Agent"]

    subgraph "IPC Module Layer"
        MB[MessageBus]
        MB --> Coord[BusCoordinator]
        MB --> ZMQ[ZeroMQBus]
        MB --> Reg[AgentRegistry]
        MB --> Pub[MessagePublisher]
    end

    MB --- Queue[MessageQueue]
```

### Core Components

#### 0. MessageBus (`MessageBus.ts`)

The **unified entry point** for all IPC operations. It consolidates the lifecycle management of the ZeroMQ sockets and coordination locks.

- **Simplified API**: `connect()`, `disconnect()`, `publish()`, `subscribe()`.
- **Integrated Registry**: Automatically manages agent registration and discovery.
- **Publisher Wrapper**: Provides convenience methods for broadcasting and direct messaging.

#### 1. ZeroMQBus (`ZeroMQBus.ts`)

The low-level transport layer.

- **Publisher (`PUB`)**: Broadcasts heartbeats and public events.
- **Subscriber (`SUB`)**: Listens for relevant topics.
- **Router/Dealer**: Handles direct request-response patterns (future use).

#### 2. BusCoordinator (`BusCoordinator.ts`)

Handles the "race to become master".

- Tries to bind to port `5555`.
- If successful -> Becomes **Bus Master**.
- If port busy -> Connects as **Peer**.
- Ensures the network always has a hub.

#### 3. AgentRegistry (`AgentRegistry.ts`)

Keeps track of "Who is online?".

- Maintains an in-memory map of active agents.
- Prunes "dead" agents who miss heartbeats (TTL: 30s).
- Exposes `getAgent(id)` and `listAgents()` APIs.

#### 4. MessageQueue (`MessageQueue.ts`)

A file-system backed mailbox for reliability.

- Stores messages in `.sigma/message_queue/<agent-id>/`.
- States: `pending` -> `processing` -> `completed` | `failed`.
- Ensures messages aren't lost if an agent crashes.

#### 5. MessageQueueMonitor (`MessageQueueMonitor.ts`)

The active listener.

- Watches the bus for messages directed at the local agent.
- Writes incoming messages to the `MessageQueue`.
- Emits events (`message`, `countChanged`) for the UI to react.

---

## 📦 Message Protocol

All messages follow the `AgentMessage` interface:

```typescript
interface AgentMessage {
  id: string; // UUID
  from: string; // Sender Agent ID
  to: string; // Recipient Agent ID (or 'all')
  topic: string; // e.g., 'agent.command', 'agent.text'
  timestamp: number;
  content: {
    type: string;
    [key: string]: any;
  };
}
```

### Standard Topics

- `agent.heartbeat`: "I am alive" (broadcast every 5s).
- `agent.message`: Chat message intended for an agent.
- `agent.command`: Instruction to execute a tool/action.
- `agent.notification`: Status update (e.g., "Task started").

---

## 💻 Usage

### Connecting to the Bus (Recommended)

```typescript
import { MessageBus } from '../ipc';

// 1. Initialize and Connect
const bus = new MessageBus({
  agentId: 'my-agent-id',
  model: 'claude-3-5-sonnet',
  debug: true,
});

await bus.connect();

// 2. Register Identity
bus.register({
  type: 'interactive',
  model: 'claude-3-5-sonnet',
  status: 'idle',
  capabilities: [{ name: 'code', description: 'Write code', model: 'claude' }],
});

// 3. Send Message
await bus.broadcast('agent.status', { status: 'working' });

// 4. Cleanup
await bus.disconnect();
```

### Receiving Messages

```typescript
import { MessageQueueMonitor } from '../ipc';

const monitor = new MessageQueueMonitor('my-agent-id', bus, ['agent.message']);
await monitor.start();

// React to new messages
monitor.getQueue().on('countChanged', (count) => {
  systemLog('ipc', `You have ${count} pending messages!`);
});
```

---

## 🛡️ Resilience & Safety

- **File-Backed Persistence**: Even if the process dies, the `.sigma/message_queue` retains pending messages.
- **Heartbeat Monitoring**: The system self-heals by removing stale peers.
- **Port Fallback**: If `5555` is locked, it gracefully handles connection failures (though currently optimized for single-machine IPC).

---

## 🌐 Project Isolation & IPC_SIGMA_BUS

By default, agents are **isolated by project**. The bus identity is derived from the project root (the directory containing `.open_cognition`).

### Default Behavior (No IPC_SIGMA_BUS)

Each project gets its own bus, identified by `basename-<path-hash>`:

```
/repo/frontend/.open_cognition  →  bus: frontend-a1b2c3
/repo/backend/.open_cognition   →  bus: backend-d4e5f6
```

Agents in `/repo/frontend` **cannot** see agents in `/repo/backend`.

If you run from a subdirectory without `.open_cognition`, the system walks up to find the nearest ancestor.

### Pattern A: Single Project

One `.open_cognition` at repo root. All agents in any subdirectory share the same bus automatically.

```bash
/repo/.open_cognition
cd /repo/src/components && cognition tui  # → joins /repo bus
cd /repo/src/api && cognition tui         # → same bus, agents see each other
```

### Pattern B: Specialist Sub-Projects (Intra-Repo)

Multiple `.open_cognition` directories for domain-focused PGCs, unified via `IPC_SIGMA_BUS`:

```bash
# Structure
/repo/frontend/.open_cognition   # React-focused knowledge graph
/repo/backend/.open_cognition    # API-focused knowledge graph

# Terminal 1 - Frontend Specialist
cd /repo/frontend
IPC_SIGMA_BUS=myapp cognition tui

# Terminal 2 - Backend Specialist
cd /repo/backend
IPC_SIGMA_BUS=myapp cognition tui
```

Each agent has **focused context** (its own PGC), but they share a bus at `~/.cognition/sigma-myapp/` for collaboration via `query_agent()`.

### Pattern C: Cross-Repository Mesh

Entirely separate codebases collaborating on a shared bus:

```bash
# Repo A - Auth Service
cd ~/projects/auth-service
IPC_SIGMA_BUS=platform cognition tui

# Repo B - API Gateway
cd ~/projects/api-gateway
IPC_SIGMA_BUS=platform cognition tui

# Repo C - Frontend App
cd ~/projects/web-app
IPC_SIGMA_BUS=platform cognition tui
```

All three agents join the `platform` mesh and can query each other's specialized knowledge.

### Environment Variable Reference

| Value      | Bus Location                  | Use Case                   |
| ---------- | ----------------------------- | -------------------------- |
| _(unset)_  | `${projectRoot}/.sigma`       | Default project isolation  |
| `global`   | `~/.cognition/sigma-global`   | Machine-wide mesh          |
| `team`     | `~/.cognition/sigma-team`     | Team collaboration         |
| `<custom>` | `~/.cognition/sigma-<custom>` | Named mesh (e.g., `myapp`) |

---

## 🔍 Cross-Agent Queries

The `query_agent()` tool enables **semantic queries** between agents. Instead of reading another project's code (costly in tokens), ask the specialist agent directly.

### Usage

```typescript
// Ask the backend agent about API contracts
query_agent('backend-agent', 'What is the expected payload for POST /users?');

// Ask the auth agent about security requirements
query_agent(
  'auth-agent',
  'What token validation is required for admin routes?'
);
```

### How It Works

1. **Caller** sends a `query_request` message via the bus
2. **Target agent** receives query, consults its local PGC (O₁-O₇ lattice)
3. **Target agent** sends back a `query_response` with grounded answer
4. **Caller** receives answer (50 tokens vs 100k tokens of reading source)

### Benefits

- **Token efficiency**: Get answers, not raw code
- **Specialized knowledge**: Each agent is expert in its domain
- **Grounded responses**: Answers come from the target's PGC, not hallucination
- **Async-friendly**: 60s timeout with polling for response

---

## 🔮 Future Roadmap

- **Network Bridge**: Extend ZeroMQ over WebSocket for remote collaboration.
- **Shared Memory**: Distributed lattice synchronization via the bus.
- **Swarm Protocol**: Leader election for complex multi-agent tasks.
