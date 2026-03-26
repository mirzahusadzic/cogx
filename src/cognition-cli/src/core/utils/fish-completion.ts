import { BaseCompletionGenerator, FlagMetadata } from './completion-base.js';

/**
 * Generator for Fish completion scripts.
 */
export class FishCompletionGenerator extends BaseCompletionGenerator {
  generate(): string {
    let script = `# Cognition CLI fish completion\n\n# Main commands\n`;

    for (const cmd of this.commands) {
      script += `complete -c cognition-cli -f -n "__fish_use_subcommand" -a "${cmd.name}" -d "${cmd.description}"\n`;
      if (cmd.aliases) {
        for (const alias of cmd.aliases) {
          script += `complete -c cognition-cli -f -n "__fish_use_subcommand" -a "${alias}" -d "Alias for ${cmd.name}"\n`;
        }
      }
      if (cmd.subcommands) {
        for (const sub of cmd.subcommands) {
          script += `complete -c cognition-cli -f -n "__fish_use_subcommand" -a "${cmd.name}:${sub.name}" -d "${sub.description}"\n`;
        }
      }
    }

    script += `\n# Global flags\n`;
    for (const flag of this.globalFlags) {
      script += this.formatFlagForFish(flag);
    }

    script += `\n# Subcommands and flags\n`;
    for (const cmd of this.commands) {
      if (cmd.subcommands) {
        for (const sub of cmd.subcommands) {
          script += `complete -c cognition-cli -f -n "__fish_seen_subcommand_from ${cmd.name}" -a "${sub.name}" -d "${sub.description}"\n`;
          if (sub.values) {
            script += `complete -c cognition-cli -f -n "__fish_seen_subcommand_from ${sub.name}; and __fish_seen_subcommand_from ${cmd.name}" -a "${sub.values.join(' ')}"\n`;
          }
        }
      }

      if (cmd.flags) {
        for (const flag of cmd.flags) {
          script += this.formatFlagForFish(flag, cmd.name);
        }
      }
    }

    return script;
  }

  private formatFlagForFish(flag: FlagMetadata, subcommand?: string): string {
    const condition = subcommand
      ? `-n "__fish_seen_subcommand_from ${subcommand}" `
      : '';
    const short = flag.short ? `-s ${flag.short.replace(/^-+/, '')} ` : '';
    const long = `-l ${flag.name.replace(/^-+/, '')} `;
    const description = `-d "${flag.description.replace(/"/g, '\\"')}" `;
    const values = flag.values ? `-xa "${flag.values.join(' ')}"` : '';

    return `complete -c cognition-cli ${condition}${short}${long}${description}${values}\n`;
  }
}
