# Chapter 6: O₂ Security — Foundational Constraints

> **The Axiom Applied**: Security knowledge forms a sublattice where threat models meet mitigations at precise points of alignment. This is not metaphor—it's the mathematical structure that makes "Which attacks violate our principles?" a computable query.

**Part**: II — The Seven Layers
**Layer**: O₂ (Security)
**Role**: Foundational Constraints
**Knowledge Types**: 6 (threat_model, attack_vector, mitigation, boundary, constraint, vulnerability)

---

## Table of Contents

1. [Why O₂ Is Foundational](#why-o₂-is-foundational)
2. [The Six Knowledge Types](#the-six-knowledge-types)
3. [SecurityGuidelinesManager Architecture](#securityguidelinesmanager-architecture)
4. [Document Classification and Routing](#document-classification-and-routing)
5. [Cross-Overlay Queries](#cross-overlay-queries)
6. [Dependency Security Inheritance](#dependency-security-inheritance)
7. [Real-World Examples](#real-world-examples)
8. [Implementation Deep Dive](#implementation-deep-dive)
9. [Common Pitfalls](#common-pitfalls)
10. [Performance Characteristics](#performance-characteristics)

---

## Why O₂ Is Foundational

O₂ Security occupies a unique position in the 7-layer architecture: **it's checked BEFORE mission alignment**.

### Layer Ordering (Revisited)

```text
O₁ (Structure)     → Code artifacts (AST, dependencies, symbols)
O₂ (Security)      → Threat models, mitigations, constraints [FOUNDATIONAL]
O₃ (Lineage)       → Dependency graph, blast radius, call chains
O₄ (Mission)       → Strategic vision, purpose, goals, principles
O₅ (Operational)   → Workflow patterns, quest structure, sacred sequences
O₆ (Mathematical)  → Theorems, proofs, lemmas, formal properties
O₇ (Coherence)     → Cross-layer alignment scoring
```

### Why Foundational?

**1. Universal Dependency**

- Every layer above (O₃-O₇) needs security context
- Mission principles (O₄) must not violate security constraints (O₂)
- Operational patterns (O₅) must respect security boundaries (O₂)

**2. Early Blocking**

- Security violations should block operations early (not late)
- No point aligning with mission if security is compromised
- Fail fast: Check O₂ before expensive operations

**3. Portability**

- Security knowledge can be inherited from dependencies
- `express.cogx` contains Express framework's known CVEs
- Your project imports `express.cogx` → inherits Express security knowledge

**4. Immutability**

- Security constraints are non-negotiable (unlike mission which evolves)
- Attack vectors don't change based on project goals
- Mitigations are universal (same XSS fix works everywhere)

### The Critical Distinction

**O₂ Security Overlay** ≠ Core Security Layer

| Aspect           | O₂ Security Overlay            | Core Security (`src/core/security/`) |
| ---------------- | ------------------------------ | ------------------------------------ |
| **Purpose**      | Store app security knowledge   | Protect the lattice itself           |
| **Scope**        | Application vulnerabilities    | Mission document integrity           |
| **Threat Model** | XSS, CSRF, SQL injection, etc. | Mission poisoning, drift attacks     |
| **Queryable**    | Yes (via lattice algebra)      | No (internal validation)             |
| **Portable**     | Yes (.cogx files)              | No (system infrastructure)           |
| **Integration**  | Query commands                 | Genesis command (validation gate)    |

**Analogy**:

- O₂ Security Overlay = Security documentation in the repository
- Core Security = Operating system firewall protecting the repository

**See Also**: [Core Security Architecture](../../architecture/SECURITY_CORE.md) for system-level protection details.

---

## The Six Knowledge Types

O₂ Security extracts 6 distinct knowledge types from security documents. Each type has specific detection patterns and serves a unique role in the security lattice.

### 1. Threat Model

**Definition**: High-level attack scenarios and threat actors.

**Purpose**: Describes WHO attacks, WHAT they target, and WHY.

**Detection Pattern**:

- Documents named `THREAT_MODEL.md`, `THREATS.md`
- Sections with headers containing "threat", "attacker", "adversary"
- Structured threat descriptions (actor, capability, motivation, target)

**Example**:

```markdown
## Threat: Mission Poisoning

**Attacker**: Malicious contributor with commit access
**Capability**: Can submit pull requests, influence code review
**Motivation**: Shift project toward attacker's goals
**Target**: VISION.md, mission concept embeddings
**Attack Method**: Submit series of "innocent" PRs that gradually drift mission
```

**Embedding Content**: Full threat description (actor + method + target)

**Metadata Fields**:

```typescript
{
  type: 'threat_model',
  text: '...',        // Full description
  context: '...',     // Surrounding paragraphs
  source_file: 'THREAT_MODEL.md',
  severity?: 'critical' | 'high' | 'medium' | 'low'
}
```

### 2. Attack Vector

**Definition**: Specific exploit methods and techniques.

**Purpose**: Describes HOW an attack is executed (tactical details).

**Detection Pattern**:

- Documents with "SECURITY.md", "VULNERABILITIES.md"
- Sections with "attack", "exploit", "vulnerability"
- References to CWE (Common Weakness Enumeration)
- CVE identifiers (CVE-YYYY-NNNNN)

**Example**:

```markdown
## Attack: SQL Injection via User Input

**Method**: Attacker supplies malicious SQL in username field
**Payload**: `admin' OR '1'='1' --`
**Target**: User authentication query
**Impact**: Bypass authentication, access all accounts
**CWE**: CWE-89 (SQL Injection)
```

**Embedding Content**: Attack method + payload + target

**Metadata Fields**:

```typescript
{
  type: 'attack_vector',
  text: '...',
  context: '...',
  source_file: 'SECURITY.md',
  cwe?: 'CWE-89',
  cve?: 'CVE-2024-12345',
  cvss_score?: 9.8
}
```

### 3. Mitigation

**Definition**: Countermeasures and defenses against attacks.

**Purpose**: Describes HOW to prevent or remediate vulnerabilities.

**Detection Pattern**:

- Sections with "mitigation", "defense", "fix", "remediation"
- Code blocks showing secure patterns
- References to security libraries/frameworks

**Example**:

````markdown
## Mitigation: Use Parameterized Queries

**Problem**: SQL injection via string concatenation
**Solution**: Use parameterized queries with bound parameters

```typescript
// ❌ Vulnerable
const query = `SELECT * FROM users WHERE id = ${userId}`;

// ✅ Secure
const query = 'SELECT * FROM users WHERE id = ?';
db.execute(query, [userId]);
```
````

**Libraries**: `pg`, `mysql2` (Node.js)
**References**: OWASP SQL Injection Prevention Cheat Sheet

````

**Embedding Content**: Problem + solution + code example

**Metadata Fields**:
```typescript
{
  type: 'mitigation',
  text: '...',
  context: '...',
  source_file: 'SECURITY.md',
  addresses_cwe?: 'CWE-89',
  addresses_cve?: 'CVE-2024-12345',
  effectiveness: 'high' | 'medium' | 'low'
}
````

### 4. Boundary

**Definition**: Security boundaries and trust zones.

**Purpose**: Defines WHERE security checks must occur (perimeters).

**Detection Pattern**:

- Sections with "boundary", "trust zone", "security perimeter"
- Diagrams showing data flow across boundaries
- References to "trusted/untrusted", "internal/external"

**Example**:

```markdown
## Security Boundary: API Gateway

**Boundary**: All external requests pass through API gateway
**Trust Zones**:

- External: User browsers, mobile apps (UNTRUSTED)
- API Gateway: Authentication + validation (TRANSITION)
- Internal Services: Business logic (TRUSTED)

**Enforcement**:

- All requests validated at gateway (JWT, rate limiting)
- Internal services assume pre-validated input
- No direct external access to internal services
```

**Embedding Content**: Boundary description + trust zones + enforcement

**Metadata Fields**:

```typescript
{
  type: 'boundary',
  text: '...',
  context: '...',
  source_file: 'ARCHITECTURE.md',
  enforced_at: 'api_gateway',
  trust_levels: ['untrusted', 'transition', 'trusted']
}
```

### 5. Constraint

**Definition**: Security requirements and policies (must/must not).

**Purpose**: Defines non-negotiable security rules.

**Detection Pattern**:

- Imperative language: "must", "must not", "never", "always"
- Policy statements: "required", "forbidden", "mandatory"
- Compliance references: GDPR, HIPAA, PCI-DSS

**Example**:

```markdown
## Security Constraints

**Authentication**:

- MUST require authentication for all non-public endpoints
- MUST use JWT tokens with expiration (max 1 hour)
- MUST NOT store passwords in plaintext
- MUST hash passwords with bcrypt (cost factor ≥ 12)

**Data Protection**:

- MUST encrypt sensitive data at rest (AES-256)
- MUST use TLS 1.3 for data in transit
- MUST NOT log passwords, tokens, or PII

**Compliance**: GDPR Article 32 (Security of Processing)
```

**Embedding Content**: Full constraint statement

**Metadata Fields**:

```typescript
{
  type: 'constraint',
  text: '...',
  context: '...',
  source_file: 'SECURITY_POLICY.md',
  imperative: 'must' | 'must_not' | 'should' | 'should_not',
  compliance?: 'GDPR' | 'HIPAA' | 'PCI-DSS' | 'SOC2'
}
```

### 6. Vulnerability

**Definition**: Known security issues, CVEs, and their status.

**Purpose**: Tracks discovered vulnerabilities and remediation progress.

**Detection Pattern**:

- CVE identifiers (CVE-YYYY-NNNNN)
- Vulnerability databases (NVD, GitHub Security Advisories)
- Status indicators: "fixed", "mitigated", "open", "wontfix"

**Example**:

```markdown
## Known Vulnerabilities

### CVE-2024-12345: ReDoS in Email Validator

**Status**: ✅ Fixed in v2.1.0
**Severity**: High (CVSS 7.5)
**Affected**: Versions 1.x - 2.0.x
**Description**: Regular expression in email validation vulnerable to ReDoS
**Mitigation**: Upgrade to v2.1.0 or use alternative validator
**Fixed**: Replaced regex with iterative parser (PR #123)
**References**: https://nvd.nist.gov/vuln/detail/CVE-2024-12345
```

**Embedding Content**: CVE description + mitigation + fix

**Metadata Fields**:

```typescript
{
  type: 'vulnerability',
  text: '...',
  context: '...',
  source_file: 'VULNERABILITIES.md',
  cve: 'CVE-2024-12345',
  status: 'fixed' | 'mitigated' | 'open' | 'wontfix',
  severity: 'critical' | 'high' | 'medium' | 'low',
  cvss_score: 7.5,
  fixed_in?: '2.1.0',
  affected_versions?: '1.x - 2.0.x'
}
```

---

## SecurityGuidelinesManager Architecture

### Class Overview

```typescript
/**
 * SecurityGuidelinesManager
 *
 * Manages security guideline overlays in the PGC (O₂ layer - foundational).
 * Stores extracted security knowledge from security documents.
 *
 * LOCATION: src/core/overlays/security-guidelines/manager.ts
 *
 * OVERLAY STRUCTURE:
 * .open_cognition/overlays/security_guidelines/<doc-hash>.yaml
 */
export class SecurityGuidelinesManager {
  private overlayPath: string;
  private workbench: WorkbenchClient;

  constructor(pgcRoot: string, workbenchUrl?: string) {
    this.overlayPath = path.join(pgcRoot, 'overlays', 'security_guidelines');
    this.workbench = new WorkbenchClient(
      workbenchUrl || 'http://localhost:8000'
    );
  }

  // Core methods
  async generateOverlay(/* ... */): Promise<void>;
  async loadOverlay(
    documentHash: string
  ): Promise<SecurityGuidelinesOverlay | null>;
  async listOverlays(): Promise<string[]>;
  async queryKnowledge(
    queryText: string,
    topK?: number
  ): Promise<SecurityKnowledge[]>;
}
```

### Overlay Format

**Storage**: `.open_cognition/overlays/security_guidelines/<doc-hash>.yaml`

**Structure**:

```yaml
document_hash: abc123def456...
document_path: docs/SECURITY.md
generated_at: '2025-10-30T12:00:00Z'
transform_id: genesis_doc_transform_v1
source_project: my-app
source_commit: a1b2c3d4

extracted_knowledge:
  - type: threat_model
    text: 'Mission Poisoning: Attacker submits series of PRs...'
    context: "## Threat Model\n\nOur primary concern is..."
    source_file: SECURITY.md
    severity: critical
    embedding: [0.123, 0.456, ..., 0.789] # 768 dimensions

  - type: attack_vector
    text: 'SQL Injection via user input in login form'
    context: "### Attack Vectors\n\n1. SQL Injection..."
    source_file: SECURITY.md
    cwe: CWE-89
    cvss_score: 9.8
    embedding: [0.234, 0.567, ..., 0.890]

  - type: mitigation
    text: 'Use parameterized queries with bound parameters'
    context: "## Mitigations\n\nFor SQL injection..."
    source_file: SECURITY.md
    addresses_cwe: CWE-89
    effectiveness: high
    embedding: [0.345, 0.678, ..., 0.901]
```

### Embedding Generation

**Algorithm**:

```typescript
async generateEmbeddings(knowledge: SecurityKnowledge[]): Promise<SecurityKnowledge[]> {
  const results: SecurityKnowledge[] = [];

  for (const item of knowledge) {
    // 1. Sanitize text (remove Unicode, special chars)
    const sanitized = this.sanitizeForEmbedding(item.text);

    // 2. Call eGemma for embedding
    const response = await this.workbench.embed({
      signature: sanitized,
      dimensions: 768,
    });

    // 3. Validate embedding (must be 768 dimensions)
    const embedding = response['embedding_768d'];
    if (!embedding || embedding.length !== 768) {
      console.warn(`Invalid embedding for: ${item.text.substring(0, 50)}...`);
      continue;
    }

    // 4. Attach embedding to knowledge item
    results.push({ ...item, embedding });
  }

  return results;
}
```

**Sanitization Rules**:

- Replace smart quotes with ASCII quotes
- Replace em-dash with hyphen
- Replace bullets with asterisk
- Replace arrows with `->`
- Remove all non-ASCII characters (except whitespace)

**Why Sanitize?**

- eGemma embedding models expect clean ASCII text
- Unicode characters can cause encoding issues
- Ensures consistent embedding quality

### Query Interface

```typescript
/**
 * Query security knowledge by semantic similarity
 *
 * @param queryText - Natural language query
 * @param topK - Number of results (default: 5)
 * @returns Security knowledge items ranked by similarity
 */
async queryKnowledge(
  queryText: string,
  topK: number = 5
): Promise<Array<{ item: SecurityKnowledge; similarity: number }>> {
  // 1. Generate query embedding
  const queryEmbedding = await this.workbench.embed({
    signature: queryText,
    dimensions: 768,
  });

  // 2. Load all overlays
  const overlays = await this.listOverlays();
  const allKnowledge: SecurityKnowledge[] = [];

  for (const hash of overlays) {
    const overlay = await this.loadOverlay(hash);
    if (overlay) {
      allKnowledge.push(...overlay.extracted_knowledge);
    }
  }

  // 3. Compute cosine similarity for each item
  const results = allKnowledge.map((item) => ({
    item,
    similarity: this.cosineSimilarity(queryEmbedding, item.embedding!),
  }));

  // 4. Sort by similarity (descending) and return top K
  return results
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK);
}
```

**Example Queries**:

```typescript
// Find mitigations for SQL injection
const results = await manager.queryKnowledge('prevent SQL injection', 5);

// Find threat models related to authentication
const threats = await manager.queryKnowledge('authentication attacks', 10);

// Find constraints for data encryption
const constraints = await manager.queryKnowledge('encryption requirements', 5);
```

---

## Document Classification and Routing

### Phase 2 Integration

As part of the multi-overlay architecture (Phase 2), the genesis command routes security documents to O₂:

```typescript
// In GenesisDocTransform (src/core/transforms/genesis-doc-transform.ts)

async routeToOverlays(
  classification: { type: DocumentType; confidence: number },
  ast: MarkdownDocument,
  filePath: string,
  contentHash: string,
  objectHash: string
): Promise<void> {
  switch (classification.type) {
    case DocumentType.SECURITY:
      await this.generateSecurityOverlay(ast, contentHash, objectHash, filePath);
      break;
    // ... other cases
  }
}

async generateSecurityOverlay(
  ast: MarkdownDocument,
  contentHash: string,
  objectHash: string,
  relativePath: string
): Promise<void> {
  // 1. Extract security knowledge from AST
  const extractor = new DocumentExtractor();
  const knowledge = extractor.extractSecurity(ast, relativePath);

  if (knowledge.length === 0) {
    return; // No security knowledge found
  }

  // 2. Generate overlay via SecurityGuidelinesManager
  const manager = new SecurityGuidelinesManager(this.pgcRoot, this.workbenchUrl);
  await manager.generateOverlay(
    relativePath,
    contentHash,
    knowledge,
    this.getTransformId(),
    undefined, // source_project (for imports)
    await this.getGitCommitHash() // provenance
  );
}
```

### Document Classification

**Classifier** (`src/core/analyzers/document-classifier.ts`):

```typescript
enum DocumentType {
  STRATEGIC = 'strategic', // Mission, vision, principles
  OPERATIONAL = 'operational', // Workflows, quest structure
  SECURITY = 'security', // Threat models, vulnerabilities ← O₂
  MATHEMATICAL = 'mathematical', // Theorems, proofs
  TECHNICAL = 'technical', // API docs, architecture (generic)
}
```

**Security Classification Signals**:

- Filename: `SECURITY.md`, `THREAT_MODEL.md`, `VULNERABILITIES.md`
- Headers: "Security", "Threat", "Attack", "Vulnerability", "Mitigation"
- Keywords: CVE, CWE, CVSS, OWASP
- Imperative language: "must not expose", "always validate"

---

## Cross-Overlay Queries

O₂ Security becomes powerful when combined with other overlays via lattice algebra.

### Example 1: Which Attacks Violate Our Principles?

**Query**: `O2[attack_vector] ~ O4[principle]`

**Meaning**: Find attack vectors (O₂) that semantically align with mission principles (O₄)

**Use Case**: Identify attacks that contradict our core values

```bash
# CLI
cognition-cli lattice "O2[attack_vector] ~ O4[principle]" --threshold 0.75

# Output:
# ┌─────────────────────────────────────────────────────────────┐
# │ Attack: SQL Injection via user input                        │
# │ Violates Principle: "Trust nothing, verify everything"      │
# │ Similarity: 0.82                                            │
# │                                                             │
# │ Explanation: Attack exploits lack of input validation,      │
# │ contradicts our principle of verifying all external input.  │
# └─────────────────────────────────────────────────────────────┘
```

**TypeScript**:

```typescript
import { meet } from './core/algebra/lattice-operations.js';
import { OverlayRegistry } from './core/algebra/overlay-registry.js';

const registry = new OverlayRegistry(pgcRoot, workbenchUrl);
const security = await registry.get('O2');
const mission = await registry.get('O4');

// Get attack vectors and principles
const attacks = await security.getItemsByType('attack_vector');
const principles = await mission.getItemsByType('principle');

// Find alignment
const violations = await meet(attacks, principles, { threshold: 0.75 });

for (const { itemA, itemB, similarity } of violations) {
  console.log(`Attack: ${itemA.metadata.text}`);
  console.log(`Violates: ${itemB.metadata.text}`);
  console.log(`Similarity: ${similarity.toFixed(2)}\n`);
}
```

### Example 2: Security Coverage Gaps

**Query**: `O1[symbols] - O2[symbols]`

**Meaning**: Which code symbols (O₁) lack security guidelines (O₂)?

**Use Case**: Find functions/classes without documented security considerations

```bash
cognition-cli lattice "O1 - O2" --format gaps

# Output:
# Security Coverage Gaps:
#
# ❌ handleUserInput (src/api/handlers.ts:45)
#    No security guidelines found
#
# ❌ executeQuery (src/db/query.ts:89)
#    No security guidelines found
#
# ❌ sanitizeFilePath (src/utils/files.ts:23)
#    No security guidelines found
#
# Coverage: 67% (200/300 symbols have security guidelines)
```

**TypeScript**:

```typescript
import { symbolDifference } from './core/algebra/lattice-operations.js';

const structural = await registry.get('O1');
const security = await registry.get('O2');

// Get symbol sets
const codeSymbols = await structural.getSymbolSet();
const secureSymbols = await security.getSymbolSet();

// Find gaps
const gaps = symbolDifference(codeSymbols, secureSymbols);

console.log(`${gaps.size} symbols lack security coverage:`);
for (const symbol of gaps) {
  console.log(`- ${symbol}`);
}
```

### Example 3: Mitigations for Specific Code

**Query**: `O1[symbol=handleLogin] -> O2[mitigation]`

**Meaning**: Given code symbol (O₁), project to security mitigations (O₂)

**Use Case**: Find applicable security mitigations for a specific function

```bash
cognition-cli lattice "O1[handleLogin] -> O2[mitigation]"

# Output:
# Mitigations for handleLogin:
#
# 1. Use bcrypt for password hashing (similarity: 0.89)
# 2. Implement rate limiting on login endpoint (similarity: 0.85)
# 3. Validate JWT tokens on every request (similarity: 0.78)
# 4. Use HTTPS for all authentication flows (similarity: 0.72)
```

**TypeScript**:

```typescript
import { project } from './core/algebra/lattice-operations.js';

// Get specific function from O1
const loginHandler = await structural.filter((m) => m.symbol === 'handleLogin');

// Get all mitigations from O2
const mitigations = await security.getItemsByType('mitigation');

// Project login handler to mitigations
const applicable = await project(
  'authentication login password',
  loginHandler,
  mitigations,
  { threshold: 0.7 }
);
```

### Example 4: Operational Patterns That Ensure Security

**Query**: `O5[workflow_pattern] ~ O2[boundary]`

**Meaning**: Which workflow patterns (O₅) align with security boundaries (O₂)?

**Use Case**: Find operational patterns that respect security boundaries

```bash
cognition-cli lattice "O5[workflow_pattern] ~ O2[boundary]" --threshold 0.7

# Output:
# Workflow: "External API Request Flow"
# Respects Boundary: "API Gateway validates all external input"
# Similarity: 0.84
#
# Explanation: Workflow explicitly routes through API gateway,
# ensuring all external requests are validated at boundary.
```

---

## Dependency Security Inheritance

### The .cogx Format

O₂ Security overlays can be exported as `.cogx` files and imported by dependent projects.

**Use Case**: Express framework exports its known CVEs, your project imports them.

#### Export

```bash
# In express repository
cognition-cli export express-security.cogx --overlay O2

# Creates: express-security.cogx (contains all O₂ security knowledge)
```

**File Format**:

```yaml
format_version: '1.0'
overlay_type: O2_security
project_name: express
project_version: 4.18.2
git_commit: a1b2c3d4e5f6
exported_at: '2025-10-30T12:00:00Z'

knowledge:
  - type: vulnerability
    text: 'CVE-2024-12345: ReDoS in parameter parsing'
    cve: CVE-2024-12345
    status: fixed
    fixed_in: 4.18.3
    embedding: [0.123, ..., 0.789]

  - type: mitigation
    text: 'Always validate Content-Type header'
    addresses_cve: CVE-2024-12345
    embedding: [0.234, ..., 0.890]

  # ... more knowledge items
```

#### Import

```bash
# In your project
cognition-cli import express-security.cogx

# Merges express O₂ knowledge into your O₂ overlay
```

**Result**:

```
.open_cognition/overlays/security_guidelines/
  ├── abc123.yaml      # Your project's security knowledge
  └── express_def456.yaml  # Imported Express security knowledge
```

### Querying Inherited Knowledge

Once imported, Express security knowledge is queryable alongside your own:

```bash
# Find all CVEs (yours + Express)
cognition-cli lattice "O2[vulnerability]"

# Find mitigations for Express-specific vulnerabilities
cognition-cli lattice "O2[vulnerability][source_project=express] -> O2[mitigation]"
```

**TypeScript**:

```typescript
// Query returns both your knowledge + imported knowledge
const vulnerabilities = await security.getItemsByType('vulnerability');

// Filter by source project
const expressVulns = await security.filter(
  (m) => m.source_project === 'express'
);

// Query without filtering (searches everything)
const results = await security.queryKnowledge(
  'parameter parsing vulnerability',
  5
);
// Results may include both your project and Express knowledge
```

### Provenance Tracking

Every imported overlay retains provenance:

```yaml
document_hash: def456...
document_path: express-security.cogx
source_project: express # ← Origin project
source_commit: a1b2c3d4 # ← Git commit hash
generated_at: '2025-10-30T12:00:00Z'
transform_id: import_cogx_v1
```

**Why Provenance Matters**:

- **Trust**: Verify security knowledge came from legitimate source
- **Updates**: Track which version of Express these CVEs apply to
- **Audit**: Forensic trail of where security knowledge originated
- **Versioning**: Know when to update imported overlays (new Express release)

### Ecosystem Seeding

Over time, the ecosystem accumulates reusable security overlays:

```
npm-registry/
  ├── express-security.cogx       (Express framework)
  ├── react-security.cogx         (React XSS patterns)
  ├── postgresql-security.cogx    (PostgreSQL injection)
  ├── jwt-security.cogx           (JWT vulnerabilities)
  └── ... (hundreds of libraries)
```

**Vision**: When you install `express`, you also get `express-security.cogx`

```bash
npm install express
# Also downloads: node_modules/express/express-security.cogx

cognition-cli import node_modules/express/express-security.cogx
# Your project now inherits Express security knowledge
```

---

## Real-World Examples

### Example 1: Mission Document Validation

**Scenario**: Use O₂ constraints to validate mission documents before ingestion.

```typescript
// In MissionValidator (src/core/security/mission-validator.ts)

async validate(visionPath: string): Promise<ValidationResult> {
  // Load O₂ security constraints
  const security = await registry.get('O2');
  const constraints = await security.getItemsByType('constraint');

  // Extract mission concepts
  const concepts = await extractor.extractConcepts(visionPath);

  // Check if mission violates security constraints
  const violations = await meet(concepts, constraints, { threshold: 0.8 });

  if (violations.length > 0) {
    return {
      safe: false,
      layers: [{
        name: 'SecurityConstraints',
        passed: false,
        message: `Mission violates ${violations.length} security constraints`,
        details: violations,
      }],
      recommendation: 'review',
      alertLevel: 'warning',
    };
  }

  return { safe: true, layers: [], recommendation: 'approve', alertLevel: 'none' };
}
```

**Use Case**: Prevent mission drift that weakens security posture.

### Example 2: Security Checklist for PR Review

**Scenario**: Generate security checklist for code review based on changed symbols.

```bash
# Get changed symbols from git diff
git diff main --name-only | grep '.ts$' > changed_files.txt

# Extract symbols from changed files
cognition-cli patterns changed_files.txt --format symbols > changed_symbols.txt

# Find security guidelines for changed symbols
cognition-cli lattice "O1[symbols=@changed_symbols.txt] -> O2"

# Output:
# Security Checklist for PR Review:
#
# Changed: handleUserInput (src/api/handlers.ts)
# ⚠️  Security Guidelines:
#   - Validate all input against whitelist
#   - Sanitize before database queries
#   - Escape output to prevent XSS
#
# Changed: executeQuery (src/db/query.ts)
# ⚠️  Security Guidelines:
#   - Use parameterized queries only
#   - Never concatenate user input into SQL
#   - Log all database errors securely
```

### Example 3: Threat Model Completeness Check

**Scenario**: Ensure threat model covers all attack vectors found in code.

```typescript
// Get all detected attack vectors from code analysis
const detectedVectors = await structural.filter(
  (m) => m.architectural_role === 'security_sensitive'
);

// Get documented threat models
const threatModels = await security.getItemsByType('threat_model');

// Find attack vectors not covered by threat models
const uncovered = [];

for (const vector of detectedVectors) {
  const matches = await meet([vector], threatModels, { threshold: 0.7 });
  if (matches.length === 0) {
    uncovered.push(vector);
  }
}

if (uncovered.length > 0) {
  console.warn(
    `⚠️  ${uncovered.length} attack vectors lack threat model coverage`
  );
  for (const item of uncovered) {
    console.warn(`   - ${item.metadata.symbol} (${item.metadata.file_path})`);
  }
}
```

---

## Implementation Deep Dive

### Directory Structure

```
src/core/overlays/security-guidelines/
  ├── manager.ts           # SecurityGuidelinesManager class
  └── index.ts             # Exports

.open_cognition/overlays/security_guidelines/
  ├── abc123.yaml          # Overlay for SECURITY.md
  ├── def456.yaml          # Overlay for THREAT_MODEL.md
  └── express_ghi789.yaml  # Imported from express.cogx
```

### Key Methods

#### generateOverlay

```typescript
async generateOverlay(
  documentPath: string,
  documentHash: string,
  knowledge: SecurityKnowledge[],
  transformId: string,
  sourceProject?: string,
  sourceCommit?: string
): Promise<void> {
  // 1. Generate embeddings for all knowledge items
  const withEmbeddings = await this.generateEmbeddings(knowledge, documentPath);

  // 2. Create overlay structure
  const overlay: SecurityGuidelinesOverlay = {
    document_hash: documentHash,
    document_path: documentPath,
    extracted_knowledge: withEmbeddings,
    generated_at: new Date().toISOString(),
    transform_id: transformId,
    source_project: sourceProject,
    source_commit: sourceCommit,
  };

  // 3. Write to disk
  await fs.ensureDir(this.overlayPath);
  const filePath = path.join(this.overlayPath, `${documentHash}.yaml`);
  await fs.writeFile(filePath, YAML.stringify(overlay));
}
```

#### loadOverlay

```typescript
async loadOverlay(documentHash: string): Promise<SecurityGuidelinesOverlay | null> {
  const filePath = path.join(this.overlayPath, `${documentHash}.yaml`);

  if (!(await fs.pathExists(filePath))) {
    return null;
  }

  const content = await fs.readFile(filePath, 'utf-8');
  return YAML.parse(content) as SecurityGuidelinesOverlay;
}
```

#### queryKnowledge

```typescript
async queryKnowledge(
  queryText: string,
  topK: number = 5
): Promise<Array<{ item: SecurityKnowledge; similarity: number }>> {
  // 1. Generate query embedding
  const sanitized = this.sanitizeForEmbedding(queryText);
  const response = await this.workbench.embed({
    signature: sanitized,
    dimensions: 768,
  });
  const queryEmbedding = response['embedding_768d'];

  // 2. Load all overlays
  const hashes = await this.listOverlays();
  const allKnowledge: SecurityKnowledge[] = [];

  for (const hash of hashes) {
    const overlay = await this.loadOverlay(hash);
    if (overlay) {
      allKnowledge.push(...overlay.extracted_knowledge);
    }
  }

  // 3. Compute similarities
  const results = allKnowledge
    .filter((item) => item.embedding && item.embedding.length === 768)
    .map((item) => ({
      item,
      similarity: this.cosineSimilarity(queryEmbedding, item.embedding!),
    }));

  // 4. Sort and return top K
  return results
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK);
}
```

#### cosineSimilarity

```typescript
private cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have same dimensions');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator === 0 ? 0 : dotProduct / denominator;
}
```

### Embedding Progress Logging

```typescript
// In generateEmbeddings
for (let i = 0; i < knowledge.length; i++) {
  // Log progress at first, last, and every 50 items
  if (i === 0 || i === total - 1 || (i + 1) % 50 === 0) {
    EmbedLogger.progress(i + 1, total, 'SecurityGuidelines', documentName);
  }

  // Generate embedding...
}

// EmbedLogger output:
// [SecurityGuidelines] Embedding 1/100 (SECURITY.md)
// [SecurityGuidelines] Embedding 50/100 (SECURITY.md)
// [SecurityGuidelines] Embedding 100/100 (SECURITY.md) ✓
```

---

## Common Pitfalls

### Pitfall 1: Conflating O₂ Overlay with Core Security

**Problem**: Confusing application security knowledge (O₂) with system security (core).

**Symptom**: Trying to query MissionValidator via lattice algebra.

**Fix**:

- O₂ = Application security knowledge (queryable, portable)
- Core = System protection (validation only, not queryable)
- See [Core Security Architecture](../../architecture/SECURITY_CORE.md)

### Pitfall 2: Missing Embeddings

**Problem**: Knowledge items stored without embeddings.

**Symptom**: `queryKnowledge()` returns empty results even though overlays exist.

**Cause**: Embedding generation failed silently (sanitization removed all text, API error).

**Fix**:

```typescript
// Always validate embeddings before storing
if (!embedding || embedding.length !== 768) {
  console.warn(`Skipping item (invalid embedding): ${item.text}`);
  continue;
}
```

### Pitfall 3: Over-Broad Queries

**Problem**: Query returns too many irrelevant results.

**Symptom**: `queryKnowledge('security')` returns hundreds of items.

**Fix**: Use more specific queries + filtering

```typescript
// ❌ Too broad
const results = await security.queryKnowledge('security', 100);

// ✅ Specific
const results = await security.queryKnowledge('SQL injection mitigation', 5);

// ✅ Filtered
const attacks = await security.getItemsByType('attack_vector');
const sqlAttacks = attacks.filter((a) => a.text.includes('SQL'));
```

### Pitfall 4: Ignoring Provenance

**Problem**: Imported overlays without tracking source.

**Symptom**: Can't tell which CVEs came from Express vs your code.

**Fix**: Always set `source_project` and `source_commit` on import

```typescript
await manager.generateOverlay(
  'express-security.cogx',
  documentHash,
  knowledge,
  'import_cogx_v1',
  'express', // ← Source project
  'a1b2c3d4' // ← Git commit
);
```

### Pitfall 5: Stale Security Knowledge

**Problem**: Imported CVEs from old version of dependency.

**Symptom**: Alerting on CVEs already fixed in current version.

**Fix**: Check source version before importing

```typescript
// Check if imported overlay is stale
const overlay = await security.loadOverlay(hash);
if (overlay.source_project === 'express') {
  const currentVersion = require('express/package.json').version;
  const overlayVersion = overlay.source_commit; // or version field

  if (isOutdated(overlayVersion, currentVersion)) {
    console.warn(
      `⚠️  Express security overlay is stale (${overlayVersion} vs ${currentVersion})`
    );
    console.warn('   Run: cognition-cli update-imports');
  }
}
```

---

## Performance Characteristics

### Embedding Generation

**Operation**: Generate embeddings for N security knowledge items

**Complexity**: O(N × E) where E = embedding API latency (~100ms)

**Benchmark**:

- 10 items: ~1 second
- 100 items: ~10 seconds
- 1000 items: ~100 seconds (1.7 minutes)

**Optimization**: Embeddings are cached in overlay files (generated once, queried many times)

### Query Performance

**Operation**: Semantic search across M overlays with total N items

**Complexity**: O(M × N × D) where D = 768 dimensions (cosine similarity)

**Benchmark**:

- 1 overlay, 100 items: ~10ms
- 10 overlays, 1000 items: ~100ms
- 100 overlays, 10,000 items: ~1 second

**Optimization**: Use LanceDB for large-scale queries (O(N × log M) via ANN)

### Meet Operation (Cross-Overlay)

**Operation**: Find alignment between A items from O₂ and B items from O₄

**Complexity**: O(A × B × D) for pairwise cosine similarity

**Benchmark**:

- 10 attacks × 10 principles: ~1ms
- 100 attacks × 100 principles: ~100ms
- 1000 attacks × 1000 principles: ~10 seconds

**Optimization**: Use approximate nearest neighbor (ANN) via LanceDB

- Complexity drops to O(A × log B)
- Benchmark: 1000 × 1000 becomes ~100ms

---

## Summary

**O₂ Security: Foundational Constraints**

- **6 Knowledge Types**: threat_model, attack_vector, mitigation, boundary, constraint, vulnerability
- **Foundational Role**: Checked before mission alignment, universal dependency
- **Portability**: Export as .cogx, import from dependencies (security inheritance)
- **Queryable**: Semantic search, cross-overlay queries via lattice algebra
- **Provenance**: Track source project + git commit for imported knowledge
- **Integration**: Genesis command routes security documents to O₂

**Key Distinction**: O₂ stores application security knowledge (XSS, SQL injection), Core Security protects the lattice itself (mission poisoning).

**Next Steps**:

- Chapter 8: O₄ Mission (strategic alignment)
- Chapter 12: Boolean Operations (query algebra including O₂)
- Part IV: .cogx Format (portability details)

---

**Next Chapter**: [Chapter 7: O₃ Lineage — Dependency Tracking](07-o3-lineage.md)

**Previous Chapter**: [Chapter 5: O₁ Structure — Code Artifacts](05-o1-structure.md)

---

**Status**: ✅ Complete (October 30, 2025)
**Author**: Collaborative implementation session
**Reviewed**: Pending
