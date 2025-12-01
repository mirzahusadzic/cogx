# Feature Specification: Multi-Agent Collaborative System with Interactive Background Tasks

**Version:** 2.0.2
**Date:** 2025-12-02
**Status:** Proposal (Major Architectural Revision)
**Author:** Claude Sonnet 4.5 (based on user requirements), revised by Claude Opus 4.5
**Previous Version:** 2.0.1 (Federated approach)
**Breaking Change:** Shifts from headless-first to **federated multi-agent system** as Phase 1 goal (using existing terminal tabs, NOT internal tab UI)

---

## Executive Summary

This specification proposes a **Federated Multi-Agent Collaborative System** for Cognition CLI that enables multiple AI agents (Gemini, Claude, Opus) to work together through **ZeroMQ pub/sub communication** while maintaining separate interactive conversations with the user in their existing terminal tabs. The system supports both **interactive agents** (independent TUI instances) and **background tasks** (headless execution), with zero-hardcoded workflows and dynamic permission delegation.

**Key Innovation:** Instead of building internal tab UI, we leverage the user's existing terminal tabs (iTerm, tmux, Wezterm, etc.) and add a ZeroMQ pub/sub layer for agent-to-agent communication. Each `cognition-cli tui` instance is a peer that auto-connects to a shared message bus.

---

## 1. Problem Statement

### 1.1 Current User Workflow (Manual Multi-Agent)

**What users do today:**

```
Terminal 1: cognition-cli tui --model gemini
Terminal 2: cognition-cli tui --model claude
Terminal 3: cognition-cli tui --model opus

User manually:
1. Asks Gemini for high-level architecture design
2. Copies proposal to Claude's terminal
3. Asks Claude to implement
4. Copies code to Opus's terminal for review
5. Copies feedback back to Claude
6. Repeats until complete
```

**Pain Points:**

- ❌ Manual copy/paste between terminals
- ❌ No agent-to-agent communication
- ❌ User acts as message broker
- ❌ Context loss between switches
- ❌ No collaboration history

### 1.2 Additional Problems (From v1.x Spec)

**Problem 1: Broken Conversation Flow**

When wizard needs to run `/onboard-project`, it breaks conversation flow by asking user to manually execute the command.

**Problem 2: Permission Modal Spam**

Background tasks trigger permission modals for each tool use, without context.

**Problem 3: Hardcoded Workflows**

Slash command logic is imperative code, not declarative markdown.

**Problem 4: No Inter-Process Communication**

Parent TUI cannot send messages to child processes or coordinate between agents.

---

## 2. Solution Architecture

### 2.1 Vision: Federated Multi-Agent Workspace

**Key Insight:** Users already run multiple agents in separate terminal tabs. We don't build a new tab UI - we leverage existing terminal infrastructure and add IPC.

**What we're building:**

```
┌─────────────────────────────────────────────────────────────────────────┐
│ User's Terminal Emulator (iTerm, tmux, Wezterm, etc.)                   │
│                                                                          │
│ ┌─[Terminal Tab 1]───┬─[Terminal Tab 2]───┬─[Terminal Tab 3]───┐        │
│ │                    │                    │                    │        │
│ │ $ cognition-cli    │ $ cognition-cli    │ $ cognition-cli    │        │
│ │   tui --gemini     │   tui --claude     │   tui --opus       │        │
│ │                    │                    │                    │        │
│ │ You: Design the    │ You: Implement     │ You: Review the    │        │
│ │      IPC system    │      Gemini's      │      code from     │        │
│ │                    │      proposal      │      Claude        │        │
│ │ Gemini: Here's my  │                    │                    │        │
│ │ architecture...    │ 📥 From Gemini:    │ 📥 From Claude:    │        │
│ │                    │ "Architecture      │ "Review request:   │        │
│ │ Publishing to      │  proposal ready"   │  ZeroMQBus.ts"     │        │
│ │ arch.proposal...   │                    │                    │        │
│ │                    │ Claude: I see      │ Opus: LGTM with    │        │
│ │                    │ Gemini's design... │ minor suggestions  │        │
│ └────────┬───────────┴────────┬───────────┴────────┬───────────┘        │
│          │                    │                    │                    │
│          │     ZeroMQ Pub/Sub (auto-discovered)    │                    │
│          └────────────────────┼────────────────────┘                    │
│                               │                                          │
│                         ┌─────▼─────┐                                    │
│                         │  ZeroMQ   │  ipc:///tmp/cognition-bus.sock     │
│                         │  Pub/Sub  │  (or tcp://127.0.0.1:5555)         │
│                         └───────────┘                                    │
└─────────────────────────────────────────────────────────────────────────┘
```

**What we DON'T build:**

- ❌ Internal tab UI (TabBar, Tab components)
- ❌ Tab switching logic
- ❌ Notification badges inside TUI
- ❌ Tab state management

**What we DO build:**

- ✅ ZeroMQ pub/sub bus (auto-start on first TUI, others connect)
- ✅ Agent auto-registration on TUI startup
- ✅ Message routing between TUI instances
- ✅ In-conversation notifications ("📥 From Gemini: ...")

**User workflow:**

1. User opens Terminal Tab 1: `cognition-cli tui --gemini`
2. User opens Terminal Tab 2: `cognition-cli tui --claude`
3. User opens Terminal Tab 3: `cognition-cli tui --opus`
4. All three auto-connect to same ZeroMQ bus
5. Ask Gemini for architecture → Gemini publishes `arch.proposal_ready`
6. Switch to Claude terminal → sees "📥 From Gemini: Architecture proposal"
7. Ask Claude to implement → Claude publishes `code.review_requested`
8. Switch to Opus terminal → sees "📥 From Claude: Review request"
9. Opus reviews → publishes `code.review_completed`
10. Switch to Claude terminal → sees "📥 From Opus: Review feedback"

### 2.2 Core Components

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         FEDERATED TUI INSTANCES                          │
│                                                                          │
│  Terminal 1              Terminal 2              Terminal 3              │
│  ┌──────────────┐       ┌──────────────┐       ┌──────────────┐         │
│  │ TUI Process  │       │ TUI Process  │       │ TUI Process  │         │
│  │ --gemini     │       │ --claude     │       │ --opus       │         │
│  │              │       │              │       │              │         │
│  │ AgentAdapter │       │ AgentAdapter │       │ AgentAdapter │         │
│  │ ZeroMQClient │       │ ZeroMQClient │       │ ZeroMQClient │         │
│  └──────┬───────┘       └──────┬───────┘       └──────┬───────┘         │
│         │                      │                      │                  │
│         └──────────────────────┼──────────────────────┘                  │
│                                │                                         │
│                    ┌───────────▼───────────┐                             │
│                    │    ZeroMQ Pub/Sub     │                             │
│                    │    (shared socket)    │                             │
│                    │                       │                             │
│                    │  ipc:///tmp/cogni.sock│                             │
│                    └───────────┬───────────┘                             │
│                                │                                         │
│                    ┌───────────▼───────────┐                             │
│                    │    Agent Registry     │  ← Distributed (each TUI    │
│                    │    (in-memory per TUI)│    maintains local view)    │
│                    └───────────────────────┘                             │
│                                                                          │
│  Background Tasks (Headless TUI instances - also connect to bus)         │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │ cognition-cli tui --headless --command /onboard-project           │  │
│  │ cognition-cli tui --headless --command /pr-review                 │  │
│  └────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

