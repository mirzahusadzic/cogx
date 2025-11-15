/**
 * Quest Operations Log - Append-only Audit Trail for Quest Execution
 *
 * Implements the operational logging layer (Block 2: Lops) of the cPOW framework.
 * Records all quest activities in a verifiable, tamper-evident format to support
 * cryptographic proof of work, quality scoring, and wisdom distillation.
 *
 * MISSION ALIGNMENT:
 * - Implements cPOW Operational Loop (Phase 2: G→T→O Feedback)
 * - Provides verifiable quest execution history
 * - Enables AQS (Agentic Quality Score) computation
 * - Supports wisdom distillation (CoMP generation)
 *
 * DESIGN PHILOSOPHY:
 * The operations log is the "blockchain" of the quest system - an immutable
 * record of all actions, decisions, and outcomes. It enables:
 * 1. Auditability: Every transform can be traced to its origin
 * 2. Reproducibility: Quest execution can be replayed from logs
 * 3. Quality Assessment: Metrics derived from logged data
 * 4. Continuous Learning: Patterns extracted from successful quests
 *
 * LOG FORMAT:
 * - JSONL (JSON Lines): One JSON object per line
 * - Append-only: Never modify existing entries
 * - Timestamped: ISO 8601 format for precise ordering
 * - Typed: Discriminated unions for type safety
 *
 * STORAGE:
 * ```
 * .open_cognition/workflow_log.jsonl
 * ```
 *
 * QUEST LIFECYCLE IN LOG:
 * ```
 * quest_start       → Initialize quest with intent and baseline
 *   transform_proposed  → Propose code change
 *   oracle_evaluation   → Evaluate transform quality
 *   transform_applied   → Apply accepted transform
 *   transform_proposed  → Propose next change
 *   oracle_evaluation   → Evaluate quality
 *   transform_applied   → Apply accepted transform
 * quest_complete    → Finalize with metrics and proof
 * ```
 *
 * @example
 * // Initialize quest logging
 * const log = new QuestOperationsLog({ projectRoot: '/path/to/project' });
 * await log.logQuestStart({
 *   quest_id: 'quest-123',
 *   intent: 'Add authentication to user service',
 *   baseline_coherence: 0.85,
 *   mission_concepts: ['security', 'user-management']
 * });
 *
 * @example
 * // Log transform and oracle evaluation
 * await log.logTransform({
 *   quest_id: 'quest-123',
 *   action: 'transform_applied',
 *   transform_id: 'transform-456',
 *   transform_type: 'create',
 *   files_affected: ['src/auth/AuthService.ts'],
 *   rationale: 'Implement JWT-based authentication',
 *   coherence_delta: 0.05
 * });
 *
 * await log.logOracleEvaluation({
 *   quest_id: 'quest-123',
 *   transform_id: 'transform-456',
 *   oracle_score: 0.92,
 *   accuracy: 0.95,
 *   efficiency: 0.88,
 *   adaptability: 0.93,
 *   feedback: 'Excellent security implementation',
 *   session_id: 'oracle-session-789',
 *   accepted: true
 * });
 *
 * @example
 * // Complete quest with metrics
 * await log.logQuestComplete({
 *   quest_id: 'quest-123',
 *   duration_minutes: 45.2,
 *   transforms_count: 3,
 *   final_coherence: 0.90,
 *   coherence_delta: 0.05,
 *   commit_sha: 'a7b3c9d...',
 *   fltb_passed: true,
 *   aqs_score: 0.91,
 *   aqs_grade: 'A',
 *   comp_generated: true,
 *   comp_id: 'comp-auth-pattern-001'
 * });
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
 *
 * Common fields present in every log entry type.
 */
interface BaseLogEntry {
  timestamp: string; // ISO 8601 format
  quest_id: string; // Unique quest identifier
  action: string; // Type of operation
  user: string; // System username
}

/**
 * Quest initialization entry (Phase 1: Quest Start)
 *
 * Records the start of a new quest with its intent and baseline metrics.
 * This is always the first entry in a quest's log sequence.
 */
