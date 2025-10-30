/**
 * Transparency Log - Append-only audit trail for all cognition-cli operations
 *
 * Logs all mission loads and coherence measurements to make operations visible.
 * Users have full access to logs and control over their data.
 */

import fs from 'fs';
import path from 'path';
import os from 'os';

interface LogEntry {
  timestamp: string;
  action: string;
  user: string;
  [key: string]: string | number | boolean | undefined;
}

interface MissionLoadEntry extends LogEntry {
  action: 'mission_loaded';
  mission_title: string;
  mission_source: string;
  concepts_count: number;
  mission_hash: string;
}

interface CoherenceCheckEntry extends LogEntry {
  action: 'coherence_measured';
  symbols_count: number;
  mission_title: string;
  mission_hash: string;
}

export class TransparencyLog {
  private logPath: string;

  constructor(projectRoot: string = process.cwd()) {
    const securityDir = path.join(projectRoot, '.open_cognition', 'security');

    // Ensure security directory exists
    if (!fs.existsSync(securityDir)) {
      fs.mkdirSync(securityDir, { recursive: true });
    }

    this.logPath = path.join(securityDir, 'transparency.jsonl');
  }

  /**
   * Log mission document load
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
   * Log coherence measurement
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
   */
  private async append(entry: LogEntry): Promise<void> {
    const line = JSON.stringify(entry) + '\n';
    fs.appendFileSync(this.logPath, line);
  }

  /**
   * Read all log entries
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
   * Get log file path
   */
  getLogPath(): string {
    return this.logPath;
  }

  /**
   * Display recent log entries
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
 */
let globalLog: TransparencyLog | null = null;

export function getTransparencyLog(projectRoot?: string): TransparencyLog {
  if (!globalLog) {
    globalLog = new TransparencyLog(projectRoot);
  }
  return globalLog;
}
