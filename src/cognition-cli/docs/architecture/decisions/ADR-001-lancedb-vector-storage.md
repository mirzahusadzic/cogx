# ADR-001: LanceDB for Vector Storage

- **Date**: 2025
- **Status**: Accepted
- **Deciders**: Core team
- **Related**: Innovation #5 (Overlay System with vector embeddings)

## Context

The Cognition CLI requires a vector database to enable semantic search across code symbols, documentation concepts, and mission alignment. With 4,000+ embeddings per 32K LOC codebase (each 768 dimensions), we needed a storage solution that could:

1. **Perform sub-millisecond similarity searches** for interactive queries
2. **Operate offline-first** to align with PGC's self-contained philosophy
3. **Support content-addressable portability** where `.lancedb` files travel with the PGC
4. **Handle ~36 MB storage efficiently** with minimal overhead
5. **Integrate seamlessly** with Apache Arrow columnar storage

The choice of vector database is architectural—it determines whether the PGC is truly self-contained or requires external infrastructure.

## Decision

We chose **LanceDB v0.22.2** as the serverless vector database for all overlay vector storage.

**Implementation Details:**

- Storage location: `.open_cognition/patterns.lancedb/`
- Vector dimensions: 768 (EmbeddingGemma-300M model)
- Distance metrics: Cosine (default), L2, Dot product
- Index type: HNSW (Hierarchical Navigable Small World)
- Schema: Apache Arrow with dual embedding support (structural + semantic)

**Code Reference:** `src/core/overlays/vector-db/lance-store.ts`

## Alternatives Considered

### Option 1: Pinecone (Cloud-Hosted)

- **Pros**: Production-ready, managed infrastructure, excellent documentation
- **Cons**:
  - Requires internet connectivity (violates offline-first principle)
  - Data sent to third-party servers (privacy concern)
  - 10-100ms network latency vs. sub-millisecond local queries
  - Costs scale with usage (not free for local compute)
  - `.lancedb` files cannot travel with PGC (requires migration scripts)
- **Why rejected**: Incompatible with PGC's self-contained, portable knowledge pool philosophy

### Option 2: Weaviate (Self-Hosted Server)

- **Pros**: Open source, supports multiple embedding models, GraphQL API
- **Cons**:
  - Requires server deployment (infrastructure overhead)
  - Not serverless—needs Docker or Kubernetes
  - Network latency even for local deployments
  - Complex setup for simple use case
- **Why rejected**: Too heavyweight for embedded use case; violates simplicity principle

### Option 3: Qdrant (Self-Hosted or Cloud)

- **Pros**: High performance, Rust-based, good API
- **Cons**:
  - Requires server (embedded mode exists but not mature at decision time)
  - Network overhead for queries
  - Additional dependency management
- **Why rejected**: Server requirement incompatible with serverless PGC architecture

### Option 4: Chroma (Embedded Vector DB)

- **Pros**: Python-based, simple API, embedded mode
- **Cons**:
  - Python dependency (Cognition CLI is TypeScript/Node.js)
  - Less mature than LanceDB at decision time
  - Storage format not as battle-tested as Apache Arrow
- **Why rejected**: Language mismatch and less mature ecosystem

### Option 5: FAISS (Facebook AI Similarity Search)

- **Pros**: Extremely fast, widely used, no server required
- **Cons**:
  - Low-level C++ library (complex integration)
  - No built-in persistence layer (requires custom implementation)
  - No metadata support (would need separate storage)
  - Manual index management
- **Why rejected**: Too low-level; would require building entire storage layer ourselves

## Rationale

LanceDB was chosen because it uniquely satisfies all requirements:

1. **Serverless Architecture**
   - Embedded directly in the CLI application
   - No separate server process required
   - Zero infrastructure overhead

2. **Offline-First by Design**
   - All data stored locally in `.lancedb` files
   - No network dependency for queries
   - Query latency: ~5ms (vs. 10-100ms for network-based solutions)

