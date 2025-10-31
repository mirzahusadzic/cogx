/**
 * Quest Infrastructure (Block 2: Lops)
 *
 * Exports quest operations logging for cPOW operational loop
 */

export {
  QuestOperationsLog,
  getQuestOperationsLog,
  resetQuestOperationsLog,
  type QuestStartEntry,
  type TransformEntry,
  type OracleEvaluationEntry,
  type QuestCompleteEntry,
  type LogEntry,
  type QuestOperationsLogOptions,
} from './operations-log.js';
