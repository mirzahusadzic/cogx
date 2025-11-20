# Task: Decouple Cognition Σ from Claude - Implement LLM Provider Abstraction Layer

## Context

Cognition Σ is currently tightly coupled to Claude API (Anthropic). We need to decouple the LLM provider to enable:

- Multi-provider support (Claude, OpenAI GPT-4, local models)
- Provider flexibility when needed
- Competitive pricing options
- Fallback/redundancy mechanisms
- Future-proofing against vendor lock-in

**Reference**: See `docs/architecture/audits/prompts/ECOSYS.md` lines 124-143, 478-500, 710 for the plugin architecture vision.

## Current Architecture (Tight Coupling)

Current state: Claude API calls are embedded throughout the codebase without abstraction.

**Problems**:

1. Direct Claude API imports scattered across files
2. No provider abstraction layer
3. Cannot swap providers without code changes
4. Hard to test (mocking requires changing imports)
5. Vendor lock-in

## Target Architecture (Decoupled)

**Goal**: Plugin-based LLM provider system with clean abstraction.

```
┌─────────────────────────────────┐
│   Cognition Σ CLI (Core)        │
│   - Overlays (O1-O7)            │
│   - PGC architecture            │
│   - Session management          │
│   - Context compression         │
└─────────────┬───────────────────┘
              │
    ┌─────────┴─────────┐
    │  LLM Provider API  │  ← Abstraction Layer
    └─────────┬──────────┘
              │
    ┌─────────┴──────────────────────┐
    │                                │
┌───┴────────┐  ┌──────────┐  ┌────┴──────┐
│ Claude     │  │ OpenAI   │  │ Local     │
│ Provider   │  │ Provider │  │ Provider  │
└────────────┘  └──────────┘  └───────────┘
```

## Implementation Steps

### Phase 1: Design Provider Interface (30 min)

Create `src/llm/provider-interface.ts`:

```typescript
export interface LLMProvider {
  name: string;
  models: string[];

  // Core completion method
  complete(request: CompletionRequest): Promise<CompletionResponse>;

  // Streaming support
  stream?(request: CompletionRequest): AsyncIterator<StreamChunk>;

  // Cost estimation
  estimateCost?(tokens: number, model: string): number;

  // Health check
  isAvailable(): Promise<boolean>;
}

export interface CompletionRequest {
  prompt: string;
  model: string;
  maxTokens?: number;
  temperature?: number;
  stopSequences?: string[];
  systemPrompt?: string;
}

export interface CompletionResponse {
  text: string;
  model: string;
  tokens: {
    prompt: number;
    completion: number;
    total: number;
  };
  finishReason: 'stop' | 'length' | 'error';
}

export interface StreamChunk {
  text: string;
  isComplete: boolean;
}
```

### Phase 2: Create Provider Registry (30 min)

Create `src/llm/provider-registry.ts`:

```typescript
import { LLMProvider } from './provider-interface.js';

export class ProviderRegistry {
  private providers = new Map<string, LLMProvider>();
  private defaultProvider: string = 'claude';

  register(provider: LLMProvider): void {
    this.providers.set(provider.name, provider);
  }

  get(name: string): LLMProvider {
    const provider = this.providers.get(name);
    if (!provider) {
      throw new Error(`Provider '${name}' not registered`);
    }
    return provider;
  }

  getDefault(): LLMProvider {
    return this.get(this.defaultProvider);
  }

  setDefault(name: string): void {
    if (!this.providers.has(name)) {
      throw new Error(`Cannot set default to unregistered provider '${name}'`);
    }
    this.defaultProvider = name;
  }

  list(): string[] {
    return Array.from(this.providers.keys());
  }

  async healthCheck(name: string): Promise<boolean> {
    const provider = this.get(name);
    return provider.isAvailable();
  }
}

// Global registry instance
export const registry = new ProviderRegistry();
```

### Phase 3: Implement Claude Provider (45 min)

Create `src/llm/providers/claude-provider.ts`:

