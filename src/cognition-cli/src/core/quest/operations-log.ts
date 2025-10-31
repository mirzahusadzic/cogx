/**
 * QuestOperationsLog - Append-only audit trail for quest execution (Block 2: Lops)
 *
 * MISSION ALIGNMENT:
 * - Implements cPOW Operational Loop (Phase 2: G→T→O Feedback)
 * - Provides verifiable quest execution history
 * - Enables AQS (Agentic Quality Score) computation
 * - Supports wisdom distillation (CoMP generation)
 *
 * PURPOSE:
 * Logs all quest operations (start, transforms, oracle evaluations, completion)
 * to enable:
 * 1. cPOW generation (cryptographic proof of work)
 * 2. AQS calculation (quality scoring)
 * 3. Wisdom extraction (pattern distillation)
 *
 * REFERENCE: docs/manual/part-5-cpow-loop/20-cpow-reference.md
 */

import fs from 'fs';
import path from 'path';
import os from 'os';

// ============================================================================
// Core Types
// ============================================================================

/**
 * Base log entry - all quest operations share these fields
 */
interface BaseLogEntry {
  timestamp: string; // ISO 8601 format
  quest_id: string; // Unique quest identifier
  action: string; // Type of operation
  user: string; // System username
}

/**
 * Quest initialization entry (Phase 1)
 */
export interface QuestStartEntry extends BaseLogEntry {
  action: 'quest_start';
  intent: string; // Natural language description
  baseline_coherence: number; // O₇ coherence score at start
  mission_concepts: string[]; // Relevant O₄ concepts
  security_level?: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Transform proposal/application entry (Phase 2)
 */
export interface TransformEntry extends BaseLogEntry {
  action: 'transform_proposed' | 'transform_applied' | 'transform_reverted';
  transform_id: string; // Unique transform identifier
  transform_type: 'create' | 'modify' | 'delete' | 'refactor';
  files_affected: string[]; // File paths
  rationale: string; // Why this transform
  coherence_delta?: number; // Change in coherence (if applied)
}

/**
 * Oracle evaluation entry (Phase 2)
 */
export interface OracleEvaluationEntry extends BaseLogEntry {
  action: 'oracle_evaluation';
  transform_id: string; // Which transform was evaluated
  oracle_score: number; // 0.0 - 1.0
  accuracy: number; // 0.0 - 1.0
  efficiency: number; // 0.0 - 1.0
  adaptability: number; // 0.0 - 1.0
  feedback: string; // Oracle suggestions
  session_id: string; // Oracle session identifier
  accepted: boolean; // Was transform accepted?
}

/**
 * Quest completion entry (Phase 4-8)
 */
export interface QuestCompleteEntry extends BaseLogEntry {
  action: 'quest_complete';
  duration_minutes: number; // Total quest duration
  transforms_count: number; // Number of transforms applied
  final_coherence: number; // O₇ coherence score at end
  coherence_delta: number; // Change from baseline
  commit_sha?: string; // Git commit hash (if committed)
  fltb_passed: boolean; // Four-Layered Trust Boundary validation
  cpow_id?: string; // Generated cPOW identifier
  aqs_score?: number; // Agentic Quality Score
  aqs_grade?: 'A' | 'B' | 'C' | 'D' | 'F';
  comp_generated?: boolean; // Was wisdom distilled?
  comp_id?: string; // CoMP identifier (if generated)
}

/**
 * Union type of all log entries
 */
export type LogEntry =
  | QuestStartEntry
  | TransformEntry
  | OracleEvaluationEntry
  | QuestCompleteEntry;

// ============================================================================
// QuestOperationsLog Class
// ============================================================================

export interface QuestOperationsLogOptions {
  projectRoot?: string;
  dryRun?: boolean; // If true, don't actually write to disk
}

export class QuestOperationsLog {
  private logPath: string;
  private dryRun: boolean;
  private dryRunBuffer: LogEntry[] = []; // Store entries in memory during dry run

  constructor(options: QuestOperationsLogOptions = {}) {
    const projectRoot = options.projectRoot || process.cwd();
    this.dryRun = options.dryRun ?? false;

    // Log path: .open_cognition/workflow_log.jsonl
    const pgcDir = path.join(projectRoot, '.open_cognition');
    this.logPath = path.join(pgcDir, 'workflow_log.jsonl');

    // Ensure directory exists (only if not dry run)
    if (!this.dryRun) {
      if (!fs.existsSync(pgcDir)) {
        fs.mkdirSync(pgcDir, { recursive: true });
      }
    }
  }

  // ==========================================================================
  // Public API - Logging Methods
  // ==========================================================================

