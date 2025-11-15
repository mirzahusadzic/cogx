# ADR-010: Workbench API Integration (Optional External Service)

**Date**: Circa 2024
**Status**: Accepted
**Deciders**: Core team

## Context

The Cognition CLI needs specialized AI inference capabilities:

1. **Embedding generation** - Convert text to 768-dimensional semantic vectors
2. **AST parsing** - Parse Python and other languages (TypeScript/JavaScript native)
3. **Summarization** - LLM-based content compression
4. **Oracle validation** - Quality assessment for extracted patterns

These operations could be performed:
- **Locally** (on-device models, local GPU)
- **Externally** (API service, centralized infrastructure)

**Trade-offs:**

| Aspect | Local Models | External API |
|--------|--------------|--------------|
| **Setup** | Complex (GPU, model downloads) | Simple (API key) |
| **Privacy** | High (data never leaves machine) | Lower (data sent for inference) |
| **Performance** | Variable (GPU-dependent) | Consistent (dedicated infrastructure) |
| **Cost** | Hardware upfront | Pay-per-use |
| **Portability** | Requires local GPU | Works anywhere |
| **Consistency** | Model version varies | Centralized model version |

We needed an architecture that balances **user autonomy** (local-first philosophy) with **practical accessibility** (not everyone has GPUs).

## Decision

We implemented **optional external Workbench API** with fallback layers and local-first defaults:

**Architecture:**

1. **Default Mode**: Local-only where possible
2. **Optional External**: Workbench API for specialized inference
3. **User Control**: Users choose workbench deployment via `WORKBENCH_URL`
4. **Layered Fallback**: Native → Remote → SLM → LLM (decreasing fidelity)

**Configuration:**
```bash
# Environment variables
WORKBENCH_URL=http://localhost:8000      # Default (local deployment)
WORKBENCH_API_KEY=...                     # Required for API operations

# CLI usage
cognition-cli tui --workbench http://localhost:8000
```

**Workbench Capabilities:**
- **Embeddings**: `POST /embed` (768D vectors via google/embeddinggemma-300m)
- **AST Parsing**: `POST /ast/parse` (Python, Go, etc.)
- **Summarization**: `POST /summarize` (LLM-based compression)

**Storage:** Vectors stored locally in LanceDB (`.open_cognition/patterns.lancedb/`)

**Code Reference:** `src/core/executors/workbench-client.ts`

## Alternatives Considered

### Option 1: All-Local (No External API)
- **Pros**: Maximum privacy, no network dependency, no API costs
- **Cons**:
  - Requires GPU for embeddings (excludes many users)
  - Model downloads (10+ GB for embedding models)
  - Inconsistent results (model versions vary)
  - Complex setup (CUDA, model management)
  - Slower on CPU-only machines
- **Why rejected**: Accessibility barrier too high; not everyone has GPUs

### Option 2: Mandatory External API (No Local Option)
- **Pros**: Simple deployment, consistent results, no GPU needed
- **Cons**:
  - Violates offline-first principle
  - Privacy concerns (all data sent to API)
  - Network dependency (no offline usage)
  - Vendor lock-in (tied to specific API)
  - Cost scales with usage
- **Why rejected**: Violates user autonomy and privacy principles

### Option 3: Cloud-Only (Managed Service)
- **Pros**: Zero setup, always available, scalable
- **Cons**:
  - No local deployment option
  - Data must leave machine
  - Cannot audit backend
  - Vendor lock-in
  - Ongoing costs
- **Why rejected**: Incompatible with self-contained PGC philosophy

### Option 4: Peer-to-Peer Inference (Distributed)
- **Pros**: Decentralized, community-powered
- **Cons**:
  - Complex coordination (peer discovery, load balancing)
  - Variable performance (peer availability)
  - Security risks (malicious peers)
  - Inconsistent results (different model versions)
- **Why rejected**: Too complex; reliability issues

### Option 5: Browser-Based Models (WASM/WebGL)
- **Pros**: No server needed, runs in browser
- **Cons**:
  - Limited model size (cannot run 300M+ models)
  - Poor performance (JavaScript inference slow)
  - Not CLI-compatible (requires browser)
  - Quantization quality loss
