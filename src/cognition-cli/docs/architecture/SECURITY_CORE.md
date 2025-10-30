# Core Security Architecture

> **Defending the Lattice: System-Level Protection Against Cognitive Attacks**

**Last Updated**: October 30, 2025
**Status**: Production
**Location**: `src/core/security/`

---

## Executive Summary

The core security layer protects **the PGC itself** from attacks that could compromise the cognitive architecture's integrity. This is distinct from the O₂ Security overlay, which stores application-level security knowledge.

**Key Distinction**:

- **Core Security**: Protects THE LATTICE (the cognitive system)
- **O₂ Security Overlay**: Stores knowledge ABOUT application security

**Analogy**:

- Core Security = OS kernel security (protects the operating system)
- O₂ Security Overlay = Security best practices docs (guides developers)

---

## Threat Model

### Attack Vectors

**1. Gradual Mission Poisoning**

- Attacker submits series of plausible PRs over time
- Each PR shifts mission slightly toward attacker's goals
- Example: "security first" → "balanced approach" → "pragmatic flexibility"

**2. Trust Erosion**

- Injecting language that undermines security principles
- Adding exceptions for "trusted users" or "experienced developers"
- Weakening constraints disguised as "improving user experience"

**3. Security Weakening**

- Removing security-focused concepts
- Adding "pragmatic" language to justify bypassing checks
- Deprioritizing security concepts (moving them lower in document)

**4. Ambiguity Injection**

- Adding vague terms ("balanced", "flexible", "context-dependent")
- Enabling malicious interpretations of mission principles
- Creating wiggle room for policy violations

**5. Velocity Prioritization**

- Emphasizing speed over safety
- Framing security as "slowing down development"
- Pressuring for "fast iterations" at expense of validation

---

## Defense Philosophy

### 🔓 Advisory by Default (Warn, Don't Block)

- System provides warnings and evidence
- Humans make final decisions
- Blocking only in strict mode (opt-in)

**Why**: Prevents false positives from breaking legitimate workflows

### 🔍 Transparent (All Detection Logic Documented)

- Every pattern detection rule is documented
- Thresholds are configurable and auditable
- No black-box heuristics

**Why**: Users can inspect, challenge, and improve detection logic

### 👤 User Control (Easy to Configure/Disable)

- Security features can be disabled
- Thresholds can be adjusted per project
- Mode selection: advisory, strict, disabled

**Why**: Respects developer autonomy while providing protection

### 🚫 No Telemetry (All Analysis Local)

- No data sent to external services
- All validation runs locally
- LLM validation is optional (can use pattern matching only)

**Why**: Privacy and security of mission documents

### 🤝 Augment Humans (Help Reviewers, Don't Replace)

- System provides evidence for human review
- Recommendations are suggestive, not authoritative
- Focus on helping reviewers spot subtle attacks

**Why**: Humans are ultimate authority on mission integrity

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   MissionValidator                       │
│  Pre-ingestion gate for mission documents                │
└─────────────────┬───────────────────────────────────────┘
                  │
        ┌─────────┴─────────┐
        │                   │
┌───────▼──────┐    ┌──────▼───────┐
│ Layer 1:     │    │ Layer 3:     │
│ Content      │    │ Semantic     │
│ Safety       │    │ Drift        │
│ (LLM-based)  │    │ (Embedding)  │
└───────┬──────┘    └──────┬───────┘
        │                   │
┌───────▼──────┐    ┌──────▼───────┐
│ Layer 2:     │    │ Layer 4:     │
│ Content      │    │ Structural   │
│ Patterns     │    │ Integrity    │
│ (Regex)      │    │ (Markdown)   │
└──────────────┘    └──────────────┘
        │                   │
        └─────────┬─────────┘
                  │
     ┌────────────▼─────────────┐
     │   MissionIntegrityMonitor │
     │   Immutable audit trail   │
     └────────────┬──────────────┘
                  │
          ┌───────▼────────┐
          │ .open_cognition │
          │ /mission_       │
          │  integrity/     │
          │  versions.json  │
          └─────────────────┘
