import { BaseCompletionGenerator, FlagMetadata } from './completion-base.js';

/**
 * Generator for Zsh completion scripts.
 */
export class ZshCompletionGenerator extends BaseCompletionGenerator {
  generate(): string {
    const commandsList = this.getCommandsDescription();
    const globalOpts = this.getGlobalOptionsDescription();

    return `#compdef cognition-cli
# Cognition CLI zsh completion

_cognition_cli() {
  local -a commands
  commands=(
${commandsList}
  )

  local -a global_opts
  global_opts=(
${globalOpts}
  )

  _arguments -C \\
    $global_opts \\
    '1: :->command' \\
    '*:: :->args'

  case \${state} in
    command)
      # Handle colon-separated commands
      if compset -P '*:'; then
        case "\${IPREFIX%:}" in
${this.generateSubcommandDescriptions()}
        esac
      else
        _describe 'command' commands
      fi
      ;;
    args)
      case \${words[1]} in
${this.generateCommandArgHandling()}
      esac
      ;;
  esac
}

_cognition_cli "$@"
`;
  }

  private getCommandsDescription(): string {
    const list: string[] = [];
    for (const cmd of this.commands) {
      list.push(
        `    '${cmd.name}:${cmd.description}${cmd.aliases ? ` (alias: ${cmd.aliases.join(', ')})` : ''}'`
      );
      if (cmd.aliases) {
        for (const alias of cmd.aliases) {
          list.push(`    '${alias}:Alias for ${cmd.name}'`);
        }
      }
      if (cmd.subcommands) {
        for (const sub of cmd.subcommands) {
          list.push(`    '${cmd.name}:${sub.name}:${sub.description}'`);
        }
      }
    }
    return list.join('\n');
  }

  private getGlobalOptionsDescription(): string {
    return this.globalFlags
      .map((f) => this.formatFlagForZsh(f))
      .map((s) => `    ${s}`)
      .join('\n');
  }

  private formatFlagForZsh(flag: FlagMetadata): string {
    let zshFlag = '';
    if (flag.short) {
      zshFlag = `{-${flag.short.replace(/^-+/, '')},${flag.name}}`;
    } else {
      zshFlag = `'${flag.name}'`;
    }

    const description = `[${flag.description}]`;
    let values = '';
    if (flag.values) {
      values = `:${flag.name.replace(/^-+/, '')}:(${flag.values.join(' ')})`;
    } else if (flag.type === 'file') {
      values = ':file:_files';
    } else if (flag.type === 'directory') {
      values = ':directory:_directories';
    } else if (flag.type === 'number' || flag.type === 'string') {
      values = `:${flag.name.replace(/^-+/, '')}:`;
    }

    return `${zshFlag}${description}${values}`;
  }

  private generateSubcommandDescriptions(): string {
    let script = '';
    const parents = this.commands.filter(
      (c) => c.subcommands && c.subcommands.length > 0
    );
    for (const p of parents) {
      const aliases = p.aliases ? `|${p.aliases.join('|')}` : '';
      script += `          ${p.name}${aliases})
            local -a ${p.name}_cmds
            ${p.name}_cmds=(${p.subcommands!.map((s) => `'${s.name}:${s.description}'`).join(' ')})
            _describe '${p.name} subcommand' ${p.name}_cmds
            ;;
`;
    }
    return script;
  }

  private generateCommandArgHandling(): string {
    let script = '';
    for (const cmd of this.commands) {
      const aliases = cmd.aliases ? `|${cmd.aliases.join('|')}` : '';
      if (cmd.flags || cmd.subcommands) {
        script += `        ${cmd.name}${aliases})
          _arguments -C \\
`;
        if (cmd.flags) {
          script +=
            cmd.flags
              .map((f) => `            ${this.formatFlagForZsh(f)} \\`)
              .join('\n') + '\n';
        }
        if (cmd.subcommands) {
          // If we have subcommands, we might need a state transition for them if they have values/flags
          // but for now let's keep it simple and just suggest subcommands if they are the next word
          const subNames = cmd.subcommands.map((s) => s.name).join(' ');
          script += `            '1:subcommand:(${subNames})' \\
`;
        }
        script += "            '*:: :->subargs'\n";

        // Handle subcommands that have values or flags
        if (
          cmd.subcommands &&
          cmd.subcommands.some((s) => s.values || s.flags)
        ) {
          script += `          case \${state} in
            subargs)
              case \${words[1]} in
`;
          for (const sub of cmd.subcommands) {
            if (sub.values || sub.flags) {
              script += `                ${sub.name})
                  _arguments -C \\
`;
              if (sub.flags) {
                script +=
                  sub.flags
                    .map(
                      (f) =>
                        `                    ${this.formatFlagForZsh(f)} \\`
                    )
                    .join('\n') + '\n';
              }
              if (sub.values) {
                script += `                    '1: :(${sub.values.join(' ')})' \\
`;
              }
              script += "                    '*:: :->final'\n";
              script += '                  ;;\n';
            }
          }
          script += '              esac\n';
          script += '              ;;\n';
          script += '          esac\n';
        }

        script += '          ;;\n';
      }
    }
    return script;
  }
}