**Key Difference from v1.x:** No central "hub" process. All TUI instances are peers that connect to a shared ZeroMQ socket.

### 2.3 Key Principles

1. **Federated Peers**: Each TUI instance is a peer, no central hub
2. **Zero New UI**: Leverage existing terminal tabs (iTerm, tmux, etc.)
3. **ZeroMQ Pub/Sub**: Agents communicate via shared event bus
4. **Auto-Discovery**: TUI instances auto-connect to bus on startup
5. **Zero Hardcoding**: Workflows and permissions defined in markdown
6. **Delegated Permissions**: Each agent/task declares its own scope
7. **Task-Based Leadership**: Different agents lead on different tasks (Gemini: concepts, Claude: implementation, Opus: review)
8. **Infrastructure Reuse**: Leverage existing agent providers, tools, SIGMA integration
9. **Background + Foreground**: Support both interactive TUIs and headless background tasks

### 2.4 Comparison to v1.x Architecture

| Aspect                  | v1.x (Headless-First)        | v2.0 (Federated Multi-Agent)       |
| ----------------------- | ---------------------------- | ---------------------------------- |
| **Primary Goal**        | Background task execution    | Multi-agent collaboration          |
| **IPC**                 | stdin/stdout                 | ZeroMQ pub/sub                     |
| **UX**                  | Single agent + background    | Multiple terminal TUIs + pub/sub   |
| **Agent Communication** | Parent→Child only            | Peer-to-peer via shared bus        |
| **Phase 1 Deliverable** | Headless `/onboard-project`  | ZeroMQ bus + auto-connect          |
| **Tab UI**              | N/A                          | None (use terminal tabs)           |
| **Multi-Agent**         | Phase 6 (future)             | Phase 1 (now)                      |
| **User Workflow**       | New pattern                  | Natural evolution of current usage |
| **Complexity**          | Simpler initially            | Simpler than internal tabs!        |
| **Migration Path**      | Requires Phase 6 rewrite     | Future-proof from Phase 1          |

**Why this approach?**

- User already runs multiple agents in separate terminal tabs
- Building internal tab UI is reinventing the wheel (iTerm, tmux already do this)
- ZeroMQ pub/sub between processes is simpler than internal tab state management
- Federated peers = no single point of failure
- Each TUI instance can crash independently without affecting others

---

## 3. Technical Design

### 3.1 ZeroMQ Message Bus

**Architecture:**

```
┌─────────────────────────────────────────────────────────┐
│ ZeroMQ Bus                                              │
│                                                          │
│ ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│ │   PUB socket │  │   SUB socket │  │  REQ socket  │   │
│ │  (broadcast) │  │   (receive)  │  │  (request)   │   │
│ └──────┬───────┘  └──────┬───────┘  └──────┬───────┘   │
│        │                 │                 │            │
│        └─────────────────┼─────────────────┘            │
└──────────────────────────┼──────────────────────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
   ┌────▼────┐       ┌─────▼─────┐     ┌─────▼─────┐
   │ Gemini  │       │  Claude   │     │   Opus    │
   │  Agent  │       │   Agent   │     │   Agent   │
   └─────────┘       └───────────┘     └───────────┘
```

**Implementation:**

```typescript
// src/ipc/ZeroMQBus.ts
import * as zmq from 'zeromq';

interface ZeroMQBusConfig {
  pubAddress: string;   // e.g., 'tcp://127.0.0.1:5555'
  subAddress: string;   // e.g., 'tcp://127.0.0.1:5556'
}

export class ZeroMQBus {
  private pubSocket: zmq.Publisher;
  private subSocket: zmq.Subscriber;
  private handlers: Map<string, Set<MessageHandler>>;

  constructor(config: ZeroMQBusConfig) {
    this.pubSocket = new zmq.Publisher();
    this.subSocket = new zmq.Subscriber();
    this.handlers = new Map();
  }

  async start() {
    await this.pubSocket.bind(this.config.pubAddress);
    this.subSocket.connect(this.config.subAddress);
    this.startListening();
  }

  // Publish event to topic
  publish(topic: string, message: any): void {
    const payload = JSON.stringify(message);
    this.pubSocket.send([topic, payload]);
  }

  // Subscribe to topic
  subscribe(topic: string, handler: MessageHandler): void {
    if (!this.handlers.has(topic)) {
      this.handlers.set(topic, new Set());
      this.subSocket.subscribe(topic);
    }
    this.handlers.get(topic)!.add(handler);
  }

  // Unsubscribe from topic
  unsubscribe(topic: string, handler: MessageHandler): void {
    const handlers = this.handlers.get(topic);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.handlers.delete(topic);
        this.subSocket.unsubscribe(topic);
      }
    }
  }

  private async startListening() {
    for await (const [topic, payload] of this.subSocket) {
      const topicStr = topic.toString();
      const message = JSON.parse(payload.toString());

      const handlers = this.handlers.get(topicStr);
      if (handlers) {
        for (const handler of handlers) {
          handler(message);
        }
      }
    }
  }
}

type MessageHandler = (message: any) => void;
```

### 3.2 Event Protocol (Topics & Messages)

**Topic Naming Convention:**

```
<category>.<action>

Examples:
- code.completed          # Code implementation finished
- code.review_requested   # Request code review
- code.review_completed   # Review finished
- arch.proposal_ready     # Architecture proposal ready
- task.started           # Background task started
- task.completed         # Background task completed
- agent.question         # Agent asks question to another agent
- user.input_required    # Agent needs user input
```

**Message Types:**

```typescript
// src/ipc/AgentMessage.ts

// Base message
interface AgentMessage {
  id: string;           // Unique message ID
  from: string;         // Agent ID (e.g., 'gemini-1', 'claude-1')
  timestamp: number;    // Unix timestamp
  topic: string;        // Event topic
  payload: any;         // Topic-specific payload
}

// Code completion event
interface CodeCompletedMessage extends AgentMessage {
  topic: 'code.completed';
  payload: {
    files: string[];              // Modified files
    summary: string;              // What was implemented
    requestReview: boolean;       // Should Opus review?
    branch?: string;              // Git branch (if applicable)
  };
}

// Review request event
interface ReviewRequestedMessage extends AgentMessage {
  topic: 'code.review_requested';
  payload: {
    files: string[];              // Files to review
    context: string;              // What to look for
    priority: 'low' | 'normal' | 'high';
  };
}

// Review completed event
interface ReviewCompletedMessage extends AgentMessage {
  topic: 'code.review_completed';
  payload: {
    files: string[];
    issues: ReviewIssue[];
    approved: boolean;
    summary: string;
  };
}

interface ReviewIssue {
  file: string;
  line: number;
  severity: 'error' | 'warning' | 'suggestion';
  message: string;
}

// Architecture proposal event
interface ArchProposalMessage extends AgentMessage {
  topic: 'arch.proposal_ready';
  payload: {
    title: string;
    description: string;
    diagrams?: string[];          // ASCII diagrams or mermaid
    tradeoffs: string;
    recommendation: string;
  };
}

// Agent question (agent-to-agent)
interface AgentQuestionMessage extends AgentMessage {
  topic: 'agent.question';
  payload: {
    to: string;                   // Target agent ID
    question: string;
    context?: string;
  };
}
```