```typescript
import Anthropic from '@anthropic-ai/sdk';
import {
  LLMProvider,
  CompletionRequest,
  CompletionResponse,
} from '../provider-interface.js';

export class ClaudeProvider implements LLMProvider {
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

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    try {
      const response = await this.client.messages.create({
        model: request.model,
        max_tokens: request.maxTokens || 4096,
        temperature: request.temperature,
        system: request.systemPrompt,
        messages: [{ role: 'user', content: request.prompt }],
        stop_sequences: request.stopSequences,
      });

      const textContent = response.content.find((c) => c.type === 'text');
      const text = textContent?.type === 'text' ? textContent.text : '';

      return {
        text,
        model: response.model,
        tokens: {
          prompt: response.usage.input_tokens,
          completion: response.usage.output_tokens,
          total: response.usage.input_tokens + response.usage.output_tokens,
        },
        finishReason:
          response.stop_reason === 'end_turn'
            ? 'stop'
            : response.stop_reason === 'max_tokens'
              ? 'length'
              : 'stop',
      };
    } catch (error) {
      throw new Error(`Claude API error: ${error.message}`);
    }
  }

  async *stream(request: CompletionRequest): AsyncIterator<StreamChunk> {
    const stream = await this.client.messages.create({
      model: request.model,
      max_tokens: request.maxTokens || 4096,
      temperature: request.temperature,
      system: request.systemPrompt,
      messages: [{ role: 'user', content: request.prompt }],
      stream: true,
    });

    for await (const event of stream) {
      if (
        event.type === 'content_block_delta' &&
        event.delta.type === 'text_delta'
      ) {
        yield {
          text: event.delta.text,
          isComplete: false,
        };
      } else if (event.type === 'message_stop') {
        yield {
          text: '',
          isComplete: true,
        };
      }
    }
  }

  estimateCost(tokens: number, model: string): number {
    // Approximate pricing (dollars per 1M tokens)
    const pricing: Record<string, { input: number; output: number }> = {
      'claude-sonnet-4-5-20250929': { input: 3, output: 15 },
      'claude-3-5-sonnet-20241022': { input: 3, output: 15 },
      'claude-3-opus-20240229': { input: 15, output: 75 },
      'claude-3-haiku-20240307': { input: 0.25, output: 1.25 },
    };

    const rates = pricing[model] || pricing['claude-3-5-sonnet-20241022'];
    // Rough estimate: 50/50 input/output split
    return (tokens / 1_000_000) * ((rates.input + rates.output) / 2);
  }

  async isAvailable(): Promise<boolean> {
    try {
      // Quick test with minimal tokens
      await this.client.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'test' }],
      });
      return true;
    } catch {
      return false;
    }
  }
}
```

### Phase 4: Implement OpenAI Provider (45 min)

Create `src/llm/providers/openai-provider.ts`:

```typescript
import OpenAI from 'openai';
import {
  LLMProvider,
  CompletionRequest,
  CompletionResponse,
} from '../provider-interface.js';

export class OpenAIProvider implements LLMProvider {
  name = 'openai';
  models = ['gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo', 'gpt-4o'];

  private client: OpenAI;

  constructor(apiKey?: string) {
    this.client = new OpenAI({
      apiKey: apiKey || process.env.OPENAI_API_KEY,
    });
  }

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    try {
      const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];

      if (request.systemPrompt) {
        messages.push({ role: 'system', content: request.systemPrompt });
      }
      messages.push({ role: 'user', content: request.prompt });

      const response = await this.client.chat.completions.create({
        model: request.model,
        messages,
        max_tokens: request.maxTokens,
        temperature: request.temperature,
        stop: request.stopSequences,
      });

      const choice = response.choices[0];

      return {
        text: choice.message.content || '',
        model: response.model,
        tokens: {
          prompt: response.usage?.prompt_tokens || 0,
          completion: response.usage?.completion_tokens || 0,
          total: response.usage?.total_tokens || 0,
        },
        finishReason:
          choice.finish_reason === 'stop'
            ? 'stop'
            : choice.finish_reason === 'length'
              ? 'length'
              : 'stop',
      };
    } catch (error) {
      throw new Error(`OpenAI API error: ${error.message}`);
    }
  }

  async *stream(request: CompletionRequest): AsyncIterator<StreamChunk> {
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];

    if (request.systemPrompt) {
      messages.push({ role: 'system', content: request.systemPrompt });
    }
    messages.push({ role: 'user', content: request.prompt });

    const stream = await this.client.chat.completions.create({
      model: request.model,
      messages,
      max_tokens: request.maxTokens,
      temperature: request.temperature,
      stream: true,
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) {
        yield {
          text: delta,
          isComplete: false,
        };
      }
    }

    yield { text: '', isComplete: true };
  }

  estimateCost(tokens: number, model: string): number {
    // Approximate pricing (dollars per 1M tokens)
    const pricing: Record<string, { input: number; output: number }> = {
      'gpt-4-turbo': { input: 10, output: 30 },
      'gpt-4': { input: 30, output: 60 },
      'gpt-3.5-turbo': { input: 0.5, output: 1.5 },
      'gpt-4o': { input: 2.5, output: 10 },
    };

    const rates = pricing[model] || pricing['gpt-4-turbo'];
    return (tokens / 1_000_000) * ((rates.input + rates.output) / 2);
  }

  async isAvailable(): Promise<boolean> {
    try {
      await this.client.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 1,
      });
      return true;
    } catch {
      return false;
    }
  }
}
```