```

---

## Components

### 1. MissionValidator

**Purpose**: Multi-layer validation before ingesting mission documents

**Location**: `src/core/security/mission-validator.ts`

#### Validation Layers

**Layer 1: Content Safety (LLM-Based, Optional)**

- Uses eGemma personas to analyze content
- Maps document type to appropriate validator:
  - `strategic` → `security_validator`
  - `operational` → `operational_validator`
  - `security` → `security_meta_validator`
  - `mathematical` → `math_validator`
- Checks for malicious patterns, ambiguity, security weakening
- **Only enabled if** `config.contentFiltering.llmFilter.enabled === true`

**Layer 2: Content Patterns (Regex-Based, Fallback)**

- Pattern matching for suspicious language
- Detects trust erosion, security weakening, ambiguity injection
- **Always runs** (even if LLM validation disabled)
- Provides basic protection without LLM dependency

**Layer 3: Semantic Drift Analysis (Embedding-Based)**

- Compares new version against previous versions
- Computes cosine distance between concept embeddings
- Detects concept addition/removal/repositioning
- Flags suspicious drift patterns

**Layer 4: Structural Integrity (Markdown Validation)**

- Ensures document parses correctly
- Validates markdown structure
- Checks for malformed content

#### Validation Result

```typescript
interface ValidationResult {
  safe: boolean; // All layers passed?
  layers: ValidationLayer[]; // Per-layer results
  recommendation: 'approve' | 'review' | 'reject';
  alertLevel: 'none' | 'info' | 'warning' | 'critical';
  embeddedConcepts?: MissionConcept[];
}
```

#### Usage Example

```typescript
import { MissionValidator, loadSecurityConfig } from './core/security/index.js';

const config = await loadSecurityConfig(projectRoot);
const validator = new MissionValidator(pgcRoot, config, workbenchUrl);

const result = await validator.validate('VISION.md', DocumentType.STRATEGIC);

if (!result.safe) {
  console.warn('Security concerns detected:');
  for (const layer of result.layers) {
    if (!layer.passed) {
      console.warn(`  - ${layer.name}: ${layer.message}`);
    }
  }

  if (result.recommendation === 'reject' && config.mode === 'strict') {
    throw new Error('Mission validation failed in strict mode');
  }
}
```

---

### 2. MissionIntegrityMonitor

**Purpose**: Creates immutable audit trail of all mission document versions

**Location**: `src/core/security/mission-integrity.ts`

#### Mission Version Record

```typescript
interface MissionVersion {
  version: number; // Monotonically increasing
  hash: string; // SHA-256 of content
  timestamp: string; // ISO timestamp
  author?: string; // Git author (if available)
  commitHash?: string; // Git commit SHA
  conceptEmbeddings: number[][]; // Snapshot of embeddings
  semanticFingerprint: string; // Hash of embedding centroid
  conceptTexts: string[]; // Concept texts for comparison
}
```

#### Storage

**Location**: `.open_cognition/mission_integrity/versions.json`

**Format**:

```json
{
  "versions": [
    {
      "version": 1,
      "hash": "abc123...",
      "timestamp": "2025-10-30T12:00:00Z",
      "author": "developer@example.com",
      "commitHash": "a1b2c3d4",
      "conceptEmbeddings": [[0.1, 0.2, ...], ...],
      "semanticFingerprint": "def456...",
      "conceptTexts": ["Security first", "Privacy by default", ...]
    },
    ...
  ]
}
```

#### Invariants

1. **Append-Only**: Versions are never deleted or modified
2. **Monotonic Version Numbers**: Version N+1 always comes after version N
3. **Full Snapshots**: Each version includes complete embedding snapshot
4. **Atomic Writes**: Write to temp file, then rename (prevents corruption)
5. **Git Integration**: Captures git metadata when available

#### Security Properties

- **Prevents Evidence Erasure**: Attacker cannot delete history of poisoning
- **Forensic Trail**: Enables investigation of mission changes over time
- **Rewind Capability**: Can restore previous mission state if compromised
- **Tamper Detection**: Hash chain prevents modification of historical versions

---

### 3. SemanticDriftDetector

**Purpose**: Detects semantic drift and suspicious patterns in mission changes

**Location**: `src/core/security/drift-detector.ts`

#### Drift Analysis Algorithm

```
1. Compute semantic distance (cosine distance between embedding centroids)
2. Identify added/removed/shifted concepts
3. Run pattern detection (security weakening, trust erosion, etc.)
4. Classify severity based on distance and patterns
5. Generate recommendation (approve/review/reject)
```

#### Drift Severity Thresholds

| Severity | Distance  | Description          | Action               |
| -------- | --------- | -------------------- | -------------------- |
| None     | < 0.05    | Minor refinements    | Auto-approve         |
| Low      | 0.05-0.15 | Acceptable reframing | Log + approve        |
| Medium   | 0.15-0.30 | Significant changes  | Review recommended   |
| High     | 0.30-0.50 | Major mission shift  | Alert + review       |
| Critical | > 0.50    | Potential poisoning  | Block in strict mode |

**Note**: Thresholds are configurable via `SecurityConfig`

#### Drift Analysis Result

```typescript
interface DriftAnalysis {
  severity: 'none' | 'low' | 'medium' | 'high' | 'critical';
  distance: number; // Cosine distance (0-1)
  addedConcepts: string[]; // New concepts
  removedConcepts: string[]; // Deleted concepts
  shiftedConcepts: {
    // Repositioned concepts
    concept: string;
    oldPosition: number;
    newPosition: number;
    delta: number; // Positive = deprioritized
  }[];
  suspiciousPatterns: string[]; // Detected attack patterns
  recommendation: 'approve' | 'review' | 'reject';
}
```

#### Pattern Detection Rules

**Security Weakening Patterns**:

- Removing: "security first", "security-critical", "never bypass"
- Adding: "pragmatic", "flexible", "balanced approach"
- Shifting: Moving security concepts lower in document

**Trust Erosion Patterns**:

- Adding: "trust experienced users", "trust the team"
- Removing: "verify", "validate", "audit"
- Shifting: Deprioritizing validation concepts

**Ambiguity Injection Patterns**:

- Adding: "context-dependent", "case-by-case", "use judgment"
- Removing: "always", "never", "must"
- Shifting: Making concrete principles more vague

**Velocity Prioritization Patterns**:

- Adding: "move fast", "iterate quickly", "ship rapidly"
- Removing: "careful", "thorough", "validated"
- Shifting: Prioritizing speed over safety

#### Usage Example

```typescript
import { SemanticDriftDetector } from './core/security/drift-detector.js';

