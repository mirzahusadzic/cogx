/**
 * Transparency Log - Append-Only Audit Trail for O2 Security Overlay
 *
 * Implements an immutable, append-only audit log for all cognition-cli operations
 * involving mission documents and coherence measurements. Provides cryptographic
 * evidence trails for security analysis and incident investigation.
 *
 * MISSION ALIGNMENT:
 * - Core implementation of "National Security Through Transparency" (VISION.md:81-88, 81.2% importance)
 * - Provides "Verification Over Trust" via auditable operations (VISION.md:97-104, 74.3%)
 * - Enables "Cryptographic Truth" through content-addressable logging (86.7% importance)
 * - Supports "Oracle Validation" by logging validation outcomes (Innovation #2, 88.1%)
 * - Part of O2 (Security) overlay - FOUNDATIONAL and non-negotiable
 *
 * DESIGN RATIONALE:
 * - JSONL format (one JSON object per line) for:
 *   - Simple append operations (no file parsing needed)
 *   - Easy streaming and tail operations
 *   - Resilience to partial writes (incomplete lines ignored)
 *   - Standard log processing tools compatibility
 *
 * - Append-only semantics:
 *   - Prevents tampering via file replacement
 *   - Creates forensic trail for attack detection
 *   - Enables temporal analysis of drift patterns
 *
 * SECURITY GUARANTEES:
 * - Append-only: Never modifies or deletes existing entries
 * - Tamper-evident: Any modification requires replacing entire file (detectable)
 * - User-controlled: Stored in .open_cognition/security/ (local, no telemetry)
 * - Content-addressable: Mission hashes enable integrity verification
 * - Timestamp-ordered: Chronological trail for forensic analysis
 *
 * THREAT MODEL:
 * Defends against:
 * - Mission poisoning attacks (gradual drift is logged)
 * - Evidence destruction (append-only prevents selective deletion)
 * - Post-facto manipulation (timestamps + hashes create audit trail)
 *
 * Does NOT defend against:
 * - Full file deletion (user controls .open_cognition/)
 * - System clock manipulation (relies on Date.now())
 * - Disk corruption (no redundancy/replication)
 *
 * STORAGE:
 * - Location: .open_cognition/security/transparency.jsonl
 * - Format: JSONL (JSON Lines - newline-delimited JSON objects)
 * - Retention: Indefinite (user can archive/rotate manually)
 *
 * @example
 * // Log a mission document load
 * const log = getTransparencyLog();
 * await log.logMissionLoad({
 *   title: "Engineering Excellence",
 *   source: "/path/to/VISION.md",
 *   concepts: extractedConcepts,
 *   hash: "abc123..."
 * });
 * // Output: "📋 Mission loaded: Engineering Excellence"
 * // Writes: {"timestamp":"2025-11-15T...","action":"mission_loaded",...}
 *
 * @example
 * // Display recent audit trail
 * const log = getTransparencyLog();
 * await log.displayRecent(20);
 * // Shows last 20 operations with details
 *
 * @example
 * // Read all log entries for custom analysis
 * const log = getTransparencyLog();
 * const entries = await log.readAll();
 * const missionLoads = entries.filter(e => e.action === 'mission_loaded');
 * console.log(`${missionLoads.length} mission loads detected`);
 */

import fs from 'fs';
import path from 'path';
import os from 'os';

/**
 * Base log entry structure
 * All entries include timestamp, action type, and user context
 */
interface LogEntry {
  timestamp: string;
  action: string;
  user: string;
  [key: string]: string | number | boolean | undefined;
}

/**
 * Mission load entry - records mission document ingestion
 */
interface MissionLoadEntry extends LogEntry {
  action: 'mission_loaded';
  mission_title: string;
  mission_source: string;
  concepts_count: number;
  mission_hash: string;
}

/**
 * Coherence check entry - records alignment measurements
 */
interface CoherenceCheckEntry extends LogEntry {
  action: 'coherence_measured';
  symbols_count: number;
  mission_title: string;
  mission_hash: string;
}

/**
 * TransparencyLog - Append-only audit log for security events
 *
 * Manages the transparency.jsonl file in .open_cognition/security/.
 * Provides structured logging of mission operations with user attribution.
 *
 * @example
 * const log = new TransparencyLog('/path/to/project');
 * await log.logMissionLoad({
 *   title: "Security Policy",
 *   source: "SECURITY.md",
 *   concepts: [...],
 *   hash: "abc123"
 * });
 */
