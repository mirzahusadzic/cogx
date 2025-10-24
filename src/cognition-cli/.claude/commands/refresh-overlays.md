# Refresh PGC Overlays

Regenerate pattern overlays when code structure has changed significantly.

## When to Use This

- After major refactoring
- After switching git branches
- After deleting and recreating overlays
- When overlay data seems stale

## Steps

1. Run `cognition-cli overlay generate structural_patterns . --force`
   - The `--force` flag regenerates all patterns, even if they already exist
   - Show progress and any errors

2. Run `cognition-cli overlay generate lineage_patterns . --force`
   - Regenerates dependency lineage graph
   - Show progress and any errors

3. Report updated pattern statistics:
   - Number of structural patterns regenerated
   - Number of lineage patterns regenerated
   - Any symbols that failed processing
   - Comparison with previous counts (if available)

## Options to Consider

If the user mentions branch switching or overlay deletion, suggest using `--skip-gc`:

```bash
cognition-cli overlay generate structural_patterns . --force --skip-gc
cognition-cli overlay generate lineage_patterns . --force --skip-gc
```

The `--skip-gc` flag prevents garbage collection from deleting object hashes that overlays still reference.

## Output Format

```bash
Refreshing PGC overlays...

[Regenerating structural patterns...]
  ⚠️ Using --force flag - regenerating all patterns
  Processed 3,847 symbols
  ✅ Structural patterns refreshed

[Regenerating lineage patterns...]
  ⚠️ Using --force flag - regenerating all patterns
  Analyzed 2,156 dependencies
  ✅ Lineage patterns refreshed

📊 Refresh Summary:
  - Structural patterns: 3,847 (unchanged)
  - Lineage patterns: 2,156 (+34 new links)
  - Failed symbols: 0
  - Duration: 3m 42s

Overlays are now synchronized with current codebase!
```

## Notes

- This can be time-consuming for large codebases
- Respects eGemma rate limits (5 embed calls per 10 seconds)
- Consider running during off-hours for very large projects
- Use `--skip-gc` when switching branches to avoid hash deletion issues
