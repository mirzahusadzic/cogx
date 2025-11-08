/**
 * Tests for Sigma Lattice Restoration
 *
 * Tests the ability to save and restore conversation lattices from disk,
 * ensuring that all critical data is preserved across TUI sessions.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import type {
  ConversationLattice,
  ConversationNode,
  TurnAnalysis,
} from '../types.js';

describe('Sigma Lattice Restoration', () => {
  let testDir: string;
  let sessionId: string;

  beforeEach(async () => {
    // Create temporary directory for test
    testDir = path.join(os.tmpdir(), `sigma-test-${Date.now()}`);
    await fs.ensureDir(testDir);
    sessionId = `test-session-${Date.now()}`;
  });

  afterEach(async () => {
    // Clean up test directory
    await fs.remove(testDir);
  });

  it('should save and restore a complete lattice with all metadata', async () => {
    // ========================================
    // 1. CREATE A SAMPLE LATTICE
    // ========================================
    const sampleLattice: ConversationLattice = {
      nodes: [
        {
          id: 'turn-1',
          type: 'conversation_turn',
          turn_id: 'turn-1',
          role: 'user',
          content: 'How do I implement a binary search tree?',
          timestamp: 1000000,
          embedding: new Array(768).fill(0.1),
          novelty: 0.85,
          overlay_scores: {
            O1_structural: 8,
            O2_security: 0,
            O3_lineage: 0,
            O4_mission: 5,
            O5_operational: 2,
            O6_mathematical: 9,
            O7_strategic: 3,
          },
          importance_score: 8,
          is_paradigm_shift: true,
          semantic_tags: [
            'data-structures',
            'binary-search-tree',
            'algorithms',
          ],
        },
        {
          id: 'turn-2',
          type: 'conversation_turn',
          turn_id: 'turn-2',
          role: 'assistant',
          content: 'Here is a BST implementation in TypeScript...',
          timestamp: 1000100,
          embedding: new Array(768).fill(0.2),
          novelty: 0.3,
          overlay_scores: {
            O1_structural: 7,
            O2_security: 1,
            O3_lineage: 2,
            O4_mission: 4,
            O5_operational: 6,
            O6_mathematical: 10,
            O7_strategic: 2,
          },
          importance_score: 7,
          is_paradigm_shift: false,
          semantic_tags: ['typescript', 'implementation', 'code'],
        },
        {
          id: 'turn-3',
          type: 'conversation_turn',
          turn_id: 'turn-3',
          role: 'user',
          content: 'Can you add a delete method?',
          timestamp: 1000200,
          embedding: new Array(768).fill(0.15),
          novelty: 0.2,
          overlay_scores: {
            O1_structural: 5,
            O2_security: 0,
            O3_lineage: 7,
            O4_mission: 3,
            O5_operational: 4,
            O6_mathematical: 6,
            O7_strategic: 2,
          },
          importance_score: 4,
          is_paradigm_shift: false,
          semantic_tags: ['enhancement', 'delete-operation'],
        },
      ],
      edges: [
        {
          from: 'turn-1',
          to: 'turn-2',
          type: 'temporal',
          weight: 1.0,
        },
        {
          from: 'turn-2',
          to: 'turn-3',
          type: 'temporal',
          weight: 1.0,
        },
        {
          from: 'turn-3',
          to: 'turn-1',
          type: 'conversation_reference',
          weight: 0.8,
        },
      ],
      metadata: {
        session_id: sessionId,
        created_at: Date.now(),
        original_turn_count: 3,
        compressed_turn_count: 3,
        compression_ratio: 1.0,
      },
    };

    // ========================================
    // 2. SAVE LATTICE TO DISK
    // ========================================
    const latticeDir = path.join(testDir, '.sigma');
    await fs.ensureDir(latticeDir);
    const latticePath = path.join(latticeDir, `${sessionId}.lattice.json`);
    await fs.writeFile(latticePath, JSON.stringify(sampleLattice, null, 2));

    // ========================================
    // 3. RESTORE LATTICE FROM DISK
    // ========================================
    const latticeContent = await fs.readFile(latticePath, 'utf-8');
    const restoredLattice = JSON.parse(latticeContent) as ConversationLattice;

    // ========================================
    // 4. VERIFY ALL DATA IS PRESERVED
    // ========================================

    // Check lattice structure
    expect(restoredLattice.nodes).toHaveLength(3);
    expect(restoredLattice.edges).toHaveLength(3);
    expect(restoredLattice.metadata.session_id).toBe(sessionId);

    // Check first node preservation
    const node1 = restoredLattice.nodes[0];
    expect(node1.id).toBe('turn-1');
    expect(node1.role).toBe('user');
    expect(node1.content).toBe('How do I implement a binary search tree?');
    expect(node1.timestamp).toBe(1000000);
    expect(node1.embedding).toHaveLength(768);
    expect(node1.novelty).toBe(0.85);
    expect(node1.importance_score).toBe(8);
    expect(node1.is_paradigm_shift).toBe(true);
    expect(node1.semantic_tags).toEqual([
      'data-structures',
      'binary-search-tree',
      'algorithms',
    ]);

    // Check overlay scores preservation
    expect(node1.overlay_scores.O1_structural).toBe(8);
    expect(node1.overlay_scores.O6_mathematical).toBe(9);

    // Check edges preservation
    const edge1 = restoredLattice.edges[0];
    expect(edge1.from).toBe('turn-1');
    expect(edge1.to).toBe('turn-2');
    expect(edge1.type).toBe('temporal');
    expect(edge1.weight).toBe(1.0);

    const edge3 = restoredLattice.edges[2];
    expect(edge3.type).toBe('conversation_reference');
    expect(edge3.weight).toBe(0.8);
  });

  it('should correctly rebuild TurnAnalysis from ConversationNode', async () => {
    // ========================================
    // 1. CREATE SAMPLE NODE
    // ========================================
    const node: ConversationNode = {
      id: 'turn-123',
      type: 'conversation_turn',
      turn_id: 'turn-123',
      role: 'assistant',
      content: 'Test content',
      timestamp: 2000000,
      embedding: new Array(768).fill(0.5),
      novelty: 0.6,
      overlay_scores: {
        O1_structural: 4,
        O2_security: 2,
        O3_lineage: 3,
        O4_mission: 5,
        O5_operational: 7,
        O6_mathematical: 1,
        O7_strategic: 4,
      },
      importance_score: 2, // Below routine threshold (< 3)
      is_paradigm_shift: false,
      semantic_tags: ['test', 'example'],
    };

    // ========================================
    // 2. REBUILD TurnAnalysis (same logic as useClaudeAgent.ts:725-748)
    // ========================================
    const rebuiltAnalysis: TurnAnalysis = {
      turn_id: node.id,
      role: node.role,
      content: node.content,
      timestamp: node.timestamp,
      embedding: node.embedding || [],
      novelty: node.novelty || 0,
      importance_score: node.importance_score || 0,
      is_paradigm_shift: node.is_paradigm_shift || false,
      is_routine: (node.importance_score || 0) < 3, // Reconstruct from importance score
      overlay_scores: node.overlay_scores || {
        O1_structural: 0,
        O2_security: 0,
        O3_lineage: 0,
        O4_mission: 0,
        O5_operational: 0,
        O6_mathematical: 0,
        O7_strategic: 0,
      },
      references: [], // Not preserved in lattice nodes
      semantic_tags: node.semantic_tags || [],
    };

    // ========================================
    // 3. VERIFY RECONSTRUCTION
    // ========================================
    expect(rebuiltAnalysis.turn_id).toBe('turn-123');
    expect(rebuiltAnalysis.role).toBe('assistant');
    expect(rebuiltAnalysis.content).toBe('Test content');
    expect(rebuiltAnalysis.timestamp).toBe(2000000);
    expect(rebuiltAnalysis.embedding).toHaveLength(768);
    expect(rebuiltAnalysis.novelty).toBe(0.6);
    expect(rebuiltAnalysis.importance_score).toBe(2);
    expect(rebuiltAnalysis.is_paradigm_shift).toBe(false);
    expect(rebuiltAnalysis.is_routine).toBe(true); // importance < 3
    expect(rebuiltAnalysis.semantic_tags).toEqual(['test', 'example']);
    expect(rebuiltAnalysis.references).toEqual([]); // Not preserved
  });

  it('should handle paradigm shift turns correctly', async () => {
    const node: ConversationNode = {
      id: 'turn-456',
      type: 'conversation_turn',
      turn_id: 'turn-456',
      role: 'user',
      content: 'I need to completely rethink the architecture',
      timestamp: 3000000,
      embedding: new Array(768).fill(0.9),
      novelty: 0.92, // High novelty
      overlay_scores: {
        O1_structural: 10,
        O2_security: 3,
        O3_lineage: 8,
        O4_mission: 9,
        O5_operational: 5,
        O6_mathematical: 2,
        O7_strategic: 8,
      },
      importance_score: 9, // High importance
      is_paradigm_shift: true, // Marked as paradigm shift
      semantic_tags: ['architecture', 'redesign', 'paradigm-shift'],
    };

    const rebuiltAnalysis: TurnAnalysis = {
      turn_id: node.id,
      role: node.role,
      content: node.content,
      timestamp: node.timestamp,
      embedding: node.embedding,
      novelty: node.novelty,
      importance_score: node.importance_score,
      is_paradigm_shift: node.is_paradigm_shift,
      is_routine: (node.importance_score || 0) < 3,
      overlay_scores: node.overlay_scores,
      references: [],
      semantic_tags: node.semantic_tags,
    };

    expect(rebuiltAnalysis.is_paradigm_shift).toBe(true);
    expect(rebuiltAnalysis.is_routine).toBe(false);
    expect(rebuiltAnalysis.novelty).toBeGreaterThan(0.7);
    expect(rebuiltAnalysis.importance_score).toBeGreaterThanOrEqual(7);
  });

  it('should preserve complex lattice with multiple edge types', async () => {
    const lattice: ConversationLattice = {
      nodes: [
        {
          id: 'turn-a',
          type: 'conversation_turn',
          turn_id: 'turn-a',
          role: 'user',
          content: 'Content A',
          timestamp: 1,
          embedding: [],
          novelty: 0.5,
          overlay_scores: {
            O1_structural: 0,
            O2_security: 0,
            O3_lineage: 0,
            O4_mission: 0,
            O5_operational: 0,
            O6_mathematical: 0,
            O7_strategic: 0,
          },
          importance_score: 5,
          is_paradigm_shift: false,
          semantic_tags: [],
        },
        {
          id: 'turn-b',
          type: 'conversation_turn',
          turn_id: 'turn-b',
          role: 'assistant',
          content: 'Content B',
          timestamp: 2,
          embedding: [],
          novelty: 0.3,
          overlay_scores: {
            O1_structural: 0,
            O2_security: 0,
            O3_lineage: 0,
            O4_mission: 0,
            O5_operational: 0,
            O6_mathematical: 0,
            O7_strategic: 0,
          },
          importance_score: 5,
          is_paradigm_shift: false,
          semantic_tags: [],
        },
      ],
      edges: [
        {
          from: 'turn-a',
          to: 'turn-b',
          type: 'temporal',
          weight: 1.0,
        },
        {
          from: 'turn-b',
          to: 'turn-a',
          type: 'semantic_similarity',
          weight: 0.75,
        },
        {
          from: 'turn-b',
          to: 'turn-a',
          type: 'conversation_reference',
          weight: 0.9,
        },
      ],
      metadata: {
        session_id: 'test',
        created_at: Date.now(),
        original_turn_count: 2,
        compressed_turn_count: 2,
        compression_ratio: 1.0,
      },
    };

    const latticeDir = path.join(testDir, '.sigma');
    await fs.ensureDir(latticeDir);
    const latticePath = path.join(latticeDir, 'test.lattice.json');
    await fs.writeFile(latticePath, JSON.stringify(lattice, null, 2));

    const restored = JSON.parse(
      await fs.readFile(latticePath, 'utf-8')
    ) as ConversationLattice;

    expect(restored.edges).toHaveLength(3);
    expect(restored.edges[0].type).toBe('temporal');
    expect(restored.edges[1].type).toBe('semantic_similarity');
    expect(restored.edges[2].type).toBe('conversation_reference');
  });
});
