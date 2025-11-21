# LLM Provider Configuration

**Status**: ✅ Integrated
**Version**: 1.0.0
**Last Updated**: 2025-11-20

## Overview

The Cognition CLI now includes a **multi-provider LLM abstraction layer** that enables you to use different language models (Claude, OpenAI, Gemini, etc.) throughout the system, particularly in the TUI (Terminal User Interface).

This abstraction eliminates vendor lock-in and provides:
- ✅ **Provider switching** - Use different LLMs without code changes
- ✅ **Cost optimization** - Choose cheaper models for simple tasks
- ✅ **Redundancy** - Fallback to alternative providers if one is unavailable
- ✅ **Future-proof** - Easy integration of new LLM providers

## Architecture

```
┌─────────────────────────────────────────┐
│   Cognition TUI / Commands              │
│   - Multi-turn conversations            │
│   - Tool calling                        │
│   - MCP integration                     │
└─────────────┬───────────────────────────┘
              │
    ┌─────────┴──────────┐
    │  Provider Registry  │
    │  (Abstraction Layer)│
    └─────────┬──────────┘
              │
    ┌─────────┴─────────────────┐
    │            │               │
┌───┴────────┐  ┌┴──────────┐  ┌┴───────┐
│ Claude     │  │ OpenAI    │  │ Gemini │
│ Provider   │  │ Provider  │  │ Provider│
│ (SDK)      │  │ (Future)  │  │ (Future)│
└────────────┘  └───────────┘  └────────┘
```

## Quick Start

### Using Claude (Default)

The TUI uses Claude by default. No configuration needed:

```bash
cognition-cli tui
```

### Specifying a Provider

To use a specific provider:

```bash
# Use Claude with a specific model
cognition-cli tui --provider claude --model claude-3-haiku-20240307

# Future: Use OpenAI
cognition-cli tui --provider openai --model gpt-4-turbo

# Future: Use Gemini
cognition-cli tui --provider gemini --model gemini-2.0-flash-thinking-exp-01-21
```

## Available Providers

### Claude (Anthropic)

**Status**: ✅ Fully Supported

**Models**:
- `claude-sonnet-4-5-20250929` (default) - Latest Sonnet with extended thinking
- `claude-3-5-sonnet-20241022` - Previous Sonnet version
- `claude-3-opus-20240229` - Most capable, highest cost
- `claude-3-haiku-20240307` - Fastest, lowest cost

**Requirements**:
- API Key: Set `ANTHROPIC_API_KEY` environment variable
- Workbench: Running workbench server (for embeddings/analysis)

**Features**:
- ✅ Tool calling (bash, file operations, etc.)
- ✅ MCP server integration (recall, memory)
- ✅ Extended thinking mode (up to 32K tokens)
- ✅ Session resumption
- ✅ Streaming responses

**Example**:
```bash
export ANTHROPIC_API_KEY="sk-ant-..."
cognition-cli tui --provider claude --model claude-sonnet-4-5-20250929
```

### OpenAI

**Status**: ⏳ Coming Soon

Planned support for OpenAI's models including GPT-4 Turbo, GPT-4o, and O1 series.

### Gemini (Google)

**Status**: ⏳ Coming Soon

Planned support for Google's Gemini models including Gemini 2.0 Flash with thinking mode.

## Environment Configuration

### Setting Default Provider

You can set environment variables to configure default behavior:

```bash
# Set default provider
export COGNITION_LLM_PROVIDER=claude

# Set default model
export COGNITION_LLM_MODEL=claude-sonnet-4-5-20250929

# Then run TUI without flags
cognition-cli tui
```

### Provider-Specific Configuration

**Claude (Anthropic)**:
```bash
export ANTHROPIC_API_KEY="sk-ant-..."
export WORKBENCH_URL="http://localhost:8000"  # For embeddings
```

**OpenAI** (future):
```bash
export OPENAI_API_KEY="sk-..."
```

**Gemini** (future):
```bash
export GOOGLE_API_KEY="..."
```

## TUI Provider Selection

The TUI accepts provider configuration via CLI flags:

```bash
cognition-cli tui \
  --provider claude \
  --model claude-3-haiku-20240307 \
  --session-id my-session \
  --debug
```

### Provider Requirements for TUI

Not all providers support all TUI features. Currently supported:

| Feature | Claude | OpenAI | Gemini |
|---------|--------|--------|--------|
| **Basic Completions** | ✅ | ⏳ | ⏳ |
| **Streaming** | ✅ | ⏳ | ⏳ |
| **Tool Calling** | ✅ | ⏳ | ⏳ |
| **MCP Servers** | ✅ | ❌ | ❌ |
| **Extended Thinking** | ✅ | ❌ | ⏳ |
| **Session Resumption** | ✅ | ⏳ | ⏳ |

### Checking Available Providers

To see which providers are available:

```bash
# Via Node.js
node -e "import('./src/cognition-cli/src/llm/index.js').then(m => {
  m.initializeProviders().then(() => {
    console.log('Available providers:', m.registry.list());
    console.log('Agent providers:', m.registry.listAgentProviders());
  });
});"
```