### Phase 5: Create Provider Initialization (20 min)

Create `src/llm/index.ts`:

```typescript
import { registry } from './provider-registry.js';
import { ClaudeProvider } from './providers/claude-provider.js';
import { OpenAIProvider } from './providers/openai-provider.js';

export { registry };
export {
  LLMProvider,
  CompletionRequest,
  CompletionResponse,
} from './provider-interface.js';
export { ClaudeProvider } from './providers/claude-provider.js';
export { OpenAIProvider } from './providers/openai-provider.js';

// Initialize default providers
export function initializeProviders(): void {
  // Register Claude (default)
  const claude = new ClaudeProvider();
  registry.register(claude);

  // Register OpenAI if API key is available
  if (process.env.OPENAI_API_KEY) {
    const openai = new OpenAIProvider();
    registry.register(openai);
  }
}

// Convenience helper for getting completions
export async function complete(
  prompt: string,
  options: {
    model?: string;
    provider?: string;
    systemPrompt?: string;
    maxTokens?: number;
    temperature?: number;
  } = {}
): Promise<string> {
  const providerName = options.provider || 'claude';
  const provider = registry.get(providerName);

  // Auto-select model if not specified
  const model = options.model || provider.models[0];

  const response = await provider.complete({
    prompt,
    model,
    systemPrompt: options.systemPrompt,
    maxTokens: options.maxTokens,
    temperature: options.temperature,
  });

  return response.text;
}
```

### Phase 6: Update Existing Code to Use Abstraction (60 min)

**Find all Claude API calls**:

```bash
# Search for direct Claude imports
grep -r "from '@anthropic-ai/sdk'" src/
grep -r "import.*Anthropic" src/
```

**Replace pattern**:

**Before** (tight coupling):

```typescript
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const response = await client.messages.create({
  model: 'claude-sonnet-4-5-20250929',
  max_tokens: 4096,
  messages: [{ role: 'user', content: prompt }],
});
```

**After** (decoupled):

```typescript
import { complete, registry } from './llm/index.js';

// Simple usage
const text = await complete(prompt, {
  model: 'claude-sonnet-4-5-20250929',
  maxTokens: 4096,
});

// Or with explicit provider
const provider = registry.get('claude');
const response = await provider.complete({
  prompt,
  model: 'claude-sonnet-4-5-20250929',
  maxTokens: 4096,
});
```

**Key files to update** (search results will reveal these):

- `src/services/*.ts` - Any service using Claude
- `src/commands/*.ts` - Commands that call LLM
- `src/tui/*.ts` - TUI interactions with LLM
- Any other files importing `@anthropic-ai/sdk`

### Phase 7: Add Configuration Support (30 min)

Update config system to support provider selection.

Create/update `src/config/llm-config.ts`:

