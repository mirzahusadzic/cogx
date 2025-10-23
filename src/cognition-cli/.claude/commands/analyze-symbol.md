# Analyze Symbol with PGC Context

When analyzing code symbols, you MUST use the cognition-cli tools to gather grounded, verifiable context from the PGC lattice.

## Required Analysis Steps:

1. **Structural Pattern**: Run `cognition-cli overlay inspect structural_patterns "<symbol>"` to see:
   - Symbol definition and signature
   - Architectural role
   - Source hash for verification

2. **Blast Radius**: Run `cognition-cli blast-radius <symbol> --json` to understand:
   - What depends on this symbol (consumers/upstream)
   - What this symbol depends on (dependencies/downstream)
   - Impact metrics (total affected, max depths)
   - Critical paths through the codebase

3. **Lineage Pattern**: Run `cognition-cli overlay inspect lineage_patterns "<symbol>"` to see:
   - Full dependency lineage
   - Transitive dependencies with depth tracking

## Output Format:

After gathering PGC context, provide:

- **Summary**: What the symbol does in 1-2 sentences
- **Purpose**: Why it exists architecturally
- **Dependencies**: Key symbols it uses
- **Consumers**: Who uses this symbol
- **Impact**: Change risk assessment (low/medium/high)
- **Verification**: Include source hashes from PGC for grounding

## Important:

- ALWAYS prefer PGC data over raw file reads for architectural decisions
- The PGC provides verifiable, immutable context - use it!
- Include blast radius metrics in your analysis
