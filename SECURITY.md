# Security Policy

## Supported Versions

We release patches for security vulnerabilities for the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 2.2.x   | :white_check_mark: |
| < 2.2   | :x:                |

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

Instead, please report them via email to: **<mirza.husadzic@proton.me>**

You should receive a response within 48 hours. If for some reason you do not, please follow up via email to ensure we received your original message.

Please include the following information in your report:

- Type of vulnerability
- Full paths of source file(s) related to the vulnerability
- Location of the affected source code (tag/branch/commit or direct URL)
- Step-by-step instructions to reproduce the issue
- Proof-of-concept or exploit code (if possible)
- Impact of the issue, including how an attacker might exploit it

This information will help us triage your report more quickly.

## Disclosure Policy

We follow the principle of **Coordinated Vulnerability Disclosure**:

1. **Report received**: We acknowledge receipt within 48 hours
2. **Validation**: We validate the vulnerability (typically 1-5 days)
3. **Fix development**: We develop a fix (timeline depends on severity)
4. **Release**: We release a patch
5. **Public disclosure**: We publicly disclose the vulnerability 90 days after the fix is released (or sooner if mutually agreed)

You will be credited for the discovery unless you prefer to remain anonymous.

## Security Update Policy

### Critical Vulnerabilities

- **Response time**: Within 24 hours
- **Patch release**: Within 7 days
- **Notification**: Security advisory + email to known users

### High Severity Vulnerabilities

- **Response time**: Within 48 hours
- **Patch release**: Within 14 days
- **Notification**: Security advisory + release notes

### Medium/Low Severity Vulnerabilities

- **Response time**: Within 7 days
- **Patch release**: Next regular release
- **Notification**: Release notes

## Security Considerations for This Project

The Cognition CLI implements **cryptographically-grounded knowledge systems** and **semantic alignment measurement infrastructure**. Special security considerations apply:

### 1. Dual-Use Technology

This tool can be used for both beneficial and potentially harmful purposes:

- ✅ **Intended use**: Helping developers align code with project values
- ⚠️ **Potential misuse**: Ideological conformity enforcement

**Our commitment**: The tool remains neutral, transparent, and under user control.

### 2. Cryptographic Grounding

- All objects are SHA-256 content-addressed
- Tampering with the PGC will be detected
- Fidelity scores cannot be forged without detection
- Transparency logs are append-only

**Security concern**: If you discover a way to forge content hashes or bypass transparency logging, please report it immediately.

### 3. Transparency Logging

All mission operations are logged to `.open_cognition/security/transparency.jsonl`:

```jsonl
{
  "timestamp": "2025-10-31T15:30:48.612Z",
  "action": "mission_loaded",
  "user": "username",
  "mission_title": "...",
  "mission_source": "...",
  "concepts_count": 8,
  "mission_hash": "d1d302..."
}
```

**Security concern**: If you discover a way to disable logging without leaving traces, please report it.

### 4. Workbench Integration

The CLI can optionally integrate with an external workbench (eGemma) for:

- Embeddings generation
- SLM/LLM extraction
- Remote AST parsing

**Security considerations**:

- User controls which workbench to use (`WORKBENCH_URL`)
- User controls which models to use
- User controls security mode: `off`, `advisory`, or `strict`

**Security concern**: If you discover vulnerabilities in the workbench client, please report them.

### 5. Local File System Access

The CLI operates on local filesystems and creates a `.open_cognition/` directory.

**Workspace Discovery**:

- The CLI walks backwards from the current directory to find `.open_cognition/` (similar to Git searching for `.git/`)
- Once found, that directory becomes the workspace root
- All operations are scoped to the discovered workspace

**Security considerations**:

- The workspace discovery mechanism walks up the directory tree until `.open_cognition/` is found or filesystem root is reached
- Once workspace is discovered, the CLI operates within workspace boundaries
- The CLI should never transmit local file contents to external services without explicit user permission (via workbench configuration)
- Symlink handling should prevent directory traversal attacks outside the workspace

**Security concern**: If you discover directory traversal vulnerabilities that escape workspace boundaries or unauthorized file access, please report immediately.

## Known Security Limitations

We acknowledge the following limitations:

### 1. LLM-Generated Content

When using Layer 3 (LLM Supervisor) or mission concept extraction:

- **Fidelity score**: 0.70-0.85 (not cryptographic truth)
- **Potential risk**: Hallucinations or biased extractions
- **Mitigation**: Fidelity labeling makes uncertainty transparent

### 2. Git Integration

The lineage overlay (O₃) integrates with Git:

- **Trust assumption**: Git history is assumed trustworthy
- **Potential risk**: Forged git commits could pollute lineage data
- **Mitigation**: Use GPG-signed commits for high-security environments

### 3. External Workbench Dependency

Optional features depend on external workbench:

- **Trust assumption**: Workbench server is controlled by user
- **Potential risk**: Compromised workbench could return malicious data
- **Mitigation**: Fidelity scores + user controls workbench selection

### 4. No Sandboxing for Layer 3

Currently, Layer 3 (LLM Supervisor) is a placeholder and not sandboxed:

- **Current status**: Not fully implemented
- **Future plan**: Sandboxed execution environment
- **Current mitigation**: Clearly marked as low fidelity (0.70)

## Security Best Practices

When using Cognition CLI in production:

1. **Verify Integrity**: Check SHA-256 hashes of all objects
2. **Review Transparency Logs**: Regularly audit `.open_cognition/security/transparency.jsonl`
3. **Control Your Workbench**: Self-host eGemma or use trusted instances only
4. **Use GPG-Signed Commits**: For high-security lineage tracking
5. **Validate Fidelity Scores**: Don't trust low-fidelity data (< 0.85) for critical decisions
6. **Audit Transform History**: Review `.open_cognition/transforms/` for unexpected operations
7. **Security Mode**: Use `strict` mode for mission-critical projects

## Security Advisories

Security advisories will be published via:

- GitHub Security Advisories
- Project README
- Email notification (for known users)
- Project documentation site

## Bug Bounty Program

We do not currently have a bug bounty program. However, we deeply appreciate responsible disclosure and will publicly acknowledge security researchers who help improve the project's security.

## Research and Academic Use

If you're researching security aspects of cryptographically-grounded knowledge systems or semantic alignment infrastructure:

- We welcome academic collaboration
- Please disclose responsibly
- We're happy to provide technical details to aid research
- Consider publishing findings jointly

## Contact

- **Security issues**: <mirza.husadzic@proton.me>
- **General questions**: <https://github.com/mirzahusadzic/cogx/issues>
- **Project maintainer**: Mirza Husadžić

## Attribution

This security policy is inspired by best practices from:

- GitHub Security Lab
- OWASP Vulnerability Disclosure Cheat Sheet
- ISO/IEC 29147 (Vulnerability Disclosure)

---

**Last updated**: November 9, 2025