```typescript
export interface LLMConfig {
  defaultProvider: 'claude' | 'openai' | string;
  providers: {
    claude?: {
      apiKey?: string;
      defaultModel?: string;
    };
    openai?: {
      apiKey?: string;
      defaultModel?: string;
    };
  };
}

export function loadLLMConfig(): LLMConfig {
  // Load from .cognitionrc or environment
  return {
    defaultProvider: process.env.COGNITION_LLM_PROVIDER || 'claude',
    providers: {
      claude: {
        apiKey: process.env.ANTHROPIC_API_KEY,
        defaultModel:
          process.env.COGNITION_CLAUDE_MODEL || 'claude-sonnet-4-5-20250929',
      },
      openai: {
        apiKey: process.env.OPENAI_API_KEY,
        defaultModel: process.env.COGNITION_OPENAI_MODEL || 'gpt-4-turbo',
      },
    },
  };
}
```

### Phase 8: Add CLI Commands for Provider Management (30 min)

Create `src/commands/provider.ts`:

```typescript
import { Command } from 'commander';
import { registry } from '../llm/index.js';
import chalk from 'chalk';

export function createProviderCommand(): Command {
  const cmd = new Command('provider');
  cmd.description('Manage LLM providers');

  // List providers
  cmd
    .command('list')
    .description('List available providers')
    .action(async () => {
      const providers = registry.list();
      console.log(chalk.bold('\nAvailable Providers:\n'));

      for (const name of providers) {
        const provider = registry.get(name);
        const isDefault = name === registry.getDefault().name;
        const status = (await registry.healthCheck(name))
          ? chalk.green('✓ Available')
          : chalk.red('✗ Unavailable');

        console.log(
          `  ${isDefault ? chalk.bold('*') : ' '} ${chalk.cyan(name)}`
        );
        console.log(`    Status: ${status}`);
        console.log(`    Models: ${provider.models.join(', ')}`);
        console.log();
      }
    });

  // Set default provider
  cmd
    .command('set-default <provider>')
    .description('Set default LLM provider')
    .action((provider: string) => {
      try {
        registry.setDefault(provider);
        console.log(chalk.green(`✓ Default provider set to: ${provider}`));
      } catch (error) {
        console.error(chalk.red(`✗ Error: ${error.message}`));
        process.exit(1);
      }
    });

  // Test provider
  cmd
    .command('test <provider>')
    .description('Test provider availability')
    .action(async (providerName: string) => {
      try {
        const isAvailable = await registry.healthCheck(providerName);
        if (isAvailable) {
          console.log(chalk.green(`✓ ${providerName} is available`));
        } else {
          console.log(chalk.red(`✗ ${providerName} is unavailable`));
          process.exit(1);
        }
      } catch (error) {
        console.error(chalk.red(`✗ Error: ${error.message}`));
        process.exit(1);
      }
    });

  return cmd;
}
```

Register in `src/cli.ts`:

```typescript
import { createProviderCommand } from './commands/provider.js';

program.addCommand(createProviderCommand());
```

### Phase 9: Update Tests (45 min)

Create `src/llm/__tests__/provider-registry.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { ProviderRegistry } from '../provider-registry.js';
import { LLMProvider } from '../provider-interface.js';

class MockProvider implements LLMProvider {
  constructor(
    public name: string,
    public models: string[] = ['mock-model']
  ) {}

  async complete() {
    return {
      text: 'mock response',
      model: this.models[0],
      tokens: { prompt: 10, completion: 10, total: 20 },
      finishReason: 'stop' as const,
    };
  }

  async isAvailable() {
    return true;
  }
}

describe('ProviderRegistry', () => {
  let registry: ProviderRegistry;

  beforeEach(() => {
    registry = new ProviderRegistry();
  });

  it('should register and retrieve providers', () => {
    const provider = new MockProvider('test');
    registry.register(provider);

    expect(registry.get('test')).toBe(provider);
  });

  it('should throw when getting unregistered provider', () => {
    expect(() => registry.get('nonexistent')).toThrow();
  });

  it('should set and get default provider', () => {
    const provider = new MockProvider('test');
    registry.register(provider);
    registry.setDefault('test');

    expect(registry.getDefault()).toBe(provider);
  });

  it('should list all providers', () => {
    registry.register(new MockProvider('p1'));
    registry.register(new MockProvider('p2'));

    expect(registry.list()).toEqual(['p1', 'p2']);
  });
});
```

