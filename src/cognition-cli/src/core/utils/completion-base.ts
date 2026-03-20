/**
 * Metadata for a CLI command used for shell completion.
 */
export interface CommandMetadata {
  name: string;
  description: string;
  aliases?: string[];
  subcommands?: CommandMetadata[];
  flags?: FlagMetadata[];
  values?: string[]; // Enum values for the command or subcommand
}

/**
 * Metadata for a CLI flag used for shell completion.
 */
export interface FlagMetadata {
  name: string;
  short?: string;
  description: string;
  values?: string[]; // Enum values for the flag
  type?: 'file' | 'directory' | 'string' | 'number' | 'boolean';
}

/**
 * Base class for shell completion generators.
 */
export abstract class BaseCompletionGenerator {
  protected commands: CommandMetadata[];
  protected globalFlags: FlagMetadata[];

  constructor(commands: CommandMetadata[], globalFlags: FlagMetadata[]) {
    this.commands = commands;
    this.globalFlags = globalFlags;
  }

  /**
   * Generate the completion script.
   */
  abstract generate(): string;
}
