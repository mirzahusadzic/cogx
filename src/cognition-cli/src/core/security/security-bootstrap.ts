/**
 * Security Bootstrap - Minimal dual-use acknowledgment and transparency
 *
 * cognition-cli is measurement infrastructure. It does not make ethical judgments.
 * This module ensures users:
 * 1. Acknowledge dual-use risks (one-time, stored in ~/.cognition-cli/settings.json)
 * 2. Understand their responsibility for ethical deployment
 * 3. Are informed about transparency logging
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { createInterface } from 'readline';

interface Settings {
  dual_use_acknowledgment?: UserAcknowledgment;
  version: string;
}

interface UserAcknowledgment {
  timestamp: string;
  user: string;
  hostname: string;
  version: string;
  acknowledged: boolean;
}

export class SecurityBootstrap {
  private settingsDir: string;
  private settingsPath: string;
  private projectSecurityDir: string;

  constructor(projectRoot: string = process.cwd()) {
    // Global settings in ~/.cognition-cli/
    this.settingsDir = path.join(os.homedir(), '.cognition-cli');
    this.settingsPath = path.join(this.settingsDir, 'settings.json');

    // Per-project security/transparency logs
    this.projectSecurityDir = path.join(
      projectRoot,
      '.open_cognition',
      'security'
    );
  }

  /**
   * Main bootstrap function - called before any cognition-cli operation
   */
  async bootstrap(): Promise<void> {
    // Ensure directories exist
    if (!fs.existsSync(this.settingsDir)) {
      fs.mkdirSync(this.settingsDir, { recursive: true });
    }
    if (!fs.existsSync(this.projectSecurityDir)) {
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
  • Which models to use (defaults: gemini-2.5-flash, gemini-2.0-flash-thinking)
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
   * Prompt user for input
   */
  private async promptUser(): Promise<string> {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    return new Promise((resolve) => {
      rl.question('', (answer) => {
        rl.close();
        resolve(answer.trim());
      });
    });
  }
}

/**
 * Custom error for security violations
 */
export class SecurityViolationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SecurityViolationError';
  }
}

/**
 * Bootstrap function to be called at CLI entry point
 */
export async function bootstrapSecurity(projectRoot?: string): Promise<void> {
  const bootstrap = new SecurityBootstrap(projectRoot);
  await bootstrap.bootstrap();
}