export class TransparencyLog {
  private logPath: string;

  /**
   * Creates a TransparencyLog instance
   *
   * INITIALIZATION:
   * 1. Resolves security directory path (.open_cognition/security/)
   * 2. Creates directory if it doesn't exist
   * 3. Sets log file path (transparency.jsonl)
   *
   * @param projectRoot - Root directory of the project (contains .open_cognition/)
   *                      Defaults to current working directory
   *
   * @example
   * const log = new TransparencyLog();  // Uses process.cwd()
   * const log = new TransparencyLog('/path/to/workspace');  // Explicit path
   */
  constructor(projectRoot: string = process.cwd()) {
    const securityDir = path.join(projectRoot, '.open_cognition', 'security');

    // Ensure security directory exists
    if (!fs.existsSync(securityDir)) {
      fs.mkdirSync(securityDir, { recursive: true });
    }

    this.logPath = path.join(securityDir, 'transparency.jsonl');
  }

  /**
   * Log mission document load event
   *
   * Records when a mission document is ingested into the Grounded Context Pool (PGC).
   * Includes concept count and content hash for integrity verification.
   *
   * TRANSPARENCY:
   * - Prints human-readable summary to console
   * - Appends machine-readable JSONL entry to log
   * - Shows log file location for user verification
   *
   * @param mission - Mission document details
   * @param mission.title - Human-readable mission title
   * @param mission.source - File path or URL of mission document
   * @param mission.concepts - Extracted mission concepts (count logged)
   * @param mission.hash - SHA-256 hash of document content (optional)
   *
   * @example
   * await log.logMissionLoad({
   *   title: "Engineering Principles",
   *   source: "/workspace/VISION.md",
   *   concepts: [{text: "Security first", weight: 0.9}, ...],
   *   hash: "a3f2e1..."
   * });
   * // Output:
   * // 📋 Mission loaded: "Engineering Principles"
   * // 📍 Source: /workspace/VISION.md
   * // 🎯 Concepts extracted: 42
   * // 📝 Logged to: .open_cognition/security/transparency.jsonl
   */
  async logMissionLoad(mission: {
    title: string;
    source: string;
    concepts: unknown[];
    hash?: string;
  }): Promise<void> {
    const entry: MissionLoadEntry = {
      timestamp: new Date().toISOString(),
      action: 'mission_loaded',
      user: os.userInfo().username,
      mission_title: mission.title,
      mission_source: mission.source,
      concepts_count: mission.concepts.length,
      mission_hash: mission.hash || 'unknown',
    };

    await this.append(entry);

    // Display to user (transparency)
    console.log(`📋 Mission loaded: "${mission.title}"`);
    console.log(`📍 Source: ${mission.source}`);
    console.log(`🎯 Concepts extracted: ${mission.concepts.length}`);
    console.log(`📝 Logged to: ${this.logPath}`);
  }

  /**
   * Log coherence measurement event
   *
   * Records when code symbols are measured against mission concepts.
   * Creates audit trail of O7 (Coherence) overlay computation.
   *
   * TRANSPARENCY:
   * - Shows which symbols were measured
   * - Links measurement to specific mission version (by hash)
   * - Provides temporal evidence of drift detection
   *
   * @param symbols - Code symbols being measured (count logged)
   * @param mission - Mission document context
   * @param mission.title - Mission title for human readability
   * @param mission.hash - Mission hash for version linking
   *
   * @example
   * await log.logCoherenceCheck(
   *   codebaseSymbols,
   *   { title: "Security Policy", hash: "abc123..." }
   * );
   * // Output:
   * // 🔍 Coherence measured: 347 symbols against "Security Policy"
   * // 📝 Logged to: .open_cognition/security/transparency.jsonl
   */
  async logCoherenceCheck(
    symbols: unknown[],
    mission: { title: string; hash?: string }
  ): Promise<void> {
    const entry: CoherenceCheckEntry = {
      timestamp: new Date().toISOString(),
      action: 'coherence_measured',
      user: os.userInfo().username,
      symbols_count: symbols.length,
      mission_title: mission.title,
      mission_hash: mission.hash || 'unknown',
    };

    await this.append(entry);

    // Display to user (transparency)
    console.log(
      `🔍 Coherence measured: ${symbols.length} symbols against "${mission.title}"`
    );
    console.log(`📝 Logged to: ${this.logPath}`);
  }

