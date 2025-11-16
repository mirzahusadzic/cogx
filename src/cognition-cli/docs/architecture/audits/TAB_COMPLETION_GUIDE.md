# Tab Completion Guide

Cognition CLI supports shell tab completion for **bash**, **zsh**, and **fish** shells.

## Features

Tab completion provides smart suggestions for:

✓ **Commands**: `cognition-cli [TAB]` → shows all available commands
✓ **Aliases**: Includes short aliases (i, g, q, w, l)
✓ **Subcommands**: `cognition-cli overlay [TAB]` → shows generate, list
✓ **Options**: `--format [TAB]` → shows auto, table, json, plain
✓ **Overlay Types**: `overlay generate [TAB]` → shows all overlay types
✓ **Context-Aware**: Suggestions adapt based on command context

## Installation

### Auto-detect Shell

```bash
cognition-cli completion install
```

The CLI automatically detects your shell (bash/zsh/fish) and installs the appropriate completion.

### Specify Shell

```bash
# For bash
cognition-cli completion install --shell bash

# For zsh
cognition-cli completion install --shell zsh

# For fish
cognition-cli completion install --shell fish
```

### After Installation

Restart your shell or reload the config:

```bash
# Bash
source ~/.bashrc

# Zsh
source ~/.zshrc

# Fish (auto-reloads)
# Just open a new terminal
```

## Usage Examples

Once installed, you can use tab completion everywhere:

### Command Completion

```bash
$ cognition-cli [TAB][TAB]
ask           genesis       query         wizard
audit         init          security      ...

$ cognition-cli q[TAB]
query  # Expands to 'query'
```

### Subcommand Completion

```bash
$ cognition-cli overlay [TAB][TAB]
generate  list

$ cognition-cli security [TAB][TAB]
mandate  attacks  coverage-gaps  boundaries  list  cves  query  coherence
```

### Overlay Type Completion

```bash
$ cognition-cli overlay generate [TAB][TAB]
structural_patterns    security_guidelines    lineage_patterns
mission_concepts       operational_patterns   mathematical_proofs
strategic_coherence    all
```

### Option Completion

```bash
$ cognition-cli query "auth" --format [TAB][TAB]
auto  table  json  plain

$ cognition-cli completion install --shell [TAB][TAB]
bash  zsh  fish
```

### Alias Completion

Short aliases work just like full commands:

```bash
$ cognition-cli w[TAB]
wizard  # Expands to 'wizard' or completes alias 'w'

$ cognition-cli l "O1 - O2" --format [TAB]
auto  table  json  plain
```

## Supported Shells

| Shell    | Status      | Notes               |
| -------- | ----------- | ------------------- |
| **bash** | ✓ Supported | Tested on bash 4.0+ |
| **zsh**  | ✓ Supported | Tested on zsh 5.0+  |
| **fish** | ✓ Supported | Tested on fish 3.0+ |

## Completion Details

### Commands with Tab Completion

All commands support tab completion:

- **Core**: init, genesis, query, wizard, tui, ask
- **Overlays**: overlay generate/list
- **Analysis**: patterns, concepts, coherence
- **Sugar**: security, workflow, proofs
- **Utilities**: status, watch, update, guide, completion

### Context-Aware Completions

The completion system is context-aware:

#### After `overlay generate`:

- Suggests all 7 overlay types
- Includes "all" option

#### After `--format`:

- Suggests: auto, table, json, plain

#### After `--shell`:

- Suggests: bash, zsh, fish

#### After `security`:

- Suggests all security subcommands

#### After `-p` or `--project-root`:

- Completes directory paths

## Troubleshooting

### Completion Not Working

**1. Check installation:**

```bash
# Bash
grep cognition-completion ~/.bashrc

# Zsh
grep cognition-completion ~/.zshrc

# Fish
ls ~/.config/fish/completions/cognition-cli.fish
```

**2. Verify completion file exists:**

```bash
# Bash
ls ~/.cognition-completion.bash

# Zsh
ls ~/.cognition-completion.zsh

# Fish
ls ~/.config/fish/completions/cognition-cli.fish
```

**3. Reload shell config:**

```bash
# Bash
source ~/.bashrc

# Zsh
source ~/.zshrc

# Fish - restart terminal
```

### Permission Errors

If you see permission errors:

```bash
# Check file permissions
ls -l ~/.cognition-completion.*

# Fix if needed
chmod 644 ~/.cognition-completion.*
```

### Completion Shows Wrong Suggestions

Try reinstalling:

```bash
cognition-cli completion uninstall
cognition-cli completion install
```

## Uninstallation

To remove tab completion:

```bash
# Auto-detect shell
cognition-cli completion uninstall

# Specify shell
cognition-cli completion uninstall --shell bash
```

This removes:

- Completion script file
- Source line from shell config
- All completion functionality

## Advanced Usage

### Custom Completion Scripts

The completion scripts are stored in:

- **Bash**: `~/.cognition-completion.bash`
- **Zsh**: `~/.cognition-completion.zsh`
- **Fish**: `~/.config/fish/completions/cognition-cli.fish`

You can customize these scripts if needed, but they will be overwritten on reinstall.

### Shell-Specific Features

#### Bash

- Uses `complete -F` for custom completion function
- Supports `COMPREPLY` for suggestions
- Compatible with bash-completion framework

#### Zsh

- Uses `#compdef` directive
- Leverages zsh's `_arguments` system
- Integrates with Oh My Zsh and other frameworks

#### Fish

- Uses `complete -c` syntax
- Automatically loaded from completions directory
- Supports `__fish_seen_subcommand_from` for context

## Examples

### Quick Workflow

```bash
# Install (once)
cognition-cli completion install

# Use tab completion
cognition-cli w[TAB]                    # → wizard
cognition-cli overlay g[TAB]            # → generate
cognition-cli overlay generate s[TAB]   # → structural_patterns
cognition-cli q "auth" --f[TAB]         # → --format
cognition-cli query "db" --format j[TAB] # → json
```

### Power User Workflow

```bash
# Using aliases + completion
cognition-cli i[TAB]    # → init
cognition-cli g[TAB]    # → genesis
cognition-cli q[TAB]    # → query
cognition-cli w[TAB]    # → wizard
cognition-cli l[TAB]    # → lattice

# Complex commands
cognition-cli security [TAB]            # → see all subcommands
cognition-cli workflow [TAB]            # → see all subcommands
cognition-cli proofs [TAB]              # → see all subcommands
```

## Contributing

To add new completions:

1. Edit `src/commands/completion.ts`
2. Add commands to appropriate shell completion functions
3. Test with all three shells
4. Submit PR with examples

## See Also

- [CLI Style Guide](./STYLE_GUIDE.md)
- [Documentation Home](/index)
- [Command Reference](https://mirzahusadzic.github.io/cogx/manual/)

---

**Need help?** Run `cognition-cli completion --help` or open an issue on GitHub.
