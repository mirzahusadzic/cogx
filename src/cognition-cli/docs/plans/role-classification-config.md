# Plan: Externalize Architectural Role Classification to JSON Configuration

## Problem Statement

The current architectural role classification is hardcoded within the `src/core/overlays/structural/` directory. While the recent improvements (introducing `command`, `view`, `hook`, etc.) have significantly improved classification for this repository, the logic is inherently tied to a specific project structure and naming convention. This approach is not scalable for:

1. Different programming languages.
2. Different architectural patterns (e.g., Clean Architecture, Hexagonal, MVC).
3. Custom repository structures.

## Proposed Solution

Move the classification logic out of the core code and into a configurable, JSON-based ruleset. This would allow users to define their own heuristics and for Sigma to be language-agnostic.

### 1. Configuration Schema (`.open_cognition/roles.json`)

The configuration should allow for a list of prioritized rules that use regex on the `filePath` and `symbolName`.

```json
{
  "roles": [
    {
      "id": "command",
      "priority": 10,
      "rules": [{ "path": "/commands/", "name": ".*Command$" }]
    },
    {
      "id": "view",
      "priority": 10,
      "rules": [
        { "path": "/(tui|components|views)/", "name": "^[A-Z].*" },
        { "name": ".*(View|Component)$" }
      ]
    },
    {
      "id": "hook",
      "priority": 10,
      "rules": [{ "name": "^use[A-Z].*" }]
    },
    {
      "id": "data_access",
      "priority": 10,
      "rules": [
        { "path": "/(repositories|data-access|db)/" },
        { "name": ".*(Repository|Store|DAO)$" }
      ]
    }
  ],
  "defaultRole": "component"
}
```

### 2. Core Components

- **RoleClassifier Service**: A new utility (e.g., in `src/core/utils/role-classifier.ts`) that:
  - Loads the `roles.json` configuration.
  - Compiles the regexes.
  - Provides a `classify(name, path, metadata)` method.
- **Integration Points**:
  - `src/core/overlays/structural/worker.ts`: Replace `inferArchitecturalRole` with a call to the `RoleClassifier`.
  - `src/core/overlays/structural/patterns.ts`: Replace `inferArchitecturalRole` with a call to the `RoleClassifier`.

### 3. Implementation Phases

- **Phase 1: Basic Externalization**: Define the JSON schema and implement the `RoleClassifier` to match the current hardcoded logic.
- **Phase 2: Configuration Loading**: Allow Sigma to look for a `.sigma/roles.json` file in the project root, falling back to a default "universal" roleset if none is found.
- **Phase 3: Extended Metadata**: Allow rules to consider more than just name and path (e.g., "extends X class" or "has Y decorator").

## Benefits

- **Customizability**: Users can tailor the classification to their project's specific terminology.
- **Language Support**: Easily support Java (e.g., `@Service` annotations), Python (e.g., `_view.py` suffix), and more.
- **Consistency**: Centralizing the logic ensures all overlays use the same classification rules.
- **Maintainability**: Updating classification rules no longer requires a rebuild/re-deploy of the core Sigma CLI.
