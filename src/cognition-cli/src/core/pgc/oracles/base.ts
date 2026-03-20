import { PGCManager } from '../manager.js';
import { VerificationResult } from '../../types/verification.js';

/**
 * Abstract base class for PGC Oracles (integrity validators).
 *
 * Oracles are the "immune system" of the Grounded Context Pool (PGC).
 * They ensure internal consistency, referential integrity, and synchronization
 * across the different layers of the PGC.
 */
export abstract class AbstractOracle {
  /**
   * Create a new oracle instance.
   *
   * @param pgcManager - PGC manager instance for accessing index, object store, and overlays
   */
  constructor(protected pgcManager: PGCManager) {}

  /**
   * Perform a complete integrity verification of the layer managed by this oracle.
   *
   * @returns Verification result with success status and diagnostic messages
   */
  abstract verify(): Promise<VerificationResult>;
}
