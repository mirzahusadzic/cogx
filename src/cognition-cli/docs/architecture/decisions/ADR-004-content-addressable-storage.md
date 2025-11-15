# ADR-004: Content-Addressable Storage with SHA-256

**Date**: Circa 2024
**Status**: Accepted
**Deciders**: Core team

## Context

The Grounded Context Pool (PGC) needs to store immutable knowledge artifacts (code structure, embeddings, mission concepts) with guarantees of:

1. **Data integrity** - Detect tampering or corruption
2. **Deduplication** - Don't store identical content multiple times
3. **Verifiable provenance** - Cryptographic proof of artifact lineage
4. **Efficient lookups** - O(1) access by hash
5. **Git-like portability** - PGC directories can be copied and versioned

Traditional file storage (path-based) fails these requirements because:

- File paths don't guarantee content integrity (files can be modified in place)
- No automatic deduplication (same content at different paths)
- No cryptographic verification (tampering undetectable)
- Path-based lookups don't scale for large knowledge graphs

We needed an immutable object store where **content = identity**.

## Decision

We implemented **content-addressable storage with SHA-256 hashing**, following Git's object store pattern:

**Architecture:**

```
.open_cognition/
└── objects/
    └── {first-2-chars}/      # Git-style sharding
        └── {remaining-62-chars}  # Object file
```

**Example:**

```
Hash: a3b5c7d9e1f2... (64 hex chars)
Path: .open_cognition/objects/a3/b5c7d9e1f2...
```

**Implementation:**

- Hash algorithm: **SHA-256** (64-character hex digest)
- Sharding: First 2 characters as directory (prevents deep nesting)
- Immutability: Objects never modified after creation
- Deduplication: `hash = computeHash(content)` → only write if not exists

**Code Reference:** `src/core/pgc/object-store.ts`

## Alternatives Considered

### Option 1: Path-Based Storage (Traditional Filesystem)

- **Pros**: Simple, familiar, no hashing overhead
- **Cons**:
  - No integrity verification (silent corruption undetected)
  - No automatic deduplication (duplicate content stored multiple times)
  - Path conflicts (same filename, different content)
  - No tamper detection (files modified in place)
- **Why rejected**: Cannot provide cryptographic truth guarantees

### Option 2: MD5 Hashing

- **Pros**: Faster than SHA-256 (128-bit vs. 256-bit)
- **Cons**:
  - Collision vulnerabilities (MD5 broken since 2004)
  - Not cryptographically secure (birthday attacks practical)
  - Poor security optics (widely considered obsolete)
- **Why rejected**: Security-critical application requires collision-resistant hash

### Option 3: SHA-1 Hashing (Git's Original Choice)

- **Pros**: Git compatibility, widely deployed, 160-bit
- **Cons**:
  - Collision attacks demonstrated (SHAttered, 2017)
  - Git itself transitioning to SHA-256
  - 160-bit provides weaker security margin than 256-bit
- **Why rejected**: SHA-1 deprecated for security-critical applications

### Option 4: SHA-512 Hashing

- **Pros**: Stronger security margin (512-bit), faster on 64-bit systems
- **Cons**:
  - Longer hash strings (128 hex chars vs. 64)
  - Filesystem path length limits (256 chars typical)
  - Overkill for current threat model
  - Harder to display/communicate hashes
- **Why rejected**: SHA-256 provides sufficient security with better UX

### Option 5: Content-Addressable Database (IPFS, Dat)

- **Pros**: Distributed architecture, network effects, existing implementations
- **Cons**:
  - External dependency (IPFS daemon required)
  - Network overhead even for local operations
  - Complexity (peer discovery, DHT, etc.)
  - Not aligned with offline-first principle
- **Why rejected**: Too heavyweight for local-first use case

## Rationale

SHA-256 content-addressable storage was chosen because it uniquely satisfies all requirements:

### 1. Cryptographic Integrity

**From SECURITY.md**:

> "All objects are SHA-256 content-addressed. Tampering with the PGC will be detected. Fidelity scores cannot be forged without detection."

**Guarantees:**

- **Collision resistance**: 2^256 hash space (practically impossible to find two contents with same hash)
- **Tamper detection**: Any modification changes hash instantly
- **Verification**: `hash(stored_content) === object_id` proves integrity

### 2. Automatic Deduplication

**From README.md (lines 630-632)**:

> "We first considered simply replicating source files, but realized this was inefficient. The pragmatic solution was to create a content-addressable store, like Git's, for all unique pieces of knowledge. The content of every GKe is stored here once, named by its own cryptographic `hash`. This guarantees absolute data integrity and deduplication."

**Efficiency:**

```typescript
// src/core/pgc/object-store.ts
async store(content: string | Buffer): Promise<string> {
  const hash = this.computeHash(content);
  const objectPath = this.getObjectPath(hash);

  // Deduplication: don't write if already exists
  if (existsSync(objectPath)) {
    return hash;  // Return existing hash
  }

  // Write only if new content
  await fs.mkdir(path.dirname(objectPath), { recursive: true });
  await fs.writeFile(objectPath, content);
  return hash;
}
```