const detector = new SemanticDriftDetector({
  low: 0.05,
  medium: 0.15,
  high: 0.3,
  critical: 0.5,
});

const analysis = await detector.analyzeDrift(oldVersion, newVersion);

if (analysis.severity === 'high' || analysis.severity === 'critical') {
  console.warn(
    `⚠️  High semantic drift detected (distance: ${analysis.distance})`
  );
  console.warn('Added concepts:', analysis.addedConcepts);
  console.warn('Removed concepts:', analysis.removedConcepts);
  console.warn('Suspicious patterns:', analysis.suspiciousPatterns);
  console.warn(`Recommendation: ${analysis.recommendation}`);
}
```

---

### 4. SecurityConfig

**Purpose**: User-configurable security settings

**Location**: `src/core/security/security-config.ts`

#### Configuration Structure

```typescript
interface SecurityConfig {
  mode: SecurityMode; // 'advisory' | 'strict' | 'disabled'

  contentFiltering: {
    llmFilter: {
      enabled: boolean; // Use LLM-based validation?
      model: string; // eGemma model to use
      confidence: number; // Minimum confidence (0-1)
    };
    patternMatching: {
      enabled: boolean; // Use regex-based validation?
      customPatterns?: string[]; // Additional suspicious patterns
    };
  };

  missionIntegrity: {
    enabled: boolean; // Track mission versions?
    drift: {
      warnThreshold: number; // Warn at this distance
      alertThreshold: number; // Alert at this distance
      blockThreshold: number; // Block at this distance (strict mode)
    };
  };
}
```

#### Security Modes

**Advisory Mode (Default)**:

- All validation layers run
- Warnings are logged
- No blocking (approve with warnings)
- Humans make final decision

**Strict Mode**:

- All validation layers run
- Critical findings block ingestion
- High/critical drift blocks updates
- Requires explicit override to proceed

**Disabled Mode**:

- No validation performed
- All mission changes accepted
- For development/testing only

#### Configuration File

**Location**: `.cognition/security.json` (project root)

**Example**:

```json
{
  "mode": "advisory",
  "contentFiltering": {
    "llmFilter": {
      "enabled": true,
      "model": "egemma-2b",
      "confidence": 0.7
    },
    "patternMatching": {
      "enabled": true,
      "customPatterns": ["skip validation", "bypass security"]
    }
  },
  "missionIntegrity": {
    "enabled": true,
    "drift": {
      "warnThreshold": 0.05,
      "alertThreshold": 0.15,
      "blockThreshold": 0.3
    }
  }
}
```

#### Loading Configuration

```typescript
import {
  loadSecurityConfig,
  DEFAULT_SECURITY_CONFIG,
} from './core/security/index.js';

