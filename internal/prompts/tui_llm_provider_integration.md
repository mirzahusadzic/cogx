# Task: Integrate LLM Provider Abstraction into TUI - Enable Multi-Provider Agent Support

## Context

The LLM provider abstraction layer (branch: `feature/llm-provider-abstraction`) is **feature-complete** but **integration-incomplete**. It supports simple text completions and embeddings across Claude, OpenAI, and Gemini, but the **TUI currently bypasses this abstraction** and uses the Claude Agent SDK directly.

**Current Architecture Problem**:
```
TUI → Claude Agent SDK (direct) ← VENDOR LOCK-IN
  ↓
  ✗ Cannot switch to OpenAI/Gemini for agent workflows
  ✗ No cost optimization options
  ✗ No fallback/redundancy mechanisms
```

**Why This Matters**:
1. **Vendor Lock-In**: TUI is permanently tied to Claude API
2. **Cost Inflexibility**: Cannot leverage cheaper models for simple tasks
3. **No Redundancy**: Single point of failure (Claude API down = TUI unusable)
4. **Strategic Risk**: Cannot adopt future LLM providers without rewriting TUI

**Reference**: The LLM provider abstraction exists at:
- `src/llm/provider-interface.ts` - Base interface
- `src/llm/providers/claude-provider.ts` - Claude implementation
- `src/llm/providers/openai-provider.ts` - OpenAI implementation
- `src/llm/providers/gemini-provider.ts` - Gemini implementation
- `src/commands/provider.ts` - Management CLI (ONLY current usage)

## Current State Analysis

### What Exists (✅)

**LLM Provider Abstraction** - Simple completions:
```typescript
interface LLMProvider {
  complete(request: CompletionRequest): Promise<CompletionResponse>
  stream?(request: CompletionRequest): AsyncGenerator<StreamChunk>
  isAvailable(): Promise<boolean>
  estimateCost?(tokens: number, model: string): number
}
```

**TUI Architecture** - Complex agent workflows (src/tui/hooks/sdk/SDKQueryManager.ts):
```typescript
import { query } from '@anthropic-ai/claude-agent-sdk';

const sdkQuery = query({
  prompt,
  options: {
    cwd,                    // Working directory for tools
    resume: sessionId,      // Multi-turn session resumption
    systemPrompt: preset,   // System prompt presets
    maxThinkingTokens,      // Extended thinking mode
    mcpServers,            // MCP server integration (recall, etc.)
    canUseTool: callback,  // Tool calling permissions
    stderr: callback       // Error handling
  }
});
```

### The Gap (❌)

| Feature | Provider Abstraction | Claude Agent SDK | Required for TUI? |
|---------|---------------------|------------------|-------------------|
| **Session Management** | ❌ | ✅ `resume` | ✅ YES |
| **Tool Calling** | ❌ | ✅ `canUseTool` | ✅ YES |
| **MCP Servers** | ❌ | ✅ `mcpServers` | ✅ YES |
| **Extended Thinking** | ❌ | ✅ `maxThinkingTokens` | ✅ YES |
| **Working Directory** | ❌ | ✅ `cwd` | ✅ YES |
| **System Prompt Presets** | ❌ (basic) | ✅ Presets | ✅ YES |
| **Streaming** | ✅ (optional) | ✅ Built-in | ✅ YES |

## Target Architecture (Decoupled Agent SDK)

**Goal**: Extend the LLM provider abstraction to support agent SDK features, then migrate TUI.

```
┌─────────────────────────────────────────────────┐
│   Cognition Σ TUI (Agent Workflows)             │
│   - Multi-turn conversations                    │
│   - Tool calling (bash, file ops, etc.)         │
│   - MCP integration (recall, context injection) │
│   - Extended thinking (complex reasoning)       │
│   - Session persistence                         │
└─────────────┬───────────────────────────────────┘
              │
    ┌─────────┴──────────┐
    │  Agent Provider    │  ← NEW ABSTRACTION LAYER
    │  Interface         │
    └─────────┬──────────┘
              │
    ┌─────────┴───────────────────────────┐
    │                     │               │
┌───┴────────────┐  ┌─────┴─────┐   ┌─────┴──────┐
│ Claude Agent   │  │ OpenAI    │   │ Gemini     │
│ Provider       │  │ Agents    │   │ Agents     │
│ (SDK wrapper)  │  │ (future)  │   │ (future)   │
└────────────────┘  └───────────┘   └────────────┘
```

