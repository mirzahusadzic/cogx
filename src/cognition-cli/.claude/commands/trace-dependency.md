# Trace Dependency Chain

When debugging or understanding how symbol A reaches symbol B, use PGC tools to trace the verifiable path.

## Dependency Tracing Steps:

1. **Start with blast-radius**: Run `cognition-cli blast-radius <start-symbol> --direction down --max-depth 5 --json`
   - This shows all downstream dependencies
   - Check if target symbol appears in dependencies list

2. **Inspect critical paths**: Look at the `criticalPaths` in blast-radius output
   - These show high-impact chains through the codebase
   - Often reveal the connection you're looking for

3. **Check lineage pattern**: Run `cognition-cli overlay inspect lineage_patterns "<start-symbol>"`
   - Shows the full dependency lineage with depths
   - Includes transitive dependencies

4. **Verify with structural data**: For each symbol in the chain, run:
   ```bash
   cognition-cli overlay inspect structural_patterns "<symbol>"
   ```
   - Confirms the structural relationship (imports, extends, implements, uses)

## Output Format:

```
🔍 Dependency Trace: A → B

Path Found:
A (src/file1.ts)
  → uses C (depth: 1)
    → C (src/file2.ts)
      → extends D (depth: 2)
        → D (src/file3.ts)
          → imports B (depth: 3)
            → B (src/file4.ts) ✓

Relationship Types:
- A uses C: method parameter type
- C extends D: class inheritance
- D imports B: direct import

Verification Hashes:
- A: structural_hash_123...
- C: structural_hash_456...
- B: structural_hash_789...
```

## Use Cases:

- "How does X reach Y?"
- "Why does changing A break B?"
- "What's the dependency chain between these components?"
- "Find circular dependencies"

## Important:

All paths MUST be verified through PGC data - never guess at dependencies!
