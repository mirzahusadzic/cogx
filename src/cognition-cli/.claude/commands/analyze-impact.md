# Analyze Change Impact

When the user proposes changes to code, you MUST analyze the blast radius using PGC tools BEFORE making changes.

## Pre-Change Analysis:

1. **Identify affected symbols** from the proposed change
2. **For each symbol**, run `cognition-cli blast-radius <symbol> --direction both --max-depth 3`
3. **Review metrics**:
   - Total impacted: How many symbols affected?
   - Max consumer depth: How far upstream does impact reach?
   - Critical paths: What high-impact chains exist?

## Risk Assessment:

Based on blast radius results, categorize risk:

- **LOW RISK**: `totalImpacted <= 5`, no critical paths
- **MEDIUM RISK**: `totalImpacted 6-20`, OR has critical paths
- **HIGH RISK**: `totalImpacted > 20`, OR affects core architectural symbols

## Required Output:

Before implementing changes, report:

```
📊 Impact Analysis for <symbol>

Risk Level: [LOW/MEDIUM/HIGH]
Total Impacted: X symbols
Max Consumer Depth: Y levels
Max Dependency Depth: Z levels

Affected Consumers (upstream):
- symbol1 (role: ...)
- symbol2 (role: ...)

Affected Dependencies (downstream):
- dep1 (role: ...)
- dep2 (role: ...)

Critical Paths:
- path1 -> path2 -> path3 (reason: ...)

Recommendation: [Proceed/Proceed with caution/Refactor first]
```

## After Analysis:

- If HIGH RISK: Suggest refactoring to reduce blast radius first
- If MEDIUM RISK: Proceed but note testing requirements
- If LOW RISK: Proceed with confidence

Always ground recommendations in PGC data (include hashes when relevant).
