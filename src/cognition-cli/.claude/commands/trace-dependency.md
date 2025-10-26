# Trace Dependency Chain

Trace how one component depends on another through the dependency graph.

## Goal

Visualize and explain the dependency path between two components, identifying:

- Direct vs transitive dependencies
- Intermediary components in the chain
- Multiple paths if they exist
- Depth and complexity of the relationship

## Steps

1. **Get source and target components from user**
   - Ask: "Which component is the source?" (the one that depends)
   - Ask: "Which component is the target?" (the one being depended on)

2. **Run dependency query**
   - Execute: `node dist/cli.js query <source> --depth 5 --lineage`
   - Parse the JSON lineage output

3. **Search for paths to target**
   - Traverse the lineage tree looking for target symbol
   - Identify all paths from source to target
   - Calculate depth of each path

4. **Visualize the dependency chains**
   - Show each path clearly with tree structure
   - Highlight intermediary components
   - Indicate direct (1-hop) vs transitive (multi-hop)

5. **Provide analysis**
   - Relationship type (direct, transitive, none)
   - Coupling assessment (tight vs loose)
   - Suggestions if needed

## Notes

- Limit depth to 5-7 levels to avoid overwhelming output
- Highlight circular dependencies prominently
- Provide architectural context and suggestions
