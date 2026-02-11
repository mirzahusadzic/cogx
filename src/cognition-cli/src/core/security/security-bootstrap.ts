/**
 * Security Bootstrap - Dual-Use Acknowledgment and Transparency Initialization
 *
 * Ensures users acknowledge dual-use risks before using cognition-cli.
 * Implements minimal, honest safeguards focused on transparency and user awareness.
 *
 * MISSION ALIGNMENT:
 * - Implements "National Security Through Transparency" (81.2% importance)
 * - Enforces "Verification Over Trust" via explicit user acknowledgment (VISION.md:122, 74.3%)
 * - Provides audit trails for responsible AI deployment (VISION.md:97-104)
 * - Part of O2 (Security) overlay - FOUNDATIONAL and non-negotiable
 *
 * DESIGN PHILOSOPHY:
 * cognition-cli is measurement infrastructure - it does NOT make ethical judgments.
 * This module ensures users:
 * 1. Acknowledge dual-use risks (one-time, annually renewed)
 * 2. Understand their responsibility for ethical deployment
 * 3. Are informed about transparency logging
 * 4. Control which workbench/models to trust
 *
 * SECURITY ROLE:
 * - One-time dual-use mandate acknowledgment (stored in ~/.cognition-cli/)
 * - Annual re-acknowledgment (1 year expiry)
 * - Transparent security directory initialization
 * - User-controlled settings (no telemetry, local storage)
 *
 * THREAT MODEL:
 * This is NOT a security control - it's a transparency measure.
 * Can be bypassed by forking (intentional - bypass is visible).
 * Goal: Make users aware, not prevent misuse.
 *
 * @example
 * // Called at CLI entry point
 * await bootstrapSecurity();
 * // If first run, prompts for acknowledgment
 * // If acknowledged, continues silently
 *
 * @example
 * // Custom project root
 * await bootstrapSecurity('/path/to/workspace');
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { createInterface } from 'readline';
import { WorkspaceManager } from '../workspace-manager.js';
import { getHomeDir } from '../../utils/home-dir.js';

/**
 * Global settings stored in ~/.cognition-cli/settings.json
 */
export interface Settings {
  dual_use_acknowledgment?: UserAcknowledgment;
  version: string;
  defaultProvider?: 'claude' | 'gemini' | string;
}

/**
 * User acknowledgment record
 * Stored persistently to avoid repeated prompts
 */
interface UserAcknowledgment {
  timestamp: string;
  user: string;
  hostname: string;
  version: string;
  acknowledged: boolean;
}

/**
 * SecurityBootstrap - Manages dual-use acknowledgment flow
 *
 * Handles first-run initialization, acknowledgment prompts,
 * and security directory setup.
 *
 * @example
 * const bootstrap = new SecurityBootstrap();
 * await bootstrap.bootstrap();
 */
export class SecurityBootstrap {
  private settingsDir: string;
  private settingsPath: string;
  private projectSecurityDir: string | null;

  /**
   * Creates a SecurityBootstrap instance
   *
   * Initializes paths for global settings and project-specific security directory.
   * Uses workspace walk-up to find .open_cognition/.
   *
   * @param startDir - Starting directory for workspace resolution (default: cwd)
   *
   * @example
   * const bootstrap = new SecurityBootstrap();
   * const bootstrap = new SecurityBootstrap('/path/to/project');
   */
  constructor(startDir: string = process.cwd()) {
    // Global settings in ~/.cognition-cli/
    this.settingsDir = path.join(getHomeDir(), '.cognition-cli');
    this.settingsPath = path.join(this.settingsDir, 'settings.json');

    // Per-project security/transparency logs - use walk-up to find workspace
    const workspaceManager = new WorkspaceManager();
    const projectRoot = workspaceManager.resolvePgcRoot(startDir);

    if (projectRoot) {
      this.projectSecurityDir = path.join(
        projectRoot,
        '.open_cognition',
        'security'
      );
    } else {
      // No workspace found - don't create one
      this.projectSecurityDir = null;
    }
  }

