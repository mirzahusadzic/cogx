# Rebuild PGC from Scratch

Rebuild the PGC after major changes or when starting fresh using the interactive wizard.

## Recommended Approach: Use Wizard

The wizard command provides an interactive setup that handles all overlays:

```bash
cognition-cli wizard
```

The wizard will:

1. Check if PGC already exists (offers to rebuild if needed)
2. Initialize `.open_cognition` workspace
3. Run genesis on source code
4. Optionally ingest documentation with `genesis:docs`
5. Generate all 7 overlays interactively:
   - O₁: structural_patterns
   - O₂: security_guidelines
   - O₃: lineage_patterns
   - O₄: mission_concepts
   - O₅: operational_patterns
   - O₆: mathematical_proofs
   - O₇: strategic_coherence

## Manual Approach (Advanced)

If you need more control, you can rebuild manually:

1. Check if `.open_cognition` exists. If it does, warn the user that this will rebuild from scratch.

2. Run `cognition-cli init` (if not already initialized)

3. Run `cognition-cli genesis src/` to build the knowledge graph
   - Show progress
   - Report number of files found and parsed
   - Note any errors

4. Generate each overlay as needed:

   ```bash
   cognition-cli overlay generate structural_patterns .
   cognition-cli overlay generate security_guidelines .
   cognition-cli overlay generate lineage_patterns .
   cognition-cli overlay generate mission_concepts .
   cognition-cli overlay generate operational_patterns .
   cognition-cli overlay generate mathematical_proofs .
   cognition-cli overlay generate strategic_coherence .
   ```

5. Provide a comprehensive summary:
   - Total files indexed
   - Total symbols extracted
   - Dependency links created
   - Overlays generated
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
