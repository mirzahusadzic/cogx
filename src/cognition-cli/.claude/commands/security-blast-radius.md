# Security Blast Radius Analysis

When the user asks about security impact or blast radius of a file/symbol, use the PGC security blast radius command to analyze cascading security threats using O₂ (Security Guidelines) + O₃ (Blast Radius).

## Analysis Steps

**IMPORTANT**: Use the `cognition-cli security blast-radius` command which automatically combines O₂ + O₃ data.

### Step 1: Run Security Blast Radius Analysis

```bash
cognition-cli security blast-radius <file-or-symbol> --json
```

This command outputs:

- `target`: Symbol and file path
- `security_threats`: Threats from O₂ with severity, CVE, mitigation
- `blast_radius`: Consumers, dependencies, critical paths from O₃
- `risk_assessment`: Combined severity and data exposure
- `recommendations`: Automated security recommendations

### Step 2: Parse and Enhance the Output

Take the JSON output and expand it into a comprehensive security report following this structure:

## Report Structure

```text
## Security Blast Radius Analysis Report

**Target**: <symbol from JSON>
**Type**: Symbol (Class/Function)
**Location**: <filePath from JSON>
**Analysis Date**: <current date>

---

## 🔐 Security Threats (O₂)

**Applicable Threats**: <count from JSON>

[For each threat in security_threats array]:

### Threat N: <securityType> (<severity>)
- **Severity**: <severity>
- **CVE**: <cveId if present>
- **Similarity**: <similarity * 100>%
- **Description**: <description from threat.text>
- **Attack Vector**: <inferred from securityType>
- **Mitigation**: <mitigation from threat>

**Severity Distribution**:
- Critical: <count threats where severity = "critical">
- High: <count where severity = "high">
- Medium: <count where severity = "medium">
- Low: <count where severity = "low">

---

## 💥 Blast Radius (O₃)

**Direct Consumers**: <direct_consumers count>
**Transitive Impact**: <transitive_impact count> symbols
**Max Depth**: <max_depth> levels

### Direct Consumers (What depends on this):

[For each consumer in blast_radius.consumers]:
1. **<symbol>** in `<filePath>`
   - Role: <role>
   - Impact: <describe based on role>

### Dependencies (What this depends on):

[For each dependency in blast_radius.dependencies]:
- <symbol> in `<filePath>` (role: <role>)

---

## 🔴 Critical Security Paths

[For each path in blast_radius.critical_paths]:

### Critical Path N: <reason> (depth: <depth>)

```

<path[0]> → <path[1]> → <path[2]> → ... → <path[n]>

```

**Impact**: <explain based on threat types + path reason>

---

## 📊 Data Exposure Assessment

**From risk_assessment.data_exposure**:

[Analyze and format the data_exposure field]

### Data Types at Risk:
- Credentials: <Yes/No based on threats>
- PII: <Yes/No>
- API keys: <Yes/No>
- Organizational data: <Yes/No>

---

## 🎯 Risk Assessment

**Overall Severity**: <risk_assessment.severity from JSON>

### Risk Factors:

#### 1. Attack Vector Severity: <level>
- Number of threats: <security_threats.count>
- Highest severity: <max severity from threats>
- Attack types: <list securityType values>

#### 2. Blast Radius Size: <SMALL/MEDIUM/LARGE>
- Direct consumers: <count>
- Total impacted: <transitive_impact>
- Max depth: <max_depth>

#### 3. Data Sensitivity: <level>
[Based on threat descriptions and data_exposure]

#### 4. Attack Complexity: <LOW/MEDIUM/HIGH>
[Based on similarity scores - higher similarity = lower complexity]

**Combined Risk Score**: <calculate 0-100> / 100

```

Attack Vector (30 pts): <X>/30
Blast Radius (25 pts): <X>/25
Data Sensitivity (25 pts): <X>/25
Attack Complexity (20 pts): <X>/20
───────────────────────────────────
Total: <X>/100

```

---

## 🛠️ Remediation Priorities

[Parse recommendations from JSON and categorize by severity + blast radius]

### 🔴 Critical (Fix Immediately)

[Threats where severity="critical" OR (severity="high" AND transitive_impact > 20)]

1. **<threat.securityType>**
   - **Mitigation**: <threat.mitigation>
   - **Affected**: <list critical path endpoints>

### 🟡 High Priority (Fix Within 1 Week)

[Threats where severity="high" OR (severity="medium" AND transitive_impact > 10)]

### 🟢 Medium Priority

[Remaining threats]

---

## Recommended Actions

[Use recommendations array from JSON output]

1. <recommendation[0]>
2. <recommendation[1]>
3. <recommendation[2]>

---

## 📊 Executive Summary

**<Target> Compromise = <describe worst-case based on threats + blast radius>**

| Metric | Value | Severity |
|--------|-------|----------|
| **Direct Consumers** | <count> | <level> |
| **Transitive Impact** | <count> | <level> |
| **Security Threats** | <count> | <level> |
| **Risk Score** | <X>/100 | <level> |

**Immediate Actions Required**:
[List top 3-5 critical remediations]
```

## Grounding Requirements

**MUST USE PGC COMMAND**:

1. ✅ Run `cognition-cli security blast-radius <target> --json`
2. ✅ Parse the JSON output
3. ✅ Use ONLY data from the command output
4. ✅ Expand and format into comprehensive report
5. ❌ Do NOT read source files
6. ❌ Do NOT invent threats not in JSON
7. ❌ Do NOT provide generic security advice

**If command fails**:

- Check if overlays are generated: `cognition-cli status`
- Tell user to run `cognition-cli wizard` if PGC not initialized
- Tell user to run `cognition-cli overlay generate security_guidelines` if O₂ missing
- Tell user to run `cognition-cli overlay generate structural_patterns` if O₃ missing

## Example Usage

User: "What's the security blast radius of SnowflakeClient?"

**Step 1**: Run command

```bash
cognition-cli security blast-radius SnowflakeClient --json
```

**Step 2**: Parse JSON output

```json
{
  "target": {
    "symbol": "SnowflakeClient",
    "filePath": "src/ingestion/snowflake_ingestor/api_client.py"
  },
  "security_threats": {
    "count": 3,
    "threats": [
      {
        "type": "SQL Injection",
        "severity": "critical",
        "description": "...",
        "similarity": 0.95,
        "cveId": "CVE-2024-XXXX",
        "mitigation": "Use parameterized queries"
      },
      ...
    ]
  },
  "blast_radius": {
    "direct_consumers": 3,
    "transitive_impact": 15,
    "max_depth": 4,
    "consumers": [...],
    "critical_paths": [...]
  },
  "risk_assessment": {
    "severity": "HIGH",
    "data_exposure": [...]
  }
}
```

**Step 3**: Format into comprehensive report using the structure above

## What Makes a Good Report

✅ **DO**:

- Use all data from JSON output
- Expand threat descriptions with context
- Explain critical paths clearly
- Provide actionable remediations
- Calculate concrete risk scores
- Organize by priority

❌ **DON'T**:

- Add information not in JSON
- Read source files
- Invent vulnerabilities
- Provide generic advice
- Skip any section - use "None found" if empty

The goal is to take the PGC-generated data and present it as a professional security audit report.