## Implementation Strategy

### Phase 1: Extend Provider Interface for Agent Workflows (60 min)

**Goal**: Add agent-specific capabilities to the LLM provider interface.

Create `src/llm/agent-provider-interface.ts`:

```typescript
import { LLMProvider } from './provider-interface.js';
import type { McpSdkServerConfigWithInstance } from '@anthropic-ai/claude-agent-sdk';

/**
 * Agent-specific request options
 * Extends basic completion with agent SDK features
 */
export interface AgentRequest {
  /** User prompt */
  prompt: string;

  /** Model identifier */
  model: string;

  /** Working directory for tool execution */
  cwd?: string;

  /** Resume session ID (undefined = fresh session) */
  resumeSessionId?: string;

  /** System prompt (preset or custom) */
  systemPrompt?: {
    type: 'preset' | 'custom';
    preset?: string;  // e.g., 'claude_code'
    custom?: string;
  };

  /** Extended thinking token budget */
  maxThinkingTokens?: number;

  /** MCP server configurations */
  mcpServers?: Record<string, McpSdkServerConfigWithInstance>;

  /** Tool use permission callback */
  onCanUseTool?: (toolName: string) => Promise<boolean>;

  /** Error callback */
  onStderr?: (error: string) => void;

  /** Enable streaming (partial messages) */
  includePartialMessages?: boolean;

  /** Additional options */
  maxTokens?: number;
  temperature?: number;
}

/**
 * Agent-specific message types
 * Mirrors Claude Agent SDK message structure
 */
export interface AgentMessage {
  id: string;
  type: 'user' | 'assistant' | 'tool_use' | 'tool_result' | 'thinking';
  role?: 'user' | 'assistant';
  content: string | AgentContent[];
  timestamp: Date;
  thinking?: string;  // Extended thinking content
}

export interface AgentContent {
  type: 'text' | 'tool_use' | 'tool_result';
  text?: string;
  id?: string;
  name?: string;
  input?: unknown;
  content?: unknown;
  is_error?: boolean;
}

/**
 * Agent response with full context
 */
export interface AgentResponse {
  messages: AgentMessage[];
  sessionId: string;  // New or resumed session ID
  tokens: {
    prompt: number;
    completion: number;
    total: number;
  };
  finishReason: 'stop' | 'length' | 'tool_use' | 'error';
}

/**
 * Agent Provider Interface
 *
 * Extends LLMProvider with agent-specific capabilities:
 * - Multi-turn session management
 * - Tool calling support
 * - MCP server integration
 * - Extended thinking mode
 *
 * Providers that implement this interface can be used for agent workflows
 * like the TUI, which require complex interaction patterns beyond simple completions.
 */
export interface AgentProvider extends LLMProvider {
  /**
   * Execute agent query with full agent SDK features
   *
   * Returns async generator for streaming message updates.
   * Each yielded value is a complete snapshot of the conversation state.
   *
   * @example
   * const provider = registry.getAgent('claude');
   * for await (const response of provider.executeAgent(request)) {
   *   // response.messages contains all messages so far
   *   // Last message may be partial (streaming)
   *   console.log(response.messages[response.messages.length - 1]);
   * }
   */
  executeAgent(
    request: AgentRequest
  ): AsyncGenerator<AgentResponse, void, undefined>;

  /**
   * Check if provider supports agent workflows
   *
   * Some providers may only support basic completions.
   * This method allows runtime capability checking.
   */
  supportsAgentMode(): boolean;
}

/**
 * Type guard to check if provider supports agent workflows
 */
export function isAgentProvider(
  provider: LLMProvider
): provider is AgentProvider {
  return (
    'executeAgent' in provider &&
    typeof (provider as AgentProvider).executeAgent === 'function'
  );
}
```

### Phase 2: Implement Claude Agent Provider (90 min)

**Goal**: Wrap the Claude Agent SDK in the new interface.

