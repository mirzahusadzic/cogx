/**
 * cPOW Generator - Creates immutable computational receipts
 *
 * Generates cPOW (Cognitive Proof of Work) receipts from quest execution data.
 * cPOWs are stored in `.open_cognition/pgc/cpow/` and serve as cryptographic
 * proof that work was done, validated, and committed.
 *
 * ALGORITHM:
 * 1. Compute SHA-256 hashes of before/after states
 * 2. Calculate duration from timestamps
 * 3. Aggregate Oracle responses
 * 4. Serialize all quest artifacts
 * 5. Generate cPOW document
 * 6. Store to disk
 *
 * REFERENCE: docs/manual/part-5-cpow-loop/20-cpow-reference.md (Phase 6)
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import type { CPOW, CPOWOptions } from './types.js';
import type { CodebaseState } from '../types/quest.js';

/**
 * Generate cPOW (Cognitive Proof of Work) receipt
 *
 * Creates an immutable computational receipt proving that work was performed,
 * validated by Oracle, and committed to version control.
 *
 * @param options - cPOW generation options
 * @returns Generated cPOW object
 *
 * @example
 * const cpow = await generateCPOW({
 *   quest: quest,
 *   transforms: transforms,
 *   oracleResponses: oracleResponses,
 *   fltbResult: fltbResult,
 *   commitSHA: commitSHA,
 *   beforeState: beforeState,
 *   afterState: afterState,
 *   agent: 'claude-sonnet-4'
 * });
 *
 * console.log(`cPOW generated: ${cpow.cpow_id}`);
 * console.log(`Duration: ${cpow.duration_minutes.toFixed(1)} minutes`);
 * console.log(`Coherence Δ: ${cpow.coherence.delta >= 0 ? '+' : ''}${cpow.coherence.delta.toFixed(3)}`);
 */
export async function generateCPOW(options: CPOWOptions): Promise<CPOW> {
  const {
    quest,
    transforms,
    oracleResponses,
    fltbResult,
    commitSHA,
    beforeState,
    afterState,
    agent,
  } = options;

  // Generate cPOW ID
  const cpow_id = `cpow_${quest.quest_id}`;

  // Compute timestamps
  const timestamp_end = new Date().toISOString();
  const timestamp_start = quest.timestamp_start;

  // Calculate duration in minutes
  const start = new Date(timestamp_start);
  const end = new Date(timestamp_end);
  const duration_minutes = (end.getTime() - start.getTime()) / (1000 * 60);

  // Compute state hashes (SHA-256)
  const before_state_hash = computeStateHash(beforeState);
  const after_state_hash = computeStateHash(afterState);

  // Extract coherence values
  const coherence_before = beforeState.coherence;
  const coherence_after = afterState.coherence;
  const coherence_delta = coherence_after - coherence_before;

  // Create cPOW object
  const cpow: CPOW = {
    cpow_id,
    quest_id: quest.quest_id,
    intent: quest.intent,
    timestamp_start,
    timestamp_end,
    duration_minutes,
    commit_sha: commitSHA,
    before_state_hash,
    after_state_hash,
    transforms,
    oracle_responses: oracleResponses,
    fltb_validation: fltbResult,
    coherence: {
      before: coherence_before,
      after: coherence_after,
      delta: coherence_delta,
    },
    agent,
    security_level: quest.security_level,
  };

  return cpow;
}

/**
 * Store cPOW to disk
 *
 * Writes cPOW to `.open_cognition/pgc/cpow/<cpow_id>.json`.
 *
 * @param cpow - cPOW object to store
 * @param projectPath - Project root directory
 *
 * @example
 * await storeCPOW(cpow, '/home/user/myapp');
 * // Writes to: /home/user/myapp/.open_cognition/pgc/cpow/cpow_quest-001.json
 */
export async function storeCPOW(
  cpow: CPOW,
  projectPath: string
): Promise<void> {
  const cpowDir = path.join(projectPath, '.open_cognition', 'pgc', 'cpow');

  // Ensure directory exists
  if (!fs.existsSync(cpowDir)) {
    fs.mkdirSync(cpowDir, { recursive: true });
  }

  // Write cPOW to file
  const cpowPath = path.join(cpowDir, `${cpow.cpow_id}.json`);
  fs.writeFileSync(cpowPath, JSON.stringify(cpow, null, 2), 'utf-8');

  console.log(`✅ cPOW stored: ${cpowPath}`);
}

/**
 * Load cPOW from disk
 *
 * Reads cPOW from `.open_cognition/pgc/cpow/<cpow_id>.json`.
 *
 * @param cpow_id - cPOW identifier
 * @param projectPath - Project root directory
 * @returns Loaded cPOW object
 *
 * @example
 * const cpow = await loadCPOW('cpow_quest-001', '/home/user/myapp');
 */
export async function loadCPOW(
  cpow_id: string,
  projectPath: string
): Promise<CPOW> {
  const cpowPath = path.join(
    projectPath,
    '.open_cognition',
    'pgc',
    'cpow',
    `${cpow_id}.json`
  );

  if (!fs.existsSync(cpowPath)) {
    throw new Error(`cPOW not found: ${cpowPath}`);
  }

  const content = fs.readFileSync(cpowPath, 'utf-8');
  return JSON.parse(content) as CPOW;
}

/**
 * List all cPOWs in project
 *
 * @param projectPath - Project root directory
 * @returns Array of cPOW IDs
 *
 * @example
 * const cpowIds = await listCPOWs('/home/user/myapp');
 * console.log(`Found ${cpowIds.length} cPOWs`);
 */
export async function listCPOWs(projectPath: string): Promise<string[]> {
  const cpowDir = path.join(projectPath, '.open_cognition', 'pgc', 'cpow');

  if (!fs.existsSync(cpowDir)) {
    return [];
  }

  const files = fs.readdirSync(cpowDir);
  return files
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.replace('.json', ''));
}

/**
 * Compute SHA-256 hash of codebase state
 *
 * Creates a deterministic hash by serializing state properties in canonical order.
 *
 * @param state - Codebase state to hash
 * @returns SHA-256 hash (hex string)
 *
 * @example
 * const hash = computeStateHash(state);
 * // Returns: "sha256:abc123def456..."
 */
export function computeStateHash(state: CodebaseState): string {
  // Serialize state in canonical order
  const canonical = {
    timestamp: state.timestamp,
    coherence: state.coherence,
    symbols_count: state.symbols.length,
    file_count: state.file_count || 0,
    commit_sha: state.commit_sha || '',
    // Note: We don't hash full symbols array to keep hash stable
    // even if symbol order changes. Instead, use count + coherence.
  };

  const content = JSON.stringify(canonical);
  const hash = crypto.createHash('sha256').update(content).digest('hex');
  return `sha256:${hash}`;
}

/**
 * Generate cPOW and store to disk (convenience function)
 *
 * Combines generateCPOW() and storeCPOW() into one call.
 *
 * @param options - cPOW generation options
 * @param projectPath - Project root directory
 * @returns Generated cPOW object
 *
 * @example
 * const cpow = await generateAndStoreCPOW({
 *   quest: quest,
 *   transforms: transforms,
 *   oracleResponses: oracleResponses,
 *   fltbResult: fltbResult,
 *   commitSHA: commitSHA,
 *   beforeState: beforeState,
 *   afterState: afterState
 * }, '/home/user/myapp');
 */
export async function generateAndStoreCPOW(
  options: CPOWOptions,
  projectPath: string
): Promise<CPOW> {
  const cpow = await generateCPOW(options);
  await storeCPOW(cpow, projectPath);
  return cpow;
}