  /**
   * Log quest initialization (Phase 1: Quest Start)
   */
  async logQuestStart(
    entry: Omit<QuestStartEntry, 'timestamp' | 'user' | 'action'>
  ): Promise<void> {
    const fullEntry: QuestStartEntry = {
      ...entry,
      action: 'quest_start',
      timestamp: new Date().toISOString(),
      user: os.userInfo().username,
    };

    await this.append(fullEntry);

    // Display to user (transparency)
    if (this.dryRun) {
      console.log(`[DRY RUN] 🎯 Quest started: "${entry.intent}"`);
      console.log(`[DRY RUN] Quest ID: ${entry.quest_id}`);
      console.log(
        `[DRY RUN] Baseline coherence: ${entry.baseline_coherence.toFixed(3)}`
      );
    } else {
      console.log(`🎯 Quest started: "${entry.intent}"`);
      console.log(`Quest ID: ${entry.quest_id}`);
      console.log(`Baseline coherence: ${entry.baseline_coherence.toFixed(3)}`);
      console.log(`📝 Logged to: ${this.logPath}`);
    }
  }

  /**
   * Log transform proposal/application (Phase 2: Transform)
   */
  async logTransform(
    entry: Omit<TransformEntry, 'timestamp' | 'user'>
  ): Promise<void> {
    const fullEntry: TransformEntry = {
      ...entry,
      timestamp: new Date().toISOString(),
      user: os.userInfo().username,
    };

    await this.append(fullEntry);

    // Display to user (transparency)
    const actionLabel =
      entry.action === 'transform_proposed'
        ? 'Proposed'
        : entry.action === 'transform_applied'
          ? 'Applied'
          : 'Reverted';

    if (this.dryRun) {
      console.log(
        `[DRY RUN] 🔨 Transform ${actionLabel}: ${entry.transform_id}`
      );
      console.log(
        `[DRY RUN] Type: ${entry.transform_type}, Files: ${entry.files_affected.length}`
      );
    } else {
      console.log(`🔨 Transform ${actionLabel}: ${entry.transform_id}`);
      console.log(
        `Type: ${entry.transform_type}, Files: ${entry.files_affected.length}`
      );
      if (entry.coherence_delta !== undefined) {
        console.log(
          `Coherence Δ: ${entry.coherence_delta >= 0 ? '+' : ''}${entry.coherence_delta.toFixed(3)}`
        );
      }
      console.log(`📝 Logged to: ${this.logPath}`);
    }
  }

  /**
   * Log Oracle evaluation (Phase 2: Oracle Validation)
   */
  async logOracleEvaluation(
    entry: Omit<OracleEvaluationEntry, 'timestamp' | 'user' | 'action'>
  ): Promise<void> {
    const fullEntry: OracleEvaluationEntry = {
      ...entry,
      action: 'oracle_evaluation',
      timestamp: new Date().toISOString(),
      user: os.userInfo().username,
    };

    await this.append(fullEntry);

    // Display to user (transparency)
    if (this.dryRun) {
      console.log(`[DRY RUN] 🔮 Oracle evaluated: ${entry.transform_id}`);
      console.log(
        `[DRY RUN] Score: ${entry.oracle_score.toFixed(3)} (${entry.accepted ? 'ACCEPTED' : 'REJECTED'})`
      );
    } else {
      console.log(`🔮 Oracle evaluated: ${entry.transform_id}`);
      console.log(
        `Score: ${entry.oracle_score.toFixed(3)} (${entry.accepted ? 'ACCEPTED' : 'REJECTED'})`
      );
      console.log(
        `  Accuracy: ${entry.accuracy.toFixed(2)}, Efficiency: ${entry.efficiency.toFixed(2)}, Adaptability: ${entry.adaptability.toFixed(2)}`
      );
      console.log(`📝 Logged to: ${this.logPath}`);
    }
  }

