# LLM Provider Configuration

Cognition Σ supports multiple LLM providers through a plugin architecture. This guide explains how to configure and use different LLM backends.

## Table of Contents

- [Overview](#overview)
- [Supported Providers](#supported-providers)
- [Configuration](#configuration)
- [CLI Usage](#cli-usage)
- [Programmatic Usage](#programmatic-usage)
- [Custom Providers](#custom-providers)
- [Troubleshooting](#troubleshooting)

## Overview

The LLM provider abstraction layer decouples Cognition Σ from any specific LLM vendor. This enables:

- **Multi-provider support**: Switch between Claude, OpenAI, or custom providers
- **Cost optimization**: Compare pricing and choose the best option
- **Redundancy**: Fallback providers for reliability
- **Future-proofing**: Easy to add new providers as they emerge

## Supported Providers

### Claude (Anthropic)

**Status**: Default provider

**Models**:

- `claude-sonnet-4-5-20250929` - Latest Sonnet (recommended)
- `claude-3-5-sonnet-20241022` - Previous Sonnet
- `claude-3-opus-20240229` - Most capable, expensive
- `claude-3-haiku-20240307` - Fastest, cheapest

**Pricing** (per 1M tokens):

- Sonnet 4.5: $3 input, $15 output
- Opus: $15 input, $75 output
- Haiku: $0.25 input, $1.25 output

### OpenAI

**Status**: Optional provider

**Models**:

- `gpt-4o` - Latest multimodal model
- `gpt-4-turbo` - High capability, good speed (recommended)
- `gpt-4` - Most capable
- `gpt-3.5-turbo` - Fastest, cheapest

**Pricing** (per 1M tokens):

- GPT-4o: $2.50 input, $10 output
- GPT-4 Turbo: $10 input, $30 output
- GPT-4: $30 input, $60 output
- GPT-3.5 Turbo: $0.50 input, $1.50 output

## Configuration

### Environment Variables

Configure providers using environment variables:

```bash
# Claude (default provider)
export ANTHROPIC_API_KEY=sk-ant-...
export COGNITION_CLAUDE_MODEL=claude-sonnet-4-5-20250929  # Optional

# OpenAI (optional)
export OPENAI_API_KEY=sk-...
export COGNITION_OPENAI_MODEL=gpt-4-turbo  # Optional

# Set default provider (optional, defaults to 'claude')
export COGNITION_LLM_PROVIDER=claude  # or 'openai'
```

### Getting API Keys

**Claude (Anthropic)**:

1. Sign up at <https://console.anthropic.com>
2. Navigate to API Keys section
3. Create a new API key
4. Copy and set as `ANTHROPIC_API_KEY`

**OpenAI**:

1. Sign up at <https://platform.openai.com>
2. Navigate to API Keys section
3. Create a new API key
4. Copy and set as `OPENAI_API_KEY`

### Configuration Validation

Check your configuration:

```bash
cognition-cli provider config
```

This displays:

- Current default provider
- API key status (masked for security)
- Default models
- Available models
- Configuration issues (if any)

## CLI Usage

### List Available Providers

```bash
cognition-cli provider list
```

Output:

```
📋 Available LLM Providers

* claude (default)
  Status: ✓ Available
  Models: claude-sonnet-4-5-20250929, claude-3-5-sonnet-20241022, ...

  openai
  Status: ✓ Available
  Models: gpt-4o, gpt-4-turbo, gpt-4 +1 more
```

### Test Provider Availability

```bash
# Test specific provider
cognition-cli provider test claude
cognition-cli provider test openai
```

Output:

```
Testing claude...
✓ claude is available and working
```

### Set Default Provider

```bash
cognition-cli provider set-default openai
```

Output:

```
✓ Default provider set to: openai

To make this permanent, set COGNITION_LLM_PROVIDER environment variable:
  export COGNITION_LLM_PROVIDER=openai
```

**Note**: This change is temporary. To persist, set the environment variable.

### List Models

```bash
# List all models for all providers
cognition-cli provider models

# List models for specific provider
cognition-cli provider models claude
cognition-cli provider models openai
```

## Programmatic Usage

### Basic Completion

```typescript
import { complete } from './llm/index.js';

// Simple completion (uses default provider and model)
const text = await complete('What is TypeScript?');
console.log(text);
```

### Specify Provider and Model

```typescript
import { complete } from './llm/index.js';

const text = await complete('Explain quantum computing', {
  provider: 'openai',
  model: 'gpt-4-turbo',
  maxTokens: 1000,
  temperature: 0.7,
});
```

### Direct Provider Access

```typescript
import { registry } from './llm/index.js';

// Get specific provider
const claude = registry.get('claude');

// Make completion request
const response = await claude.complete({
  prompt: 'Explain quantum computing',
  model: 'claude-sonnet-4-5-20250929',
  maxTokens: 1000,
  temperature: 0.7,
  systemPrompt: 'You are a physics expert.',
});

console.log(response.text);
console.log(`Tokens used: ${response.tokens.total}`);

// Estimate cost
const cost = claude.estimateCost(response.tokens.total, response.model);
console.log(`Estimated cost: $${cost.toFixed(4)}`);
```

### Streaming Completions

```typescript
import { streamComplete } from './llm/index.js';

// Stream response to console
for await (const chunk of streamComplete('Write a story about AI')) {
  process.stdout.write(chunk);
}
console.log('\nDone!');
```

### Initialization

```typescript
import { initializeProviders } from './llm/index.js';

// Initialize with environment variables
initializeProviders();

// Initialize with explicit configuration
initializeProviders({
  anthropicApiKey: process.env.ANTHROPIC_API_KEY,
  openaiApiKey: process.env.OPENAI_API_KEY,
  defaultProvider: 'openai',
  skipMissingProviders: true,  // Don't fail if some providers unavailable
});
```

### Health Checks

```typescript
import { registry } from './llm/index.js';

// Check specific provider
const available = await registry.healthCheck('claude');
if (!available) {
  console.warn('Claude unavailable, switching to OpenAI');
  registry.setDefault('openai');
}

// Check all providers
const health = await registry.healthCheckAll();
console.log('Claude:', health.claude ? '✓' : '✗');
console.log('OpenAI:', health.openai ? '✓' : '✗');
```

## Custom Providers

You can implement custom providers for local models, other APIs, or custom logic.

### Implementing a Provider

```typescript
import type {
  LLMProvider,
  CompletionRequest,
  CompletionResponse,
} from './llm/provider-interface.js';

class CustomProvider implements LLMProvider {
  name = 'my-provider';
  models = ['my-model-v1'];

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    // Your implementation here
    // Call your API, local model, etc.

    return {
      text: 'Generated response',
      model: request.model,
      tokens: {
        prompt: 100,
        completion: 200,
        total: 300,
      },
      finishReason: 'stop',
    };
  }

  async isAvailable(): Promise<boolean> {
    // Health check implementation
    return true;
  }

  // Optional: streaming support
  async *stream(request: CompletionRequest): AsyncIterator<StreamChunk> {
    yield { text: 'chunk 1', isComplete: false };
    yield { text: 'chunk 2', isComplete: false };
    yield { text: '', isComplete: true };
  }

  // Optional: cost estimation
  estimateCost(tokens: number, model: string): number {
    return (tokens / 1_000_000) * 0.5;  // $0.50 per 1M tokens
  }
}
```

### Registering a Custom Provider

```typescript
import { registry } from './llm/index.js';

const customProvider = new CustomProvider();
registry.register(customProvider);

// Use it
const text = await complete('Hello', { provider: 'my-provider' });
```

## Troubleshooting

### "Provider not registered" Error

**Cause**: Provider was not initialized or API key is missing.

**Solution**:

```bash
# Check configuration
cognition-cli provider config

# Verify API key is set
echo $ANTHROPIC_API_KEY
echo $OPENAI_API_KEY

# Set API key if missing
export ANTHROPIC_API_KEY=sk-ant-...
```

### "Provider unavailable" Error

**Cause**: API is down, network issues, or invalid API key.

**Solution**:

```bash
# Test provider availability
cognition-cli provider test claude

# Check API key validity
# Regenerate key at provider console if needed
```

### "No providers registered" Error

**Cause**: No valid API keys configured.

**Solution**:

```bash
# Set at least one provider API key
export ANTHROPIC_API_KEY=sk-ant-...

# Or in code:
initializeProviders({
  anthropicApiKey: 'sk-ant-...',
  skipMissingProviders: true,
});
```

### Cost Optimization

Compare costs across providers:

```typescript
import { registry } from './llm/index.js';

const claude = registry.get('claude');
const openai = registry.get('openai');

const tokens = 100_000;

console.log('Claude Sonnet 4.5:', claude.estimateCost(tokens, 'claude-sonnet-4-5-20250929'));
console.log('Claude Haiku:', claude.estimateCost(tokens, 'claude-3-haiku-20240307'));
console.log('GPT-4 Turbo:', openai.estimateCost(tokens, 'gpt-4-turbo'));
console.log('GPT-3.5 Turbo:', openai.estimateCost(tokens, 'gpt-3.5-turbo'));
```

### Performance Issues

For faster responses:

1. Use faster models: Claude Haiku or GPT-3.5 Turbo
2. Reduce `maxTokens`
3. Use streaming for better UX on long responses
4. Consider caching responses for repeated queries

### Rate Limiting

If you hit rate limits:

1. Implement retry logic with exponential backoff
2. Use multiple API keys (if allowed by provider)
3. Switch to different provider as fallback
4. Reduce request frequency

## Best Practices

1. **Environment Variables**: Store API keys in `.env` files, never commit them
2. **Error Handling**: Always wrap provider calls in try-catch
3. **Health Checks**: Verify provider availability before critical operations
4. **Cost Monitoring**: Track token usage and estimated costs
5. **Model Selection**: Use appropriate model for the task (don't use Opus for simple tasks)
6. **Fallback Strategy**: Configure multiple providers for redundancy
7. **Testing**: Use mocks in tests, not real API calls

## Architecture

```
┌─────────────────────────────────┐
│   Cognition Σ CLI (Core)        │
│   - Overlays (O1-O7)            │
│   - PGC architecture            │
│   - Session management          │
└─────────────┬───────────────────┘
              │
    ┌─────────┴─────────┐
    │  LLM Provider API  │  ← Abstraction Layer
    │   (src/llm/)       │
    └─────────┬──────────┘
              │
    ┌─────────┴──────────────────────┐
    │                                │
┌───┴────────┐  ┌──────────┐  ┌────┴──────┐
│ Claude     │  │ OpenAI   │  │ Custom    │
│ Provider   │  │ Provider │  │ Providers │
└────────────┘  └──────────┘  └───────────┘
```

## Related Documentation

- [Provider Interface API](../../src/llm/provider-interface.ts)
- [Provider Registry API](../../src/llm/provider-registry.ts)
- [Configuration API](../../src/llm/llm-config.ts)

## Support

For issues or questions:

1. Check [Troubleshooting](#troubleshooting) section
2. Review provider documentation (Anthropic, OpenAI)
3. Open an issue on GitHub
