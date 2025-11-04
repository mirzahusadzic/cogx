# 06 - Interactive Mode: Visual Exploration with AI

Beyond command-line queries, cognition-cli offers two interactive modes for visual exploration and AI-powered assistance.

## The TUI: Visual PGC Exploration

### **`cognition-cli tui`**

Launch an interactive Terminal User Interface with Claude integration. This provides a visual, conversational way to explore your PGC.

```bash
# Launch TUI in current project
cognition-cli tui

# Launch with specific session
cognition-cli tui --session-id <uuid>

# Configure compression threshold (default: 120K tokens)
cognition-cli tui --session-tokens 150000

# Enable debug logging for compression
cognition-cli tui --debug
```

### Options

- `-p, --project-root <path>` - Root directory of the project
- `--session-id <uuid>` - Claude session ID to attach to
- `-w, --workbench <url>` - eGemma workbench URL (default: `http://localhost:8000`)
- `--session-tokens <number>` - Token threshold for context compression (default: `120000`)
- `--debug` - Enable debug logging for Σ (Sigma) compression

### Prerequisites

Before using the TUI, you need to authenticate via Claude Code CLI:

**Note:** Authentication is currently not supported directly in cognition-cli. Use Claude Code CLI to login before launching TUI mode.

If your token expires during a TUI session, you'll see a clear message:

```
⎿ API Error: 401 - OAuth token has expired.
  Please obtain a new token or refresh your existing token.
· Please authenticate via Claude Code CLI
```

**This authentication is only required for TUI mode.** The `ask` command does not require authentication.

### Features

#### Conversational PGC Exploration

Ask Claude questions about your codebase:

```
You: What does UserManager do?
Claude: [Analyzes PGC and provides grounded answer with sources]

You: Show me all security vulnerabilities
Claude: [Queries O₂ overlay and presents findings]

You: Find code similar to AuthService
Claude: [Uses pattern similarity search and explains results]
```

#### Infinite Context (Σ Sigma)

The TUI implements **Σ (Sigma)** - infinite context through intelligent compression:

- **Automatic compression** when conversation exceeds token threshold
- **Semantic preservation** - important context retained
- **Transparent** - debug mode shows compression events
- **LanceDB storage** - all turns persisted in `.sigma/` directory

**Example debug output:**

```bash
$ cognition-cli tui --debug

[Sigma] Session: abc-123-def
[Sigma] Current tokens: 45000 / 120000
[Sigma] Compressing conversation...
[Sigma] Preserved: 3 paradigm shifts, 5 high-importance turns
[Sigma] New token count: 18000 / 120000
```

#### Lattice Integration

The TUI has full access to lattice queries:

```
You: lattice "O1 - O2"
Claude: [Executes Boolean algebra query and formats results]

You: patterns find-similar UserManager
Claude: [Shows architectural similarities with explanations]

You: What's the blast radius of changing DatabaseService?
Claude: [Runs blast-radius analysis and visualizes impact]
```

### Usage Tips

1. **Be specific** - "Show security issues in auth/" vs "security issues"
2. **Reference overlays** - "Query O₁ for services" tells Claude exactly what to do
3. **Ask for comparisons** - "Compare UserManager and OrderManager"
4. **Request visualizations** - "Show the dependency graph for..."
5. **Check status** - "Is the PGC coherent?"

### Session Management

**Starting a new session:**

```bash
cognition-cli tui
# Creates new session ID automatically
```

**Continuing an existing session:**

```bash
# Session ID shown in TUI header
cognition-cli tui --session-id abc-123-def-456
```

**Session storage:**

- Sessions stored in `.sigma/conversation_turns/`
- Persisted with LanceDB for semantic search
- Can query across sessions using cross-session commands

### Keyboard Shortcuts

- `Ctrl+C` - Exit TUI
- `Enter` - Send message
- `Up/Down` - Scroll through history (planned)

### Troubleshooting

#### OAuth Token Expired

```
⎿ API Error: 401 - OAuth token has expired.
```

**Solution:** Exit TUI and authenticate again via Claude Code CLI before relaunching.

#### Compression Not Working

**Symptoms:** Memory errors, slow responses after long conversations

**Solutions:**

- Increase threshold: `--session-tokens 150000`
- Enable debug mode: `--debug` to see compression events
- Check `.sigma/` directory exists and is writable

#### TUI Won't Start

**Error:** `Cannot connect to workbench`

**Solution:** Ensure eGemma is running: `curl http://localhost:8000/health`

---

## AI-Powered Help: The Ask Command

### **`cognition-cli ask <question>`**

Ask questions about The Lattice Book manual and get AI-synthesized answers.

```bash
# Ask a question
cognition-cli ask "How do I generate overlays?"

# Show processing steps
cognition-cli ask "What is the PGC?" --verbose

# Save answer as markdown
cognition-cli ask "Explain lattice queries" --save

# Retrieve more context
cognition-cli ask "How does genesis work?" --top-k 10
```

