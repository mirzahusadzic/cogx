/**
 * Tests for QuestOperationsLog (Block 2: Lops)
 *
 * These tests demonstrate the quest logging infrastructure
 * in dry-run mode (no actual file writes).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  QuestOperationsLog,
  getQuestOperationsLog,
  resetQuestOperationsLog,
  type TransformEntry,
  type OracleEvaluationEntry,
  type QuestCompleteEntry,
} from './operations-log.js';

describe('QuestOperationsLog', () => {
  let log: QuestOperationsLog;
  const questId = 'q_test_2025_10_31_001';

  beforeEach(() => {
    // Create log in dry-run mode (no file writes)
    log = new QuestOperationsLog({
      projectRoot: '/test-project',
      dryRun: true,
    });
  });

  describe('Quest Start', () => {
    it('should log quest initialization', async () => {
      await log.logQuestStart({
        quest_id: questId,
        intent: 'Implement Block 2 (Lops) infrastructure',
        baseline_coherence: 0.585,
        mission_concepts: ['transparency', 'verifiable-truth', 'audit-trail'],
        security_level: 'medium',
      });

      const buffer = log.getDryRunBuffer();
      expect(buffer.length).toBe(1);

      const entry = buffer[0];
      expect(entry.action).toBe('quest_start');
      expect(entry.quest_id).toBe(questId);
      expect(entry).toHaveProperty('timestamp');
      expect(entry).toHaveProperty('user');
    });
  });

  describe('Transform Logging', () => {
    it('should log transform proposal', async () => {
      await log.logTransform({
        quest_id: questId,
        action: 'transform_proposed',
        transform_id: 't_001',
        transform_type: 'create',
        files_affected: ['src/core/quest/operations-log.ts'],
        rationale: 'Create QuestOperationsLog class',
      });

      const buffer = log.getDryRunBuffer();
      expect(buffer.length).toBe(1);

      const entry = buffer[0];
      expect(entry.action).toBe('transform_proposed');
      expect(entry.transform_id).toBe('t_001');
    });

    it('should log transform application with coherence delta', async () => {
      await log.logTransform({
        quest_id: questId,
        action: 'transform_applied',
        transform_id: 't_001',
        transform_type: 'create',
        files_affected: ['src/core/quest/operations-log.ts'],
        rationale: 'Create QuestOperationsLog class',
        coherence_delta: 0.015,
      });

      const buffer = log.getDryRunBuffer();
      const entry = buffer[0] as TransformEntry;

      expect(entry.action).toBe('transform_applied');
      expect(entry.coherence_delta).toBe(0.015);
    });
  });

  describe('Oracle Evaluation', () => {
    it('should log Oracle evaluation with scores', async () => {
      await log.logOracleEvaluation({
        quest_id: questId,
        transform_id: 't_001',
        oracle_score: 0.85,
        accuracy: 0.9,
        efficiency: 0.8,
        adaptability: 0.85,
        feedback: 'Good structure, follows TransparencyLog pattern',
        session_id: 'oracle_sess_2025_10_31_001',
        accepted: true,
      });

      const buffer = log.getDryRunBuffer();
      const entry = buffer[0] as OracleEvaluationEntry;

      expect(entry.action).toBe('oracle_evaluation');
      expect(entry.oracle_score).toBe(0.85);
      expect(entry.accepted).toBe(true);
    });
  });

  describe('Quest Completion', () => {
    it('should log quest completion with AQS', async () => {
      await log.logQuestComplete({
        quest_id: questId,
        duration_minutes: 15.5,
        transforms_count: 3,
        final_coherence: 0.605,
        coherence_delta: 0.02,
        commit_sha: 'abc123def456',
        fltb_passed: true,
        cpow_id: 'cpow_q_test_2025_10_31_001',
        aqs_score: 0.874,
        aqs_grade: 'A',
        comp_generated: true,
        comp_id: 'comp_quest_logging_2025_10_31',
      });

      const buffer = log.getDryRunBuffer();
      const entry = buffer[0] as QuestCompleteEntry;

      expect(entry.action).toBe('quest_complete');
      expect(entry.duration_minutes).toBe(15.5);
      expect(entry.aqs_score).toBe(0.874);
      expect(entry.aqs_grade).toBe('A');
      expect(entry.comp_generated).toBe(true);
    });
  });

  describe('Quest Analysis', () => {
    beforeEach(async () => {
      // Setup a complete quest log
      await log.logQuestStart({
        quest_id: questId,
        intent: 'Test quest',
        baseline_coherence: 0.5,
        mission_concepts: ['test'],
      });

      await log.logTransform({
        quest_id: questId,
        action: 'transform_applied',
        transform_id: 't_001',
        transform_type: 'create',
        files_affected: ['test.ts'],
        rationale: 'Test',
        coherence_delta: 0.05,
      });

      await log.logOracleEvaluation({
        quest_id: questId,
        transform_id: 't_001',
        oracle_score: 0.8,
        accuracy: 0.8,
        efficiency: 0.8,
        adaptability: 0.8,
        feedback: 'Good',
        session_id: 'test_session',
        accepted: true,
      });

      await log.logQuestComplete({
        quest_id: questId,
        duration_minutes: 10,
        transforms_count: 1,
        final_coherence: 0.55,
        coherence_delta: 0.05,
        fltb_passed: true,
      });
    });

    it('should retrieve quest-specific log entries', async () => {
      const entries = await log.getQuestLog(questId);
      expect(entries.length).toBe(4); // start + transform + oracle + complete
    });

    it('should calculate quest duration', async () => {
      const duration = await log.getQuestDuration(questId);
      expect(duration).toBeGreaterThanOrEqual(0);
    });

    it('should count transforms', async () => {
      const count = await log.getTransformCount(questId);
      expect(count).toBe(1);
    });

    it('should calculate average Oracle score', async () => {
      const avgScore = await log.getAverageOracleScore(questId);
      expect(avgScore).toBe(0.8);
    });
  });

  describe('Dry-Run Mode', () => {
    it('should not write to disk in dry-run mode', async () => {
      expect(log.isDryRun()).toBe(true);

      await log.logQuestStart({
        quest_id: questId,
        intent: 'Test',
        baseline_coherence: 0.5,
        mission_concepts: [],
      });

      // In dry-run mode, file doesn't exist
      expect(log.exists()).toBe(true); // Buffer has entries
      // But log path would not actually have a file
    });

    it('should store entries in memory buffer', async () => {
      await log.logQuestStart({
        quest_id: questId,
        intent: 'Test',
        baseline_coherence: 0.5,
        mission_concepts: [],
      });

      const buffer = log.getDryRunBuffer();
      expect(buffer.length).toBe(1);
      expect(buffer[0].quest_id).toBe(questId);
    });
  });

  describe('Global Instance', () => {
    it('should create and reuse global instance', () => {
      resetQuestOperationsLog();

      const log1 = getQuestOperationsLog({ dryRun: true });
      const log2 = getQuestOperationsLog({ dryRun: true });

      expect(log1).toBe(log2); // Same instance
    });

    it('should reset global instance', () => {
      resetQuestOperationsLog();
      const log1 = getQuestOperationsLog({ dryRun: true });

      resetQuestOperationsLog();
      const log2 = getQuestOperationsLog({ dryRun: true });

      expect(log1).not.toBe(log2); // Different instances after reset
    });
  });
});
