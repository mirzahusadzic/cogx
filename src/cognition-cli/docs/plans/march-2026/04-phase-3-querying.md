# Phase 3: The Provenance Engine (Week 6-7)

**Goal:** Full chain verification and querying — the system can explain HOW it knows anything.

## 3.1 Transform→Transform DAG

Currently: `reverse_deps` maps object_hash → [transform_ids]
Missing: transform_A.outputs → transform_B.inputs chain

**New file:** `src/core/pgc/transform-dag.ts`

```typescript
export class TransformDAG {
  // Build: after each transform record, link it to upstream transforms
  async link(transformId: string, transform: Transformation): Promise<void> {
    for (const input of transform.inputs) {
      // Find which transform produced this input
      const producerTransformIds = await this.reverseDeps.getTransformIds(
        input.hash
      );
      for (const producerId of producerTransformIds) {
        await this.addEdge(producerId, transformId); // producer → consumer
      }
    }
  }

  // Query: forward traversal
  async getDownstream(transformId: string): Promise<string[]>;

  // Query: backward traversal
  async getUpstream(transformId: string): Promise<string[]>;

  // Query: full chain from source to artifact
  async getChain(
    sourceHash: string,
    targetHash: string
  ): Promise<TransformChain>;
}
```

**Cycle Protection:**

File reversions (reverting a file to a previous state) create cycles in the content graph:
`hash_A → transform → hash_B → transform → hash_A`. The DAG must handle this gracefully.

```typescript
// All traversal methods use a visited set to prevent infinite loops
async getDownstream(transformId: string, visited = new Set<string>()): Promise<string[]> {
  if (visited.has(transformId)) return []; // Cycle detected — stop
  visited.add(transformId);
  const children = await this.getDirectChildren(transformId);
  const results: string[] = [];
  for (const child of children) {
    results.push(child);
    results.push(...await this.getDownstream(child, visited));
  }
  return results;
}
```

This is O(V+E) with the visited set. Document in code: "Cycles are expected (reversions,
cherry-picks). Traversal terminates on revisit, not on error."

````

**Storage:** `.open_cognition/transform_dag/<shard>/<transform_id>` (same git-style sharding)

**Integration:** Call `TransformDAG.link()` inside `TransformLog.record()`.

## 3.2 Provenance Query Service

**New file:** `src/core/lineage/provenance-service.ts`

```typescript
export class ProvenanceService {
  constructor(
    private transformLog: TransformLog,
    private transformDAG: TransformDAG,
    private objectStore: ObjectStore,
    private index: Index,
  ) {}

  // Trace forward: what was produced from this input?
  async traceForward(inputHash: string): Promise<ProvenanceChain>

  // Trace backward: what produced this output?
  async traceBackward(outputHash: string): Promise<ProvenanceChain>

  // Verify: is the chain complete and all objects exist?
  async verifyChain(chain: ProvenanceChain): Promise<ChainVerification>

  // History: all transforms for a file, in temporal order
  async getFileHistory(filePath: string): Promise<FileHistory>

  // Impact: what's affected if this changes? (completes the blast radius TODOs)
  async analyzeImpact(hash: string, depth?: number): Promise<ImpactAnalysis>
}
````

## 3.3 verify-provenance Command

**New file:** `src/commands/verify-provenance.ts`

```bash
cognition-cli verify-provenance src/auth/AuthService.ts

# Output:
# ✅ Provenance Chain: VERIFIED
#
# src/auth/AuthService.ts
#   content_hash: e069...0813
#   ↓ Transform: "Initial extraction" (ast_native, φ=1.0)
#     ↓ structural_hash: 5f30...7980
#       ↓ Transform: "Structural pattern embedding" (egemma, φ=1.0)
#         ↓ O₁ pattern: AuthService (role: domain_service)
#           ↓ O₇ coherence: 0.74 (aligned with "authentication" mission concept)
#
# Chain depth: 4 transforms
# All objects: ✅ present (4/4)
# All transforms: ✅ valid (4/4)
# Git provenance: commit abc123 by dev@example.com "Add auth service"
# Reasoning: "Implementing JWT-based auth per security requirements"
```

## 3.4 Complete Blast Radius

**File:** `src/commands/status.ts` (lines 847-850, the TODOs)

Replace:

```typescript
consumerCount: 0,   // TODO: Calculate from pattern metadata
maxDepth: 0,        // TODO: Calculate from lineage patterns
```

With calls to `ProvenanceService.analyzeImpact()` using the transform DAG for transitive consumer counting and depth calculation.

---