Update `src/llm/providers/claude-provider.ts`:

```typescript
import Anthropic from '@anthropic-ai/sdk';
import { query, type Query, type SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import {
  LLMProvider,
  CompletionRequest,
  CompletionResponse,
} from '../provider-interface.js';
import {
  AgentProvider,
  AgentRequest,
  AgentResponse,
  AgentMessage,
  AgentContent,
} from '../agent-provider-interface.js';

export class ClaudeProvider implements LLMProvider, AgentProvider {
  name = 'claude';
  models = [
    'claude-sonnet-4-5-20250929',
    'claude-3-5-sonnet-20241022',
    'claude-3-opus-20240229',
    'claude-3-haiku-20240307',
  ];

  private client: Anthropic;

  constructor(apiKey?: string) {
    this.client = new Anthropic({
      apiKey: apiKey || process.env.ANTHROPIC_API_KEY,
    });
  }

  // ========================================
  // Basic LLMProvider interface (existing)
  // ========================================

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    // ... existing implementation ...
  }

  async *stream(request: CompletionRequest) {
    // ... existing implementation ...
  }

  estimateCost(tokens: number, model: string): number {
    // ... existing implementation ...
  }

  async isAvailable(): Promise<boolean> {
    // ... existing implementation ...
  }

  // ========================================
  // NEW: AgentProvider interface
  // ========================================

  supportsAgentMode(): boolean {
    return true;
  }

  async *executeAgent(
    request: AgentRequest
  ): AsyncGenerator<AgentResponse, void, undefined> {
    // Create SDK query with agent features
    const sdkQuery: Query = query({
      prompt: request.prompt,
      options: {
        cwd: request.cwd,
        resume: request.resumeSessionId,
        systemPrompt:
          request.systemPrompt?.type === 'preset'
            ? { type: 'preset', preset: request.systemPrompt.preset || 'claude_code' }
            : request.systemPrompt?.custom
              ? { type: 'custom', prompt: request.systemPrompt.custom }
              : { type: 'preset', preset: 'claude_code' },
        includePartialMessages: request.includePartialMessages ?? true,
        maxThinkingTokens: request.maxThinkingTokens,
        stderr: request.onStderr,
        canUseTool: request.onCanUseTool,
        mcpServers: request.mcpServers,
      },
    });

    // Stream messages from SDK
    const messages: AgentMessage[] = [];
    let currentSessionId = request.resumeSessionId || '';
    let totalTokens = { prompt: 0, completion: 0, total: 0 };

    for await (const sdkMessage of sdkQuery) {
      // Extract session ID
      if (sdkMessage.sessionId) {
        currentSessionId = sdkMessage.sessionId;
      }

      // Convert SDK message to AgentMessage
      const agentMessage = this.convertSDKMessage(sdkMessage);
      messages.push(agentMessage);

      // Estimate tokens (SDK doesn't provide real-time counts)
      totalTokens = this.estimateTokens(messages);

      // Yield current state
      yield {
        messages: [...messages], // Clone to avoid mutation
        sessionId: currentSessionId,
        tokens: totalTokens,
        finishReason: this.determineFinishReason(sdkMessage),
      };
    }
  }

  /**
   * Convert Claude Agent SDK message to AgentMessage format
   */
  private convertSDKMessage(sdkMessage: SDKMessage): AgentMessage {
    const baseMessage: AgentMessage = {
      id: this.generateMessageId(),
      type: this.mapSDKMessageType(sdkMessage.type),
      role: sdkMessage.role,
      content: '',
      timestamp: new Date(),
    };

    // Handle different SDK message types
    if (sdkMessage.type === 'text') {
      baseMessage.content = sdkMessage.text || '';
    } else if (sdkMessage.type === 'tool_use') {
      baseMessage.content = [
        {
          type: 'tool_use',
          id: sdkMessage.toolUseId || '',
          name: sdkMessage.toolName || '',
          input: sdkMessage.input,
        },
      ];
    } else if (sdkMessage.type === 'tool_result') {
      baseMessage.content = [
        {
          type: 'tool_result',
          id: sdkMessage.toolUseId || '',
          content: sdkMessage.result,
          is_error: sdkMessage.isError,
        },
      ];
    } else if (sdkMessage.type === 'thinking') {
      baseMessage.thinking = sdkMessage.thinking || '';
    }

    return baseMessage;
  }

  private mapSDKMessageType(
    sdkType: string
  ): AgentMessage['type'] {
    const typeMap: Record<string, AgentMessage['type']> = {
      text: 'assistant',
      user: 'user',
      tool_use: 'tool_use',
      tool_result: 'tool_result',
      thinking: 'thinking',
    };
    return typeMap[sdkType] || 'assistant';
  }

  private determineFinishReason(
    sdkMessage: SDKMessage
  ): AgentResponse['finishReason'] {
    if (sdkMessage.stopReason === 'end_turn') return 'stop';
    if (sdkMessage.stopReason === 'max_tokens') return 'length';
    if (sdkMessage.stopReason === 'tool_use') return 'tool_use';
    return 'stop';
  }

  private estimateTokens(messages: AgentMessage[]) {
    // Rough estimation: 4 chars per token
    let totalChars = 0;
    for (const msg of messages) {
      if (typeof msg.content === 'string') {
        totalChars += msg.content.length;
      } else if (Array.isArray(msg.content)) {
        totalChars += JSON.stringify(msg.content).length;
      }
    }
    const total = Math.ceil(totalChars / 4);
    return {
      prompt: Math.ceil(total * 0.4), // Estimate 40% input
      completion: Math.ceil(total * 0.6), // Estimate 60% output
      total,
    };
  }

  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
```