### 3.3 Agent Registry

**Purpose:** Central registry for agent discovery and capability-based routing.

```typescript
// src/agents/AgentRegistry.ts

interface AgentCapability {
  name: string;                   // e.g., 'code_review', 'architecture_design'
  description: string;
  model: string;                  // 'gemini', 'claude', 'opus'
}

interface RegisteredAgent {
  id: string;                     // Unique agent ID
  type: 'interactive' | 'background';
  model: string;
  capabilities: AgentCapability[];
  status: 'idle' | 'thinking' | 'working';
  subscriptions: Set<string>;     // Topics this agent subscribes to
}

export class AgentRegistry {
  private agents: Map<string, RegisteredAgent>;
  private bus: ZeroMQBus;

  constructor(bus: ZeroMQBus) {
    this.agents = new Map();
    this.bus = bus;
  }

  // Register a new agent
  register(agent: RegisteredAgent): void {
    this.agents.set(agent.id, agent);

    // Publish agent.registered event
    this.bus.publish('agent.registered', {
      id: agent.id,
      type: agent.type,
      model: agent.model,
      capabilities: agent.capabilities
    });
  }

  // Unregister agent
  unregister(agentId: string): void {
    this.agents.delete(agentId);
    this.bus.publish('agent.unregistered', { id: agentId });
  }

  // Find agents by capability
  findByCapability(capability: string): RegisteredAgent[] {
    return Array.from(this.agents.values())
      .filter(agent =>
        agent.capabilities.some(cap => cap.name === capability)
      );
  }

  // Get agent by ID
  get(agentId: string): RegisteredAgent | undefined {
    return this.agents.get(agentId);
  }

  // Get all agents
  getAll(): RegisteredAgent[] {
    return Array.from(this.agents.values());
  }

  // Update agent status
  updateStatus(agentId: string, status: RegisteredAgent['status']): void {
    const agent = this.agents.get(agentId);
    if (agent) {
      agent.status = status;
      this.bus.publish('agent.status_changed', {
        id: agentId,
        status
      });
    }
  }
}
```

### 3.4 In-Conversation Notifications (No Tab UI)

Since we leverage existing terminal tabs, notifications appear **inline in the conversation** rather than as badges:

```
┌─────────────────────────────────────────────────────────────┐
│ cognition-cli tui --claude                                  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ You: Implement the notification system                      │
│                                                             │
│ Claude: I'll implement that now...                          │
│         [implementation details]                            │
│         Done! Publishing review request to Opus...          │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 📥 FROM OPUS (via pub/sub):                             │ │
│ │ Topic: code.review_completed                            │ │
│ │ "LGTM with minor suggestions:                           │ │
│ │  - Line 42: Consider using Map instead of object        │ │
│ │  - Line 89: Missing error handling for edge case"       │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ Claude: I see Opus's feedback. Let me address those...      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Implementation:**

```typescript
// src/ipc/IncomingMessageHandler.ts

export class IncomingMessageHandler {
  private bus: ZeroMQBus;
  private conversationAppender: (message: SystemMessage) => void;

  constructor(bus: ZeroMQBus, conversationAppender: (msg: SystemMessage) => void) {
    this.bus = bus;
    this.conversationAppender = conversationAppender;
    this.setupSubscriptions();
  }

  private setupSubscriptions() {
    // Subscribe to topics this agent cares about
    const topics = this.getRelevantTopics();

    for (const topic of topics) {
      this.bus.subscribe(topic, (msg) => {
        // Inject into conversation as system message
        this.conversationAppender({
          role: 'system',
          content: this.formatIncomingMessage(msg),
          timestamp: Date.now(),
          source: 'pub/sub',
          fromAgent: msg.from,
          topic: msg.topic
        });
      });
    }
  }

  private formatIncomingMessage(msg: AgentMessage): string {
    return `📥 FROM ${msg.from.toUpperCase()} (via pub/sub):
Topic: ${msg.topic}
${JSON.stringify(msg.payload, null, 2)}`;
  }

  private getRelevantTopics(): string[] {
    // Each model subscribes to different topics
    // Configured via CLI flags or config file
    return [
      'code.review_completed',
      'arch.proposal_ready',
      'agent.question',
      'task.completed'
    ];
  }
}
```

**No notification badges, no tab switching logic, no internal tab state.** Messages just appear in the conversation.

### 3.5 User-Controlled Topic Subscriptions

**Philosophy:** User curates which agents subscribe to which topics. This is economical (only interested agents activate) and gives user full control over their workflow.

**Subscription Methods:**

**1. CLI Flags (at startup):**

```bash
# Subscribe to specific topics
$ cognition-cli tui --claude --subscribe "code.*,arch.proposal_ready"

# Subscribe to all topics (not recommended - expensive)
$ cognition-cli tui --opus --subscribe "*"

# No subscriptions (isolated mode)
$ cognition-cli tui --gemini --subscribe ""
```

**2. Interactive Prompt (reuses existing wizard/confirmation dialog):**

```
┌─────────────────────────────────────────────────────────────┐
│ cognition-cli tui --claude                                  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ Claude: Working on implementation...                        │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 🔔 NEW TOPIC DETECTED                                   │ │
│ │                                                         │ │
│ │ Topic: security.vulnerability_found                     │ │
│ │ From: opus-1                                            │ │
│ │                                                         │ │
│ │ Subscribe to this topic?                                │ │
│ │                                                         │ │
│ │ [Y] Yes, this time    [A] Always    [N] No    [!] Never │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ You: A                                                      │
│                                                             │
│ Claude: ✅ Subscribed to security.vulnerability_found       │
│         (saved to .cognition/subscriptions.json)            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**3. Persisted Preferences (reuses existing config pattern):**

```json
// .cognition/subscriptions.json
{
  "claude": {
    "subscribe": ["code.*", "arch.proposal_ready", "security.*"],
    "ignore": ["task.progress"]
  },
  "opus": {
    "subscribe": ["code.review_requested"],
    "ignore": ["arch.*"]
  },
  "gemini": {
    "subscribe": ["code.completed", "arch.*"],
    "ignore": []
  }
}
```

**Implementation (reuses existing patterns):**

```typescript
// src/ipc/SubscriptionManager.ts

export class SubscriptionManager {
  private bus: ZeroMQBus;
  private config: SubscriptionConfig;
  private promptUser: (prompt: NewTopicPrompt) => Promise<SubscriptionChoice>;

  constructor(
    bus: ZeroMQBus,
    config: SubscriptionConfig,
    // Reuse existing confirmation dialog pattern
    promptUser: (prompt: NewTopicPrompt) => Promise<SubscriptionChoice>
  ) {
    this.bus = bus;
    this.config = config;
    this.promptUser = promptUser;

    // Subscribe to meta-topic for new topic discovery
    this.bus.subscribe('meta.new_topic', this.handleNewTopic.bind(this));
  }

  private async handleNewTopic(msg: AgentMessage) {
    const topic = msg.payload.topic;

    // Check if already decided
    if (this.config.subscribe.some(t => this.matchesTopic(topic, t))) {
      // Already subscribed via pattern
      return;
    }
    if (this.config.ignore.includes(topic)) {
      // Already ignored
      return;
    }

    // Prompt user (reuses existing wizard/confirmation dialog)
    const choice = await this.promptUser({
      topic,
      from: msg.from,
      description: msg.payload.description
    });

    switch (choice) {
      case 'yes':
        this.bus.subscribe(topic, this.handleMessage.bind(this));
        break;
      case 'always':
        this.config.subscribe.push(topic);
        this.bus.subscribe(topic, this.handleMessage.bind(this));
        this.saveConfig();
        break;
      case 'never':
        this.config.ignore.push(topic);
        this.saveConfig();
        break;
      case 'no':
        // Do nothing, but don't persist
        break;
    }
  }

  private matchesTopic(topic: string, pattern: string): boolean {
    // Support wildcards: "code.*" matches "code.review_requested"
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    return regex.test(topic);
  }
}

type SubscriptionChoice = 'yes' | 'always' | 'no' | 'never';
```

