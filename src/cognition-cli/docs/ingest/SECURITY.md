# Security Guidelines

> _Verifiable boundaries prevent unauthorized cognitive drift._

## Security Philosophy

**Trust nothing; verify everything.**

Cognition CLI operates on sensitive codebases and interacts with external AI models. We assume that any external input (including LLM responses) could be malicious. We design our system to minimize the "blast radius" of any compromise.

**We protect the integrity of the user's code and the privacy of their intellectual property.**

## Threat Model

### Assets

Critical assets requiring protection:

- **Source Code**: Intellectual property residing in the user's local filesystem.
- **PGC Index**: The generated knowledge graph (.open_cognition) which contains semantic maps of the code.
- **API Keys**: Credentials for LLM providers (OpenAI, Anthropic, etc.).
- **User Session**: The interactive TUI state and history.
- **Cognitive Profile**: The learned preferences and history of the project.

### Threats

**Threat**: Prompt Injection
**Severity**: HIGH
**Attack Vector**: Malicious content in source files designed to trick the LLM.
**Impact**: The LLM could be coerced into misinterpreting code or suggesting malicious patches.
**Mitigation**:

- Isolate context: Use clear delimiters between system instructions and user code.
- Output validation: Verify that LLM responses adhere to strict JSON schemas.
- Human review: All code changes must be approved by the user.

**Outstanding Risks**:

- Sophisticated adversarial attacks on LLM context windows.

---

**Threat**: Data Exfiltration
**Severity**: CRITICAL
**Attack Vector**: Malicious tool or dependency sending code to unauthorized servers.
**Impact**: Loss of proprietary intellectual property.
**Mitigation**:

- Strict outbound allowlist: Only connect to configured LLM provider APIs.
- Local-first processing: Indexing and embedding happens locally (unless using cloud embedding API).
- No telemetry by default: User must opt-in to any data sharing.

**Outstanding Risks**:

- Compromised dependencies in `node_modules`.

---

**Threat**: Embedding Poisoning
**Severity**: MEDIUM
**Attack Vector**: Inserting "invisible" text or specific patterns to skew semantic search.
**Impact**: The "Ask" command retrieves irrelevant or misleading information.
**Mitigation**:

- Sanitization: Strip invisible characters and excessive whitespace before embedding.
- Relevance thresholds: Discard results with low similarity scores.

**Outstanding Risks**:

- Semantic collisions in vector space.

---

**Threat**: Cognitive Drift Attacks
**Severity**: HIGH
**Attack Vector**: Adversarial code patterns or embeddings that slowly shift O4 alignment.
**Impact**: The system's understanding of "mission" drifts away from the original intent.
**Mitigation**:

- **Coherence Locking**: Pinning specific overlay hashes in `cognition.json`.
- **Drift Alerts**: CI/CD failure if coherence drops below threshold.

## Security Boundaries

### Boundary 1: Filesystem Access

**Constraint**: The CLI must never read or write outside the project root (except for config in `~/.cognition-cli`).
**Enforcement**: Path normalization checks on all file I/O operations.
**Exception**: Explicit user configuration of external knowledge bases.

### Boundary 2: Network Traffic

**Constraint**: Outbound requests are limited to whitelisted LLM providers.
**Enforcement**: Centralized `WorkbenchClient` handles all requests.
**Exception**: `fetch_url` tool if explicitly invoked by the user.

### Boundary 3: Tool Execution

**Constraint**: Tools (bash, edit_file) cannot run without user confirmation in high-risk modes.
**Enforcement**: The TUI prompts for approval before executing destructive actions.
**Exception**: "Auto-mode" if explicitly enabled by the user (use with caution).

## Known Vulnerabilities

### CVE-COG-001: Context Window Overflow

**Component**: LLM Context Management
**Severity**: MEDIUM
**Description**: Extremely large files can truncate context, potentially hiding malicious code from the LLM's view.
**Affected Versions**: < 0.5.0
**Mitigation**: Use chunking and sliding windows (implemented in `src/utils/chunking.ts`).
**Status**: ACCEPTED_RISK (Mitigated by chunking)

## Security Requirements

### Authentication Requirements

**Implemented:**

- API Key management via secure storage or environment variables.
- Session tokens for PGC access (if using cloud backend).

**Outstanding Gaps:**

- Hardware key support for signing commits.

### Audit Requirements

**Implemented:**

- `audit` command tracks PGC transformations.
- Operation logs are stored in `.sigma/logs`.

**Outstanding Gaps:**

- Tamper-evident logging (merkle chain of logs).

## Deployment Recommendations

### Local Development (Default)

Secure environment for personal or team projects.

- Keep `.open_cognition` in `.gitignore` if it contains sensitive embeddings.
- Rotate API keys regularly.

### CI/CD Pipeline

Automated environment.

- Use read-only API keys where possible.
- Run in a sandboxed container.

## Incident Response

### If Key Compromise Detected

Immediate Actions:

1. Revoke the exposed API key immediately at the provider.
2. Update the configuration with a new key.
3. Check usage logs for unauthorized activity.

### If Unexpected Network Activity

Immediate Actions:

1. Kill the `cognition-cli` process.
2. Inspect network logs.
3. Report potential dependency compromise.

---

**Security is a continuous process of verification, not a one-time check.**