### 3. Git-Style Sharding for Performance

**Implementation:**

```typescript
private getObjectPath(hash: string): string {
  const dir = hash.slice(0, 2);   // First 2 chars
  const file = hash.slice(2);     // Remaining 62 chars
  return path.join(this.rootPath, 'objects', dir, file);
}
```

**Why Sharding:**

- Prevents deep directory trees (256 dirs max vs. 2^256 files in one dir)
- Filesystem performance: O(log n) lookups instead of O(n) scans
- Matches Git's battle-tested approach
- Standard practice (Git, Mercurial, IPFS all use similar sharding)

### 4. Immutable Audit Trail

**From transparency-log.ts and mission-integrity.ts:**

- All mission document versions tracked with content hashes
- Append-only logs prevent evidence erasure
- Provenance chains enable forensic investigation
- "Rewind" capability to previous states

### 5. Alignment with Mission (Cryptographic Truth)

**From VISION.md (lines 50-53)**:

> "1. **AI reasoning is cryptographically provable** — Every claim backed by content-addressable hashes 2. **Human cognition is augmented, not replaced** — AI provides verified context, human provides judgment"

SHA-256 hashing enables **verifiable truth** rather than statistical approximation.

## Consequences

### Positive

- **Tamper detection** - Any modification breaks hash (mathematically guaranteed)
- **Deduplication** - Same content stored once (storage efficiency)
- **Integrity verification** - `hash(content) === id` proves correctness
- **Immutable provenance** - Content hashes form cryptographic chains
- **Forensic capability** - Audit trail cannot be erased
- **Git compatibility** - Similar architecture enables future integrations
- **Portable PGC** - Content-addressable means location-independent

### Negative

- **Storage overhead** - Small files incur directory structure cost
- **No in-place updates** - Must create new object even for tiny changes
- **Hash computation cost** - SHA-256 adds CPU overhead (acceptable)
- **Filename opacity** - Hash-based names not human-readable (by design)
- **Garbage collection needed** - Unused objects accumulate (future work)

### Neutral

- **256-bit security** - Overkill for current threats but future-proof
- **64-character hashes** - Longer than MD5/SHA-1 but still manageable
- **Sharding depth** - 2-char prefix is optimization, not fundamental requirement

## Evidence

### Code Implementation

- Object store: `src/core/pgc/object-store.ts:1-150`
- Test coverage: `src/core/pgc/__tests__/object-store.test.ts`
- Mission integrity: `src/core/security/mission-integrity.ts:33-49`
- Transparency log: `src/core/security/transparency-log.ts`

### Test Validation

From `object-store.test.ts`:

```typescript
// 1. Deterministic hashing
const expectedHash = crypto.createHash('sha256').update(content).digest('hex');
expect(hash).toBe(expectedHash);

// 2. Git-style sharding
const dirToCheck = `/test-pgc/objects/${hash.slice(0, 2)}`;
const files = vol.readdirSync(dirToCheck);
expect(files).toContain(hash.slice(2));

// 3. Deduplication
const hash1 = await objectStore.store(content);
const hash2 = await objectStore.store(content);
expect(hash2).toBe(hash1); // Same hash, no duplicate writes
```

### Architectural Axiom

From `README.md:660`:

> **[1.1.3] Axiom of Hashing:** Let `hash(content)` be a deterministic cryptographic hash function (e.g., SHA256).

### Security Rationale

From `SECURITY.md:78-83`:

> "All objects are SHA-256 content-addressed. Tampering with the PGC will be detected. Fidelity scores cannot be forged without detection."

## Notes

**Why Not Blockchain?**

Content-addressable storage provides cryptographic integrity without blockchain overhead:

- No distributed consensus required (single-machine PGC)
- No mining or proof-of-work (instant writes)
- No network latency (local filesystem)
- Simpler security model (no 51% attacks)

**Git Comparison:**

| Feature      | Git                              | PGC Object Store       |
| ------------ | -------------------------------- | ---------------------- |
| Hash         | SHA-1 (transitioning to SHA-256) | SHA-256                |
| Sharding     | 2-char prefix                    | 2-char prefix          |
| Compression  | zlib                             | None (JSON, plaintext) |
| Object types | blob, tree, commit, tag          | Single type            |

**Future Enhancements:**

- Garbage collection (remove unreferenced objects)
- Compression (zlib for large objects)
- Object packing (combine small objects)
- Remote replication (rsync-style sync)

**Related Decisions:**

- ADR-007 (AGPLv3) - Transparency enabled by content-addressable architecture
- ADR-008 (Session Continuity) - Uses content hashing for session state
- ADR-009 (Quest System) - cPOW generation relies on hash-based provenance
