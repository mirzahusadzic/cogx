/**
 * Provider Command
 *
 * CLI commands for managing LLM providers in Cognition Σ.
 * Provides tools for listing, testing, and configuring providers.
 *
 * COMMANDS:
 * - provider list: Show available providers and their status
 * - provider test <name>: Test provider availability
 * - provider set-default <name>: Set default provider
 * - provider config: Show current configuration
 *
 * @example
 * # List all providers
 * cognition-cli provider list
 *
 * # Test Claude availability
 * cognition-cli provider test claude
 *
 * # Set OpenAI as default
 * cognition-cli provider set-default openai
 *
 * # Show current configuration
 * cognition-cli provider config
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { registry, initializeProviders } from '../llm/index.js';
import {
  loadLLMConfig,
  validateLLMConfig,
  getConfiguredProviders,
  CLAUDE_MODELS,
  OPENAI_MODELS,
  GEMINI_MODELS,
} from '../llm/llm-config.js';

/**
 * Create provider command
 *
 * Builds the provider management command with all subcommands.
 *
 * @returns Commander command instance
 */
export function createProviderCommand(): Command {
  const cmd = new Command('provider');
  cmd.description('Manage LLM providers');

  // List providers subcommand
  cmd
    .command('list')
    .description('List available LLM providers and their status')
    .action(async () => {
      try {
        // Initialize providers first
        initializeProviders({ skipMissingProviders: true });

        const providers = registry.list();

        if (providers.length === 0) {
          console.log(chalk.yellow('\n⚠️  No providers are configured\n'));
          console.log('Configure providers by setting environment variables:');
          console.log(chalk.dim('  ANTHROPIC_API_KEY=... for Claude'));
          console.log(chalk.dim('  OPENAI_API_KEY=... for OpenAI'));
          console.log();
          return;
        }

        console.log(chalk.bold('\n📋 Available LLM Providers\n'));

        for (const name of providers) {
          const provider = registry.get(name);
          const isDefault = name === registry.getDefaultName();

          // Test availability
          let statusText: string;
          let statusColor: (text: string) => string;

          try {
            const available = await registry.healthCheck(name);
            if (available) {
              statusText = '✓ Available';
              statusColor = chalk.green;
            } else {
              statusText = '✗ Unavailable';
              statusColor = chalk.red;
            }
          } catch {
            statusText = '✗ Error';
            statusColor = chalk.red;
          }

          // Display provider info
          const defaultMarker = isDefault ? chalk.bold('*') : ' ';
          console.log(
            `${defaultMarker} ${chalk.cyan(name)}${isDefault ? chalk.dim(' (default)') : ''}`
          );
          console.log(`  Status: ${statusColor(statusText)}`);
          console.log(
            `  Models: ${chalk.dim(provider.models.slice(0, 3).join(', '))}${provider.models.length > 3 ? chalk.dim(` +${provider.models.length - 3} more`) : ''}`
          );
          console.log();
        }
      } catch (error) {
        console.error(
          chalk.red('✗ Error listing providers:'),
          error instanceof Error ? error.message : String(error)
        );
        process.exit(1);
      }
    });

  // Set default provider subcommand
  cmd
    .command('set-default <provider>')
    .description('Set the default LLM provider')
    .action(async (providerName: string) => {
      try {
        // Initialize providers first
        initializeProviders({ skipMissingProviders: true });

        // Set default
        registry.setDefault(providerName);

        console.log(
          chalk.green(`✓ Default provider set to: ${chalk.bold(providerName)}`)
        );

        // Show hint about persistence
        console.log(
          chalk.dim(
            '\nTo make this permanent, set COGNITION_LLM_PROVIDER environment variable:'
          )
        );
        console.log(
          chalk.dim(`  export COGNITION_LLM_PROVIDER=${providerName}`)
        );
        console.log();
      } catch (error) {
        console.error(
          chalk.red('✗ Error setting default provider:'),
          error instanceof Error ? error.message : String(error)
        );
        process.exit(1);
      }
    });

  // Test provider subcommand
  cmd
    .command('test <provider>')
    .description('Test provider availability')
    .action(async (providerName: string) => {
      try {
        // Initialize providers first
        initializeProviders({ skipMissingProviders: true });

        console.log(chalk.dim(`Testing ${providerName}...`));

        const isAvailable = await registry.healthCheck(providerName);

        if (isAvailable) {
          console.log(
            chalk.green(`✓ ${providerName} is available and working`)
          );
        } else {
          console.log(
            chalk.red(`✗ ${providerName} is unavailable or not responding`)
          );
          process.exit(1);
        }
      } catch (error) {
        console.error(
          chalk.red(`✗ Error testing ${providerName}:`),
          error instanceof Error ? error.message : String(error)
        );
        process.exit(1);
      }
    });

  // Config subcommand
  cmd
    .command('config')
    .description('Show current LLM provider configuration')
    .action(() => {
      try {
        const config = loadLLMConfig();
        const errors = validateLLMConfig(config);

        console.log(chalk.bold('\n⚙️  LLM Provider Configuration\n'));

        // Show default provider
        console.log(
          chalk.cyan('Default Provider:'),
          chalk.bold(config.defaultProvider)
        );
        console.log();

        // Show Claude configuration
        console.log(chalk.cyan('Claude (Anthropic):'));
        if (config.providers.claude?.apiKey) {
          const key = config.providers.claude.apiKey;
          const maskedKey = `${key.slice(0, 8)}...${key.slice(-4)}`;
          console.log(`  API Key: ${chalk.dim(maskedKey)}`);
          console.log(
            `  Default Model: ${config.providers.claude.defaultModel || chalk.dim('not set')}`
          );
          console.log(
            chalk.dim(
              `  Available Models: ${Object.values(CLAUDE_MODELS).join(', ')}`
            )
          );
        } else {
          console.log(chalk.yellow('  Not configured (set ANTHROPIC_API_KEY)'));
        }
        console.log();

        // Show OpenAI configuration
        console.log(chalk.cyan('OpenAI:'));
        if (config.providers.openai?.apiKey) {
          const key = config.providers.openai.apiKey;
          const maskedKey = `${key.slice(0, 7)}...${key.slice(-4)}`;
          console.log(`  API Key: ${chalk.dim(maskedKey)}`);
          console.log(
            `  Default Model: ${config.providers.openai.defaultModel || chalk.dim('not set')}`
          );
          console.log(
            chalk.dim(
              `  Available Models: ${Object.values(OPENAI_MODELS).join(', ')}`
            )
          );
        } else {
          console.log(chalk.yellow('  Not configured (set OPENAI_API_KEY)'));
        }
        console.log();

        // Show Gemini configuration
        console.log(chalk.cyan('Gemini (Google):'));
        if (config.providers.gemini?.apiKey) {
          const key = config.providers.gemini.apiKey;
          const maskedKey = `${key.slice(0, 8)}...${key.slice(-4)}`;
          console.log(`  API Key: ${chalk.dim(maskedKey)}`);
          console.log(
            `  Default Model: ${config.providers.gemini.defaultModel || chalk.dim('not set')}`
          );
          console.log(
            chalk.dim(
              `  Available Models: ${Object.values(GEMINI_MODELS).join(', ')}`
            )
          );
        } else {
          console.log(chalk.yellow('  Not configured (set GOOGLE_API_KEY)'));
        }
        console.log();

        // Show validation errors
        if (errors.length > 0) {
          console.log(chalk.red('⚠️  Configuration Issues:\n'));
          errors.forEach((error) => {
            console.log(chalk.red(`  • ${error}`));
          });
          console.log();
        }

        // Show configured providers
        const configured = getConfiguredProviders();
        console.log(
          chalk.cyan('Configured Providers:'),
          configured.length > 0
            ? chalk.bold(configured.join(', '))
            : chalk.yellow('none')
        );
        console.log();
      } catch (error) {
        console.error(
          chalk.red('✗ Error loading configuration:'),
          error instanceof Error ? error.message : String(error)
        );
        process.exit(1);
      }
    });

  // Models subcommand
  cmd
    .command('models [provider]')
    .description('List available models for a provider')
    .action(async (providerName?: string) => {
      try {
        // Initialize providers first
        initializeProviders({ skipMissingProviders: true });

        if (providerName) {
          // Show models for specific provider
          const provider = registry.get(providerName);
          console.log(chalk.bold(`\n📝 ${chalk.cyan(providerName)} Models\n`));
          provider.models.forEach((model) => {
            console.log(`  • ${model}`);
          });
          console.log();
        } else {
          // Show models for all providers
          const providers = registry.list();
          console.log(chalk.bold('\n📝 Available Models\n'));

          for (const name of providers) {
            const provider = registry.get(name);
            console.log(chalk.cyan(`${name}:`));
            provider.models.forEach((model) => {
              console.log(`  • ${model}`);
            });
            console.log();
          }
        }
      } catch (error) {
        console.error(
          chalk.red('✗ Error listing models:'),
          error instanceof Error ? error.message : String(error)
        );
        process.exit(1);
      }
    });

  return cmd;
}