### Options

- `-p, --project-root <path>` - Root directory
- `-w, --workbench <url>` - eGemma workbench URL
- `--top-k <number>` - Number of similar concepts to retrieve (default: 5)
- `--save` - Save Q&A as markdown document
- `--verbose` - Show detailed processing steps

### How It Works

1. **Embedding** - Your question is embedded as a vector
2. **Similarity Search** - Finds related sections in manual documentation
3. **Context Synthesis** - AI synthesizes answer from relevant sections
4. **Source Citations** - Shows which manual sections were used

### Example Session

```bash
$ cognition-cli ask "How do overlays work?"

🤔 Searching manual for relevant information...

Found 5 related sections:
  • Core Infrastructure: Overlays
  • Structural Patterns Overlay
  • Lineage Patterns Overlay
  • Strategic Coherence
  • Querying The Lattice

Synthesizing answer...

Overlays are specialized analytical layers built on top of the PGC foundation.
Each overlay provides a different perspective on your codebase:

- O₁ (Structural Patterns): Architectural roles and signatures
- O₂ (Security Guidelines): Vulnerability analysis
- O₃ (Lineage Patterns): Dependency provenance
- O₄ (Mission Concepts): Strategic alignment
- O₅ (Operational Patterns): Runtime behaviors
- O₆ (Mathematical Proofs): Formal verification
- O₇ (Strategic Coherence): Mission synthesis

Generate overlays using:
  cognition-cli overlay generate structural_patterns .
  cognition-cli overlay generate lineage_patterns .

Sources:
  📖 Core Infrastructure (section: Overlays)
  📖 Getting Started (section: Generate Overlays)
```

### Verbose Mode

Shows the retrieval and synthesis process:

```bash
$ cognition-cli ask "What is provenance?" --verbose

[1/4] Embedding query...
  ✓ Query vector: [0.234, -0.891, 0.456, ...]

[2/4] Searching documentation...
  ✓ Found 5 relevant passages
  ✓ Similarity scores: 0.91, 0.87, 0.82, 0.79, 0.75

[3/4] Retrieving context...
  ✓ Passage 1: Introduction (tokens: 245)
  ✓ Passage 2: Core Infrastructure (tokens: 312)
  ✓ Total context: 987 tokens

[4/4] Synthesizing answer...
  ✓ Generated response (tokens: 156)

Provenance is the cryptographic grounding property...
[Full answer follows]
```

### Saving Answers

Use `--save` to create markdown files:

```bash
$ cognition-cli ask "Explain the watch command" --save

Answer saved to: .open_cognition/docs/qa/explain-the-watch-command.md
```

The saved file includes:

- The question
- The synthesized answer
- Source citations
- Timestamp

### Best Practices

1. **Be specific** - "How do I fix dirty state?" vs "problems"
2. **Ask about concepts** - "What is lattice algebra?" works well
3. **Request examples** - "Show example of overlay query"
4. **Check sources** - Review citations to verify accuracy
5. **Save important answers** - Use `--save` for reference

### Limitations

- **Only searches manual** - Doesn't query your actual PGC
- **Requires docs ingestion** - Run `genesis:docs` first
- **Context window** - Limited to top-k most relevant passages
- **Not interactive** - Use TUI for back-and-forth conversation

---

## Comparison: TUI vs Ask

| Feature                | TUI                      | Ask               |
| ---------------------- | ------------------------ | ----------------- |
| **Interactive**        | ✅ Yes                   | ❌ No             |
| **PGC Queries**        | ✅ Yes                   | ❌ No             |
| **Manual Search**      | ✅ Yes                   | ✅ Yes            |
| **Claude Integration** | ✅ Yes                   | ✅ Yes (one-shot) |
| **Session Memory**     | ✅ Yes (Σ)               | ❌ No             |
| **Requires OAuth**     | ✅ Yes (via Claude Code) | ❌ No             |
| **Best For**           | Exploration, Analysis    | Quick questions   |

---

## Advanced: Cross-Session Queries

The TUI stores all conversations in LanceDB, enabling cross-session queries:

```bash
# Find similar conversations (in TUI or via command)
You: search similar "how to generate overlays"
Claude: [Shows past conversations about overlays]

# Find paradigm shifts across sessions
You: show paradigm shifts
Claude: [Lists key insights from all sessions]
```

This is powered by the `.sigma/` directory structure:

- `conversation_turns/` - LanceDB table of all messages
- `sessions/` - Session metadata
- `compression/` - Compression logs

---

## What's Next?

Now that you understand interactive modes, explore:

- **[Overlays & Analysis](./07_Overlays_And_Analysis.md)** - Deep dive on analytical overlays
- **[Command Reference](./08_Command_Reference.md)** - Complete alphabetical listing
- **[Daily Workflow](./04_Daily_Workflow.md)** - Integrate TUI into your workflow