export interface QuestStartEntry extends BaseLogEntry {
  action: 'quest_start';
  intent: string; // Natural language description
  baseline_coherence: number; // O₇ coherence score at start
  mission_concepts: string[]; // Relevant O₄ concepts
  security_level?: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Transform proposal/application entry (Phase 2: Transform Execution)
 *
 * Records transform lifecycle events:
 * - transform_proposed: Transform suggested but not yet applied
 * - transform_applied: Transform accepted and applied to codebase
 * - transform_reverted: Transform undone (rollback)
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
 * Oracle evaluation entry (Phase 2: Quality Assessment)
 *
 * Records Oracle's evaluation of a proposed transform using the AAA framework:
 * - Accuracy: Correctness and alignment with requirements
 * - Efficiency: Performance and resource utilization
 * - Adaptability: Maintainability and extensibility
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
 * Quest completion entry (Phases 4-8: Finalization)
 *
 * Records quest completion with final metrics and generated artifacts:
 * - Phase 4: Git commit
 * - Phase 5: cPOW generation
 * - Phase 6: AQS calculation
 * - Phase 7: CoMP distillation
 * - Phase 8: Wisdom integration
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
 *
 * Discriminated union using the 'action' field for type narrowing.
 */
export type LogEntry =
  | QuestStartEntry
  | TransformEntry
  | OracleEvaluationEntry
  | QuestCompleteEntry;

// ============================================================================
// QuestOperationsLog Class
// ============================================================================

/**
 * Options for configuring the quest operations log
 */
export interface QuestOperationsLogOptions {
  /** Root directory of the project (defaults to process.cwd()) */
  projectRoot?: string;

  /** If true, store entries in memory instead of writing to disk (for testing) */
  dryRun?: boolean;
}

/**
 * Quest Operations Log Manager
 *
 * Provides high-level API for logging quest activities and querying quest history.
 * Handles file I/O, timestamping, and user attribution automatically.
 */
export class QuestOperationsLog {
  private logPath: string;
  private dryRun: boolean;
  private dryRunBuffer: LogEntry[] = []; // Store entries in memory during dry run

  /**
   * Create a new quest operations log manager
   *
   * @param options - Configuration options
   *
   * @example
   * // Production mode (writes to disk)
   * const log = new QuestOperationsLog({ projectRoot: '/path/to/project' });
   *
   * @example
   * // Test mode (in-memory only)
   * const log = new QuestOperationsLog({ dryRun: true });
   */
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
   *
   * Records the start of a new quest with its intent, baseline coherence,
   * and relevant mission concepts. This should be the first log entry
   * for any quest.
   *
   * @param entry - Quest start data (timestamp and user added automatically)
   *
   * @example
   * await log.logQuestStart({
   *   quest_id: 'quest-001',
   *   intent: 'Implement user authentication',
   *   baseline_coherence: 0.82,
   *   mission_concepts: ['security', 'authentication'],
   *   security_level: 'high'
   * });
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
   * Log transform proposal/application (Phase 2: Transform Execution)
   *
   * Records transform lifecycle events. Should be called:
   * - When transform is proposed (before Oracle evaluation)
   * - When transform is applied (after Oracle accepts)
   * - When transform is reverted (rollback scenario)
   *
   * @param entry - Transform data (timestamp and user added automatically)
   *
   * @example
   * // Propose transform
   * await log.logTransform({
   *   quest_id: 'quest-001',
   *   action: 'transform_proposed',
   *   transform_id: 'transform-abc',
   *   transform_type: 'create',
   *   files_affected: ['src/auth/AuthService.ts'],
   *   rationale: 'Add JWT authentication'
   * });
   *
   * @example
   * // Apply accepted transform
   * await log.logTransform({
   *   quest_id: 'quest-001',
   *   action: 'transform_applied',
   *   transform_id: 'transform-abc',
   *   transform_type: 'create',
   *   files_affected: ['src/auth/AuthService.ts'],
   *   rationale: 'Add JWT authentication',
   *   coherence_delta: 0.03
   * });
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
   * Log Oracle evaluation (Phase 2: Quality Assessment)
   *
   * Records Oracle's quality assessment using the AAA framework:
   * - Accuracy: Correctness (0-1)
   * - Efficiency: Performance (0-1)
   * - Adaptability: Maintainability (0-1)
   * - Overall Score: Weighted average
   *
   * @param entry - Oracle evaluation data (timestamp and user added automatically)
   *
   * @example
   * await log.logOracleEvaluation({
   *   quest_id: 'quest-001',
   *   transform_id: 'transform-abc',
   *   oracle_score: 0.89,
   *   accuracy: 0.92,
   *   efficiency: 0.85,
   *   adaptability: 0.90,
   *   feedback: 'Well-structured implementation with good test coverage',
   *   session_id: 'oracle-session-123',
   *   accepted: true
   * });
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
   * Log quest completion (Phases 4-8: Finalization)
   *
   * Records final quest metrics and generated artifacts:
   * - Duration and transform count
   * - Final coherence and delta
   * - Git commit SHA
   * - F.L.T.B validation status
   * - cPOW identifier
   * - AQS score and grade
   * - CoMP (wisdom) artifact
   *
   * @param entry - Quest completion data (timestamp and user added automatically)
   *
   * @example
   * await log.logQuestComplete({
   *   quest_id: 'quest-001',
   *   duration_minutes: 32.5,
   *   transforms_count: 2,
   *   final_coherence: 0.87,
   *   coherence_delta: 0.05,
   *   commit_sha: 'a7b3c9d2e5f8...',
   *   fltb_passed: true,
   *   cpow_id: 'cpow-001-abc123',
   *   aqs_score: 0.88,
   *   aqs_grade: 'B',
   *   comp_generated: true,
   *   comp_id: 'comp-auth-pattern'
   * });
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
   *
   * Filters the complete log to return only entries for the given quest ID.
   * Useful for quest-specific analysis and reporting.
   *
   * @param quest_id - Quest identifier
   * @returns Array of log entries for this quest (in chronological order)
   *
   * @example
   * const entries = await log.getQuestLog('quest-001');
   * console.log(`Quest has ${entries.length} log entries`);
   * entries.forEach(entry => {
   *   console.log(`${entry.timestamp}: ${entry.action}`);
   * });
   */
  async getQuestLog(quest_id: string): Promise<LogEntry[]> {
    const allEntries = await this.readAll();
    return allEntries.filter((entry) => entry.quest_id === quest_id);
  }