**Benefits:**

| Aspect | All-Subscribe | User-Curated |
|--------|--------------|--------------|
| API Cost | Every event wakes every agent | Only interested agents |
| Noise | Agents see irrelevant events | Filtered by user |
| Control | System decides | User decides |
| Workflow | Fixed patterns | User-designed |

**Key Point:** We reuse existing UI patterns (confirmation dialog, wizard) - no new UI components needed.

### 3.6 Interactive Agent Implementation

```typescript
// src/agents/InteractiveAgent.ts

export class InteractiveAgent {
  private id: string;
  private model: string;
  private provider: AgentProvider;  // GeminiAgentProvider | ClaudeProvider
  private bus: ZeroMQBus;
  private registry: AgentRegistry;
  private conversation: ConversationTurn[];

  constructor(config: InteractiveAgentConfig) {
    this.id = config.id;
    this.model = config.model;
    this.provider = this.createProvider(config.model);
    this.bus = config.bus;
    this.registry = config.registry;
    this.conversation = [];

    this.setupSubscriptions();
    this.registerCapabilities();
  }

  private createProvider(model: string): AgentProvider {
    switch (model) {
      case 'gemini':
        return new GeminiAgentProvider(/* config */);
      case 'claude':
        return new ClaudeProvider(/* config */);
      case 'opus':
        return new ClaudeProvider({ model: 'opus' });
      default:
        throw new Error(`Unknown model: ${model}`);
    }
  }

  private registerCapabilities() {
    const capabilities: AgentCapability[] = [];

    if (this.model === 'gemini') {
      capabilities.push({
        name: 'architecture_design',
        description: 'High-level system architecture and design',
        model: this.model
      });
      capabilities.push({
        name: 'concept_exploration',
        description: 'Explore concepts and propose approaches',
        model: this.model
      });
    }

    if (this.model === 'claude') {
      capabilities.push({
        name: 'code_implementation',
        description: 'Write production-quality code',
        model: this.model
      });
      capabilities.push({
        name: 'system_design',
        description: 'Detailed system design and implementation planning',
        model: this.model
      });
    }

    if (this.model === 'opus') {
      capabilities.push({
        name: 'code_review',
        description: 'In-depth code review and quality assurance',
        model: this.model
      });
      capabilities.push({
        name: 'architecture_review',
        description: 'Review architectural decisions and trade-offs',
        model: this.model
      });
    }

    this.registry.register({
      id: this.id,
      type: 'interactive',
      model: this.model,
      capabilities,
      status: 'idle',
      subscriptions: new Set()
    });
  }

  private setupSubscriptions() {
    // Model-specific subscriptions
    if (this.model === 'opus') {
      this.bus.subscribe('code.review_requested', (msg) => {
        this.handleReviewRequest(msg);
      });
    }

    if (this.model === 'claude') {
      this.bus.subscribe('arch.proposal_ready', (msg) => {
        this.handleArchProposal(msg);
      });
      this.bus.subscribe('code.review_completed', (msg) => {
        this.handleReviewFeedback(msg);
      });
    }

    if (this.model === 'gemini') {
      this.bus.subscribe('code.completed', (msg) => {
        this.handleCodeCompleted(msg);
      });
    }

    // All agents can receive questions
    this.bus.subscribe('agent.question', (msg) => {
      if (msg.payload.to === this.id) {
        this.handleQuestion(msg);
      }
    });
  }

  async sendMessage(userMessage: string): Promise<string> {
    this.registry.updateStatus(this.id, 'thinking');

    // Add user message to conversation
    this.conversation.push({
      role: 'user',
      content: userMessage,
      timestamp: Date.now()
    });

    // Get response from provider
    const response = await this.provider.chat(this.conversation);

    // Add assistant response to conversation
    this.conversation.push({
      role: 'assistant',
      content: response,
      timestamp: Date.now()
    });

    this.registry.updateStatus(this.id, 'idle');

    return response;
  }

  // Publish event to bus
  publish(topic: string, payload: any): void {
    this.bus.publish(topic, {
      id: crypto.randomUUID(),
      from: this.id,
      timestamp: Date.now(),
      topic,
      payload
    });
  }

  private handleReviewRequest(msg: AgentMessage) {
    // Opus receives review request - add to conversation as system message
    this.conversation.push({
      role: 'system',
      content: `Review request from ${msg.from}: ${msg.payload.files.join(', ')}`,
      timestamp: Date.now()
    });
  }

  private handleArchProposal(msg: AgentMessage) {
    // Claude receives architecture proposal from Gemini
    this.conversation.push({
      role: 'system',
      content: `Architecture proposal from ${msg.from}:\n${msg.payload.description}`,
      timestamp: Date.now()
    });
  }

  private handleReviewFeedback(msg: AgentMessage) {
    // Claude receives review feedback from Opus
    this.conversation.push({
      role: 'system',
      content: `Review feedback from ${msg.from}:\n${this.formatReview(msg.payload)}`,
      timestamp: Date.now()
    });
  }

  private handleCodeCompleted(msg: AgentMessage) {
    // Gemini receives notification that Claude completed implementation
    this.conversation.push({
      role: 'system',
      content: `Code completed by ${msg.from}: ${msg.payload.summary}`,
      timestamp: Date.now()
    });
  }

  private handleQuestion(msg: AgentMessage) {
    // Agent receives question from another agent
    this.conversation.push({
      role: 'system',
      content: `Question from ${msg.from}: ${msg.payload.question}`,
      timestamp: Date.now()
    });
  }

  private formatReview(review: any): string {
    // Format review issues for display
    return review.issues.map((issue: ReviewIssue) =>
      `${issue.severity.toUpperCase()}: ${issue.file}:${issue.line} - ${issue.message}`
    ).join('\n');
  }
}
```

### 3.7 Background Tasks (Headless TUI Instances)

Background tasks work the same as v1.x spec, but now also participate in ZeroMQ pub/sub:

```typescript
// src/tui/services/BackgroundTaskManager.ts

export class BackgroundTaskManager {
  private bus: ZeroMQBus;
  private tasks: Map<string, BackgroundTask>;

  async startTask(commandName: string, args?: string[]): Promise<string> {
    const taskId = crypto.randomUUID();

    // Spawn headless TUI
    const child = spawn('cognition-cli', [
      'tui',
      '--headless',
      '--command', commandName,
      '--zeromq-pub', this.bus.config.pubAddress,
      '--zeromq-sub', this.bus.config.subAddress,
      ...(args || [])
    ], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    const task: BackgroundTask = {
      id: taskId,
      commandName,
      process: child,
      status: 'running',
      startTime: Date.now()
    };

    this.tasks.set(taskId, task);

    // Background task will register itself with AgentRegistry via ZeroMQ
    // and can publish/subscribe to events

    return taskId;
  }
}
```

