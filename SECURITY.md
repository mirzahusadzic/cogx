# Security Policy

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

If you have discovered a security vulnerability, please report it privately via email to: **<mirza.husadzic@proton.me>**

This project is a solo research effort. I will do my best to respond and address vulnerabilities as quickly as possible.

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

### 3. Transparency Logging

All mission operations are logged to `.open_cognition/security/transparency.jsonl`.

### 4. Workbench Integration

The CLI can optionally integrate with an external workbench (eGemma) for embeddings and LLM/SLM operations.

**Security considerations**:
- User controls which workbench to use (`WORKBENCH_URL`)
- User controls security mode: `off`, `advisory`, or `strict`
- Symlink handling should prevent directory traversal attacks outside the workspace

## Known Security Limitations

### 1. LLM-Generated Content

- **Fidelity score**: 0.70-0.85 (not cryptographic truth)
- **Potential risk**: Hallucinations or biased extractions
- **Mitigation**: Fidelity labeling makes uncertainty transparent

### 2. Git Integration

The lineage overlay (O₃) integrates with Git:
- **Trust assumption**: Git history is assumed trustworthy
- **Potential risk**: Forged git commits could pollute lineage data

### 3. External Workbench Dependency

Optional features depend on external workbench:
- **Trust assumption**: Workbench server is controlled by user
- **Potential risk**: Compromised workbench could return malicious data

### 4. No Sandboxing for Layer 3

Currently, Layer 3 (LLM Supervisor) is a placeholder and not sandboxed:
- **Future plan**: Sandboxed execution environment

## Security Best Practices

1. **Verify Integrity**: Check SHA-256 hashes of all objects
2. **Review Transparency Logs**: Regularly audit `.open_cognition/security/transparency.jsonl`
3. **Control Your Workbench**: Self-host eGemma or use trusted instances only
4. **Use GPG-Signed Commits**: For high-security lineage tracking
5. **Validate Fidelity Scores**: Don't trust low-fidelity data (< 0.85) for critical decisions

## Research and Academic Use

If you're researching security aspects of cryptographically-grounded knowledge systems or semantic alignment infrastructure:

- We welcome academic collaboration
- Please disclose responsibly
- We're happy to provide technical details to aid research

## Contact

- **Security issues**: <mirza.husadzic@proton.me>
- **Project maintainer**: Mirza Husadžić

---

**Last updated**: March 17, 2026