  /**
   * Main bootstrap function - called before any cognition-cli operation
   *
   * FLOW:
   * 1. Ensure global settings directory exists (~/.cognition-cli/)
   * 2. Create project security directory if workspace exists
   * 3. Load settings from disk
   * 4. Check if acknowledgment exists and is valid (< 1 year old)
   * 5. If needed, prompt for acknowledgment
   * 6. Save acknowledgment to global settings
   *
   * ANNUAL RENEWAL:
   * Acknowledgments expire after 1 year. Users must re-acknowledge
   * to ensure continued awareness of dual-use risks.
   *
   * @example
   * const bootstrap = new SecurityBootstrap();
   * await bootstrap.bootstrap();
   * // Continues silently if already acknowledged
   * // Prompts if first run or acknowledgment expired
   */
  async bootstrap(): Promise<void> {
    // Ensure global settings directory exists
    if (!fs.existsSync(this.settingsDir)) {
      fs.mkdirSync(this.settingsDir, { recursive: true });
    }

    // Only create project security dir if workspace exists
    if (this.projectSecurityDir && !fs.existsSync(this.projectSecurityDir)) {
      fs.mkdirSync(this.projectSecurityDir, { recursive: true });
    }

    // Load or create settings
    const settings = this.loadSettings();

    // Check if user has already acknowledged
    if (settings.dual_use_acknowledgment) {
      const ack = settings.dual_use_acknowledgment;

      // Check if acknowledgment is still valid (1 year)
      const ackDate = new Date(ack.timestamp);
      const daysSinceAck =
        (Date.now() - ackDate.getTime()) / (1000 * 60 * 60 * 24);

      if (daysSinceAck < 365) {
        return; // Valid acknowledgment exists
      }

      console.log(
        '⚠️  Your acknowledgment is over 1 year old. Please re-acknowledge.\n'
      );
    }

    // First run or expired - show acknowledgment
    await this.promptForAcknowledgment(settings);
  }

  /**
   * Load settings from ~/.cognition-cli/settings.json
   */
  private loadSettings(): Settings {
    if (fs.existsSync(this.settingsPath)) {
      try {
        return JSON.parse(fs.readFileSync(this.settingsPath, 'utf-8'));
      } catch (e) {
        console.warn(
          'Warning: Could not parse settings file, creating new one'
        );
        console.error(
          `Settings parsing error: ${e instanceof Error ? e.message : String(e)}`
        );
      }
    }

    return { version: '1.0' };
  }

  /**
   * Save settings to ~/.cognition-cli/settings.json
   */
  private saveSettings(settings: Settings): void {
    fs.writeFileSync(this.settingsPath, JSON.stringify(settings, null, 2));
  }