**Background task publishes events:**

```typescript
// Inside headless TUI instance running /onboard-project

async function executeOnboardProject() {
  // Task starts
  bus.publish('task.started', {
    taskId: process.env.TASK_ID,
    command: '/onboard-project'
  });

  // Do work...
  const result = await analyzeProject();

  // Task completes
  bus.publish('task.completed', {
    taskId: process.env.TASK_ID,
    command: '/onboard-project',
    result: {
      filesAnalyzed: result.files.length,
      overlaysGenerated: result.overlays
    }
  });
}
```

### 3.8 Permission System (Delegated to Agent/Task)

Same as v1.x spec - frontmatter-based permission manifests:

```markdown
---
permissions:
  - tool: read_file
    scope: "**/*"
  - tool: write_file
    scope: "docs/**/*.md"
  - tool: bash
    scope: ["npm install", "git status"]
model: gemini
---

Your task: Onboard this project...
```

---

## 4. User Experience Scenarios

### 4.1 Scenario: Implement New Feature with Multi-Agent Collaboration

**Step 1: User asks Gemini for high-level design**

```
[Gemini 3 Pro tab] (active)

You: I need to implement a notification system for the TUI.
     Design the architecture.

Gemini: I'll design a notification system architecture for you.

        ## Proposed Architecture

        1. **NotificationManager** - Central service
        2. **NotificationQueue** - Priority-based queue
        3. **NotificationRenderer** - Toast/banner display

        Key design decisions:
        - Use ZeroMQ pub/sub for event distribution
        - Priority levels: low, normal, high, critical
        - Configurable display duration
        - Persistent notifications for critical items

        I'll send this proposal to Claude and Opus for review.

Gemini: Publishing architecture proposal to other agents...
        ✅ Sent to Claude and Opus
```

**Step 2: Claude receives proposal and prepares implementation**

```
[Claude Code tab] 🔔 1

(User switches to Claude tab)

Claude: 📥 Architecture proposal from Gemini: Notification System

        I've reviewed Gemini's proposal. The architecture looks solid.
        I'm ready to implement when you give the go-ahead.

        Implementation plan:
        1. Create NotificationManager service
        2. Implement priority queue
        3. Build TUI rendering component
        4. Add tests

        Estimated: 4 files, ~300 lines

You: Proceed with implementation.

Claude: Implementing notification system...

        ✅ Implementation complete:
        - src/tui/services/NotificationManager.ts (127 lines)
        - src/tui/components/Toast.tsx (89 lines)
        - src/tui/state/NotificationQueue.ts (74 lines)
        - tests/NotificationManager.test.ts (112 lines)

        Publishing to Opus for code review...
```

**Step 3: Opus reviews code**

```
[Opus 4 tab] 🔔 1

(User switches to Opus tab)

Opus: 📥 Code review request from Claude
      Files: NotificationManager.ts, Toast.tsx, NotificationQueue.ts

      Starting review...

      ## Code Review Results

      ✅ NotificationManager.ts: Clean implementation, good separation
      ✅ Toast.tsx: UI component is well-structured
      ⚠️  NotificationQueue.ts: Line 42 - Priority comparison has edge case
          Issue: When two notifications have same priority and timestamp,
                 order is non-deterministic
          Suggestion: Add sequence number as tiebreaker

      ⚠️  Missing: Error handling when ZeroMQ bus is unavailable

      Overall: Approve with minor fixes

      Publishing feedback to Claude...
```

**Step 4: Claude addresses feedback**

```
[Claude Code tab] 🔔 1

(User switches back to Claude)

Claude: 📥 Review feedback from Opus

        Addressing Opus's feedback:

        ✅ Fixed priority queue tiebreaker (added sequence number)
        ✅ Added error handling for ZeroMQ bus failures

        Updated files:
        - src/tui/state/NotificationQueue.ts

        Requesting re-review from Opus...

Opus: 🔔 Re-review complete. ✅ LGTM! Ready to merge.

You: Excellent! Commit these changes.

Claude: Creating commit...
        ✅ Committed: "feat(tui): implement notification system with
                       priority queue and ZeroMQ integration"
```

### 4.2 Scenario: Background Task with User Supervision

**User asks agent to run background task:**

```
[Claude Code tab]

You: Run /onboard-project in the background and let me know when done.

Claude: Starting /onboard-project as background task...
        ✅ Task started (ID: task-abc123)
        You can monitor progress in the [Tasks] tab.
```

**User switches to [Tasks] tab:**

```
[Tasks tab]

Background Tasks:
┌────────────────────────────────────────────────────────┐
│ /onboard-project (task-abc123)                         │
│ Status: Running (2m 34s)                               │
│ Progress:                                              │
│   ✅ Analyzed file structure (247 files)               │
│   ✅ Generated O1 (Structural) overlay                 │
│   ⏳ Generating O2 (Security) overlay... 45%           │
│   ⏳ Pending: O3-O7 overlays                           │
│                                                        │
│ [View Logs] [Cancel Task]                             │
└────────────────────────────────────────────────────────┘
```

**Task completes and notifies:**

```
[Claude Code tab] 🔔 1

Claude: 📥 Background task completed: /onboard-project

        Results:
        - Files analyzed: 247
        - Overlays generated: O1-O7
        - Critical findings: 3 security issues in O2

        Would you like me to review the security findings?
```

### 4.3 Scenario: Agent-to-Agent Communication (No User Intervention)

**Gemini proposes architecture, automatically sends to Claude:**

```
[Gemini tab]

Gemini: Architecture proposal complete. Sending to Claude for
        feasibility check...

        (publishes to arch.proposal_ready topic)
```

**Claude auto-receives and responds:**

```
[Claude tab] (not active, runs in background)

Claude: (receives arch.proposal_ready event)
        (analyzes proposal)
        (publishes to arch.feasibility_check topic)

        Feasibility check: ✅ Implementable
        Estimated effort: Medium (2-3 days)
        Potential issues: None identified
```

**Gemini receives feasibility check:**

```
[Gemini tab]

Gemini: 📥 Feasibility check from Claude: ✅ Implementable

        You: Great! Claude, please implement.
```

User only intervenes to approve - agents coordinate the details via pub/sub.

---

## 5. Implementation Roadmap

### 5.1 Phase 1: Federated Multi-Agent Foundation (2-3 weeks)

**Goal:** ZeroMQ pub/sub between independent TUI instances (no internal tab UI)

**Week 1: ZeroMQ Infrastructure**

- Install and configure `zeromq` package
- Implement `ZeroMQBus` class with auto-discovery
  - First TUI binds socket, subsequent TUIs connect
  - Use `ipc:///tmp/cognition-bus.sock` for local IPC
- Implement `AgentRegistry` (distributed, each TUI maintains local view)
- Define event protocol and message types
- Unit tests for message bus

**Files:**

- `src/ipc/ZeroMQBus.ts` (NEW)
- `src/ipc/AgentMessage.ts` (NEW)
- `src/ipc/AgentRegistry.ts` (NEW)
- `tests/ipc/ZeroMQBus.test.ts` (NEW)