// Load from project root (or use defaults)
const config = await loadSecurityConfig(projectRoot);

// Or use defaults explicitly
const config = DEFAULT_SECURITY_CONFIG;

// Or override specific settings
const config = {
  ...DEFAULT_SECURITY_CONFIG,
  mode: 'strict',
  missionIntegrity: {
    enabled: true,
    drift: {
      warnThreshold: 0.03,
      alertThreshold: 0.1,
      blockThreshold: 0.2,
    },
  },
};
```

---

## Integration Points

### Genesis Command Integration

```typescript
// In genesis command (src/commands/genesis.ts)
import {
  MissionValidator,
  loadSecurityConfig,
} from '../core/security/index.js';

// Load security config
const config = await loadSecurityConfig(projectRoot);

// Create validator
const validator = new MissionValidator(pgcRoot, config, workbenchUrl);

// Validate before ingestion
const result = await validator.validate(filePath, docType);

if (!result.safe) {
  // Log warnings
  for (const layer of result.layers) {
    if (!layer.passed) {
      console.warn(`⚠️  ${layer.name}: ${layer.message}`);
    }
  }

  // Block in strict mode
  if (result.recommendation === 'reject' && config.mode === 'strict') {
    throw new Error('Mission validation failed');
  }

  // Prompt user in advisory mode
  if (result.recommendation === 'reject' && config.mode === 'advisory') {
    const proceed = await promptUser('Continue despite warnings?');
    if (!proceed) {
      throw new Error('User cancelled due to validation warnings');
    }
  }
}

// If validation passed (or user overrode), record version
if (config.missionIntegrity.enabled) {
  const monitor = new MissionIntegrityMonitor(pgcRoot);
  await monitor.recordVersion(filePath, embeddedConcepts);
}
```

---

## Testing Strategy

### Unit Tests

**Drift Detection**:

```typescript
describe('SemanticDriftDetector', () => {
  it('detects security weakening patterns', async () => {
    const oldConcepts = ['Security first', 'Never bypass validation'];
    const newConcepts = ['Balanced approach', 'Pragmatic security'];

    const analysis = await detector.analyzeDrift(oldVersion, newVersion);

    expect(analysis.severity).toBe('high');
    expect(analysis.suspiciousPatterns).toContain('Security weakening');
  });

  it('flags high semantic distance', async () => {
    // Create versions with embeddings far apart
    const analysis = await detector.analyzeDrift(oldVersion, newVersion);

    expect(analysis.distance).toBeGreaterThan(0.3);
    expect(analysis.severity).toBe('high');
  });
});
```

**Mission Integrity**:

```typescript
describe('MissionIntegrityMonitor', () => {
  it('creates immutable version history', async () => {
    const monitor = new MissionIntegrityMonitor(pgcRoot);

    await monitor.recordVersion(visionPath, concepts1);
    await monitor.recordVersion(visionPath, concepts2);

    const versions = await monitor.getVersions();

    expect(versions).toHaveLength(2);
    expect(versions[0].version).toBe(1);
    expect(versions[1].version).toBe(2);
  });

  it('prevents version tampering', async () => {
    // Attempt to modify versions.json directly
    const versionsPath = path.join(pgcRoot, 'mission_integrity/versions.json');
    const data = await fs.readJSON(versionsPath);
    data.versions[0].hash = 'tampered';
    await fs.writeJSON(versionsPath, data);

    // Next recordVersion should detect tampering
    await expect(monitor.recordVersion(visionPath, concepts)).rejects.toThrow();
  });
});
```

### Integration Tests

**End-to-End Validation**:

```bash
# Test poisoning attempt
echo "Pragmatic security. Trust experienced users." > VISION.md
cognition-cli genesis VISION.md

