import { OverlayAlgebra } from './overlay-algebra.js';
import { MissionConceptsManager } from '../overlays/mission-concepts/manager.js';
import { SecurityGuidelinesManager } from '../overlays/security-guidelines/manager.js';
import { OperationalPatternsManager } from '../overlays/operational-patterns/manager.js';
import { MathematicalProofsManager } from '../overlays/mathematical-proofs/manager.js';
import { StructuralPatternsManager } from '../overlays/structural-patterns/manager.js';
import { LineageAlgebraAdapter } from '../overlays/lineage/algebra-adapter.js';
import { CoherenceAlgebraAdapter } from '../overlays/strategic-coherence/algebra-adapter.js';
import { AsyncBaseRegistry } from '../common/registry.js';

/**
 * Overlay identifiers following the lattice architecture
 */
export type OverlayId = 'O1' | 'O2' | 'O3' | 'O4' | 'O5' | 'O6' | 'O7';

/**
 * Metadata about an overlay
 */
export interface OverlayInfo {
  id: OverlayId;
  name: string;
  description: string;
  supportedTypes: string[];
}

/**
 * Status of an overlay including warnings
 */
export interface OverlayStatus {
  hasData: boolean;
  warning?: string;
  count?: number;
}

/**
 * Registry of all overlay managers in the PGC
 */
export class OverlayRegistry extends AsyncBaseRegistry<OverlayAlgebra> {
  private workbenchUrl?: string;

  /**
   * Create a new overlay registry
   *
   * @param pgcRoot - Root directory of the PGC (Grounded Context Pool)
   * @param workbenchUrl - Optional URL for workbench API access
   */
  constructor(
    private pgcRoot: string,
    workbenchUrl?: string
  ) {
    super('OverlayRegistry');
    this.workbenchUrl = workbenchUrl;
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
   * Get information about all available overlays
   *
   * @returns Array of overlay metadata including IDs, names, descriptions, and supported types
   */
  getOverlayInfo(): OverlayInfo[] {
    return [
      {
        id: 'O1',
        name: 'Structure',
        description: 'Code artifacts (AST, dependencies, symbols)',
        supportedTypes: ['symbol', 'function', 'class', 'module'],
      },
      {
        id: 'O2',
        name: 'Security',
        description: 'Threat models, mitigations, constraints [FOUNDATIONAL]',
        supportedTypes: [
          'threat_model',
          'attack_vector',
          'mitigation',
          'boundary',
          'constraint',
          'vulnerability',
        ],
      },
      {
        id: 'O3',
        name: 'Lineage',
        description: 'Dependency graph, blast radius, call chains',
        supportedTypes: ['dependency', 'call_chain', 'impact_zone'],
      },
      {
        id: 'O4',
        name: 'Mission',
        description: 'Strategic vision, purpose, goals, principles',
        supportedTypes: ['concept', 'principle', 'goal', 'vision'],
      },
      {
        id: 'O5',
        name: 'Operational',
        description: 'Workflow patterns, quest structure, sacred sequences',
        supportedTypes: [
          'quest_structure',
          'sacred_sequence',
          'workflow_pattern',
          'depth_rule',
          'terminology',
        ],
      },
      {
        id: 'O6',
        name: 'Mathematical',
        description: 'Theorems, proofs, lemmas, formal properties',
        supportedTypes: ['theorem', 'lemma', 'axiom', 'proof', 'identity'],
      },
      {
        id: 'O7',
        name: 'Coherence',
        description: 'Cross-layer alignment scoring',
        supportedTypes: ['alignment', 'coherence_score', 'drift'],
      },
    ];
  }

  /**
   * Check if an overlay exists and has data
   *
   * @param overlayId - Overlay identifier to check
   * @returns Promise resolving to true if the overlay has data, false otherwise
   */
  async hasData(overlayId: OverlayId): Promise<boolean> {
    try {
      const manager = await this.get(overlayId);
      const items = await manager.getAllItems();
      return items.length > 0;
    } catch {
      return false;
    }
  }

  /**
   * Get list of overlays that have data
   *
   * @returns Promise resolving to array of overlay IDs that contain data
   */
  async getPopulatedOverlays(): Promise<OverlayId[]> {
    const overlayIds: OverlayId[] = ['O1', 'O2', 'O3', 'O4', 'O5', 'O6', 'O7'];
    const populated: OverlayId[] = [];

    for (const id of overlayIds) {
      if (await this.hasData(id)) {
        populated.push(id);
      }
    }

    return populated;
  }

  /**
   * Create manager instance for overlay
   *
   * @param overlayId - Overlay identifier to create manager for
   * @returns Promise resolving to overlay manager instance
   * @protected
   */
  protected async createItem(overlayId: string): Promise<OverlayAlgebra> {
    switch (overlayId) {
      case 'O1':
        return new StructuralPatternsManager(this.pgcRoot, this.workbenchUrl);

      case 'O2':
        return new SecurityGuidelinesManager(this.pgcRoot, this.workbenchUrl);

      case 'O3':
        return new LineageAlgebraAdapter(this.pgcRoot, this.workbenchUrl);

      case 'O4':
        return new MissionConceptsManager(this.pgcRoot, this.workbenchUrl);

      case 'O5':
        return new OperationalPatternsManager(this.pgcRoot, this.workbenchUrl);

      case 'O6':
        return new MathematicalProofsManager(this.pgcRoot, this.workbenchUrl);

      case 'O7':
        return new CoherenceAlgebraAdapter(this.pgcRoot, this.workbenchUrl);

      default:
        throw new Error(`Unknown overlay ID: ${overlayId}`);
    }
  }
}

/**
 * Create a registry instance for a PGC root
 *
 * @param pgcRoot - Root directory of the PGC (Grounded Context Pool)
 * @param workbenchUrl - Optional URL for workbench API access
 * @returns New OverlayRegistry instance
 */
export function createOverlayRegistry(
  pgcRoot: string,
  workbenchUrl?: string
): OverlayRegistry {
  return new OverlayRegistry(pgcRoot, workbenchUrl);
}
