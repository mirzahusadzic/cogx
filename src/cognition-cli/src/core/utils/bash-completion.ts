import { BaseCompletionGenerator, FlagMetadata } from './completion-base.js';

/**
 * Generator for Bash completion scripts.
 */
export class BashCompletionGenerator extends BaseCompletionGenerator {
  generate(): string {
    const commands = this.getCommandsList();
    const globalFlags = this.globalFlags
      .map((f) => f.name + (f.short ? ` ${f.short}` : ''))
      .join(' ');

    return `# Cognition CLI bash completion

_cognition_cli_completions() {
  local cur prev cmd_with_colon
  COMPREPLY=()
  cur="\${COMP_WORDS[COMP_CWORD]}"
  prev="\${COMP_WORDS[COMP_CWORD-1]}"

  # Handle colon-separated commands
  ${this.generateSubcommandHandling()}

  # Main commands
  local commands="${commands}"

  # Global flags
  local global_flags="${globalFlags}"

  # If completing first word, suggest main commands
  if [ \${COMP_CWORD} -eq 1 ]; then
    COMPREPLY=( $(compgen -W "\${commands}" -- \${cur}) )
    return 0
  fi

  # Context-aware completion
  case "\${cmd_with_colon}" in
${this.generateCaseStatements()}
  esac

  # Default completion
  COMPREPLY=( $(compgen -W "\${commands} \${global_flags}" -- \${cur}) )
  return 0
}

complete -F _cognition_cli_completions cognition-cli
`;
  }

  private getCommandsList(): string {
    const list: string[] = [];
    for (const cmd of this.commands) {
      list.push(cmd.name);
      if (cmd.aliases) list.push(...cmd.aliases);
      if (cmd.subcommands) {
        for (const sub of cmd.subcommands) {
          list.push(`${cmd.name}:${sub.name}`);
        }
      }
    }
    return list.join(' ');
  }

  private generateSubcommandHandling(): string {
    // Collect commands with subcommands for the manual colon reconstruction
    const parents = this.commands.filter(
      (c) => c.subcommands && c.subcommands.length > 0
    );
    if (parents.length === 0) return '';

    const parentNames = parents.map((p) => p.name).join('|');

    let script = `if [[ \${COMP_CWORD} -ge 2 ]] && [[ "\${COMP_WORDS[COMP_CWORD-2]}" =~ ^(${parentNames})$ ]] && [[ "\${COMP_WORDS[COMP_CWORD-1]}" == ":" ]]; then
    local base_cmd="\${COMP_WORDS[COMP_CWORD-2]}"
    case "\${base_cmd}" in
`;

    for (const p of parents) {
      const subNames = p.subcommands!.map((s) => s.name).join(' ');
      script += `      ${p.name})
        COMPREPLY=( $(compgen -W "${subNames}" -- \${cur}) )
        return 0
        ;;
`;
    }

    script += `    esac
  fi

  # Reconstruct colon-separated command for completion matching
  if [[ \${COMP_CWORD} -ge 3 ]] && [[ "\${COMP_WORDS[COMP_CWORD-2]}" == ":" ]]; then
    cmd_with_colon="\${COMP_WORDS[COMP_CWORD-3]}:\${COMP_WORDS[COMP_CWORD-1]}"
  else
    cmd_with_colon="\${prev}"
  fi`;

    return script;
  }

  private generateCaseStatements(): string {
    let script = '';

    // Global flags with values
    for (const flag of this.globalFlags) {
      if (flag.values) {
        script += `    ${flag.name})
      COMPREPLY=( $(compgen -W "${flag.values.join(' ')}" -- \${cur}) )
      return 0
      ;;
`;
      }
    }

    // Command specific flags and subcommands
    for (const cmd of this.commands) {
      if (cmd.flags) {
        script += `    ${cmd.name})
      COMPREPLY=( $(compgen -W "${this.getFlagNames(cmd.flags)}" -- \${cur}) )
      return 0
      ;;
`;
      }

      if (cmd.subcommands) {
        // Parent command level (already handled by reconstruct for colon, but some might be direct)
        script += `    ${cmd.name})
      COMPREPLY=( $(compgen -W "${cmd.subcommands.map((s) => s.name).join(' ')}" -- \${cur}) )
      return 0
      ;;
`;

        // Subcommand level
        for (const sub of cmd.subcommands) {
          if (sub.values) {
            script += `    ${cmd.name}:${sub.name}|${sub.name})
      COMPREPLY=( $(compgen -W "${sub.values.join(' ')}" -- \${cur}) )
      return 0
      ;;
`;
          }
          if (sub.flags) {
            script += `    ${cmd.name}:${sub.name}|${sub.name})
      COMPREPLY=( $(compgen -W "${this.getFlagNames(sub.flags)}" -- \${cur}) )
      return 0
      ;;
`;
          }
        }
      }
    }

    return script;
  }

  private getFlagNames(flags: FlagMetadata[]): string {
    const names: string[] = [];
    for (const f of flags) {
      names.push(f.name);
      if (f.short) names.push(f.short);
    }
    return names.join(' ');
  }
}
