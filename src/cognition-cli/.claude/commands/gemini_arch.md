# Architecture Overview

Based on PGC analysis, this is a monorepo containing a Gemini CLI tool with the following structure:

Core Components

Config (role: component, impacts: 219 symbols)

- Central configuration hub at core/src/config/config.ts
- Depends on: 27 core services/components
- Highest architectural impact - critical path to nearly all systems
- Manages: Extensions, MCP servers, telemetry, sandbox, accessibility settings

  ToolRegistry (role: component, impacts: 117+ symbols)

- Tool management system at core/src/tools/tool-registry.ts
- Consumers: Config, MCP integrations, all Tool implementations
- Manages execution of tools (Edit, Read, Shell, Grep, Glob, MCP tools, etc.)
- Critical dependency paths through BaseToolInvocation, BaseDeclarativeTool

  GeminiChat (role: component, impacts: 150+ symbols)

- Core chat orchestration at core/src/core/geminiChat.ts
- Used by: AgentExecutor, CoderAgentExecutor, Zed integration
- Integrates with: GeminiClient, ModelRouterService, Config
- Handles conversation flow, history validation, streaming

  MessageBus (role: component, impacts: 75 symbols)

- Event coordination at core/src/confirmation-bus/message-bus.ts
- Extends EventEmitter
- Depends on: PolicyEngine → PolicyRule
- Key infrastructure for tool confirmations and state management

  AgentExecutor (role: component, impacts: 49 symbols)

- Agent orchestration at core/src/agents/executor.ts
- Base class for CoderAgentExecutor (a2a-server)
- Integrates: Config, ToolRegistry, GeminiChat, ChatRecordingService, LoopDetectionService

  Key Architectural Layers
  1. CLI Layer (packages/cli/)

- CommandService - command management
- Extension system (ExtensionManager, ExtensionEnablementManager)
- File/Builtin/MCP command loaders
- Zed editor integration
  2. Core Engine (packages/core/)

- LLM Integration: BaseLlmClient → GeminiClient → GeminiChat
- Model Routing: ModelRouterService with multiple strategies (Classifier, Composite, Default, Fallback, Override)
- Tool System: ToolRegistry managing Edit, Read, Shell, Grep, Glob, MCP tools
- Agent System: AgentRegistry, AgentExecutor, SubagentInvocation
  3. Service Layer

- ChatRecordingService - conversation persistence
- LoopDetectionService - infinite loop prevention
- FileDiscoveryService - file search/filtering
- ShellExecutionService - command execution
- ModelRouterService - model selection strategies
  4. A2A Server (packages/a2a/server/)

- CoderAgentExecutor - specialized agent for coding tasks
- Task/TaskWrapper - task management
- HTTP API (createApp, main)
- GCS persistence (GCSTaskStore)

  Critical Dependency Paths
  1. Config → ToolRegistry → ToolInvocation (117 consumers)
  - Changes to tool interfaces ripple widely
  2. Config → MessageBus (75 consumers)
  - Event system is architectural bottleneck
  3. BaseLlmClient → GeminiClient → GeminiChat
  - LLM abstraction layer with extensive reach
  4. AgentExecutor → GeminiChat → Config
  - Agent execution depends on full config stack

  Data Flows

  User Input Flow:
  CLI → CommandService → AgentExecutor → GeminiChat → GeminiClient → API
  ↓
  ToolRegistry → Tool Invocations → MessageBus (confirmations)

  Extension Flow:
  Config → ExtensionManager → loadExtensions → ToolRegistry/AgentRegistry/PromptRegistry

  MCP Integration Flow:
  Config → McpClient → discoverTools/discoverPrompts → ToolRegistry/PromptRegistry
  → OAuth handling → MCPOAuthProvider → MCPOAuthTokenStorage

  Architectural Patterns

- Registry Pattern: ToolRegistry, AgentRegistry, PromptRegistry, CommandRegistry
- Strategy Pattern: Multiple routing strategies for model selection
- Service Layer: Separation of concerns (Chat, Loop Detection, File Discovery, etc.)
- Event-Driven: MessageBus for tool confirmations and state changes
- Extensibility: Plugin architecture via Extensions and MCP servers

  Architectural Risks

  ⚠️ High Blast Radius Symbols (Changes require extensive testing):

- Config (219 consumers) - Changes affect entire system
- ToolInvocation (117 consumers) - Core tool abstraction
- BaseDeclarativeTool (109 consumers) - Tool implementation base
- BaseToolInvocation (92 consumers) - Tool execution base
- MessageBus (75 consumers) - Event coordination

  Package Distribution

- 3636 total symbols analyzed
- 63% utilities (2292) - helper functions
- 20% types (737) - TypeScript interfaces/types
- 15% components (534) - classes/services
- 1% configuration (35) - config objects
- 1% services (33) - specialized services
- <1% controllers (5) - orchestration

  The architecture follows a layered monorepo design with clear separation between CLI, core engine, services, and specialized servers,
  unified by a central Config component and coordinated through registries and event buses.