**Week 2: TUI Integration**

- Add `--zeromq-bus` flag to TUI (optional, auto-discover if not specified)
- Implement `IncomingMessageHandler` for in-conversation notifications
- Auto-register agent on TUI startup (`agent.registered` event)
- Auto-deregister on TUI exit (`agent.unregistered` event)
- Wire up pub/sub to conversation (inject system messages)

**Files:**

- `src/tui/index.tsx` (MODIFIED: add ZeroMQ integration)
- `src/ipc/IncomingMessageHandler.ts` (NEW)
- `src/tui/hooks/useZeroMQ.ts` (NEW)

**Week 3: Testing & Polish**

- Integration tests for multi-TUI communication
- Graceful handling when bus not available (single-agent mode)
- Documentation for multi-agent workflow

**Deliverables:**

- ✅ User opens multiple `cognition-cli tui` in separate terminals
- ✅ All TUI instances auto-connect to shared ZeroMQ bus
- ✅ Agents can publish events via ZeroMQ
- ✅ Incoming messages appear inline in conversation
- ✅ Works with any terminal emulator (iTerm, tmux, etc.)

**What we DON'T build in Phase 1:**

- ❌ Internal tab UI
- ❌ Notification badges
- ❌ Tab switching logic
- ❌ Tab state management

### 5.2 Phase 2: Background Tasks (2-3 weeks)

**Goal:** Headless TUI instances for background task execution

**Week 1: Headless Mode**

- Add `--headless` flag to TUI
- Implement headless rendering (no UI, stdout only)
- Connect headless instance to ZeroMQ bus
- Register headless agent in `AgentRegistry`

**Week 2: Background Task Manager**

- Implement `BackgroundTaskManager` service
- Task spawning and lifecycle management
- Task progress reporting via pub/sub events
- `cognition-cli tasks` command to list running background tasks

**Week 3: Integration**

- Wire up slash commands to background tasks
- Permission manifest parsing
- Task completion broadcasts to all connected TUIs via pub/sub
- Testing and debugging

**Files:**

- `src/tui/index.ts` (MODIFIED: add --headless mode)
- `src/tui/services/BackgroundTaskManager.ts` (NEW)
- `src/cli/commands/tasks.ts` (NEW: `cognition-cli tasks` command)
- `src/tui/hooks/useBackgroundTasks.ts` (NEW)

**Deliverables:**

- ✅ User can run `/onboard-project` in background
- ✅ `cognition-cli tasks` lists running background tasks
- ✅ Background tasks publish events to ZeroMQ
- ✅ Interactive TUIs receive task completion notifications inline

### 5.3 Phase 3: Agent Collaboration Patterns (2-3 weeks)

**Goal:** Rich agent-to-agent collaboration workflows

**Week 1: Review Workflow**

- Claude publishes `code.review_requested`
- Opus auto-receives and starts review
- Opus publishes `code.review_completed`
- Claude addresses feedback automatically

**Week 2: Architecture Workflow**

- Gemini publishes `arch.proposal_ready`
- Claude receives and performs feasibility check
- Opus receives and reviews for best practices
- Both publish feedback to Gemini

**Week 3: Question/Answer Workflow**

- Any agent can publish `agent.question` to specific agent
- Target agent receives and responds
- Conversation history updated with Q&A

**Files:**

- `src/agents/workflows/ReviewWorkflow.ts` (NEW)
- `src/agents/workflows/ArchitectureWorkflow.ts` (NEW)
- `src/agents/workflows/QuestionAnswerWorkflow.ts` (NEW)

**Deliverables:**

- ✅ Agents can request code reviews from each other
- ✅ Architecture proposals flow between agents
- ✅ Agents can ask questions to each other

### 5.4 Phase 4: Polish & Production Readiness (2-3 weeks)

**Week 1: Error Handling**

- ZeroMQ connection failures
- Agent crash recovery
- Task timeout handling
- Graceful degradation

**Week 2: Performance & Optimization**

- Message batching for high-frequency events
- Tab rendering optimization
- Memory management for long conversations
- ZeroMQ socket pooling

**Week 3: Testing & Documentation**

- Integration tests for multi-agent scenarios
- E2E tests for tab switching and notifications
- Performance benchmarks
- User documentation and guides

**Deliverables:**

- ✅ Comprehensive test suite
- ✅ Error handling for all failure modes
- ✅ Performance benchmarks met
- ✅ Documentation complete

### 5.5 Phase 5: Advanced Features (Future)

**Agent Focus/Rotation:**

- Agents can request focus (`agent.request_focus`)
- TUI shows modal: "Gemini has important message. Switch tab?"
- Auto-rotate to agent with high-priority notification

**Multi-User Support:**

- Multiple users can connect to same ZeroMQ bus
- Collaborative agent workspace
- User attribution in conversation

**Agent Learning:**

- Agents learn from each other's patterns
- Feedback loops improve collaboration
- Capability discovery becomes dynamic

---

## 6. Testing Strategy

### 6.1 Unit Tests

**ZeroMQ Bus:**

```typescript
describe('ZeroMQBus', () => {
  it('publishes and subscribes to topics', async () => {
    const bus = new ZeroMQBus(config);
    await bus.start();

    const received: any[] = [];
    bus.subscribe('test.topic', (msg) => received.push(msg));

    bus.publish('test.topic', { data: 'hello' });

    await waitFor(() => received.length > 0);
    expect(received[0].data).toBe('hello');
  });
});
```

**Agent Registry:**

```typescript
describe('AgentRegistry', () => {
  it('registers and finds agents by capability', () => {
    const registry = new AgentRegistry(bus);

    registry.register({
      id: 'opus-1',
      type: 'interactive',
      model: 'opus',
      capabilities: [{ name: 'code_review', description: '...', model: 'opus' }],
      status: 'idle',
      subscriptions: new Set()
    });

    const reviewers = registry.findByCapability('code_review');
    expect(reviewers).toHaveLength(1);
    expect(reviewers[0].id).toBe('opus-1');
  });
});
```

### 6.2 Integration Tests

**Multi-Agent Collaboration:**

```typescript
describe('Multi-Agent Code Review', () => {
  it('completes review workflow', async () => {
    const gemini = new InteractiveAgent({ id: 'gemini-1', model: 'gemini', bus, registry });
    const claude = new InteractiveAgent({ id: 'claude-1', model: 'claude', bus, registry });
    const opus = new InteractiveAgent({ id: 'opus-1', model: 'opus', bus, registry });

    // Claude implements code
    await claude.sendMessage('Implement a notification system');

    // Wait for code.review_requested event
    await waitForEvent(bus, 'code.review_requested');

    // Opus should receive review request
    expect(opus.conversation).toContainMessage(/Review request from claude-1/);

    // Opus reviews code
    await opus.sendMessage('Start review');

    // Wait for code.review_completed event
    await waitForEvent(bus, 'code.review_completed');

    // Claude should receive review feedback
    expect(claude.conversation).toContainMessage(/Review feedback from opus-1/);
  });
});
```

### 6.3 E2E Tests

**Tab Switching with Notifications:**

