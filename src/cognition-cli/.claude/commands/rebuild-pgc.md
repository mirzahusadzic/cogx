# Rebuild PGC from Scratch

Rebuild the PGC after major changes or when starting fresh.

## Steps

1. Check if `.open_cognition` exists. If it does, warn the user that this will rebuild from scratch.

2. Run `cognition-cli init` (if not already initialized)

3. Run `cognition-cli genesis src/` to build the knowledge graph
   - Show progress
   - Report number of files found and parsed
   - Note any errors

4. Run `cognition-cli overlay generate structural_patterns .`
   - Show progress
   - Report number of patterns generated

5. Run `cognition-cli overlay generate lineage_patterns .`
   - Show progress
   - Report dependency links created

6. Provide a comprehensive summary:
   - Total files indexed
   - Total symbols extracted
   - Dependency links created
   - Storage size (if available)
   - Any warnings or errors encountered

## Output Format

Use clear formatting with:

- ✅ for successful steps
- ⚠️ for warnings
- ❌ for errors
- 📊 for summary statistics

## Example

```bash
Rebuilding PGC from scratch...

✅ PGC initialized at .open_cognition/

[Running genesis on src/...]
  Discovered 247 files
  Parsed 247 files successfully
  ✅ Genesis complete

[Generating structural patterns...]
  Processed 3,847 symbols
  Generated 3,847 pattern entries
  ✅ Structural patterns generated

[Generating lineage patterns...]
  Analyzed 2,156 dependencies
  Built lineage graph
  ✅ Lineage patterns generated

📊 PGC Build Summary:
  - Files indexed: 247
  - Total symbols: 3,847
  - Dependency links: 2,156
  - Storage: 45.2 MB

Your PGC is now ready for grounded AI reasoning!
```

## Notes

- This is a potentially time-consuming operation for large codebases
- Recommend running during off-hours for very large projects
- If eGemma workbench is not running, some overlays may fail
- Consider backing up existing `.open_cognition/` if it exists
