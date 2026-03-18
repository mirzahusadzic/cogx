import { OverlayAlgebra } from '../core/algebra/overlay-algebra.js';
import { ConversationLanceStore } from './conversation-lance-store.js';
import { ConversationOverlayManager } from './overlays/conversation-overlay-manager.js';
import { CONVERSATION_OVERLAY_CONFIGS } from './overlays/types.js';
import { AsyncMutex } from './utils/AsyncMutex.js';
import { systemDiagnosticsService } from '../core/services/diagnostics/SystemDiagnosticsService.js';
import { AsyncBaseRegistry } from '../core/common/registry.js';

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
export class ConversationOverlayRegistry extends AsyncBaseRegistry<OverlayAlgebra> {
  private workbenchUrl?: string;
  private debug: boolean;
  private writeMutex = new AsyncMutex(); // Serialize LanceDB writes
  private currentSessionId: string | null = null; // Store session ID for lazy-loaded managers
  private lanceStore: ConversationLanceStore;

  constructor(
    private sigmaRoot: string,
    workbenchUrl?: string,
    debug?: boolean
  ) {
    super('ConversationOverlayRegistry');
    this.workbenchUrl = workbenchUrl;
    this.debug = debug || false;
    this.lanceStore = new ConversationLanceStore(sigmaRoot);
  }

  /**
   * Get conversation overlay manager by ID
   *
   * Lazy-initializes the manager on first access and caches it for reuse.
   * Automatically initializes the LanceDB store if supported by the manager.
   *
   * @param overlayId - Overlay identifier (O1-O7)
   * @returns Promise resolving to the overlay manager instance
   */
  override async get(overlayId: string): Promise<OverlayAlgebra> {
    const isNew = !this.has(overlayId);
    const manager = await super.get(overlayId);

    if (isNew) {
      // CRITICAL FIX: Set current session ID on newly created manager
      if (this.debug) {
        systemDiagnosticsService.systemLog(
          'sigma',
          `[Registry] Creating ${overlayId}`,
          {
            currentSessionId: this.currentSessionId || 'NULL',
          }
        );
      }

      if (this.currentSessionId && 'setCurrentSession' in manager) {
        if (this.debug) {
          systemDiagnosticsService.systemLog(
            'sigma',
            `[Registry] Setting session ${this.currentSessionId} on ${overlayId}`
          );
        }
        (manager as ConversationOverlayWithLifecycle).setCurrentSession!(
          this.currentSessionId
        );
      }

      // Initialize LanceDB store if supported
      if (
        'initializeLanceStore' in manager &&
        typeof (manager as ConversationOverlayWithLifecycle)
          .initializeLanceStore === 'function'
      ) {
        await (manager as ConversationOverlayWithLifecycle)
          .initializeLanceStore!();
      }
    }

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
    return Object.values(CONVERSATION_OVERLAY_CONFIGS).map((config) => ({
      id: config.id as OverlayId,
      name: config.name,
      description: config.description,
    }));
  }

  /**
   * Create manager instance based on overlay ID
   *
   * @param overlayId - Overlay identifier to create manager for
   * @returns Promise resolving to overlay manager instance
   * @protected
   */
  protected async createItem(overlayId: string): Promise<OverlayAlgebra> {
    const config = CONVERSATION_OVERLAY_CONFIGS[overlayId as OverlayId];
    if (!config) {
      throw new Error(`Unknown conversation overlay: ${overlayId}`);
    }

    return new ConversationOverlayManager(
      this.sigmaRoot,
      config,
      this.workbenchUrl,
      this.debug,
      this.lanceStore
    );
  }

  /**
   * Flush all in-memory overlays to disk
   *
   * @param sessionId - Session UUID to flush turns for
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
   */
  async clearAllMemory(): Promise<void> {
    const allOverlays: OverlayId[] = ['O1', 'O2', 'O3', 'O4', 'O5', 'O6', 'O7'];

    for (const overlayId of allOverlays) {
      const manager = await this.get(overlayId);

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
   * Set current session ID for all managers
   *
   * @param sessionId - Session UUID to set as current
   */
  async setCurrentSession(sessionId: string): Promise<void> {
    if (this.debug) {
      systemDiagnosticsService.systemLog(
        'sigma',
        `setCurrentSession called with: ${sessionId}`
      );
    }
    this.currentSessionId = sessionId;

    const allOverlays: OverlayId[] = ['O1', 'O2', 'O3', 'O4', 'O5', 'O6', 'O7'];

    for (const overlayId of allOverlays) {
      // Set session on already initialized managers
      if (this.has(overlayId)) {
        // We know it's already there, so get() will be fast/sync
        const manager = await this.get(overlayId);

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