```typescript
describe('Tab UI', () => {
  it('shows notification badges when agent receives message', async () => {
    const { container } = render(<TUI />);

    // Start with Claude tab active
    expect(screen.getByText('Claude Code')).toHaveAttribute('active', 'true');

    // Opus publishes event
    bus.publish('code.review_completed', { from: 'opus-1', payload: { ... } });

    // Claude tab should show notification badge
    await waitFor(() => {
      expect(screen.getByText(/Claude Code/)).toContainElement(screen.getByText(/🔔 1/));
    });

    // Switch to Claude tab
    fireEvent.click(screen.getByText('Claude Code'));

    // Notification badge should clear
    expect(screen.queryByText(/🔔 1/)).not.toBeInTheDocument();
  });
});
```

---

## 7. Non-Functional Requirements

### 7.1 Performance

- **Message latency:** < 10ms for ZeroMQ pub/sub (local IPC)
- **Tab switch latency:** < 100ms
- **Notification display:** < 50ms from event publish
- **Agent startup time:** < 500ms per agent
- **Memory per agent:** < 100MB baseline

### 7.2 Reliability

- **Agent crash isolation:** One agent crash doesn't affect others
- **ZeroMQ reconnection:** Auto-reconnect on connection loss
- **Message delivery:** At-least-once delivery for critical events
- **Data persistence:** Conversation history persisted to disk

### 7.3 Security

- **ZeroMQ binding:** Only bind to localhost (127.0.0.1), not 0.0.0.0
- **Permission enforcement:** ToolGuardian enforces declared scopes
- **No credential exposure:** Secrets not logged or sent via ZeroMQ
- **Sandboxing:** Background tasks cannot escape permission scope

### 7.4 Usability

- **Tab labels:** Clear agent names (Gemini 3 Pro, Claude Code, Opus 4)
- **Notification clarity:** Message source and action clearly indicated
- **Status visibility:** Agent status (idle/thinking/working) always visible
- **Keyboard shortcuts:** Tab switching via Ctrl+1/2/3, Ctrl+Tab

---

## 8. Migration from v1.x

### 8.1 Breaking Changes

| v1.x                   | v2.0                      | Migration Path                   |
| ---------------------- | ------------------------- | -------------------------------- |
| stdin/stdout IPC       | ZeroMQ pub/sub            | Rewrite IPC layer                |
| Single agent + headless| Multi-agent tabs          | Refactor TUI to support tabs     |
| Parent→Child only      | Any-to-any communication  | Implement AgentRegistry          |
| Hardcoded agent logic  | Capability-based routing  | Define capabilities per agent    |

### 8.2 What Stays the Same

- ✅ Markdown-based slash commands
- ✅ Permission manifests (frontmatter)
- ✅ Tool system (existing tools work unchanged)
- ✅ SIGMA integration (overlays, memory)
- ✅ Agent providers (GeminiAgentProvider, ClaudeProvider)
- ✅ Headless TUI for background tasks

### 8.3 Migration Steps

1. **Install ZeroMQ:** `npm install zeromq`
2. **Implement ZeroMQBus:** Replace stdin/stdout IPC
3. **Build tab UI:** Refactor TUI to support multiple tabs
4. **Create InteractiveAgent:** Wrap existing agent providers
5. **Implement AgentRegistry:** Add capability-based discovery
6. **Update slash commands:** Connect to ZeroMQ instead of stdin/stdout
7. **Test:** Comprehensive testing of multi-agent workflows

---

## 9. Open Questions

### 9.1 Technical Questions

1. **ZeroMQ vs alternatives:** Should we consider nanomsg or other IPC libraries?
   - **Recommendation:** Stick with ZeroMQ (mature, well-tested, excellent TypeScript bindings)

2. **Message persistence:** Should we persist ZeroMQ messages to disk for replay?
   - **Recommendation:** Not in Phase 1. Add in Phase 5 if needed.

3. **Agent concurrency:** How many agents can run concurrently before performance degrades?
   - **Recommendation:** Start with 3 interactive + unlimited background. Benchmark in Phase 4.

4. **Cross-session communication:** Should agents communicate across different TUI sessions?
   - **Recommendation:** No in Phase 1. Single session only. Multi-session in Phase 5.

5. **Model costs:** Running 3 agents simultaneously increases API costs. How to manage?
   - **Recommendation:** User choice. Default to 1 agent (Claude), allow spawning others on demand.

### 9.2 UX Questions

1. **Default tabs:** Should all 3 agents start by default, or spawn on demand?
   - **Recommendation:** Start with Claude only. User can add tabs via `[+]` button.

2. **Notification priorities:** How to handle high-frequency notifications without overwhelming user?
   - **Recommendation:** Implement notification priority levels. Only show toast for high/critical.

3. **Agent naming:** Should user be able to rename tabs (e.g., "Claude - Implementation")?
   - **Recommendation:** Yes, but Phase 5 feature.

4. **Conversation export:** How to export multi-agent collaboration history?
   - **Recommendation:** Export all tabs as separate markdown files, or unified timeline view.

### 9.3 Architecture Questions

1. **Agent autonomy:** Should agents be able to start tasks without user approval?
   - **Recommendation:** No in Phase 1. All tasks require user initiation. Phase 5: Add "autonomous mode" flag.