### Phase 3: Update Provider Registry for Agent Support (30 min)

**Goal**: Add agent-specific registry methods.

Update `src/llm/provider-registry.ts`:

```typescript
import { LLMProvider } from './provider-interface.js';
import { AgentProvider, isAgentProvider } from './agent-provider-interface.js';

export class ProviderRegistry {
  // ... existing code ...

  /**
   * Get provider as AgentProvider (throws if not supported)
   */
  getAgent(name: string): AgentProvider {
    const provider = this.get(name);
    if (!isAgentProvider(provider)) {
      throw new Error(
        `Provider '${name}' does not support agent mode. ` +
        `Use a provider like 'claude' that implements AgentProvider.`
      );
    }
    return provider;
  }

  /**
   * Get default provider as AgentProvider
   */
  getDefaultAgent(): AgentProvider {
    return this.getAgent(this.defaultProvider);
  }

  /**
   * List providers that support agent mode
   */
  listAgentProviders(): string[] {
    return this.list().filter((name) => {
      const provider = this.providers.get(name);
      return provider && isAgentProvider(provider);
    });
  }

  /**
   * Check if provider supports agent workflows
   */
  supportsAgent(name: string): boolean {
    const provider = this.providers.get(name);
    return !!provider && isAgentProvider(provider);
  }
}
```

### Phase 4: Create TUI Agent Adapter (45 min)

**Goal**: Bridge between provider abstraction and TUI's useClaudeAgent hook.

Create `src/tui/hooks/sdk/AgentProviderAdapter.ts`:

```typescript
import { registry } from '../../../llm/index.js';
import type {
  AgentRequest,
  AgentResponse,
  AgentMessage,
} from '../../../llm/agent-provider-interface.js';
import type { McpSdkServerConfigWithInstance } from '@anthropic-ai/claude-agent-sdk';

/**
 * Adapter Options
 *
 * Maps TUI's useClaudeAgent options to AgentProvider interface
 */
export interface AgentAdapterOptions {
  /** Provider name (default: 'claude') */
  provider?: string;

  /** Model to use (provider-specific) */
  model?: string;

  /** Working directory for tool execution */
  cwd: string;

  /** Resume session ID */
  resumeSessionId?: string;

  /** Extended thinking token budget */
  maxThinkingTokens?: number;

  /** MCP servers */
  mcpServers?: Record<string, McpSdkServerConfigWithInstance>;

  /** Error callback */
  onStderr?: (error: string) => void;

  /** Tool permission callback */
  onCanUseTool?: (toolName: string) => Promise<boolean>;

  /** Debug mode */
  debug?: boolean;
}

/**
 * Agent Provider Adapter
 *
 * Wraps the AgentProvider interface for use in the TUI.
 * Handles provider selection, error mapping, and message conversion.
 */
export class AgentProviderAdapter {
  private providerName: string;
  private model: string;
  private options: AgentAdapterOptions;

  constructor(options: AgentAdapterOptions) {
    this.options = options;
    this.providerName = options.provider || 'claude';

    // Auto-select model if not specified
    const provider = registry.getAgent(this.providerName);
    this.model = options.model || provider.models[0];
  }

  /**
   * Execute agent query
   *
   * Returns async generator compatible with TUI's message processing
   */
  async *query(prompt: string): AsyncGenerator<AgentResponse> {
    const provider = registry.getAgent(this.providerName);

    const request: AgentRequest = {
      prompt,
      model: this.model,
      cwd: this.options.cwd,
      resumeSessionId: this.options.resumeSessionId,
      maxThinkingTokens: this.options.maxThinkingTokens,
      mcpServers: this.options.mcpServers,
      onStderr: this.options.onStderr,
      onCanUseTool: this.options.onCanUseTool,
      systemPrompt: {
        type: 'preset',
        preset: 'claude_code',
      },
      includePartialMessages: true,
    };

    if (this.options.debug) {
      console.log('[AgentAdapter] Query:', {
        provider: this.providerName,
        model: this.model,
        prompt: prompt.substring(0, 100) + '...',
      });
    }

    // Stream responses from provider
    for await (const response of provider.executeAgent(request)) {
      yield response;
    }
  }

  /**
   * Get current provider name
   */
  getProviderName(): string {
    return this.providerName;
  }

  /**
   * Get current model
   */
  getModel(): string {
    return this.model;
  }

  /**
   * Switch provider (creates new adapter instance)
   */
  static withProvider(
    providerName: string,
    options: AgentAdapterOptions
  ): AgentProviderAdapter {
    return new AgentProviderAdapter({
      ...options,
      provider: providerName,
    });
  }
}
```

### Phase 5: Refactor useClaudeAgent to Use Adapter (120 min)

**Goal**: Replace direct SDK calls with AgentProviderAdapter.

Update `src/tui/hooks/useClaudeAgent.ts`:

**BEFORE (lines 111-128)**:
```typescript
import { useState, useCallback, useEffect, useRef } from 'react';
import type { SDKMessage, Query } from '@anthropic-ai/claude-agent-sdk';
import { createSDKQuery } from './sdk/index.js';
```

**AFTER**:
```typescript
import { useState, useCallback, useEffect, useRef } from 'react';
import { AgentProviderAdapter } from './sdk/AgentProviderAdapter.js';
import type { AgentResponse, AgentMessage } from '../../llm/agent-provider-interface.js';
```

**BEFORE (sendMessage function)**:
```typescript
const sendMessage = useCallback(async (userMessage: string) => {
  // ... setup code ...

  const sdkQuery = createSDKQuery({
    prompt: finalPrompt,
    cwd,
    resumeSessionId,
    maxThinkingTokens,
    mcpServers,
    onStderr,
    onCanUseTool,
  });

  for await (const sdkMessage of sdkQuery) {
    // Process SDK message
  }
}, [dependencies]);
```

**AFTER**:
```typescript
const sendMessage = useCallback(async (userMessage: string) => {
  // ... setup code ...

  const adapter = new AgentProviderAdapter({
    provider: 'claude', // TODO: Make configurable
    cwd,
    resumeSessionId,
    maxThinkingTokens,
    mcpServers,
    onStderr,
    onCanUseTool,
    debug,
  });

  for await (const response of adapter.query(finalPrompt)) {
    // Process agent response
    // response.messages contains all messages
    // response.sessionId is the current session ID
    // response.tokens contains usage info
  }
}, [dependencies]);
```

**Key changes**:
1. Replace `createSDKQuery()` with `AgentProviderAdapter`
2. Iterate over `adapter.query()` instead of `sdkQuery`
3. Convert `AgentResponse` to TUI's `ClaudeMessage` format
4. Update session ID tracking to use `response.sessionId`
5. Update token counting to use `response.tokens`

### Phase 6: Add Provider Configuration to TUI (30 min)