3. **Portable Knowledge Pool**
   - `.lancedb` files can be copied, versioned, and shared
   - Entire PGC (including vectors) travels as a unit
   - No migration scripts needed—just copy the directory

4. **Apache Arrow Foundation**
   - Zero-copy data access
   - Columnar storage for efficient compression (~70% reduction)
   - Industry-standard format with broad tooling support

5. **Performance Characteristics**
   - Cold start: ~137 minutes to generate 4,106 embeddings (limited by Workbench API rate, not LanceDB)
   - Hot path: ~206ms total query time (200ms embedding + 5ms vector search + 1ms ranking)
   - Storage: 122 MB raw → ~36 MB on disk

6. **Advanced Features**
   - `mergeInsert` for efficient upserts (no version bloat)
   - Multi-distance type support (cosine, L2, dot product)
   - Automatic deduplication
   - SQL injection prevention with proper escaping

## Consequences

### Positive

- **Sub-millisecond local queries** enable interactive workflows
- **Zero cloud costs** for vector storage and queries
- **Privacy by design** - data never leaves the machine
- **True portability** - entire knowledge graph in version control
- **Simplified deployment** - no server infrastructure required
- **Consistent performance** - no network variability

### Negative

- **No built-in replication** - must use file-system level sync for backups
- **Single-machine scale** - cannot distribute across cluster (acceptable for per-project use case)
- **TypeScript bindings maturity** - LanceDB is newer than Python alternatives
- **Storage overhead** - ~36 MB per 32K LOC (acceptable for modern systems)

### Neutral

- **Apache Arrow dependency** - adds to bundle size but provides zero-copy benefits
- **Version compatibility** - tied to LanceDB releases (currently v0.22.2)
- **Index rebuilding** - HNSW index must be rebuilt if LanceDB version changes significantly

## Evidence

### Code Implementation

- Core implementation: `src/core/overlays/vector-db/lance-store.ts:1-310`
- Test coverage: `src/core/overlays/vector-db/__tests__/lance-store.test.ts:1-310`
- Schema definition: `lance-store.ts:70-88` (VECTOR_RECORD_SCHEMA with Apache Arrow types)

### Documentation

- Embeddings architecture: `docs/manual/part-1-foundation/04-embeddings.md:161-174`
- Query performance: `docs/05_Querying_The_Lattice.md` (performance benchmarks)
- Lattice integration: `docs/02_Core_Infrastructure.md` (LanceVectorStore role)

### Dependencies

- Package: `@lancedb/lancedb@^0.22.2` (package.json)
- Apache Arrow: Implicit dependency via LanceDB

### Comparative Table from Documentation

| Feature         | LanceDB                        | Alternatives (Pinecone, Weaviate)  |
| --------------- | ------------------------------ | ---------------------------------- |
| **Deployment**  | Embedded (no server)           | Cloud-hosted or self-hosted server |
| **Storage**     | Local filesystem               | Remote database                    |
| **Latency**     | Sub-millisecond (local)        | 10-100ms (network RTT)             |
| **Portability** | .lancedb files travel with PGC | Requires migration scripts         |
| **Cost**        | Free (local compute)           | Pay per query/storage              |
| **Privacy**     | Data never leaves machine      | Data sent to third-party servers   |

## Notes

**Design Philosophy Alignment:**
From `docs/manual/part-1-foundation/04-embeddings.md`:

> "LanceDB's serverless architecture aligns perfectly with PGC's 'self-contained knowledge pool' philosophy."

**Future Considerations:**

- If multi-machine distribution becomes required, consider LanceDB Cloud or hybrid approach
- Monitor LanceDB TypeScript binding maturity for API changes
- Evaluate storage compression improvements as LanceDB evolves

**Related Decisions:**

- ADR-003 (Shadow Embeddings) - Builds on LanceDB's dual vector storage capability
- ADR-008 (Session Continuity) - Uses LanceDB for conversation lattice storage
- ADR-010 (Workbench Integration) - External API generates embeddings, LanceDB stores them locally