  /**
   * Get quest duration from log entries
   *
   * Calculates elapsed time between quest_start and quest_complete entries.
   *
   * @param quest_id - Quest identifier
   * @returns Duration in minutes, or null if incomplete/not found
   *
   * @example
   * const duration = await log.getQuestDuration('quest-001');
   * if (duration) {
   *   console.log(`Quest took ${duration.toFixed(1)} minutes`);
   * }
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
   *
   * Counts only applied transforms (not proposed or reverted).
   *
   * @param quest_id - Quest identifier
   * @returns Number of applied transforms
   *
   * @example
   * const count = await log.getTransformCount('quest-001');
   * console.log(`Quest applied ${count} transforms`);
   */
  async getTransformCount(quest_id: string): Promise<number> {
    const entries = await this.getQuestLog(quest_id);
    return entries.filter((e) => e.action === 'transform_applied').length;
  }

  /**
   * Get average Oracle score for a quest
   *
   * Calculates mean Oracle score across all evaluations.
   * Useful for quality trending and retrospectives.
   *
   * @param quest_id - Quest identifier
   * @returns Average score (0-1), or null if no evaluations
   *
   * @example
   * const avgScore = await log.getAverageOracleScore('quest-001');
   * if (avgScore) {
   *   console.log(`Average quality: ${(avgScore * 100).toFixed(1)}%`);
   * }
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
   *
   * @returns true if log file exists (or has dry-run entries), false otherwise
   */
  exists(): boolean {
    if (this.dryRun) {
      return this.dryRunBuffer.length > 0;
    }
    return fs.existsSync(this.logPath);
  }

  /**
   * Get log file path
   *
   * @returns Absolute path to workflow_log.jsonl
   */
  getLogPath(): string {
    return this.logPath;
  }

  /**
   * Check if in dry-run mode
   *
   * @returns true if running in memory-only mode (testing)
   */
  isDryRun(): boolean {
    return this.dryRun;
  }

  /**
   * Get dry-run buffer (for testing/inspection)
   *
   * Only populated in dry-run mode. Empty array otherwise.
   *
   * @returns Copy of in-memory log entries (dry-run mode only)
   */
  getDryRunBuffer(): LogEntry[] {
    return this.dryRun ? [...this.dryRunBuffer] : [];
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  /**
   * Append entry to log (JSONL format - one JSON object per line)
   *
   * ALGORITHM:
   * - Dry-run mode: Push to in-memory buffer
   * - Normal mode: Append to file (synchronous for crash safety)
   *
   * @param entry - Log entry to append
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
   *
   * Parses JSONL format (one JSON object per line).
   *
   * @returns Array of all log entries (in chronological order)
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
 *
 * Singleton pattern for convenient access throughout the codebase.
 *
 * @param options - Configuration options (only used on first call)
 * @returns Global log instance
 *
 * @example
 * // First call creates instance
 * const log = getQuestOperationsLog({ projectRoot: '/path/to/project' });
 *
 * @example
 * // Subsequent calls return same instance
 * const log = getQuestOperationsLog(); // No options needed
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
 *
 * Clears the singleton instance, forcing next call to getQuestOperationsLog()
 * to create a new instance.
 *
 * @example
 * // In test cleanup
 * afterEach(() => {
 *   resetQuestOperationsLog();
 * });
 */
export function resetQuestOperationsLog(): void {
  _globalLog = null;
}