**Goal**: Allow users to select LLM provider for TUI sessions.

Update `src/commands/tui.ts`:

```typescript
interface TUIOptions {
  // ... existing options ...

  /** LLM provider to use (default: claude) */
  provider?: string;

  /** LLM model to use (provider-specific) */
  model?: string;
}

export async function tuiCommand(options: TUIOptions): Promise<void> {
  // ... existing code ...

  // Validate provider if specified
  if (options.provider) {
    if (!registry.supportsAgent(options.provider)) {
      console.error(
        `Error: Provider '${options.provider}' does not support agent mode.\n` +
        `Available agent providers: ${registry.listAgentProviders().join(', ')}`
      );
      process.exit(1);
    }
  }

  // Launch TUI with provider config
  await startTUI({
    pgcRoot,
    projectRoot,
    sessionId,
    workbenchUrl,
    sessionTokens: options.sessionTokens,
    maxThinkingTokens: options.maxThinkingTokens,
    debug: options.debug,
    provider: options.provider, // NEW
    model: options.model,       // NEW
  });
}
```

Add CLI flags in `src/cli.ts`:

```typescript
program
  .command('tui')
  .description('Launch interactive TUI')
  .option('--provider <name>', 'LLM provider to use (claude, openai, gemini)', 'claude')
  .option('--model <name>', 'Model to use (provider-specific)')
  .option('--session-id <id>', 'Resume existing session')
  // ... existing options ...
  .action(async (options) => {
    await tuiCommand({
      projectRoot: process.cwd(),
      ...options,
    });
  });
```

### Phase 7: Update Documentation (30 min)

Update `docs/guides/llm_providers.md`:

````markdown
## TUI Provider Configuration

The TUI now supports multiple LLM providers for agent workflows.

### Usage

```bash
# Use Claude (default)
cognition-cli tui

# Use OpenAI for TUI
cognition-cli tui --provider openai --model gpt-4-turbo

# Use Gemini for TUI
cognition-cli tui --provider gemini --model gemini-2.0-flash-thinking-exp-01-21
```

### Provider Requirements

Not all providers support agent mode (tool calling, MCP servers, etc.).
Currently supported agent providers:

- ✅ **Claude** (full support via Agent SDK)
- ⏳ **OpenAI** (coming soon - requires Assistants API integration)
- ⏳ **Gemini** (coming soon - requires function calling integration)

Check supported providers:

```bash
cognition-cli provider list --agent-mode
```

### Configuration

Set default TUI provider:

```bash
export COGNITION_TUI_PROVIDER=claude
export COGNITION_TUI_MODEL=claude-sonnet-4-5-20250929
```

Or per-session:

```bash
cognition-cli tui --provider claude --model claude-3-haiku-20240307
```
````

### Phase 8: Testing & Validation (60 min)

**Goal**: Ensure TUI works identically with new abstraction.

Create `src/tui/hooks/sdk/__tests__/AgentProviderAdapter.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentProviderAdapter } from '../AgentProviderAdapter.js';
import { registry } from '../../../../llm/index.js';
import type { AgentProvider } from '../../../../llm/agent-provider-interface.js';

// Mock provider
class MockAgentProvider implements AgentProvider {
  name = 'mock';
  models = ['mock-model'];

  async complete() {
    return {
      text: 'mock',
      model: 'mock-model',
      tokens: { prompt: 10, completion: 10, total: 20 },
      finishReason: 'stop' as const,
    };
  }

  async isAvailable() {
    return true;
  }

  supportsAgentMode() {
    return true;
  }

  async *executeAgent(request) {
    yield {
      messages: [
        {
          id: 'msg1',
          type: 'assistant',
          content: 'Hello from mock provider',
          timestamp: new Date(),
        },
      ],
      sessionId: 'session-123',
      tokens: { prompt: 5, completion: 10, total: 15 },
      finishReason: 'stop',
    };
  }
}

describe('AgentProviderAdapter', () => {
  beforeEach(() => {
    registry.register(new MockAgentProvider());
  });

  it('should query provider and stream responses', async () => {
    const adapter = new AgentProviderAdapter({
      provider: 'mock',
      cwd: '/tmp',
    });

    const responses = [];
    for await (const response of adapter.query('test prompt')) {
      responses.push(response);
    }

    expect(responses).toHaveLength(1);
    expect(responses[0].sessionId).toBe('session-123');
    expect(responses[0].messages[0].content).toBe('Hello from mock provider');
  });

  it('should throw if provider does not support agent mode', () => {
    expect(() => {
      new AgentProviderAdapter({
        provider: 'nonexistent',
        cwd: '/tmp',
      });
    }).toThrow();
  });
});
```