# Should warn about security weakening and trust erosion
# In strict mode, should block ingestion
```

---

## Performance Considerations

### Embedding Computation

- **Cost**: O(n) where n = number of concepts
- **Optimization**: Concepts are already embedded during extraction
- **Trade-off**: No additional embedding cost for drift detection

### Semantic Distance Calculation

- **Cost**: O(n × m) where n = concepts in old, m = concepts in new
- **Optimization**: Use cached centroids (O(1) after first compute)
- **Trade-off**: Small overhead for large mission documents (>100 concepts)

### Pattern Matching

- **Cost**: O(k × p) where k = concepts, p = patterns
- **Optimization**: Compile regex patterns once, reuse across validations
- **Trade-off**: Negligible overhead (<1ms)

### LLM Validation (Optional)

- **Cost**: Network latency + LLM inference time (100-500ms)
- **Optimization**: Can be disabled in favor of pattern matching
- **Trade-off**: Higher accuracy but slower

---

## Limitations and Known Issues

### False Positives

**Issue**: Legitimate mission refinements may trigger drift warnings

**Mitigation**:

- Default to advisory mode (warn, don't block)
- Allow threshold tuning per project
- Provide clear evidence for human review

### Cold Start Problem

**Issue**: First version has no baseline for drift detection

**Solution**:

- First version always passes drift check
- Drift detection starts from version 2 onwards

### Language Dependency

**Issue**: Pattern matching is English-centric

**Future Work**:

- Multilingual pattern support
- Language-agnostic semantic drift (embedding-only)

### Storage Growth

**Issue**: Versions file grows over time (embeddings are large)

**Mitigation**:

- Embeddings are compressed (768 floats ≈ 3KB per concept)
- Only store embeddings for mission documents (not all docs)
- Future: Implement version pruning (keep first, last, and flagged versions)

---

## Future Enhancements

### 1. Diff Visualization

Show semantic diff between versions:

```
- "Security first" (removed, severity: high)
+ "Balanced approach" (added, severity: medium)
  "Privacy by default" (shifted: position 1 → 5)
```

### 2. Anomaly Detection

ML-based anomaly detection:

- Train on historical mission evolution
- Flag deviations from normal pattern
- Detect coordinated multi-document attacks

### 3. Policy Engine

Declarative security policies:

```yaml
policies:
  - name: 'Security concepts required'
    rule: "must contain ['security', 'privacy', 'validation']"
    severity: critical

  - name: 'Trust language forbidden'
    rule: "must not contain ['trust users', 'skip validation']"
    severity: high
```

### 4. Integration with Git Hooks

Pre-commit hook for mission changes:

```bash
#!/bin/bash
# .git/hooks/pre-commit

if git diff --cached --name-only | grep -q "VISION.md"; then
  cognition-cli validate-mission VISION.md --strict
  if [ $? -ne 0 ]; then
    echo "❌ Mission validation failed"
    exit 1
  fi
fi
```

### 5. Audit Log Export

Export mission integrity log for compliance:

```bash
cognition-cli security export-audit-log --format json --output audit.json
```

---

## Comparison: Core Security vs O₂ Security Overlay

| Aspect              | Core Security                        | O₂ Security Overlay                           |
| ------------------- | ------------------------------------ | --------------------------------------------- |
| **Purpose**         | Protect the lattice                  | Store app security knowledge                  |
| **Scope**           | Mission documents                    | Application code                              |
| **Threat Model**    | Mission poisoning                    | App vulnerabilities (XSS, CSRF, etc.)         |
| **Storage**         | `.open_cognition/mission_integrity/` | `.open_cognition/overlays/O2_security/`       |
| **Components**      | MissionValidator, DriftDetector      | SecurityGuidelinesManager                     |
| **Knowledge Types** | N/A (validation only)                | threat_model, attack_vector, mitigation, etc. |
| **Queryable**       | No (internal system)                 | Yes (via lattice algebra)                     |
| **Configurable**    | Yes (security.json)                  | No (data only)                                |
| **Integration**     | Genesis command                      | Query commands (lattice, coherence)           |

**Analogy**:

- Core Security = Firewall protecting the server
- O₂ Security Overlay = Security documentation on the server

---

## Related Documentation

- [Multi-Overlay Architecture](MULTI_OVERLAY_ARCHITECTURE.md) - Overview of 7-layer system
- [Chapter 6: O₂ Security Overlay](../manual/part-2-seven-layers/06-o2-security.md) - Application security knowledge
- [Chapter 12: Boolean Operations](../manual/part-3-algebra/12-boolean-operations.md) - Query algebra (includes O₂)
- [Genesis Command](../manual/part-5-cpow-loop/18-operational-flow.md) - Where validation integrates

---

**Status**: ✅ Complete (October 30, 2025)
**Author**: Collaborative implementation session
**Reviewed**: Pending
