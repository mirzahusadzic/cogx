# Threat Model: cognition-cli

This document identifies security threats, attack vectors, and mitigations for the cognition-cli system.

## Overview

cognition-cli processes user code and documentation, stores it in a local PGC (Grounded Context Pool), and enables AI-assisted queries. This creates several security surfaces that must be protected.

## Threat Actors

1. **Malicious Contributors**: Developers attempting to inject poisoned code or documentation
2. **Supply Chain Attackers**: Compromised dependencies attempting to modify PGC data
3. **Local Attackers**: Users with file system access attempting to tamper with stored knowledge
4. **AI Prompt Injectors**: Crafted inputs designed to manipulate AI behavior

## Attack Surfaces

### 1. Document Ingestion Pipeline

**Threat**: Mission Document Poisoning
**Severity**: CRITICAL
**Attack Vector**: Malicious markdown files with crafted content designed to shift mission alignment
**Impact**: AI behavior drift, compromised decision-making, erosion of security principles
**Mitigation**:

- Multi-layer validation (MissionValidator with G→T→O pattern)
- Semantic drift detection with threshold-based alerts
- Content-addressable hashing for tamper detection
- Human-in-the-loop review for high-risk changes

**Threat**: Code Injection via Documentation
**Severity**: HIGH
**Attack Vector**: Markdown files with embedded scripts or malicious links
**Impact**: Code execution, credential theft, system compromise
**Mitigation**:

- Strict markdown parsing with sanitization
- No execution of embedded code blocks
- Content Security Policy for any rendered output
- Sandbox all file processing operations

### 2. PGC Storage Layer

**Threat**: PGC Data Tampering
**Severity**: CRITICAL
**Attack Vector**: Direct modification of `.open_cognition/` directory contents
**Impact**: Corrupted knowledge base, false analysis results, security bypass
**Mitigation**:

- Content-addressable storage (SHA-256 hashes)
- Integrity checks on load (MissionIntegrityMonitor)
- Audit trail for all modifications (TransparencyLog)
- File system permissions (read-only where possible)

**Threat**: PGC Data Exfiltration
**Severity**: MEDIUM
**Attack Vector**: Unauthorized access to `.open_cognition/` directory
**Impact**: Exposure of proprietary code analysis, mission documents, strategic information
**Mitigation**:

- File system permissions (user-only access)
- No network transmission of PGC data (local-only by design)
- Clear documentation about data storage location
- Optional encryption for sensitive projects

### 3. Embedding & Vector Database

**Threat**: Embedding Poisoning
**Severity**: HIGH
**Attack Vector**: Malicious content designed to corrupt semantic similarity calculations
**Impact**: Incorrect query results, mission drift detection bypass
**Mitigation**:

- Input validation before embedding generation
- Embedding dimensionality checks (768d expected)
- Anomaly detection for outlier embeddings
- Separate validation set for embedding quality

**Threat**: Vector Database Manipulation
**Severity**: MEDIUM
**Attack Vector**: Direct modification of LanceDB files
**Impact**: Corrupted similarity search, incorrect coherence scores
**Mitigation**:

- Database integrity checks on startup
- Version tracking for database schema
- Backup and recovery procedures
- Rebuild capability from source objects

### 4. Workbench API Integration

**Threat**: API Key Exposure
**Severity**: MEDIUM
**Attack Vector**: Environment variables, config files, or logs containing API keys
**Impact**: Unauthorized API usage, cost implications, data access
**Mitigation**:

- API keys via environment variables only (never committed)
- Warning on missing API key (deferred until actual use)
- Rate limiting on client side
- No API keys in logs or error messages

**Threat**: Man-in-the-Middle Attacks
**Severity**: MEDIUM
**Attack Vector**: Interception of API traffic to workbench
**Impact**: Exposure of code being analyzed, tampered AI responses
**Mitigation**:

- HTTPS required for all API communication
- Certificate validation enabled
- Local workbench deployment option (no network)
- Clear documentation about data transmission

### 5. Command Execution

**Threat**: Command Injection
**Severity**: CRITICAL
**Attack Vector**: User input passed to shell commands without sanitization
**Impact**: Arbitrary code execution, system compromise
**Mitigation**:

- No direct shell command execution from user input
- Parameterized queries for all database operations
- Path traversal prevention for file operations
- Input validation for all CLI arguments

**Threat**: Path Traversal
**Severity**: HIGH
**Attack Vector**: Crafted file paths escaping project directory (e.g., `../../etc/passwd`)
**Impact**: Unauthorized file access, information disclosure
**Mitigation**:

- Absolute path resolution with validation
- Restrict operations to project root subdirectories
- Path canonicalization before file access
- Reject paths with `..` segments

## Security Boundaries

### Boundary 1: Project Root Isolation

**Constraint**: All file operations must stay within the user's project directory
**Enforcement**: Path validation in all file I/O operations
**Exception**: Read-only access to user's home directory for `.cognition-cli/settings.json`

### Boundary 2: Network Isolation (Optional)

**Constraint**: System can operate without network access
**Enforcement**: Local workbench deployment, no required cloud services
**Exception**: Optional workbench API for embedding/summarization

### Boundary 3: User Data Separation

**Constraint**: Each user's PGC is isolated to their file system
**Enforcement**: No shared storage, no multi-tenancy
**Exception**: None

## Known Vulnerabilities

### CVE-2024-EXAMPLE (Placeholder)

**Component**: markdown-parser (hypothetical)
**Severity**: MEDIUM
**Description**: XSS via unclosed HTML tags in markdown
**Affected Versions**: < 2.0.0
**Mitigation**: Upgraded to 2.1.0, added HTML sanitization
**Status**: FIXED

## Security Testing

### Automated Tests

- Unit tests for all validation functions
- Integration tests for file I/O with malicious paths
- Fuzzing for markdown parser
- Static analysis with TypeScript strict mode

### Manual Review

- Code review required for all security-critical changes
- Periodic security audits of dependency tree
- Penetration testing (basic) for command injection

## Incident Response

### Detection

- Semantic drift alerts (high threshold violations)
- Integrity check failures (hash mismatches)
- Unexpected file modifications in `.open_cognition/`

### Response

1. Log incident to `.open_cognition/security/transparency.jsonl`
2. Notify user via CLI warning message
3. Halt operation and request manual review
4. Provide recovery guidance (restore from backup, regenerate PGC)

## Compliance & Responsible Use

### Dual-Use Acknowledgment

cognition-cli is measurement infrastructure. Users must:

- Acknowledge dual-use risks on first run
- Understand their responsibility for ethical deployment
- Comply with applicable laws and regulations

### Data Handling

- All data remains local (no cloud storage by default)
- User controls all PGC data
- Transparency logging for all operations
- Clear documentation about what data is collected

## References

- OWASP Top 10
- CWE-89 (SQL Injection)
- CWE-79 (XSS)
- CWE-78 (Command Injection)
- CWE-22 (Path Traversal)

## Review Schedule

This threat model is reviewed:

- On every major release
- When new features are added
- When vulnerabilities are discovered
- Quarterly security assessment
