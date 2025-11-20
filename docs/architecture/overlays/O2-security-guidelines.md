# O₂: Security Guidelines Overlay

> _The shield—threat models, vulnerabilities, and mitigations that protect the cognitive lattice._

## Overview

The **Security Guidelines Overlay** provides a structured approach to identifying, documenting, and mitigating security threats in the codebase. It extracts security-critical patterns, validates threat models, and tracks CVEs and their remediations.

**Layer**: Foundational Security
**Purpose**: Threat models, CVEs, mitigations, security patterns
**Status**: ✅ Framework Implemented
**Extraction Method**: Pattern matching + LLM validation
**Speed**: Medium (LLM validation required)

## Architecture

### Data Flow

```text
Source Code + Security Docs
    ↓
Pattern Detection (Regex + AST)
    ↓
LLM Validation (eGemma)
    ↓
Threat Classification
    ↓
Mitigation Tracking
    ↓
Security Overlay Storage
```

### Key Components

- **Threat Pattern Detector**: Identifies security-sensitive code patterns
- **CVE Tracker**: Maps known vulnerabilities to code locations
- **Mitigation Validator**: Verifies security controls are in place
- **LLM Validator**: Confirms pattern matches are true positives

## Security Pattern Categories

### 1. Authentication & Authorization

**Patterns Detected:**

- Authentication mechanisms (JWT, OAuth, API keys)
- Authorization checks (role-based, attribute-based)
- Session management
- Token validation

**Example:**

```typescript
// Detected Pattern: JWT Authentication
function verifyToken(token: string): User {
  const decoded = jwt.verify(token, SECRET_KEY);
  return decoded as User;
}

// Security Metadata:
// - Pattern: JWT_VALIDATION
// - Threat: Token tampering, weak secrets
// - Mitigation: Use strong keys, validate expiration
```

### 2. Input Validation & Sanitization

**Patterns Detected:**

- User input validation
- SQL injection prevention
- XSS prevention
- Command injection prevention
- Path traversal prevention

**Example:**

```typescript
// Detected Pattern: SQL Query Construction
const query = `SELECT * FROM users WHERE id = ${userId}`;

// Security Alert:
// - Threat: SQL Injection (CWE-89)
// - Severity: CRITICAL
// - Mitigation: Use parameterized queries
```

### 3. Cryptography

**Patterns Detected:**

- Encryption/decryption operations
- Hashing algorithms
- Key management
- Random number generation

**Example:**

```typescript
// Detected Pattern: Cryptographic Hashing
const hash = crypto.createHash('sha256').update(data).digest('hex');

// Security Metadata:
// - Pattern: CRYPTOGRAPHIC_HASH
// - Algorithm: SHA-256 (secure)
// - Threat Level: LOW
```

### 4. Data Protection

**Patterns Detected:**

- PII handling
- Sensitive data logging
- Data encryption at rest
- Secure data transmission

### 5. Access Control

**Patterns Detected:**

- File system access
- Network access
- Database access
- API endpoint protection

## Threat Model Structure

### Threat Entry Schema

```typescript
interface SecurityThreat {
  id: string; // Unique threat ID
  category: ThreatCategory; // AUTHENTICATION, INPUT_VALIDATION, etc.
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  cwe?: string; // Common Weakness Enumeration
  cve?: string; // Common Vulnerabilities and Exposures

  pattern: {
    type: string; // Pattern type
    location: {
      file: string;
      line: number;
      symbol?: string;
    };
    code_snippet: string;
    structural_hash: string; // Link to O₁ structural data
  };

  description: string;
  attack_vectors: string[];

  mitigation: {
    status: 'NONE' | 'PARTIAL' | 'COMPLETE';
    controls: string[];
    verified_at?: string;
    verified_by?: string;
  };

  metadata: {
    detected_at: string;
    detection_method: 'PATTERN' | 'LLM' | 'MANUAL';
    confidence: number; // 0.0 - 1.0
    false_positive: boolean;
  };
}
```

### Example Threat Entry

```json
{
  "id": "THREAT-2025-001",
  "category": "INPUT_VALIDATION",
  "severity": "CRITICAL",
  "cwe": "CWE-89",
  "pattern": {
    "type": "SQL_INJECTION_RISK",
    "location": {
      "file": "src/db/queries.ts",
      "line": 45,
      "symbol": "getUserById"
    },
    "code_snippet": "SELECT * FROM users WHERE id = ${userId}",
    "structural_hash": "sha256:abc123..."
  },
  "description": "Direct string interpolation in SQL query allows SQL injection",
  "attack_vectors": [
    "Attacker can inject SQL code via userId parameter",
    "Bypass authentication by injecting OR 1=1",
    "Extract sensitive data via UNION injection"
  ],
  "mitigation": {
    "status": "COMPLETE",
    "controls": [
      "Replaced with parameterized query using pg.query($1, [userId])",
      "Added input validation for userId type"
    ],
    "verified_at": "2025-10-29T16:00:00Z",
    "verified_by": "security-audit-v1"
  },
  "metadata": {
    "detected_at": "2025-10-28T10:00:00Z",
    "detection_method": "PATTERN",
    "confidence": 0.95,
    "false_positive": false
  }
}
```

