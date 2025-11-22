# 03 - Commands Reference

> **Note**: This guide is under construction. For complete command documentation, see:
>
> - Command Reference in main README (`../../README.md#-command-reference`)
> - [Claude Integration Commands](../claude/command-reference.md)
> - Run `cognition --help` for inline help
> - Run `cognition <command> --help` for command-specific help

## Available Commands

All commands are documented in the main README and accessible via `--help` flags.

### Core Commands

- `init` - Initialize PGC structure
- `genesis [path]` - Build code knowledge graph
- `genesis:docs [path]` - Ingest documentation
- `watch` - Real-time file monitoring
- `status` - Instant coherence check
- `update` - Incremental sync

### Overlay Commands

- `overlay generate <type>` - Generate analytical overlays
- `patterns <command>` - Structural pattern operations
- `concepts <command>` - Mission concept operations
- `coherence <command>` - Mission-code coherence

### Analysis Commands

- `tui` - Interactive TUI with Σ system
- `pr-analyze` - Cross-overlay PR analysis
- `security blast-radius` - Security impact analysis
- `query <question>` - Graph traversal
- `audit <command>` - PGC integrity verification

For detailed usage, see the main README (`../../README.md`) or run commands with `--help`.