- **Why rejected**: Performance and size constraints

## Rationale

Optional external Workbench API was chosen because it balances accessibility with user autonomy:

### 1. No GPU Required (Accessibility)

**From embeddings documentation (`docs/manual/part-1-foundation/04-embeddings.md`)**:
> "LanceDB is a serverless vector database built on Apache Arrow. The workbench handles GPU inference, eliminating hardware dependencies."

**User Experience:**
```bash
# No GPU? No problem.
$ export WORKBENCH_URL=http://localhost:8000
$ cognition-cli genesis src/
```

Workbench handles GPU inference remotely.

### 2. Consistent Embeddings (Reproducibility)

**From documentation:**
> "Consistent embeddings: Same model version across all users ensures reproducibility"

**Problem Solved:**
- Local models: User A (v1.0) vs. User B (v1.1) → incompatible vectors
- Workbench: Everyone uses same model version → compatible vectors

**Result:** PGC files portable across users.

### 3. User Control (Autonomy)

**From DUAL_USE_MANDATE.md (lines 248-260)**:
```typescript
// DEFAULT: Local embeddings, local coherence computation
// OPTIONAL: Remote oracle validation (user must configure)

if (!process.env.WORKBENCH_URL) {
  console.log('Operating in local mode (no external validation)');
  console.log('To enable Oracle validation: export WORKBENCH_URL=...');
}
```

**Design Philosophy:** "Local Control Over Centralized Authority"
- System defaults to local-only
- External workbench **optional** - only for AI features
- Users choose workbench deployment (`localhost` vs. remote)

### 4. Layered Extraction (Graceful Degradation)

**From `structural.ts` (mining pipeline):**
```typescript
// Layer 1: Native AST parsers (TypeScript/JavaScript - NO API)
if (parser && parser.isNative) {
  return await parser.parse(file.content);  // Local parsing
}

// Layer 1b: Remote AST parser (Python - requires workbench)
if (parser && !parser.isNative) {
  return await this.workbench.parseAST({...});
}

// Layer 2: Fallback to SLM (specialized small language model)
const result = await this.slmExtractor.extract(file);

// Layer 3: LLM supervisor (full language model inference)
const result = await this.llmSupervisor.generateAndExecuteParser(file);
```

**Fidelity Scores:**
- Layer 1 (Native): 1.0 (deterministic AST)
- Layer 1b (Remote AST): 1.0 (same parser, remote)
- Layer 2 (SLM): 0.85 (ML-based extraction)
- Layer 3 (LLM): 0.70 (highest uncertainty)

**Result:** TypeScript/JavaScript work offline; Python needs workbench.

### 5. Privacy by Design (Vectors Stay Local)

**From THREAT_MODEL.md:**
> "**Boundary 2: Network Isolation (Optional)**
> - Constraint: System can operate without network access
> - Enforcement: Local workbench deployment, no required cloud services
> - Exception: Optional workbench API for embedding/summarization"

**Privacy Architecture:**
- Embeddings generated remotely (text → vector via API)
- **Vectors stored locally** (LanceDB, never sent elsewhere)
- Raw code never sent (only signatures: "class:X | methods:5")

**Data Flow:**
```
Code → Signature ("class:UserService | methods:8")
     → Workbench API (embed signature)
     → 768D Vector
     → Store locally in LanceDB
```

### 6. Rate Limiting (Workbench Client)

**From `workbench-client.ts`:**
```typescript
export class WorkbenchClient {
  private embedQueue: Array<...> = [];
  private summarizeQueue: Array<...> = [];

  async embed(request: EmbedRequest): Promise<EmbedResponse> {
    return new Promise((resolve, reject) => {
      this.embedQueue.push({ request, resolve, reject });
      this.processEmbedQueue();  // Rate-limited processing
    });
  }
}
```

**Features:**
- Request queueing (prevent overwhelming API)
- Retry logic for 429 rate limit errors
- Configurable rate limits (per endpoint)

