# Type Lineage Generation Plan

This document outlines the plan for generating and utilizing type lineage information within the `cognition-cli`, focusing on the `structural_patterns` overlay.

## 1. Problem Statement

The goal is to generate comprehensive lineage information for types (classes, interfaces, functions) to enable advanced analysis, such as:

- Understanding the "blast radius" of changes (both downstream and potentially upstream).
- Identifying usage patterns and architectural similarities through clustering.
- Providing detailed context for embeddings.

The existing `queryCommand` primarily focuses on natural language queries and generates a "downwards" lineage (what a symbol uses) for a single, "best" matching symbol. This needs to be extended to generate full lineage JSONs for multiple symbols with optimized performance and scope.

## 2. Core Requirements & Clarifications

- **Full Lineage JSON**: The output must be the complete lineage JSON structure, not a hash, as it's crucial for downstream processes like embeddings.
- **Downwards and Upwards Dependencies**: While the initial implementation will focus on generating "downwards" lineage (what a symbol uses), the ultimate goal is to enable inference of "upwards" dependencies (what uses a symbol) through aggregation and inversion of the generated data.
- **Clustering for Pattern Identification**: The generated lineage data should be suitable for clustering to identify similar usage patterns across different symbols.

## 3. Proposed Approach

### 3.1. Scope Optimization: Constraining the Search

To optimize performance and focus the analysis, the lineage generation will be constrained:

- **Initial Symbols**: The initial set of symbols for which lineage will be generated will be derived by parsing the `.json` files directly from the `open_cognition/overlays/structural_patterns/src/core` directory. These files already contain the `StructuralData` for the symbols within this specific module of the overlay.
- **Dependency Search**: When searching for dependencies of these initial symbols, the search will be strictly limited to the `open_cognition/overlays/structural_patterns/src/core` directory and its subdirectories. This ensures that the lineage primarily reflects internal dependencies within that module.

### 3.2. New Function: `getLineageForStructuralData`

A new internal function, `getLineageForStructuralData`, will be created to handle the core lineage generation logic:

- **Input**: It will accept a `StructuralData` object (representing the symbol for which lineage is being generated) and a `maxDepth` parameter.
- **Process**:
  - It will perform a "downwards" dependency traversal, similar to the existing `queryCommand`.
  - The search for dependencies (via `pgc.index.search` and `pgc.objectStore.retrieve`) will be constrained to the `open_cognition/overlays/structural_patterns/src/core` directory.
  - It will collect _all_ relevant `StructuralData` for dependencies, not just a single "best" one.
- **Output**: It will return a `QueryResult` object, which can then be formatted into the desired JSON.

### 3.3. Depth Optimization Heuristic

To further optimize performance, a heuristic will be applied to determine the `maxDepth` for each symbol:

- For very basic types (e.g., enums, simple interfaces without complex properties, functions with only primitive parameters), `maxDepth` will be set to `0` or `1`.
- For more complex classes, interfaces, or functions, a default `maxDepth` (e.g., `2` or `3`) will be used to capture more significant dependencies. This determination will involve inspecting the `StructuralData` of the symbol.

### 3.4. Modifying `generateLineageSignature`

The `generateLineageSignature` function will be modified to orchestrate the entire process:

- It will identify all initial `StructuralData` objects by parsing the `.json` files in `open_cognition/overlays/structural_patterns/src/core`.
- For each `StructuralData` object, it will apply the depth optimization heuristic to determine the `maxDepth`.
- It will call `getLineageForStructuralData` with the `StructuralData` and the determined `maxDepth`.
- It will then use `formatAsLineageJSON` to convert the resulting `QueryResult` into the desired JSON string.
- The function will return an array of these lineage JSON strings, where each string represents the lineage for one symbol from the overlay.

## 4. Future Considerations

### 4.1. Comprehensive Blast Radius Analysis (Upwards Dependencies)

While the initial implementation focuses on "downwards" lineage, the generated data forms the foundation for a full blast radius analysis. To achieve this, a subsequent step would involve:

- Aggregating all generated "downwards" lineages.
- Constructing a comprehensive dependency graph from this aggregated data.
- Developing mechanisms to query this graph for "upwards" dependencies (what uses a symbol) by effectively inverting the relationships.

### 4.2. Clustering for Pattern Identification

The structured lineage JSONs are ideal for clustering. Future work could involve:

- Converting lineage JSONs into a suitable numerical representation (e.g., feature vectors).
- Applying clustering algorithms to group symbols with similar lineage patterns.
- Interpreting these clusters to identify common usage patterns, architectural similarities, and potential areas for refactoring or abstraction.
