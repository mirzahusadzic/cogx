/**
 * Overlay Registry
 *
 * Central registry mapping overlay IDs (O1, O2, O4, O5, O6, O7) to manager instances.
 * Enables algebraic operations by providing unified access to all overlays.
 *
 * DESIGN:
 * - Single source of truth for overlay lookup
 * - Lazy initialization (managers created on demand)
 * - Type-safe access to domain-specific managers
 *
 * USAGE:
 * ```typescript
 * const registry = new OverlayRegistry(pgcRoot);
 * const security = await registry.get('O2');
 * const mission = await registry.get('O4');
 *
 * // Now perform lattice operations
 * const aligned = await meet(
 *   await security.filter(m => m.type === 'attack_vector'),
 *   await mission.filter(m => m.type === 'principle')
 * );
 * ```
 */

import { OverlayAlgebra } from './overlay-algebra.js';
import { MissionConceptsManager } from '../overlays/mission-concepts/manager.js';
import { SecurityGuidelinesManager } from '../overlays/security-guidelines/manager.js';
import { OperationalPatternsManager } from '../overlays/operational-patterns/manager.js';
import { MathematicalProofsManager } from '../overlays/mathematical-proofs/manager.js';
import { StructuralPatternsManager } from '../overlays/structural-patterns/manager.js';
import { LineageAlgebraAdapter } from '../overlays/lineage/algebra-adapter.js';
import { CoherenceAlgebraAdapter } from '../overlays/strategic-coherence/algebra-adapter.js';

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
 * Registry of all overlay managers in the PGC
 */
export class OverlayRegistry {
  private managers = new Map<OverlayId, OverlayAlgebra>();
  private workbenchUrl?: string;

  constructor(
    private pgcRoot: string,
    workbenchUrl?: string
  ) {
    this.workbenchUrl = workbenchUrl;
  }

  /**
   * Get overlay manager by ID
   * Lazy-initializes the manager on first access
   */
  async get(overlayId: OverlayId): Promise<OverlayAlgebra> {
    // Return cached manager if exists
    if (this.managers.has(overlayId)) {
      return this.managers.get(overlayId)!;
    }

    // Create and cache manager
    const manager = this.createManager(overlayId);
    this.managers.set(overlayId, manager);
    return manager;
  }

  /**
   * Get multiple overlays at once
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
   * Note: Managers will need to be refactored to implement OverlayAlgebra
   */
  private createManager(overlayId: OverlayId): OverlayAlgebra {
    switch (overlayId) {
      case 'O1':
        return new StructuralPatternsManager(this.pgcRoot, this.workbenchUrl);

      case 'O2':
        return new SecurityGuidelinesManager(this.pgcRoot, this.workbenchUrl);

      case 'O3':
        return new LineageAlgebraAdapter(
          this.pgcRoot,
          this.workbenchUrl
        );

      case 'O4':
        return new MissionConceptsManager(this.pgcRoot, this.workbenchUrl);

      case 'O5':
        return new OperationalPatternsManager(this.pgcRoot, this.workbenchUrl);

      case 'O6':
        return new MathematicalProofsManager(this.pgcRoot, this.workbenchUrl);

      case 'O7':
        return new CoherenceAlgebraAdapter(
          this.pgcRoot,
          this.workbenchUrl
        );

      default:
        throw new Error(`Unknown overlay ID: ${overlayId}`);
    }
  }
}

/**
 * Create a registry instance for a PGC root
 */
export function createOverlayRegistry(
  pgcRoot: string,
  workbenchUrl?: string
): OverlayRegistry {
  return new OverlayRegistry(pgcRoot, workbenchUrl);
}