## Consequences

### Positive
- **No GPU required** - Accessible to all users
- **Consistent embeddings** - Same model version everywhere
- **User autonomy** - Choose workbench deployment (local vs. remote)
- **Privacy option** - Can run local workbench (data never leaves machine)
- **Graceful degradation** - Falls back to native parsers when possible
- **Portability** - PGC vectors compatible across users

### Negative
- **Network dependency** - External API requires internet (unless local workbench)
- **API costs** - Pay-per-use if using remote workbench
- **Latency** - 200ms network RTT vs. <1ms local inference
- **Vendor risk** - Tied to workbench API availability

### Neutral
- **Setup complexity** - Local workbench deployment requires Docker/configuration
- **Model versioning** - Must coordinate model updates across workbench deployments
- **Rate limits** - Must respect API rate limits (handled by client)

## Evidence

### Code Implementation
- Workbench client: `src/core/executors/workbench-client.ts:1-300`
- Mining pipeline: `src/core/orchestrators/miners/structural.ts:1-400`
- Configuration: `src/config.ts`

### Documentation
- Embeddings architecture: `docs/manual/part-1-foundation/04-embeddings.md:161-200`
- Dual-use mandate: `docs/DUAL_USE_MANDATE.md:248-260`
- Threat model: `docs/overlays/O2_security/THREAT_MODEL.md` (network isolation)

### Configuration
```typescript
// From config.ts
export const WORKBENCH_DEPENDENT_EXTRACTION_METHODS = [
  'ast_remote',    // Python AST parsing
  'slm',           // Specialized language model
  'llm_supervised' // Full LLM inference
];

export const DEFAULT_WORKBENCH_URL = 'http://localhost:8000';
```

### Environment Variables
```bash
# From src/commands/*.ts
const workbenchUrl = process.env.WORKBENCH_URL || 'http://localhost:8000';
const workbenchApiKey = process.env.WORKBENCH_API_KEY || '';
```

### Privacy Guarantees
From `DUAL_USE_MANDATE.md`:
> "**Local Control Over Centralized Authority:**
> - System defaults to local-only operation
> - External workbench is **optional** - only required for AI features
> - Users can choose which workbench to use via `WORKBENCH_URL`"

## Notes

**Why "Workbench" Instead of Generic "API"?**

"Workbench" implies:
- Tool for work (not black box service)
- User-deployable (not cloud-only)
- Specialized capabilities (embeddings, parsing)
- Optional augmentation (not core requirement)

**Model Choice (EmbeddingGemma-300M):**

From embeddings documentation:
- **Model:** `google/embeddinggemma-300m`
- **Dimensions:** 768 (industry standard)
- **Performance:** Balanced size/quality trade-off
- **Compatibility:** Works with LanceDB constraints

**Local Workbench Deployment:**

Users can deploy own workbench:
```bash
# Docker deployment (hypothetical)
docker run -p 8000:8000 cogx/workbench:latest
export WORKBENCH_URL=http://localhost:8000
```

**Result:** Complete privacy (data never leaves machine).

**Comparison Table:**

| Feature | Local Workbench | Remote Workbench |
|---------|----------------|------------------|
| **Privacy** | High (data stays local) | Lower (data sent to API) |
| **Setup** | Complex (Docker, GPU) | Simple (API key) |
| **Cost** | Hardware upfront | Pay-per-use |
| **Latency** | ~5ms (local) | ~200ms (network) |
| **Availability** | Depends on local machine | Depends on service uptime |

**Future Enhancements:**
- Client-side embedding models (ONNX, TensorFlow.js)
- Model caching (download once, run locally)
- Hybrid mode (local for TS/JS, remote for others)
- P2P workbench sharing (community-powered)

**Related Decisions:**
- ADR-001 (LanceDB) - Stores workbench-generated vectors locally
- ADR-003 (Shadow Embeddings) - Workbench generates dual embeddings
- ADR-006 (Compression) - Workbench generates embeddings for importance scoring
- ADR-008 (Session Continuity) - Workbench embeddings enable semantic search
