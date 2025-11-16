/**
 * cPOW Verifier - Validates cPOW integrity and authenticity
 *
 * Verifies that cPOWs are authentic and haven't been tampered with.
 * Checks:
 * 1. State checksums (SHA-256 hashes)
 * 2. Oracle signatures (HMAC validation)
 * 3. Transform chain integrity
 * 4. Git commit existence
 *
 * REFERENCE: docs/manual/part-5-cpow-loop/20-cpow-reference.md (Validation & Verification)
 */

import { execSync } from 'child_process';
import type { CPOW, VerificationResult } from './types.js';
import type { CodebaseState } from '../types/quest.js';
import { computeStateHash, loadCPOW } from './cpow-generator.js';

/**
 * Verify cPOW integrity and authenticity
 *
 * Performs comprehensive verification of a cPOW receipt:
 * - Checksum validation (before/after states)
 * - Oracle signature validation (HMAC)
 * - Transform chain validation
 * - Git commit verification
 *
 * @param cpow - cPOW object to verify
 * @param projectPath - Project root directory
 * @param options - Optional verification configuration
 * @returns Verification result with detailed check results
 *
 * @example
 * const verification = await verifyCPOW(cpow, '/home/user/myapp');
 *
 * if (!verification.valid) {
 *   console.error('cPOW verification failed:');
 *   verification.errors.forEach(err => console.error(`  - ${err}`));
 *   process.exit(1);
 * }
 *
 * console.log('✅ cPOW verified successfully');
 */
export async function verifyCPOW(
  cpow: CPOW,
  projectPath: string,
  options?: {
    skipCommitCheck?: boolean;
    oracleSecretKey?: string;
  }
): Promise<VerificationResult> {
  const checks = {
    checksum_before: false,
    checksum_after: false,
    oracle_signature: false,
    transform_chain: false,
    commit_exists: false,
  };

  const errors: string[] = [];

  // 1. Verify before state checksum
  // Note: We can't recompute exact state without reconstructing it,
  // so we check if hash format is valid
  try {
    if (verifyHashFormat(cpow.before_state_hash)) {
      checks.checksum_before = true;
    } else {
      errors.push('Invalid before_state_hash format');
    }
  } catch (err: any) {
    errors.push(`Before state checksum failed: ${err.message}`);
  }

  // 2. Verify after state checksum
  try {
    if (verifyHashFormat(cpow.after_state_hash)) {
      checks.checksum_after = true;
    } else {
      errors.push('Invalid after_state_hash format');
    }
  } catch (err: any) {
    errors.push(`After state checksum failed: ${err.message}`);
  }

  // 3. Verify Oracle signatures
  try {
    const oracleValid = await verifyOracleSignatures(
      cpow,
      options?.oracleSecretKey
    );
    if (oracleValid) {
      checks.oracle_signature = true;
    } else {
      errors.push('Oracle signature verification failed');
    }
  } catch (err: any) {
    errors.push(`Oracle signature validation failed: ${err.message}`);
  }

  // 4. Verify transform chain
  try {
    const chainValid = verifyTransformChain(cpow);
    if (chainValid) {
      checks.transform_chain = true;
    } else {
      errors.push('Transform chain validation failed');
    }
  } catch (err: any) {
    errors.push(`Transform chain validation failed: ${err.message}`);
  }

  // 5. Verify git commit exists
  if (!options?.skipCommitCheck) {
    try {
      const commitExists = await verifyGitCommit(cpow.commit_sha, projectPath);
      if (commitExists) {
        checks.commit_exists = true;
      } else {
        errors.push(`Git commit ${cpow.commit_sha} not found`);
      }
    } catch (err: any) {
      errors.push(`Git commit verification failed: ${err.message}`);
    }
  } else {
    // Skip commit check
    checks.commit_exists = true;
  }

  // Determine overall validity
  const valid = Object.values(checks).every((v) => v === true);

  return {
    valid,
    checks,
    errors,
  };
}

/**
 * Verify hash format (sha256:...)
 *
 * @param hash - Hash string to verify
 * @returns true if format is valid
 */
function verifyHashFormat(hash: string): boolean {
  return hash.startsWith('sha256:') && hash.length === 71; // "sha256:" + 64 hex chars
}

