/**
 * Config Command: View and Manage CLI Settings
 *
 * Provides a user-friendly interface to view and modify settings stored in
 * ~/.cognition-cli/settings.json without manual file editing.
 *
 * SETTINGS STRUCTURE:
 * - version: Settings schema version
 * - defaultProvider: LLM provider ('claude' | 'gemini')
 * - dual_use_acknowledgment: Security acknowledgment record
 *
 * @example
 * // List all settings
 * cognition-cli config
 * cognition-cli config list
 *
 * @example
 * // Get a specific setting
 * cognition-cli config get defaultProvider
 *
 * @example
 * // Set a setting
 * cognition-cli config set defaultProvider gemini
 *
 * @example
 * // Show config file path
 * cognition-cli config path
 */

import { Command } from 'commander';
import chalk from 'chalk';
import {
  loadSettings,
  saveSettings,
  getSettingsPath,
  Settings,
} from '../core/security/security-bootstrap.js';

/** Valid top-level settings keys that users can modify */
const EDITABLE_KEYS = ['defaultProvider'] as const;
type EditableKey = (typeof EDITABLE_KEYS)[number];

/** Valid values for each editable key */
const VALID_VALUES: Record<EditableKey, string[]> = {
  defaultProvider: ['claude', 'gemini'],
};

/**
 * Format a settings value for display
 */
function formatValue(value: unknown): string {
  if (value === undefined || value === null) {
    return chalk.dim('(not set)');
  }
  if (typeof value === 'object') {
    return JSON.stringify(value, null, 2);
  }
  return String(value);
}

/**
 * Display all settings in a readable format
 */
function displaySettings(settings: Settings, json: boolean): void {
  if (json || process.env.COGNITION_FORMAT === 'json') {
    console.log(JSON.stringify(settings, null, 2));
    return;
  }

  console.log('');
  console.log(chalk.bold('Cognition CLI Settings'));
  console.log(chalk.dim(`File: ${getSettingsPath()}`));
  console.log('');

  // Core settings
  console.log(chalk.cyan('Core:'));
  console.log(`  version         ${formatValue(settings.version)}`);
  console.log(`  defaultProvider ${formatValue(settings.defaultProvider)}`);
  console.log('');

  // Acknowledgment status
  const ack = settings.dual_use_acknowledgment;
  console.log(chalk.cyan('Security Acknowledgment:'));
  if (ack) {
    const ackDate = new Date(ack.timestamp);
    const daysAgo = Math.floor(
      (Date.now() - ackDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    const expiresIn = 365 - daysAgo;

    console.log(`  acknowledged    ${chalk.green('yes')}`);
    console.log(`  date            ${ackDate.toLocaleDateString()}`);
    console.log(`  user            ${ack.user}@${ack.hostname}`);
    console.log(
      `  expires in      ${expiresIn > 0 ? `${expiresIn} days` : chalk.red('expired')}`
    );
  } else {
    console.log(`  acknowledged    ${chalk.yellow('no')}`);
  }
  console.log('');
}

/**
 * Get a specific setting value
 */
function getSetting(key: string, settings: Settings, json: boolean): void {
  const value = (settings as unknown as Record<string, unknown>)[key];

  if (json) {
    console.log(JSON.stringify({ [key]: value }));
    return;
  }

  if (value === undefined) {
    console.log(chalk.yellow(`Setting '${key}' is not set`));
    console.log('');
    console.log('Available settings:');
    console.log(`  ${EDITABLE_KEYS.join(', ')}`);
    process.exit(1);
  }

  console.log(formatValue(value));
}

/**
 * Set a setting value
 */
function setSetting(key: string, value: string, settings: Settings): void {
  // Validate key is editable
  if (!EDITABLE_KEYS.includes(key as EditableKey)) {
    console.error(chalk.red(`Error: '${key}' is not an editable setting`));
    console.log('');
    console.log('Editable settings:');
    for (const k of EDITABLE_KEYS) {
      console.log(
        `  ${k}  ${chalk.dim(`(valid: ${VALID_VALUES[k].join(', ')})`)}`
      );
    }
    process.exit(1);
  }

  // Validate value
  const validValues = VALID_VALUES[key as EditableKey];
  if (validValues && !validValues.includes(value)) {
    console.error(
      chalk.red(`Error: '${value}' is not a valid value for '${key}'`)
    );
    console.log('');
    console.log(`Valid values: ${validValues.join(', ')}`);
    process.exit(1);
  }

  // Set and save
  (settings as unknown as Record<string, unknown>)[key] = value;
  saveSettings(settings);

  console.log(chalk.green(`Set ${key} = ${value}`));
  console.log(chalk.dim(`Saved to: ${getSettingsPath()}`));
}

/**
 * Creates the config command with subcommands
 */
export function createConfigCommand(): Command {
  const cmd = new Command('config');

  cmd.description(
    'View and manage CLI settings (~/.cognition-cli/settings.json)'
  );

  // Default action: list settings
  cmd.option('--json', 'Output results as JSON').action((options, command) => {
    const settings = loadSettings();
    const allOpts = command.optsWithGlobals();
    displaySettings(
      settings,
      allOpts.json || options.json || process.env.COGNITION_FORMAT === 'json'
    );
  });

  // config list
  cmd
    .command('list')
    .description('List all settings')
    .option('--json', 'Output results as JSON')
    .action((options, command) => {
      const settings = loadSettings();
      const allOpts = command.optsWithGlobals();
      displaySettings(
        settings,
        allOpts.json || options.json || process.env.COGNITION_FORMAT === 'json'
      );
    });

  // config get <key>
  cmd
    .command('get <key>')
    .description('Get a specific setting value')
    .option('--json', 'Output results as JSON')
    .action((key, options, command) => {
      const settings = loadSettings();
      const allOpts = command.optsWithGlobals();
      getSetting(
        key,
        settings,
        allOpts.json || options.json || process.env.COGNITION_FORMAT === 'json'
      );
    });

  // config set <key> <value>
  cmd
    .command('set <key> <value>')
    .description('Set a setting value')
    .action((key, value) => {
      const settings = loadSettings();
      setSetting(key, value, settings);
    });

  // config path
  cmd
    .command('path')
    .description('Show settings file path')
    .action(() => {
      console.log(getSettingsPath());
    });

  // config reset
  cmd
    .command('reset')
    .description('Reset settings to defaults (keeps acknowledgment)')
    .action(() => {
      const settings = loadSettings();
      const newSettings: Settings = {
        version: '1.0',
        dual_use_acknowledgment: settings.dual_use_acknowledgment,
      };
      saveSettings(newSettings);
      console.log(chalk.green('Settings reset to defaults'));
      console.log(chalk.dim('Note: Security acknowledgment preserved'));
    });

  return cmd;
}
