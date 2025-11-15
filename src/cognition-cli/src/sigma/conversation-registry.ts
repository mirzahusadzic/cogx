/**
 * Conversation Overlay Registry
 *
 * Central registry for all 7 conversation overlays (O1-O7).
 * Mirrors OverlayRegistry but for conversation lattice stored in .sigma/
 *
 * DESIGN:
 * - Same interface as OverlayRegistry
 * - Points to .sigma/overlays/ instead of .open_cognition/overlays/
 * - Enables Meet operations between conversation and project lattices
 *
 * USAGE:
 * ```typescript
 * const conversationRegistry = new ConversationOverlayRegistry(sigmaRoot);
 * const structural = await conversationRegistry.get('O1');
 *
 * // Meet: Conversation ∧ Project
 * const projectRegistry = new OverlayRegistry(pgcRoot);
 * const alignment = await meet(
 *   await conversationRegistry.get('O1'),
 *   await projectRegistry.get('O1')
 * );
 * ```
 */

import { OverlayAlgebra } from '../core/algebra/overlay-algebra.js';
import { ConversationStructuralManager } from './overlays/conversation-structural/manager.js';
import { ConversationSecurityManager } from './overlays/conversation-security/manager.js';
import { ConversationLineageManager } from './overlays/conversation-lineage/manager.js';
import { ConversationMissionManager } from './overlays/conversation-mission/manager.js';
import { ConversationOperationalManager } from './overlays/conversation-operational/manager.js';
import { ConversationMathematicalManager } from './overlays/conversation-mathematical/manager.js';
import { ConversationCoherenceManager } from './overlays/conversation-coherence/manager.js';
import { AsyncMutex } from './utils/AsyncMutex.js';

/**
 * Overlay identifiers (same as project)
 */
export type OverlayId = 'O1' | 'O2' | 'O3' | 'O4' | 'O5' | 'O6' | 'O7';

/**
 * Extended interface for conversation overlay managers with lifecycle methods
 */
interface ConversationOverlayWithLifecycle extends OverlayAlgebra {
  flush(sessionId: string): Promise<void>;
  clearMemory(): void;
  initializeLanceStore?(): Promise<void>;
  setCurrentSession?(sessionId: string): void;
}

/**
 * Metadata about a conversation overlay
 */
export interface ConversationOverlayInfo {
  id: OverlayId;
  name: string;
  description: string;
}

/**
 * Registry of all conversation overlay managers
 */
export class ConversationOverlayRegistry {
  private managers = new Map<OverlayId, OverlayAlgebra>();
  private workbenchUrl?: string;
  private debug: boolean;
  private writeMutex = new AsyncMutex(); // Serialize LanceDB writes

  constructor(
    private sigmaRoot: string,
    workbenchUrl?: string,
    debug?: boolean
  ) {
    this.workbenchUrl = workbenchUrl;
    this.debug = debug || false;
  }

  /**
   * Get conversation overlay manager by ID
   *
   * Lazy-initializes the manager on first access and caches it for reuse.
   * Automatically initializes the LanceDB store if supported by the manager.
   *
   * @param overlayId - Overlay identifier (O1-O7)
   * @returns Promise resolving to the overlay manager instance
   *
   * @example
   * const structural = await registry.get('O1');
   * const results = await structural.query("TUI architecture", 5);
   */
  async get(overlayId: OverlayId): Promise<OverlayAlgebra> {
    // Return cached manager if exists
    if (this.managers.has(overlayId)) {
      return this.managers.get(overlayId)!;
    }

    // Create and cache manager
    const manager = this.createManager(overlayId);

    // Initialize LanceDB store if supported
    if (
      'initializeLanceStore' in manager &&
      typeof (manager as ConversationOverlayWithLifecycle)
        .initializeLanceStore === 'function'
    ) {
      await (manager as ConversationOverlayWithLifecycle)
        .initializeLanceStore!();
    }

    this.managers.set(overlayId, manager);
    return manager;
  }

  /**
   * Get multiple overlays at once
   *
   * @param overlayIds - Array of overlay identifiers to retrieve
   * @returns Promise resolving to a map of overlay IDs to their managers
   */
  async getAll(
    overlayIds: OverlayId[]
  ): Promise<Map<OverlayId, OverlayAlgebra>> {
    const result = new Map<OverlayId, OverlayAlgebra>();
    for (const id of overlayIds) {
      result.set(id, await this.get(id));
    }
    return result;
  }