### Phase 10: Documentation (30 min)

Create `docs/guides/LLM_PROVIDERS.md`:

````markdown
# LLM Provider Configuration

Cognition Σ supports multiple LLM providers through a plugin architecture.

## Supported Providers

- **Claude** (Anthropic) - Default
- **OpenAI** (GPT-4, GPT-3.5)
- **Custom** - Implement your own

## Configuration

### Environment Variables

\`\`\`bash

# Claude (default)

export ANTHROPIC_API_KEY=sk-ant-...
export COGNITION_CLAUDE_MODEL=claude-sonnet-4-5-20250929

# OpenAI

export OPENAI_API_KEY=sk-...
export COGNITION_OPENAI_MODEL=gpt-4-turbo

# Set default provider

export COGNITION_LLM_PROVIDER=claude # or 'openai'
\`\`\`

## CLI Usage

\`\`\`bash

# List available providers

cognition-cli provider list

# Set default provider

cognition-cli provider set-default openai

# Test provider availability

cognition-cli provider test claude
\`\`\`

## Programmatic Usage

\`\`\`typescript
import { complete, registry } from './llm/index.js';

// Simple completion (uses default provider)
const text = await complete('What is TypeScript?');

// Specify provider
const text = await complete('What is TypeScript?', {
provider: 'openai',
model: 'gpt-4-turbo'
});

// Direct provider access
const provider = registry.get('claude');
const response = await provider.complete({
prompt: 'Explain quantum computing',
model: 'claude-sonnet-4-5-20250929',
maxTokens: 1000
});
\`\`\`

## Custom Providers

Implement the `LLMProvider` interface:

\`\`\`typescript
import { LLMProvider, CompletionRequest, CompletionResponse } from './llm/provider-interface.js';

class MyCustomProvider implements LLMProvider {
name = 'my-provider';
models = ['my-model-v1'];

async complete(request: CompletionRequest): Promise<CompletionResponse> {
// Your implementation
}

async isAvailable(): Promise<boolean> {
// Health check
}
}

// Register
import { registry } from './llm/index.js';
registry.register(new MyCustomProvider());
\`\`\`
\`\`\`

## Deliverables

1. ✅ Provider interface definition (`src/llm/provider-interface.ts`)
2. ✅ Provider registry (`src/llm/provider-registry.ts`)
3. ✅ Claude provider implementation (`src/llm/providers/claude-provider.ts`)
4. ✅ OpenAI provider implementation (`src/llm/providers/openai-provider.ts`)
5. ✅ All existing Claude API calls refactored to use abstraction
6. ✅ Configuration support for provider selection
7. ✅ CLI commands for provider management (`cognition-cli provider list/set-default/test`)
8. ✅ Tests for provider registry and implementations
9. ✅ Documentation (`docs/guides/LLM_PROVIDERS.md`)

## Validation

After implementation, verify:

```bash
# All tests pass
npm test

# Provider commands work
cognition-cli provider list
cognition-cli provider test claude

# Existing functionality unchanged
npm run build
cognition-cli query "test query"  # Should work as before

# Can switch providers
export COGNITION_LLM_PROVIDER=openai
cognition-cli query "test with OpenAI"
```
````

## Success Criteria

- ✅ Zero breaking changes to existing functionality
- ✅ Can switch between Claude and OpenAI without code changes
- ✅ All existing tests pass
- ✅ New provider tests added
- ✅ Documentation complete
- ✅ Configuration system in place
- ✅ CLI commands for provider management working

## Time Estimate

**Total: ~5 hours**

- Phase 1-2: Interface + Registry (1 hour)
- Phase 3-4: Provider implementations (1.5 hours)
- Phase 5-6: Refactor existing code (1.5 hours)
- Phase 7-8: Config + CLI (1 hour)
- Phase 9-10: Tests + Docs (1 hour)

---

**Priority**: HIGH
**Impact**: Strategic - enables multi-provider support and reduces vendor lock-in
**Risk**: LOW - abstraction layer is well-defined pattern
