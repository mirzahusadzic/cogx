# Verify File Provenance

Audit the transformation history of a file to ensure data integrity.

## Goal

Show the complete, verifiable chain of transformations for a file, demonstrating that the PGC's understanding is grounded in actual code, not hallucination.

## Steps

1. **Ask user which file to audit**
   - Get relative file path (e.g., src/core/auth.ts)
   - Validate file exists in PGC

2. **Run audit command**
   - Execute: `node dist/cli.js audit:transformations <file> --limit 10`
   - Show the transformation history

3. **Present transformation chain**
   For each transformation, show:
   - Timestamp
   - Transform ID (first 8 chars of hash)
   - Method used (native-ast, egemma-parse, etc.)
   - Fidelity score
   - Verification status (✅ Verified, ❌ Failed)
   - Operation type (Genesis, Incremental Update, etc.)

4. **Analyze provenance**
   - Count total transformations
   - Check if all passed verification
   - Identify any gaps or anomalies
   - Verify chain is complete back to genesis

5. **Provide integrity assessment**
   - ✅ VERIFIED: Complete chain, all checks passed
   - ⚠️ PARTIAL: Some transformations missing verification
   - ❌ BROKEN: Failed verifications or gaps in chain

## Output Format

```bash
📜 Transformation History for src/core/auth.ts

Last 10 Transformations:

1. 2025-10-24 08:33:11
   Transform ID: a74c49f8
   Method: native-ast-parse
   Fidelity: 0.95
   Status: ✅ Verified
   Operation: Incremental update (Monument 3)

2. 2025-10-23 14:22:05
   Transform ID: b3b5b9a2
   Method: native-ast-parse
   Fidelity: 0.95
   Status: ✅ Verified
   Operation: Genesis initial parse

... (8 more entries)

✅ PROVENANCE CHAIN: VERIFIED

All transformations passed Oracle verification. The file's history is
complete and cryptographically verifiable back to genesis.

This means you can trust that the PGC's understanding of this file is
grounded in actual code, not hallucination.
```

## Use Cases

1. **Debugging PGC Issues**: "Why does PGC have wrong data for this file?"
2. **Ensuring Integrity**: "Is my PGC data trustworthy?"
3. **Understanding History**: "When did this file enter the PGC?"
4. **Compliance**: "Can I prove this knowledge is verifiable?"

## Notes

- Every transformation has a cryptographic hash
- Failed verifications indicate PGC corruption
- Use this when you suspect PGC data integrity issues
- The chain proves knowledge provenance