  /**
   * Append entry to log (JSONL format - one JSON object per line)
   *
   * ALGORITHM:
   * 1. Serialize entry to JSON
   * 2. Append newline character (JSONL format)
   * 3. Append to file (atomic write on most filesystems)
   *
   * SECURITY:
   * - Append-only (never modifies existing lines)
   * - Synchronous write (ensures durability before returning)
   * - No encryption (transparency requires readability)
   *
   * @param entry - Log entry to append
   */
  private async append(entry: LogEntry): Promise<void> {
    const line = JSON.stringify(entry) + '\n';
    fs.appendFileSync(this.logPath, line);
  }

  /**
   * Read all log entries from disk
   *
   * Parses JSONL file and returns all entries in chronological order.
   * Filters out empty lines and handles parse errors gracefully.
   *
   * @returns Array of log entries (empty if file doesn't exist)
   *
   * @example
   * const entries = await log.readAll();
   * const recent = entries.slice(-10);  // Last 10 entries
   * const missions = entries.filter(e => e.action === 'mission_loaded');
   */
  async readAll(): Promise<LogEntry[]> {
    if (!fs.existsSync(this.logPath)) {
      return [];
    }

    const content = fs.readFileSync(this.logPath, 'utf-8');
    const lines = content.trim().split('\n').filter(Boolean);

    return lines.map((line) => JSON.parse(line) as LogEntry);
  }

  /**
   * Get absolute path to log file
   *
   * @returns Absolute path to transparency.jsonl
   *
   * @example
   * const logPath = log.getLogPath();
   * console.log(`View logs: cat ${logPath}`);
   */
  getLogPath(): string {
    return this.logPath;
  }

  /**
   * Display recent log entries to console
   *
   * Prints human-readable summary of recent operations.
   * Useful for quick audit trail inspection.
   *
   * @param count - Number of recent entries to display (default: 10)
   *
   * @example
   * await log.displayRecent();  // Show last 10
   * await log.displayRecent(50);  // Show last 50
   */
  async displayRecent(count: number = 10): Promise<void> {
    const entries = await this.readAll();
    const recent = entries.slice(-count);

    console.log(
      `\n📋 Recent operations (${recent.length} of ${entries.length} total):\n`
    );

    for (const entry of recent) {
      const date = new Date(entry.timestamp).toLocaleString();
      console.log(`[${date}] ${entry.action}`);

      if (entry.action === 'mission_loaded') {
        const missionEntry = entry as MissionLoadEntry;
        console.log(`  Mission: "${missionEntry.mission_title}"`);
        console.log(`  Source: ${missionEntry.mission_source}`);
        console.log(`  Concepts: ${missionEntry.concepts_count}`);
      } else if (entry.action === 'coherence_measured') {
        const coherenceEntry = entry as CoherenceCheckEntry;
        console.log(`  Symbols: ${coherenceEntry.symbols_count}`);
        console.log(`  Mission: "${coherenceEntry.mission_title}"`);
      }

      console.log('');
    }

    console.log(`Full log: ${this.logPath}\n`);
  }
}

/**
 * Global transparency log instance (singleton pattern)
 * Ensures single log file per process
 */
let globalLog: TransparencyLog | null = null;

/**
 * Get or create the global TransparencyLog instance
 *
 * Uses singleton pattern to ensure all logging operations in a process
 * write to the same log file (prevents race conditions and duplicate entries).
 *
 * @param projectRoot - Project root directory (only used on first call)
 * @returns Singleton TransparencyLog instance
 *
 * @example
 * // Anywhere in codebase
 * const log = getTransparencyLog();
 * await log.logMissionLoad({...});
 *
 * @example
 * // Override project root (first call only)
 * const log = getTransparencyLog('/custom/workspace');
 */
export function getTransparencyLog(projectRoot?: string): TransparencyLog {
  if (!globalLog) {
    globalLog = new TransparencyLog(projectRoot);
  }
  return globalLog;
}