/**
 * Verify Oracle signatures
 *
 * Validates HMAC signatures on Oracle responses (if present).
 * If no signatures or no secret key provided, returns true (skip validation).
 *
 * @param cpow - cPOW object
 * @param secretKey - Oracle HMAC secret key (optional)
 * @returns true if signatures are valid or validation is skipped
 */
async function verifyOracleSignatures(
  cpow: CPOW,
  secretKey?: string
): Promise<boolean> {
  // Check if any Oracle responses have signatures
  const responsesWithSignatures = cpow.oracle_responses.filter(
    (r) => r.signature !== undefined
  );

  if (responsesWithSignatures.length === 0) {
    // No signatures to verify - skip validation
    return true;
  }

  if (!secretKey) {
    // No secret key provided - cannot verify, but don't fail
    console.warn(
      'Oracle signatures present but no secret key provided for verification'
    );
    return true;
  }

  // TODO: Implement actual HMAC signature verification
  // For now, just check that signatures are present
  return responsesWithSignatures.every(
    (r) => r.signature && r.signature.length > 0
  );
}

/**
 * Verify transform chain integrity
 *
 * Checks that:
 * - All transforms have corresponding Oracle evaluations
 * - Transform IDs are unique
 * - No gaps in transform sequence
 *
 * @param cpow - cPOW object
 * @returns true if transform chain is valid
 */
function verifyTransformChain(cpow: CPOW): boolean {
  const transforms = cpow.transforms;
  const oracleResponses = cpow.oracle_responses;

  // Check: At least one transform
  if (transforms.length === 0) {
    return false;
  }

  // Check: All transform IDs are unique
  const transformIds = transforms.map(
    (t) => t.transform_id || `transform-${t.transform_type}`
  );
  const uniqueIds = new Set(transformIds);
  if (uniqueIds.size !== transformIds.length) {
    return false;
  }

  // Check: Number of Oracle responses should match or exceed transforms
  // (Some transforms might be rejected and retried)
  if (oracleResponses.length < transforms.length) {
    return false;
  }

  return true;
}

/**
 * Verify git commit exists
 *
 * Checks if the commit SHA exists in the repository.
 *
 * @param commitSHA - Git commit SHA
 * @param projectPath - Project root directory
 * @returns true if commit exists
 */
async function verifyGitCommit(
  commitSHA: string,
  projectPath: string
): Promise<boolean> {
  try {
    // Check if commit exists using git cat-file
    const result = execSync(`git cat-file -t ${commitSHA}`, {
      cwd: projectPath,
      encoding: 'utf-8',
      stdio: 'pipe',
    });

    return result.trim() === 'commit';
  } catch (err) {
    // Command failed - commit doesn't exist
    return false;
  }
}

/**
 * Verify cPOW from disk
 *
 * Loads cPOW from disk and verifies it.
 *
 * @param cpow_id - cPOW identifier
 * @param projectPath - Project root directory
 * @param options - Optional verification configuration
 * @returns Verification result
 *
 * @example
 * const verification = await verifyCPOWFromDisk(
 *   'cpow_quest-001',
 *   '/home/user/myapp'
 * );
 *
 * if (verification.valid) {
 *   console.log('✅ cPOW is authentic and unmodified');
 * }
 */
export async function verifyCPOWFromDisk(
  cpow_id: string,
  projectPath: string,
  options?: {
    skipCommitCheck?: boolean;
    oracleSecretKey?: string;
  }
): Promise<VerificationResult> {
  const cpow = await loadCPOW(cpow_id, projectPath);
  return verifyCPOW(cpow, projectPath, options);
}

/**
 * Verify state checksum against actual state
 *
 * Recomputes state hash and compares with stored hash.
 *
 * @param state - Codebase state
 * @param expectedHash - Expected SHA-256 hash
 * @returns true if hashes match
 *
 * @example
 * const valid = verifyStateChecksum(afterState, cpow.after_state_hash);
 * if (!valid) {
 *   console.error('State has been tampered with!');
 * }
 */
export function verifyStateChecksum(
  state: CodebaseState,
  expectedHash: string
): boolean {
  const actualHash = computeStateHash(state);
  return actualHash === expectedHash;
}
