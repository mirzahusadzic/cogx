# Explore Codebase Architecture

When the user asks about overall architecture or how systems connect, use PGC tools to build a grounded understanding.

## Architecture Exploration Steps

1. **Load Structural Patterns**: Run `cognition-cli patterns list` to see all symbols and their roles

2. **Identify Core Symbols**: Look for high-impact symbols by running blast-radius on candidates:
   - Run `cognition-cli blast-radius <symbol> --json` on suspected core components
   - High `totalImpacted` count indicates architectural importance
   - Many consumers = widely-used abstraction
   - Many dependencies = integration point

3. **Map Architectural Roles**: Use patterns analyze to see the distribution:
   - Run `cognition-cli patterns analyze --verbose` to see architectural roles
   - Models/Data structures
   - Services/Business logic
   - Controllers/Orchestrators
   - Utilities/Helpers
   - Infrastructure/Core

4. **Understand Data Flow**: Use lineage patterns to trace data transformations:
   - Run `cognition-cli patterns inspect <symbol>` on key data types to see dependencies
   - Run `cognition-cli patterns graph <symbol>` to visualize dependency trees
   - Track how data flows through the system

## Output Format

Provide a structured architecture overview:

```text
🏗️ Architecture Overview

Core Components:
- SymbolA (role: orchestrator, impacts: 45 symbols)
  → Used by: ...
  → Depends on: ...

- SymbolB (role: model, impacts: 32 symbols)
  → Used by: ...
  → Depends on: ...

Key Data Flows:
- DataType1 flows through: A → B → C
- DataType2 flows through: X → Y → Z

Architectural Patterns:
- [Pattern identified from graph structure]

Critical Paths:
- [High-impact dependency chains]
```

## Grounding

- All analysis MUST reference PGC data (structural patterns, lineage, blast radius)
- Include metrics to support architectural claims
- Note symbols with high blast radius as architectural risks
