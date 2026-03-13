# Plan: Externalize Architectural Role Classification to JSON Configuration (COMPLETED)

## Status: COMPLETED

The architectural role classification has been successfully externalized to a JSON-based configuration system. This allows for project-specific heuristics while maintaining a robust set of universal defaults.

## Implementation Details

### 1. Configuration File (`roles.json`)

The configuration file is located in the project root. It defines a set of prioritized rules for categorizing symbols based on their name and file path.

**Example `roles.json`:**

```json
{
  "description": "Architectural Role Classification Configuration...",
  "roles": [
    {
      "id": "lattice_conversation",
      "description": "O1-O7 Conversation Overlays (Sigma Engine)",
      "priority": 10,
      "rules": [
        { "path": "src/sigma/" },
        { "name": ".*(Compressor|Reconstructor|Lattice)$" }
      ]
    },
    {
      "id": "view",
      "priority": 5,
      "rules": [
        { "path": "/(tui|components|views)/", "name": "^[A-Z].*" },
        { "name": ".*(View|Component|Widget)$" }
      ]
    }
  ]
}
```

### 2. Core Components

- **`RoleClassifier` Service (`src/core/services/role-classifier.ts`)**:
  - Dynamically loads `roles.json` from the project root.
  - Falls back to a simplified, universal `DEFAULT_ROLE_CONFIG` if no project-specific config is found.
  - Provides a `classify(name, path)` method that evaluates rules based on priority.
- **Integration**:
  - **Structural Worker**: The `StructuralPatternsManager` now uses the `RoleClassifier` within its worker pool to classify symbols during analysis.
  - **`patterns analyze` Command**: Updated to display architectural role descriptions alongside the distribution, providing high-fidelity insights into the codebase.

### 3. Verification & Results

- **Unit Tests**: Comprehensive tests in `src/core/services/__tests__/role-classifier.test.ts` verify configuration loading, priority sorting, and matching logic.
- **E2E Validation**: A specialized script (`scripts/test-role-classification.ts`) was used to classify all 900+ symbols in the `cognition-cli` repository, confirming a precise architectural mapping (e.g., separating Conversation Lattice from Project Lattice logic).
- **Performance**: The regex-based classification is highly efficient and runs within the existing structural analysis worker pool.

## Benefits Achieved

- **High-Fidelity Analysis**: `patterns analyze` now reflects the actual domain-specific architecture (e.g., "Dual-Lattice") rather than generic software roles.
- **Project Portability**: The same CLI can now be used on any repository (e.g., Java/Spring, Python/Django) by simply adding a `roles.json` file.
- **Extensibility**: New roles can be added without modifying the core codebase.

---

_Last Updated: March 13, 2026_