## Cost Optimization

Different providers and models have different cost profiles. Use cheaper models when appropriate:

### Task-Based Model Selection

**Simple Tasks** (low cost):
- Claude Haiku: `claude-3-haiku-20240307`
- OpenAI: `gpt-4o-mini` (future)

**Standard Tasks** (balanced):
- Claude Sonnet: `claude-sonnet-4-5-20250929`
- OpenAI: `gpt-4-turbo` (future)

**Complex Tasks** (high capability):
- Claude Opus: `claude-3-opus-20240229`
- OpenAI: `o1` (future)

### Example: Cost-Optimized Workflow

```bash
# Use Haiku for simple code review
cognition-cli ask "Review this function for obvious bugs" \
  --provider claude \
  --model claude-3-haiku-20240307

# Use Sonnet for complex refactoring in TUI
cognition-cli tui \
  --provider claude \
  --model claude-sonnet-4-5-20250929
```

## Programmatic Usage

### Using the Provider Registry

```typescript
import { registry, initializeProviders } from './llm/index.js';

// Initialize providers
await initializeProviders();

// Get provider
const claude = registry.get('claude');

// Check capabilities
console.log('Available models:', claude.models);
console.log('Supports agent mode:', registry.supportsAgent('claude'));

// Basic completion
const response = await claude.complete({
  prompt: "Explain quantum computing",
  model: "claude-sonnet-4-5-20250929",
  maxTokens: 1000
});

console.log(response.text);
```

### Agent Workflows

For complex agent workflows with tool calling:

```typescript
import { registry } from './llm/index.js';

// Get agent-capable provider
const agent = registry.getAgent('claude');

// Execute agent workflow
for await (const response of agent.executeAgent({
  prompt: "Analyze this codebase for security issues",
  model: "claude-sonnet-4-5-20250929",
  cwd: process.cwd(),
  maxThinkingTokens: 10000
})) {
  // response.messages contains full conversation
  // response.sessionId is current session
  // response.tokens contains usage info

  const lastMsg = response.messages[response.messages.length - 1];
  console.log(lastMsg.content);
}
```

## Troubleshooting

### Provider Not Found

```
Error: Provider 'openai' not found.
Available providers: claude
```

**Solution**: The provider hasn't been initialized yet. Currently only Claude is supported. OpenAI and Gemini support is coming soon.

### Provider Doesn't Support Agent Mode

```
Error: Provider 'basic-llm' does not support agent mode.
Available agent providers: claude
```

**Solution**: The provider doesn't implement the full AgentProvider interface required by the TUI. Use a provider that supports agent workflows (currently only Claude).

### API Key Not Set

```
Error: ANTHROPIC_API_KEY environment variable not set
```

**Solution**: Set your API key:
```bash
export ANTHROPIC_API_KEY="sk-ant-..."
```

### Provider Validation Failed

If the TUI fails to start with a provider error, verify:

1. **Provider is initialized**:
   ```bash
   # Check if provider registry loads
   node -e "import('./src/cognition-cli/src/llm/index.js').then(m => console.log('✅ Loaded'))"
   ```

2. **API keys are set**:
   ```bash
   echo $ANTHROPIC_API_KEY  # Should not be empty
   ```

3. **Workbench is running** (for Claude):
   ```bash
   curl http://localhost:8000/health
   ```

## Roadmap

### Phase 1: Foundation ✅ (Current)
- ✅ Provider abstraction layer
- ✅ Claude provider integration
- ✅ TUI provider configuration
- ✅ CLI flags for provider selection

### Phase 2: Additional Providers ⏳ (Q1 2025)
- ⏳ OpenAI provider (GPT-4, GPT-4o, O1)
- ⏳ Gemini provider (Gemini 2.0 Flash)
- ⏳ Provider fallback/retry logic

### Phase 3: Advanced Features ⏳ (Q2 2025)
- ⏳ Cost tracking per provider
- ⏳ Automatic provider selection based on task
- ⏳ Provider health monitoring
- ⏳ Load balancing across providers

## See Also

- [TUI Usage Guide](./tui.md) - Using the Terminal UI
- [MCP Integration](./mcp.md) - Model Context Protocol servers
- [Sigma Architecture](../sigma/README.md) - Conversation lattice system

## Contributing

To add a new provider:

1. **Implement the Provider Interface**:
   ```typescript
   // src/llm/providers/my-provider.ts
   import { LLMProvider, AgentProvider } from '../provider-interface.js';

   export class MyProvider implements LLMProvider, AgentProvider {
     // Implementation
   }
   ```

2. **Register in Index**:
   ```typescript
   // src/llm/index.ts
   import { MyProvider } from './providers/my-provider.js';

   export async function initializeProviders() {
     const myProvider = new MyProvider(process.env.MY_API_KEY);
     registry.register(myProvider);
   }
   ```

3. **Add Tests**:
   ```typescript
   // src/llm/providers/__tests__/my-provider.test.ts
   describe('MyProvider', () => {
     // Test cases
   });
   ```

4. **Update Documentation**:
   - Add provider to this guide
   - Update feature compatibility matrix
   - Add usage examples