  /**
   * Prompt user to acknowledge dual-use risks and legal terms
   */
  private async promptForAcknowledgment(settings: Settings): Promise<void> {
    console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  DUAL-USE TECHNOLOGY & TERMS OF USE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

cognition-cli measures semantic alignment between code and mission documents.

━━━ DUAL-USE WARNING ━━━

This is dual-use technology. The same measurement capability can be used for:
  ✅ Guidance: Helping developers align with project values
  ⚠️  Enforcement: Ideological conformity checking

cognition-cli does NOT make ethical judgments. It provides measurements.

YOU control:
  • Which workbench to use (WORKBENCH_URL env variable)
  • Which models to use (defaults: gemini-3-flash-preview, gemini-3.0-pro-preview)
  • Which personas to trust (if any)

Note: Defaults use Google models. EmbeddingGemma-300M supports 100+ languages.
Personas (if used) are provisional and under your control.

━━━ LICENSE & LIABILITY ━━━

This software is licensed under AGPL-v3.

AGPL-v3 Section 15 & 16 apply: NO WARRANTY. NO LIABILITY.
The entire risk as to quality and performance is with YOU.

By using this software, you agree that:

1. You understand this tool measures code against mission documents
2. You are solely responsible for how you deploy and use this tool
3. You will NOT use this for surveillance, ideological enforcement, or harm
4. You accept all risks and liability for your use of this software
5. The author(s) hold NO responsibility for misuse or consequences

This is measurement infrastructure. You control how it's used.

━━━ TRANSPARENCY LOGGING ━━━

All operations are logged to: .open_cognition/security/transparency.jsonl
  • Mission loads (what concepts are extracted)
  • Coherence measurements (what code is measured)
  • Timestamps and user information

Logs are local and under your control.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Read full mandate: cognition-cli security mandate

Do you acknowledge and accept these terms? [yes/NO]: `);

    const response = await this.promptUser();

    if (response.toLowerCase() !== 'yes') {
      console.error(
        '\n❌ Acknowledgment required to use cognition-cli. Exiting.\n'
      );
      process.exit(1);
    }

    // Record acknowledgment in global settings
    settings.dual_use_acknowledgment = {
      timestamp: new Date().toISOString(),
      user: os.userInfo().username,
      hostname: os.hostname(),
      version: '1.0',
      acknowledged: true,
    };

    this.saveSettings(settings);

    console.log(`\n✅ Acknowledgment recorded in: ${this.settingsPath}`);
    console.log(
      `   Transparency log: .open_cognition/security/transparency.jsonl\n`
    );
  }

  /**
   * Prompt user for input with timeout
   *
   * @param timeoutMs - Timeout in milliseconds (default: 60000 = 60 seconds)
   * @returns User input or throws on timeout
   * @throws Error if no response within timeout
   */
  private async promptUser(timeoutMs: number = 60000): Promise<string> {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        rl.close();
        reject(
          new Error(
            'Prompt timeout - no user input after 60 seconds. ' +
              'Please run the command again and respond to the acknowledgment prompt.'
          )
        );
      }, timeoutMs);

      rl.question('', (answer) => {
        clearTimeout(timeout);
        rl.close();
        resolve(answer.trim());
      });
    });
  }
}

/**
 * Custom error for security violations
 *
 * Thrown when security checks fail or user denies acknowledgment.
 *
 * @example
 * throw new SecurityViolationError('User denied dual-use acknowledgment');
 */
export class SecurityViolationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SecurityViolationError';
  }
}

/**
 * Bootstrap security system - call at CLI entry point
 *
 * Convenience function that creates a SecurityBootstrap instance
 * and runs the bootstrap flow.
 *
 * @param projectRoot - Optional project root (default: cwd)
 *
 * @example
 * // In CLI entry point (bin/cogx.ts)
 * await bootstrapSecurity();
 *
 * @example
 * // With custom root
 * await bootstrapSecurity('/path/to/workspace');
 */
export async function bootstrapSecurity(projectRoot?: string): Promise<void> {
  const bootstrap = new SecurityBootstrap(projectRoot);
  await bootstrap.bootstrap();
}

/**
 * Get settings file path
 */
export function getSettingsPath(): string {
  return path.join(getHomeDir(), '.cognition-cli', 'settings.json');
}

/**
 * Load settings from ~/.cognition-cli/settings.json
 */
export function loadSettings(): Settings {
  const settingsPath = getSettingsPath();
  if (fs.existsSync(settingsPath)) {
    try {
      return JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
    } catch (e) {
      console.warn(
        'Warning: Could not parse settings file, using defaults:',
        e instanceof Error ? e.message : String(e)
      );
    }
  }
  return { version: '1.0' };
}

/**
 * Save settings to ~/.cognition-cli/settings.json
 */
export function saveSettings(settings: Settings): void {
  const settingsDir = path.join(getHomeDir(), '.cognition-cli');
  const settingsPath = getSettingsPath();

  // Ensure directory exists
  if (!fs.existsSync(settingsDir)) {
    fs.mkdirSync(settingsDir, { recursive: true });
  }

  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
}