## CVE Tracking

### CVE Entry Schema

```typescript
interface CVEEntry {
  cve_id: string; // CVE-2024-12345
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  cvss_score?: number;

  affected: {
    dependency?: string; // npm package name
    version?: string;
    code_locations?: string[]; // Affected source files
  };

  description: string;
  published_at: string;

  remediation: {
    status: 'OPEN' | 'PATCHED' | 'MITIGATED' | 'ACCEPTED_RISK';
    patch_version?: string;
    workaround?: string;
    applied_at?: string;
  };

  references: string[];
}
```

## Detection Methods

### 1. Pattern-Based Detection

Uses regex and AST analysis to find security-sensitive patterns:

```typescript
const SECURITY_PATTERNS = {
  SQL_INJECTION: /\$\{.*\}.*SELECT|INSERT|UPDATE|DELETE/i,
  XSS_RISK: /innerHTML|dangerouslySetInnerHTML/,
  WEAK_CRYPTO: /MD5|SHA1|DES/,
  HARDCODED_SECRET: /password\s*=\s*["'][^"']+["']/i,
};
```

### 2. LLM-Based Validation

Sends detected patterns to eGemma for validation:

```typescript
Prompt: 'Is this code pattern a security vulnerability?';
Context: {
  (code_snippet, pattern_type, surrounding_context);
}
Response: {
  (is_vulnerable, confidence, explanation);
}
```

### 3. Manual Review

Security experts can manually add threat entries and mark false positives.

## Mitigation Workflow

```text
1. Threat Detected
    ↓
2. LLM Validation (is it a true positive?)
    ↓
3. Severity Classification
    ↓
4. Mitigation Planning
    ↓
5. Fix Implementation
    ↓
6. Verification (LLM + Tests)
    ↓
7. Mark as COMPLETE
```

## Storage Structure

```text
.open_cognition/
└── pgc/
    └── overlays/
        └── security_guidelines/
            ├── manifest.json          # Index of all threats
            ├── threats/
            │   └── {id}.json         # Individual threat entries
            ├── cves/
            │   └── {cve_id}.json     # CVE tracking
            └── mitigations/
                └── {threat_id}.json   # Mitigation records
```

## Usage

### Scan for Security Threats

```bash
# Scan entire codebase
cognition-cli security scan

# Scan specific directory
cognition-cli security scan --path src/api

# Scan with LLM validation
cognition-cli security scan --validate
```

### List Threats

```bash
# List all threats
cognition-cli security list

# Filter by severity
cognition-cli security list --severity CRITICAL

# Filter by status
cognition-cli security list --status OPEN
```

### Track CVEs

```bash
# Check for CVEs in dependencies
cognition-cli security cve-check

# Update CVE database
cognition-cli security cve-update
```

## Integration with Other Overlays

### Links to O₁ (Structure)

Each threat entry links to structural data:

```text
threat.pattern.structural_hash → O₁ structural data
```

This allows:

- Finding all threats in a specific class/function
- Impact analysis when code structure changes

### Links to O₃ (Lineage)

Threat propagation through dependencies:

```text
Vulnerable function → O₃ lineage → All callers
```

This enables:

- **Blast radius** for security vulnerabilities
- **Transitive threat analysis**

### Feeds O₇ (Coherence)

Security guidelines must align with:

- Mission (O₄): "Cryptographic truth is essential"
- Operational patterns (O₅): "Always validate before trust"

## Security Metrics

```typescript
interface SecurityMetrics {
  total_threats: number;
  by_severity: {
    CRITICAL: number;
    HIGH: number;
    MEDIUM: number;
    LOW: number;
  };
  by_status: {
    OPEN: number;
    PATCHED: number;
    MITIGATED: number;
    ACCEPTED_RISK: number;
  };
  mean_time_to_remediation: number; // days
  false_positive_rate: number; // 0.0 - 1.0
}
```

## Best Practices

### For Developers

1. **Run security scan before commits**

   ```bash
   git add . && cognition-cli security scan --changed-only
   ```

2. **Review LLM-validated threats** (high confidence)

3. **Mark false positives explicitly**

   ```bash
   cognition-cli security mark-false-positive THREAT-2025-001
   ```

### For Security Teams

1. **Regular CVE checks** (daily/weekly)
2. **Threat model reviews** (quarterly)
3. **Penetration testing validation** (annually)

## Future Enhancements

- [ ] **SAST Integration**: Integrate with Snyk, Semgrep, etc.
- [ ] **Dynamic Analysis**: Runtime security monitoring
- [ ] **Automated Patching**: Auto-apply security patches
- [ ] **Compliance Mapping**: Map to SOC2, ISO 27001, etc.
- [ ] **Threat Intelligence**: Subscribe to security feeds

## Related Documentation

- [Multi-Overlay Architecture](../../architecture/MULTI_OVERLAY_ARCHITECTURE.md)
- [O₁: Structural Patterns](O1-structure-patterns.md)
- [O₃: Lineage Overlay](O3-lineage-patterns.md)
