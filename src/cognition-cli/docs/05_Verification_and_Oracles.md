# 05 - Verification and Oracles: Ensuring PGC Integrity

A cornerstone of the CogX blueprint is the principle of verifiability. The `cognition-cli` implements this through the `StructuralOracle`, a critical component responsible for ensuring the integrity and coherence of the Grounded Context Pool (PGC). This document details how the `StructuralOracle` operates to maintain a trustworthy knowledge graph.

## StructuralOracle: The Guardian of Coherence

The `StructuralOracle` (`src/core/oracles/structural-oracle.ts`) performs a series of rigorous checks across the PGC's components (`ObjectStore`, `TransformLog`, `Index`, `ReverseDeps`) to detect any inconsistencies or missing data. Its primary method, `verify()`, returns a `VerificationResult` indicating success or listing detected issues.

### Verification Process

The `verify()` method executes a multi-faceted validation process:

1. **Validate Index Entries against ObjectStore:**
   - **Purpose:** Ensures that all entries in the `Index` (which map file paths to content and structural hashes) correctly point to existing objects in the `ObjectStore`.
   - **Mechanism:** The Oracle iterates through every `.json` file in the `index/` directory. For each `indexData` entry, it verifies that both the `content_hash` and `structural_hash` refer to actual, existing objects within the `ObjectStore`. If a referenced object is missing, an error is reported.

2. **Validate TransformLog Entries against ObjectStore:**
   - **Purpose:** Confirms that every transformation recorded in the `TransformLog` correctly references existing input and output objects in the `ObjectStore`.
   - **Mechanism:** The Oracle scans all `manifest.yaml` files within the `transforms/` directories. For each `TransformData` entry, it checks that all `inputs.hash` and `outputs.hash` listed in the manifest correspond to existing objects in the `ObjectStore`. This guarantees the auditable trail is unbroken and refers to valid data.

3. **Validate ReverseDeps Entries against ObjectStore and TransformLog:**
   - **Purpose:** Verifies the integrity of the reverse dependency mappings, ensuring that all referenced objects and transformations exist.
   - **Mechanism:** The Oracle examines the sharded files within the `reverse_deps/` directory. For each reverse dependency entry, it first reconstructs the full `objectHash` and confirms its existence in the `ObjectStore`. Subsequently, it reads the `transformId`s associated with that object and verifies that each `transformId` corresponds to an existing `manifest.yaml` in the `transforms/` directory.