**Manual Testing Checklist**:

```bash
# 1. Install dependencies
npm install

# 2. Build with new abstraction
npm run build

# 3. Run unit tests
npm test

# 4. Test TUI with Claude (default)
npm run tui
# → Should work identically to before
# → Verify multi-turn conversations
# → Verify tool calling (bash, file ops)
# → Verify MCP recall tool
# → Verify session resumption

# 5. Test TUI with OpenAI (if implemented)
npm run tui -- --provider openai --model gpt-4-turbo
# → Should work with OpenAI's API
# → Verify feature parity

# 6. Test provider switching
cognition-cli provider list --agent-mode
cognition-cli provider set-default claude
cognition-cli tui
# → Should respect default provider

# 7. Test error handling
cognition-cli tui --provider invalid
# → Should error gracefully with helpful message
```

## Deliverables

1. ✅ Extended provider interface (`src/llm/agent-provider-interface.ts`)
2. ✅ Claude Agent Provider implementation (`src/llm/providers/claude-provider.ts` updates)
3. ✅ Agent Provider Adapter (`src/tui/hooks/sdk/AgentProviderAdapter.ts`)
4. ✅ Refactored `useClaudeAgent` hook to use adapter
5. ✅ TUI provider configuration CLI flags
6. ✅ Updated provider registry with agent support
7. ✅ Tests for agent adapter
8. ✅ Documentation updates (`docs/guides/llm_providers.md`)
9. ✅ Manual testing validation

## Success Criteria

- ✅ **Zero breaking changes** - TUI works identically with default Claude provider
- ✅ **Provider switchable** - Can use `--provider` flag to select different LLMs
- ✅ **All tests pass** - Unit tests and integration tests green
- ✅ **Feature parity** - All TUI features work (sessions, tools, MCP, thinking)
- ✅ **Error handling** - Graceful failures with helpful messages
- ✅ **Documentation complete** - Clear guide for using different providers
- ✅ **Performance unchanged** - No noticeable latency increase

## Validation Commands

```bash
# Build and test
npm run build && npm test

# TUI with default Claude
cognition-cli tui

# TUI with custom provider
cognition-cli tui --provider claude --model claude-3-haiku-20240307

# Provider management
cognition-cli provider list --agent-mode
cognition-cli provider test claude
```

## Time Estimate

**Total: ~7 hours**

- Phase 1: Agent interface design (60 min)
- Phase 2: Claude agent provider (90 min)
- Phase 3: Registry updates (30 min)
- Phase 4: Adapter creation (45 min)
- Phase 5: useClaudeAgent refactor (120 min)
- Phase 6: TUI configuration (30 min)
- Phase 7: Documentation (30 min)
- Phase 8: Testing & validation (60 min)

## Migration Path (Safe Rollout)

### Stage 1: Non-Breaking Addition (Phases 1-4)
- Add agent interface and adapter
- Keep existing SDK code working
- Test adapter in parallel

### Stage 2: Feature Flag (Phase 5)
```typescript
const USE_PROVIDER_ABSTRACTION = process.env.COGNITION_USE_PROVIDER_ABSTRACTION === 'true';

if (USE_PROVIDER_ABSTRACTION) {
  // Use AgentProviderAdapter
} else {
  // Use existing createSDKQuery
}
```

### Stage 3: Full Migration (Phase 6-8)
- Remove feature flag
- Delete old SDK code
- Update documentation

---

**Priority**: HIGH
**Impact**: Strategic - enables multi-provider TUI, reduces vendor lock-in
**Risk**: MEDIUM - requires careful refactoring of TUI hooks
**Dependencies**: Branch `feature/llm-provider-abstraction` must be merged first