  /**
   * Log quest completion (Phases 4-8: Commit → cPOW → AQS → CoMP)
   */
  async logQuestComplete(
    entry: Omit<QuestCompleteEntry, 'timestamp' | 'user' | 'action'>
  ): Promise<void> {
    const fullEntry: QuestCompleteEntry = {
      ...entry,
      action: 'quest_complete',
      timestamp: new Date().toISOString(),
      user: os.userInfo().username,
    };

    await this.append(fullEntry);

    // Display to user (transparency)
    if (this.dryRun) {
      console.log(`[DRY RUN] ✅ Quest completed: ${entry.quest_id}`);
      console.log(
        `[DRY RUN] Duration: ${entry.duration_minutes.toFixed(1)} minutes`
      );
      console.log(
        `[DRY RUN] Transforms: ${entry.transforms_count}, Coherence Δ: ${entry.coherence_delta >= 0 ? '+' : ''}${entry.coherence_delta.toFixed(3)}`
      );
      if (entry.aqs_score !== undefined) {
        console.log(
          `[DRY RUN] AQS: ${entry.aqs_score.toFixed(3)} (Grade: ${entry.aqs_grade})`
        );
      }
      if (entry.comp_generated) {
        console.log(`[DRY RUN] 🎓 Wisdom distilled: ${entry.comp_id}`);
      }
    } else {
      console.log(`✅ Quest completed: ${entry.quest_id}`);
      console.log(`Duration: ${entry.duration_minutes.toFixed(1)} minutes`);
      console.log(
        `Transforms: ${entry.transforms_count}, Coherence Δ: ${entry.coherence_delta >= 0 ? '+' : ''}${entry.coherence_delta.toFixed(3)}`
      );
      console.log(`F.L.T.B: ${entry.fltb_passed ? 'PASSED' : 'FAILED'}`);
      if (entry.commit_sha) {
        console.log(`Commit: ${entry.commit_sha.substring(0, 8)}`);
      }
      if (entry.aqs_score !== undefined) {
        console.log(
          `AQS: ${entry.aqs_score.toFixed(3)} (Grade: ${entry.aqs_grade})`
        );
      }
      if (entry.comp_generated) {
        console.log(`🎓 Wisdom distilled: ${entry.comp_id}`);
      }
      console.log(`📝 Logged to: ${this.logPath}`);
    }
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  /**
   * Read all log entries for a specific quest
   */
  async getQuestLog(quest_id: string): Promise<LogEntry[]> {
    const allEntries = await this.readAll();
    return allEntries.filter((entry) => entry.quest_id === quest_id);
  }

  /**
   * Get quest duration from log entries
   */
  async getQuestDuration(quest_id: string): Promise<number | null> {
    const entries = await this.getQuestLog(quest_id);
    if (entries.length === 0) return null;

    const startEntry = entries.find((e) => e.action === 'quest_start');
    const completeEntry = entries.find((e) => e.action === 'quest_complete');

    if (!startEntry || !completeEntry) return null;

    const start = new Date(startEntry.timestamp);
    const end = new Date(completeEntry.timestamp);
    return (end.getTime() - start.getTime()) / (1000 * 60); // Minutes
  }

  /**
   * Get transform count for a quest
   */
  async getTransformCount(quest_id: string): Promise<number> {
    const entries = await this.getQuestLog(quest_id);
    return entries.filter((e) => e.action === 'transform_applied').length;
  }

  /**
   * Get average Oracle score for a quest
   */
  async getAverageOracleScore(quest_id: string): Promise<number | null> {
    const entries = await this.getQuestLog(quest_id);
    const oracleEntries = entries.filter(
      (e) => e.action === 'oracle_evaluation'
    ) as OracleEvaluationEntry[];

    if (oracleEntries.length === 0) return null;

    const sum = oracleEntries.reduce((acc, e) => acc + e.oracle_score, 0);
    return sum / oracleEntries.length;
  }

  /**
   * Check if log file exists
   */
  exists(): boolean {
    if (this.dryRun) {
      return this.dryRunBuffer.length > 0;
    }
    return fs.existsSync(this.logPath);
  }

  /**
   * Get log file path
   */
  getLogPath(): string {
    return this.logPath;
  }

  /**
   * Check if in dry-run mode
   */
  isDryRun(): boolean {
    return this.dryRun;
  }

  /**
   * Get dry-run buffer (for testing/inspection)
   */
  getDryRunBuffer(): LogEntry[] {
    return this.dryRun ? [...this.dryRunBuffer] : [];
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  /**
   * Append entry to log (JSONL format - one JSON object per line)
   */
  private async append(entry: LogEntry): Promise<void> {
    const line = JSON.stringify(entry) + '\n';

    if (this.dryRun) {
      // Dry run: store in memory buffer instead of writing to disk
      this.dryRunBuffer.push(entry);
    } else {
      // Real mode: append to file
      fs.appendFileSync(this.logPath, line);
    }
  }

  /**
   * Read all log entries from file
   */
  private async readAll(): Promise<LogEntry[]> {
    if (this.dryRun) {
      return [...this.dryRunBuffer];
    }

    if (!fs.existsSync(this.logPath)) {
      return [];
    }

    const content = fs.readFileSync(this.logPath, 'utf-8');
    const lines = content
      .trim()
      .split('\n')
      .filter((line) => line.length > 0);

    return lines.map((line) => {
      try {
        return JSON.parse(line) as LogEntry;
      } catch (err) {
        console.error(`Failed to parse log entry: ${line}`);
        throw err;
      }
    });
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

let _globalLog: QuestOperationsLog | null = null;

/**
 * Get or create global QuestOperationsLog instance
 */
export function getQuestOperationsLog(
  options?: QuestOperationsLogOptions
): QuestOperationsLog {
  if (!_globalLog) {
    _globalLog = new QuestOperationsLog(options);
  }
  return _globalLog;
}

/**
 * Reset global instance (useful for testing)
 */
export function resetQuestOperationsLog(): void {
  _globalLog = null;
}
