/**
 * Quest Operations Log - Demo
 *
 * Demonstrates a complete quest workflow with operations logging
 * Running in DRY-RUN mode (no actual file writes)
 */

import { QuestOperationsLog } from '../src/core/quest/index.js';

async function demoQuestWorkflow() {
  console.log('='.repeat(70));
  console.log('QUEST OPERATIONS LOG - DRY RUN DEMONSTRATION');
  console.log('='.repeat(70));
  console.log();

  // Create log in dry-run mode
  const log = new QuestOperationsLog({
    projectRoot: process.cwd(),
    dryRun: true, // NO ACTUAL WRITES
  });

  const questId = 'q_2025_10_31_demo';
  const startTime = Date.now();

  // ========================================================================
  // PHASE 1: Quest Initialization
  // ========================================================================
  console.log('📋 PHASE 1: Quest Initialization');
  console.log('-'.repeat(70));

  await log.logQuestStart({
    quest_id: questId,
    intent: 'Implement Block 2 (Lops) infrastructure for quest tracking',
    baseline_coherence: 0.585,
    mission_concepts: [
      'transparency',
      'verifiable-truth',
      'audit-trail',
      'cryptographic-grounding',
    ],
    security_level: 'medium',
  });

  console.log();
  await sleep(500);

  // ========================================================================
  // PHASE 2: G→T→O Feedback Loop (3 transforms)
  // ========================================================================
  console.log('🔄 PHASE 2: G→T→O Feedback Loop');
  console.log('-'.repeat(70));

  // Transform 1: Create operations-log.ts
  console.log('\n[Transform 1: Create QuestOperationsLog class]');
  await log.logTransform({
    quest_id: questId,
    action: 'transform_proposed',
    transform_id: 't_001',
    transform_type: 'create',
    files_affected: ['src/core/quest/operations-log.ts'],
    rationale:
      'Create QuestOperationsLog class following TransparencyLog pattern',
  });

  await log.logTransform({
    quest_id: questId,
    action: 'transform_applied',
    transform_id: 't_001',
    transform_type: 'create',
    files_affected: ['src/core/quest/operations-log.ts'],
    rationale:
      'Create QuestOperationsLog class following TransparencyLog pattern',
    coherence_delta: 0.012,
  });

  await log.logOracleEvaluation({
    quest_id: questId,
    transform_id: 't_001',
    oracle_score: 0.85,
    accuracy: 0.9,
    efficiency: 0.8,
    adaptability: 0.85,
    feedback:
      'Good structure, follows TransparencyLog pattern. Consider adding dry-run mode.',
    session_id: 'oracle_sess_demo_001',
    accepted: true,
  });

  await sleep(500);

  // Transform 2: Add dry-run functionality
  console.log('\n[Transform 2: Add dry-run mode]');
  await log.logTransform({
    quest_id: questId,
    action: 'transform_proposed',
    transform_id: 't_002',
    transform_type: 'modify',
    files_affected: ['src/core/quest/operations-log.ts'],
    rationale: 'Add dry-run mode per Oracle feedback',
  });

  await log.logTransform({
    quest_id: questId,
    action: 'transform_applied',
    transform_id: 't_002',
    transform_type: 'modify',
    files_affected: ['src/core/quest/operations-log.ts'],
    rationale: 'Add dry-run mode per Oracle feedback',
    coherence_delta: 0.008,
  });

  await log.logOracleEvaluation({
    quest_id: questId,
    transform_id: 't_002',
    oracle_score: 0.88,
    accuracy: 0.92,
    efficiency: 0.85,
    adaptability: 0.87,
    feedback: 'Excellent addition. Dry-run mode enables safe testing.',
    session_id: 'oracle_sess_demo_002',
    accepted: true,
  });

  await sleep(500);

  // Transform 3: Add comprehensive tests
  console.log('\n[Transform 3: Add test coverage]');
  await log.logTransform({
    quest_id: questId,
    action: 'transform_proposed',
    transform_id: 't_003',
    transform_type: 'create',
    files_affected: ['src/core/quest/operations-log.test.ts'],
    rationale: 'Add comprehensive test coverage',
  });

  await log.logTransform({
    quest_id: questId,
    action: 'transform_applied',
    transform_id: 't_003',
    transform_type: 'create',
    files_affected: ['src/core/quest/operations-log.test.ts'],
    rationale: 'Add comprehensive test coverage',
    coherence_delta: 0.005,
  });

  await log.logOracleEvaluation({
    quest_id: questId,
    transform_id: 't_003',
    oracle_score: 0.82,
    accuracy: 0.88,
    efficiency: 0.78,
    adaptability: 0.8,
    feedback: 'Good test coverage. Consider adding integration tests.',
    session_id: 'oracle_sess_demo_003',
    accepted: true,
  });

  console.log();
  await sleep(500);

  // ========================================================================
  // PHASE 3-8: Completion (F.L.T.B → Commit → cPOW → AQS → CoMP)
  // ========================================================================
  console.log('✅ PHASES 3-8: Validation & Completion');
  console.log('-'.repeat(70));

  const endTime = Date.now();
  const durationMinutes = (endTime - startTime) / (1000 * 60);

  await log.logQuestComplete({
    quest_id: questId,
    duration_minutes: durationMinutes,
    transforms_count: 3,
    final_coherence: 0.61,
    coherence_delta: 0.025,
    commit_sha: 'abc123def456789012345678901234567890abcd',
    fltb_passed: true,
    cpow_id: 'cpow_q_2025_10_31_demo',
    aqs_score: 0.867,
    aqs_grade: 'A',
    comp_generated: true,
    comp_id: 'comp_quest_logging_2025_10_31',
  });

  console.log();
  console.log('='.repeat(70));
  console.log('QUEST ANALYSIS');
  console.log('='.repeat(70));

  // Analyze quest from log
  const entries = await log.getQuestLog(questId);
  const transformCount = await log.getTransformCount(questId);
  const avgOracleScore = await log.getAverageOracleScore(questId);
  const duration = await log.getQuestDuration(questId);

  console.log(`📊 Total log entries: ${entries.length}`);
  console.log(`🔨 Transforms applied: ${transformCount}`);
  console.log(`🔮 Average Oracle score: ${avgOracleScore?.toFixed(3)}`);
  console.log(`⏱️  Duration: ${duration?.toFixed(2)} minutes`);

  console.log();
  console.log('='.repeat(70));
  console.log('DRY-RUN BUFFER INSPECTION');
  console.log('='.repeat(70));

  const buffer = log.getDryRunBuffer();
  console.log(`\n📦 Entries stored in memory (not on disk): ${buffer.length}`);
  console.log(`📁 Would be written to: ${log.getLogPath()}`);
  console.log(`💾 Disk writes: 0 (dry-run mode)`);

  console.log();
  console.log('✅ Demo complete! Block 2 (Lops) infrastructure is ready.');
  console.log('   Next: Disable dry-run mode to enable actual logging.');
  console.log();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Run demo
demoQuestWorkflow().catch((err) => {
  console.error('Demo failed:', err);
  process.exit(1);
});