2. **Feedback loops:** What if agents disagree (e.g., Opus rejects Claude's code)?
   - **Recommendation:** User is final arbiter. Show both perspectives, user decides.

3. **Capability conflicts:** What if multiple agents have same capability (e.g., both Gemini and Claude can do architecture)?
   - **Recommendation:** User chooses which agent to ask. Or implement voting/consensus in Phase 5.

---

## 10. Alternatives Considered

### 10.1 Unified Conversation (Single Thread, All Agents)

**Rejected because:**

- Harder to implement (need conversation attribution)
- Can get crowded with many agents
- User loses ability to have focused conversation with one agent
- Tab-based is more familiar (browser tabs, tmux panes)

**Could revisit in Phase 5** as optional view mode (toggle between tabs and unified).

### 10.2 REST API for Agent Communication

**Rejected because:**

- Overkill for local IPC
- HTTP overhead vs ZeroMQ (10ms vs <1ms)
- Requires HTTP server infrastructure
- ZeroMQ pub/sub is more natural for event-driven communication

### 10.3 Shared Memory (Node.js Worker Threads)

**Rejected because:**

- Agents run as separate processes (headless TUI instances)
- Worker threads don't support spawning external commands (needed for tools)
- Harder to isolate crashes
- ZeroMQ works across processes, worker threads don't

### 10.4 WebSocket-based Communication

**Rejected because:**

- More complex than ZeroMQ for local IPC
- Requires WebSocket server
- No advantage over ZeroMQ for local-only communication
- Could be considered in Phase 5 for remote multi-user support

---

## 11. Success Metrics

### 11.1 Phase 1 Success Criteria

- ✅ User can open 3 tabs (Gemini, Claude, Opus)
- ✅ Each tab maintains independent conversation
- ✅ Agents publish events to ZeroMQ bus
- ✅ Notification badges show unread count
- ✅ Tab switching works with < 100ms latency
- ✅ No data loss on tab switch
- ✅ Agent status indicators work (idle/thinking/working)

### 11.2 Phase 2 Success Criteria

- ✅ Background tasks run in headless mode
- ✅ [Tasks] tab shows real-time progress
- ✅ Background tasks publish events to ZeroMQ
- ✅ Interactive agents receive task completion notifications
- ✅ Task cancellation works without orphan processes

### 11.3 Phase 3 Success Criteria

- ✅ Code review workflow: Claude → Opus → Claude (no user intervention for event routing)
- ✅ Architecture workflow: Gemini → Claude + Opus (feasibility check)
- ✅ Agent-to-agent questions work bidirectionally
- ✅ User can supervise all workflows via tab UI

### 11.4 Overall Success Criteria

**Compared to current manual multi-terminal workflow:**

| Metric                     | Before (Manual)       | After (v2.0)           | Improvement |
| -------------------------- | --------------------- | ---------------------- | ----------- |
| Copy/paste steps           | 10+ per task          | 0                      | 100%        |
| Context switches           | 20+ per task          | 3-5 tab switches       | 75%         |
| Agent coordination time    | 5-10 min manual       | < 1 min automatic      | 90%         |
| Conversation history loss  | High (separate terms) | None (unified history) | 100%        |
| User cognitive load        | High (broker role)    | Low (observer role)    | 80%         |

---

## 12. Risks & Mitigations

| Risk                               | Impact | Probability | Mitigation                                      |
| ---------------------------------- | ------ | ----------- | ----------------------------------------------- |
| ZeroMQ native binding issues       | High   | Low         | Fallback to pure-JS implementation (slower)     |
| Agent conversation divergence      | Medium | Medium      | Shared context via ZeroMQ events                |
| Notification overload              | Medium | High        | Priority-based filtering, user settings         |
| Tab state management complexity    | Medium | Medium      | Use proven state management (Redux/Zustand)     |
| API cost explosion (3 agents)      | High   | Medium      | Start with 1 agent, spawn on demand             |
| Message bus becomes bottleneck     | Medium | Low         | ZeroMQ handles 1M+ msg/sec, unlikely bottleneck |
| User confusion (too many tabs)     | Low    | Medium      | Default to 1 tab, clear onboarding              |

---

## 13. Appendix

### 13.1 ZeroMQ Resources

- **Official Docs:** <https://zeromq.org/>
- **Node.js Bindings:** <https://github.com/zeromq/zeromq.js>
- **Guide:** <https://zguide.zeromq.org/>

### 13.2 Example Message Payloads

**Code Review Request:**

```json
{
  "id": "msg-123",
  "from": "claude-1",
  "timestamp": 1701234567890,
  "topic": "code.review_requested",
  "payload": {
    "files": ["src/ipc/ZeroMQBus.ts"],
    "context": "New IPC implementation, check for edge cases",
    "priority": "high"
  }
}
```

**Architecture Proposal:**

```json
{
  "id": "msg-456",
  "from": "gemini-1",
  "timestamp": 1701234567890,
  "topic": "arch.proposal_ready",
  "payload": {
    "title": "Multi-Agent Notification System",
    "description": "Proposed architecture for...",
    "diagrams": ["ascii-diagram-here"],
    "tradeoffs": "Trade-off analysis...",
    "recommendation": "Recommend ZeroMQ pub/sub because..."
  }
}
```

### 13.3 Glossary

- **Agent:** AI model instance with conversation history and capabilities
- **Interactive Agent:** Agent with tab UI for user interaction
- **Background Task:** Headless TUI instance running slash command
- **ZeroMQ:** High-performance messaging library for IPC
- **Pub/Sub:** Publish/Subscribe pattern (one-to-many event distribution)
- **AgentRegistry:** Central registry for agent discovery and routing
- **Capability:** Declared skill of an agent (e.g., code_review, architecture_design)
- **Topic:** Event category in pub/sub system (e.g., code.completed)
- **Tab:** UI container for one agent's conversation

---

## 14. Version History

### Version 2.0.2 (2025-12-02)

**Added: User-Controlled Topic Subscriptions**

**New Section:**

1. **Section 3.5:** User-Controlled Topic Subscriptions
   - CLI flags: `--subscribe "code.*,arch.proposal_ready"`
   - Interactive prompts: Reuses existing wizard/confirmation dialog patterns
   - Persisted preferences: `.cognition/subscriptions.json`
   - `SubscriptionManager` class with wildcard pattern matching

**Key Benefits:**

- **Economical:** Only interested agents activate (saves API costs)
- **User Control:** User curates workflow, not hardcoded
- **No New UI:** Reuses existing confirmation dialog and wizard patterns

**Renumbered Sections:**

- 3.5 → User-Controlled Topic Subscriptions (NEW)
- 3.6 → Interactive Agent Implementation (was 3.5)
- 3.7 → Background Tasks (was 3.6)
- 3.8 → Permission System (was 3.7)

### Version 2.0.1 (2025-12-02)

**Clarification: Federated Terminal Instances (Not Internal Tabs)**

**Changes from v2.0:**

1. **Section 2.1:** Changed from "Integrated Multi-Agent Workspace" with internal tab UI to "Federated Multi-Agent Workspace" using existing terminal tabs
2. **Section 2.2:** Updated diagram to show federated TUI instances as peers (no central hub)
3. **Section 2.3:** Added "Zero New UI" and "Federated Peers" principles
4. **Section 3.4:** Replaced "Tab-Based Agent UI" with "In-Conversation Notifications"
5. **Phase 1:** Reduced scope from 4-6 weeks to 2-3 weeks (no tab UI to build)
6. **Phase 2:** Removed `TasksTab.tsx`, added `cognition-cli tasks` CLI command instead

**Key Insight:** User already runs multiple agents in separate terminal tabs (iTerm, tmux, etc.). Building internal tab UI is reinventing the wheel. Just add ZeroMQ pub/sub between independent TUI instances.

**What we DON'T build:**

- ❌ TabBar.tsx, Tab.tsx components
- ❌ Tab state management
- ❌ Notification badges
- ❌ Tab switching logic

**What we DO build:**

- ✅ ZeroMQ pub/sub bus with auto-discovery
- ✅ In-conversation notifications ("📥 FROM OPUS: ...")
- ✅ `cognition-cli tasks` CLI command

### Version 2.0 (2025-12-02)

**Major Revision: Multi-Agent First**

**Breaking Changes:**

1. Shifted from headless-first (v1.x) to multi-agent as Phase 1
2. Replaced stdin/stdout IPC with ZeroMQ pub/sub
3. Added AgentRegistry for capability-based routing
4. Interactive agents now primary feature, background tasks secondary

**New Features:**

1. ZeroMQ pub/sub event bus
2. Agent-to-agent communication without user intervention
3. Capability-based agent discovery
4. Richer collaboration patterns (review workflow, architecture workflow)

**Rationale:**

- User already runs multiple agents in separate terminals
- Building single-agent system requires rebuilding for multi-agent later
- ZeroMQ enables more powerful patterns from Phase 1
- Future-proof architecture from the start

**What Stays from v1.x:**

- Markdown-based slash commands
- Permission manifests (frontmatter)
- Headless TUI for background tasks
- Tool system and SIGMA integration
- Core philosophy: zero hardcoding, LLM-interpreted workflows

### Previous Versions

- **v1.3.2:** Hub-and-spoke topology with Parent as Write Master
- **v1.3.1:** Fixed embedding generation (Parent, not Child)
- **v1.3:** Multi-agent cooperative architecture (Phase 6)
- **v1.2:** Write coordination and agent registry
- **v1.1:** Opus review incorporated, 9/10 approval
- **v1.0:** Initial proposal for interactive background tasks

---

**End of Specification**
