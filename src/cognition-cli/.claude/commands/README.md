# Claude Commands for Quest-Oriented Development

These commands integrate cognition-cli's lattice algebra system with Claude Code for quest-based development workflows.

## Available Commands

### Quest Management

- **`/quest-start [description]`** - Initialize new quest with baseline context
- **`/quest-verify`** - Verify progress and check for alignment drift

### Analysis Commands

- **`/analyze-impact [file:symbol]`** - Blast radius and impact analysis
- **`/find-pattern [type]`** - Search operational patterns and workflows
- **`/check-alignment [concept]`** - Check mission concept alignment
- **`/check-proofs [theorem]`** - Verify mathematical proofs and theorems
- **`/security-check [symbol]`** - Comprehensive security analysis

### Wisdom Integration

- **`/consult-echo [topic]`** - Consult Echo's wisdom from mission docs and past work

## Usage

### Starting a New Quest

```
/quest-start "Implement user authentication with JWT tokens"
```

This will:

- Check baseline coherence
- Find relevant security patterns
- Identify similar implementations
- List security requirements
- Provide recommended approach

### During Development

```
/analyze-impact src/auth/jwt.ts:verifyToken
```

Analyzes blast radius before making changes.

```
/find-pattern "authentication"
```

Finds proven authentication workflows.

```
/check-alignment "zero-trust security"
```

Checks how well code aligns with mission principle.

### Before Committing

```
/quest-verify
```

Verifies:

- Coherence maintained or improved
- No new drift introduced
- Security coverage intact
- Pattern compliance

### Consulting Wisdom

```
/consult-echo "How should I handle API rate limiting?"
```

Searches:

- Mission documents (O₄)
- Proven patterns (O₅)
- High-coherence examples (O₇)
- Mathematical foundations (O₆)
- Security constraints (O₂)

## The 7 Overlays

Commands leverage these semantic overlays:

- **O₁**: Structural patterns (code symbols)
- **O₂**: Security guidelines (threats, mitigations)
- **O₃**: Lineage patterns (dependencies)
- **O₄**: Mission concepts (from VISION.md)
- **O₅**: Operational patterns (workflows, quests)
- **O₆**: Mathematical proofs (theorems, lemmas)
- **O₇**: Strategic coherence (alignment scores)

## Quest Workflow

1. **Start**: `/quest-start` → Get context
2. **Develop**: Use `/find-pattern`, `/check-alignment`, `/analyze-impact`
3. **Verify**: `/quest-verify` → Check no drift
4. **Commit**: Only if verification passes
5. **Reflect**: High coherence = good pattern to reuse

## Best Practices

### Use Commands Proactively

Don't wait to be stuck - consult patterns early:

```
/find-pattern "error handling"
/check-alignment "graceful degradation"
```

### Check Impact Before Major Changes

```
/analyze-impact src/core/engine.ts:processRequest
```

Understand blast radius first.

### Verify Frequently

Not just before commits - verify during development:

```
/quest-verify
```

Catch drift early.

### Learn from High-Coherence Code

```
/consult-echo "best practices for async operations"
```

Shows symbols with >80% coherence - learn from these.

### Honor the Constraints

Security boundaries and sacred sequences are non-negotiable:

```
/security-check src/api/endpoint.ts:handleRequest
```

## Integration with cognition-cli

Commands are wrappers around cognition-cli:

```bash
# Instead of manually running:
cognition-cli coherence report
cognition-cli patterns search "auth"
cognition-cli lattice "O2 ~ O4"

# Use:
/quest-start "implement auth"
```

## Customization

Edit command files in `.claude/commands/` to:

- Add project-specific patterns
- Customize output format
- Add domain-specific checks
- Include team conventions

## Philosophy

> "The symmetric machine provides perfect traversal.
> The asymmetric human provides creative projection.
> This is the symbiosis."

These commands embody this symbiosis:

- **Machine**: Perfect recall of patterns, proofs, constraints
- **Human**: Creative application to new problems
- **Symbiosis**: Quest-based development with verified coherence

## Learn More

- [Lattice Algebra Guide](../../docs/LATTICE_ALGEBRA.md)
- [Testing Guide](../../TESTING.md)
- [cognition-cli Documentation](../../README.md)