  /**
   * Get information about all conversation overlays
   *
   * @returns Array of metadata for all 7 conversation overlays
   */
  getOverlayInfo(): ConversationOverlayInfo[] {
    return [
      {
        id: 'O1',
        name: 'Structural',
        description: 'Architecture/design discussions',
      },
      {
        id: 'O2',
        name: 'Security',
        description: 'Security concerns raised',
      },
      {
        id: 'O3',
        name: 'Lineage',
        description: 'Knowledge evolution ("earlier we...")',
      },
      {
        id: 'O4',
        name: 'Mission',
        description: 'Goals/objectives for session',
      },
      {
        id: 'O5',
        name: 'Operational',
        description: 'Commands/actions executed',
      },
      {
        id: 'O6',
        name: 'Mathematical',
        description: 'Algorithms/logic discussed',
      },
      {
        id: 'O7',
        name: 'Coherence',
        description: 'Topic drift and conversation flow',
      },
    ];
  }

  /**
   * Create manager instance based on overlay ID
   *
   * @param overlayId - Overlay identifier to create manager for
   * @returns Overlay manager instance implementing OverlayAlgebra interface
   *
   * @throws Error if overlay ID is unknown
   *
   * @private
   */
  private createManager(overlayId: OverlayId): OverlayAlgebra {
    const workbenchUrl = this.workbenchUrl;
    const debug = this.debug;

    switch (overlayId) {
      case 'O1':
        return new ConversationStructuralManager(
          this.sigmaRoot,
          workbenchUrl,
          debug
        );
      case 'O2':
        return new ConversationSecurityManager(
          this.sigmaRoot,
          workbenchUrl,
          debug
        );
      case 'O3':
        return new ConversationLineageManager(
          this.sigmaRoot,
          workbenchUrl,
          debug
        );
      case 'O4':
        return new ConversationMissionManager(
          this.sigmaRoot,
          workbenchUrl,
          debug
        );
      case 'O5':
        return new ConversationOperationalManager(
          this.sigmaRoot,
          workbenchUrl,
          debug
        );
      case 'O6':
        return new ConversationMathematicalManager(
          this.sigmaRoot,
          workbenchUrl,
          debug
        );
      case 'O7':
        return new ConversationCoherenceManager(
          this.sigmaRoot,
          workbenchUrl,
          debug
        );
      default:
        throw new Error(`Unknown conversation overlay: ${overlayId}`);
    }
  }

  /**
   * Flush all in-memory overlays to disk
   *
   * Uses write mutex to serialize LanceDB writes and prevent
   * "Too many concurrent writers" errors.
   *
   * @param sessionId - Session UUID to flush turns for
   *
   * @example
   * await registry.flushAll(sessionId);
   * console.log('All conversation overlays persisted to LanceDB');
   */
  async flushAll(sessionId: string): Promise<void> {
    return this.writeMutex.runLocked(async () => {
      const allOverlays: OverlayId[] = [
        'O1',
        'O2',
        'O3',
        'O4',
        'O5',
        'O6',
        'O7',
      ];

      for (const overlayId of allOverlays) {
        const manager = await this.get(overlayId);

        // Use type assertion to access flush method
        if (
          'flush' in manager &&
          typeof (manager as ConversationOverlayWithLifecycle).flush ===
            'function'
        ) {
          await (manager as ConversationOverlayWithLifecycle).flush(sessionId);
        }
      }
    });
  }

  /**
   * Clear all in-memory overlays (after flush)
   *
   * Frees memory after overlay data has been persisted to disk.
   * Call this after flushAll() to reset in-memory state.
   */
  async clearAllMemory(): Promise<void> {
    const allOverlays: OverlayId[] = ['O1', 'O2', 'O3', 'O4', 'O5', 'O6', 'O7'];

    for (const overlayId of allOverlays) {
      const manager = await this.get(overlayId);

      // Use type assertion to access clearMemory method
      if (
        'clearMemory' in manager &&
        typeof (manager as ConversationOverlayWithLifecycle).clearMemory ===
          'function'
      ) {
        (manager as ConversationOverlayWithLifecycle).clearMemory();
      }
    }
  }

  /**
   * Set current session ID for all managers (for LanceDB filtering)
   *
   * Updates all initialized overlay managers to filter queries by the current session.
   * Only affects managers that have already been lazy-loaded.
   *
   * @param sessionId - Session UUID to set as current
   */
  async setCurrentSession(sessionId: string): Promise<void> {
    const allOverlays: OverlayId[] = ['O1', 'O2', 'O3', 'O4', 'O5', 'O6', 'O7'];

    for (const overlayId of allOverlays) {
      // Only set session if manager is already initialized
      if (this.managers.has(overlayId)) {
        const manager = this.managers.get(overlayId)!;

        if (
          'setCurrentSession' in manager &&
          typeof (manager as ConversationOverlayWithLifecycle)
            .setCurrentSession === 'function'
        ) {
          (manager as ConversationOverlayWithLifecycle).setCurrentSession!(
            sessionId
          );
        }
      }
    }
  }
}
