import fs from 'fs-extra';
import path from 'path';
import {
  DEFAULT_OPSEC_MODEL_NAME,
  DEFAULT_OPSEC_ENABLED,
} from '../../config.js';

/**
 * Security operating mode
 */
export type SecurityMode = 'off' | 'advisory' | 'strict';

/**
 * Security configuration
 *
 * PHILOSOPHY:
 * - Advisory by default (warn, don't block)
 * - Transparent (all patterns documented)
 * - User control (easy to configure/disable)
 * - No telemetry (all analysis local)
 * - Augment humans (help reviewers, don't replace)
 */
export interface SecurityConfig {
  /**
   * Security mode:
   * - 'off': No security checks (not recommended for production)
   * - 'advisory': Warnings only, never blocks (DEFAULT for open source)
   * - 'strict': Can block on critical threats (opt-in for high-security)
   */
  mode: SecurityMode;

  missionIntegrity: {
    /**
     * Enable mission integrity monitoring
     */
    enabled: boolean;

    /**
     * Drift detection thresholds
     * Values are cosine distances (0-1)
     */
    drift: {
      warnThreshold: number; // Show warning if drift > this
      alertThreshold: number; // Show prominent alert if drift > this
      blockThreshold: number; // Block in strict mode if drift > this
    };

    /**
     * Pattern detection flags
     * All patterns are fully documented and transparent
     */
    patterns: {
      securityWeakening: boolean; // Detect security → convenience shifts
      trustErosion: boolean; // Detect trust-based bypasses
      permissionCreep: boolean; // Detect strict → permissive shifts
      ambiguityInjection: boolean; // Detect vague qualifiers
      velocityOverSafety: boolean; // Detect speed → safety trade-offs
    };

    /**
     * Transparency and user interaction
     */
    transparency: {
      showDetectedPatterns: boolean; // Explain what patterns were detected
      showDiff: boolean; // Offer to show concept diff
      logToFile: boolean; // Keep audit trail in .open_cognition/
    };
  };

  contentFiltering: {
    /**
     * Enable content filtering (pattern or LLM-based)
     */
    enabled: boolean;

    /**
     * LLM-based content filtering (mandatory model, requires API key)
     */
    llmFilter: {
      enabled: boolean;
      model: string; // Mandatory Gemini model for security validation
      provider: 'workbench' | 'gemini-api';
    };

    /**
     * Fallback pattern matching (used when LLM disabled)
     * Regex patterns for explicit malicious instructions
     */
    fallbackPatterns: string[];
  };
}

/**
 * DEFAULT SECURITY CONFIG
 *
 * Philosophy: Advisory by default for open source
 * - Warns about potential issues
 * - Never blocks ingestion (advisory mode)
 * - Maximum transparency
 * - Respects user autonomy
 * - No telemetry or phone-home
 */
export const DEFAULT_SECURITY_CONFIG: SecurityConfig = {
  mode: 'advisory', // Warn, don't block

  missionIntegrity: {
    enabled: true,

    drift: {
      warnThreshold: 0.1, // 10% drift = yellow warning
      alertThreshold: 0.25, // 25% drift = red alert
      blockThreshold: 0.4, // 40% drift = block (strict mode only)
    },

    patterns: {
      securityWeakening: true,
      trustErosion: true,
      permissionCreep: true,
      ambiguityInjection: true,
      velocityOverSafety: true,
    },

    transparency: {
      showDetectedPatterns: true, // Always explain what was detected
      showDiff: true, // Offer to show changes
      logToFile: true, // Keep audit trail
    },
  },

  contentFiltering: {
    enabled: true,

    llmFilter: {
      enabled: DEFAULT_OPSEC_ENABLED, // Controlled by config.ts (defaults to true)
      model: DEFAULT_OPSEC_MODEL_NAME, // Mandatory model from config
      provider: 'workbench',
    },

    // Fallback patterns for explicit threats
    fallbackPatterns: [
      'exfiltrate',
      'disable.*security',
      'skip.*validation',
      'always.*approve',
      'trust.*all',
      'ignore.*check',
    ],
  },
};

/**
 * Load security config from user's project
 *
 * LOADING ORDER:
 * 1. Check for .cogx/config.ts
 * 2. If exists, import and merge with defaults
 * 3. If not exists, use defaults
 *
 * MERGE STRATEGY:
 * Deep merge: user config overrides defaults at leaf level
 */
export async function loadSecurityConfig(
  projectRoot: string
): Promise<SecurityConfig> {
  const configPath = path.join(projectRoot, '.cogx', 'config.ts');

  // Use defaults if no config file
  if (!(await fs.pathExists(configPath))) {
    return DEFAULT_SECURITY_CONFIG;
  }

  try {
    // Dynamic import of user config
    const userConfigModule = await import(configPath);
    const userConfig = userConfigModule.default || userConfigModule;

    // Deep merge with defaults
    return deepMerge(DEFAULT_SECURITY_CONFIG, userConfig.security || {});
  } catch (error) {
    console.warn(
      `Warning: Failed to load .cogx/config.ts: ${(error as Error).message}`
    );
    console.warn('Using default security configuration');
    return DEFAULT_SECURITY_CONFIG;
  }
}

/**
 * Deep merge two objects
 * User values override defaults at leaf level
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function deepMerge<T extends Record<string, any>>(
  defaults: T,
  overrides: Partial<T>
): T {
  const result = { ...defaults } as T;

  for (const key in overrides) {
    const override = overrides[key];
    const defaultValue = defaults[key];

    if (
      override !== undefined &&
      typeof override === 'object' &&
      !Array.isArray(override) &&
      typeof defaultValue === 'object' &&
      !Array.isArray(defaultValue)
    ) {
      // Recursively merge nested objects
      result[key] = deepMerge(defaultValue, override) as T[Extract<
        keyof T,
        string
      >];
    } else if (override !== undefined) {
      // Override primitive values and arrays
      result[key] = override as T[Extract<keyof T, string>];
    }
  }

  return result;
}

/**
 * Validate security config
 * Ensures all required fields are present and valid
 */
export function validateSecurityConfig(config: SecurityConfig): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Validate mode
  if (!['off', 'advisory', 'strict'].includes(config.mode)) {
    errors.push(
      `Invalid security mode: ${config.mode}. Must be 'off', 'advisory', or 'strict'`
    );
  }

  // Validate thresholds
  const { warnThreshold, alertThreshold, blockThreshold } =
    config.missionIntegrity.drift;

  if (warnThreshold < 0 || warnThreshold > 1) {
    errors.push(`warnThreshold must be 0-1, got ${warnThreshold}`);
  }
  if (alertThreshold < 0 || alertThreshold > 1) {
    errors.push(`alertThreshold must be 0-1, got ${alertThreshold}`);
  }
  if (blockThreshold < 0 || blockThreshold > 1) {
    errors.push(`blockThreshold must be 0-1, got ${blockThreshold}`);
  }

  // Thresholds should be in order
  if (warnThreshold > alertThreshold) {
    errors.push(
      `warnThreshold (${warnThreshold}) should be <= alertThreshold (${alertThreshold})`
    );
  }
  if (alertThreshold > blockThreshold) {
    errors.push(
      `alertThreshold (${alertThreshold}) should be <= blockThreshold (${blockThreshold})`
    );
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Example user configurations
 *
 * USAGE:
 * Create .cogx/config.ts in your project:
 *
 * ```typescript
 * export default {
 *   security: {
 *     // Option 1: Disable entirely
 *     mode: 'off',
 *
 *     // Option 2: Strict mode (blocks on critical)
 *     mode: 'strict',
 *
 *     // Option 3: Customize thresholds
 *     missionIntegrity: {
 *       drift: {
 *         warnThreshold: 0.05, // More sensitive
 *       },
 *     },
 *
 *     // Option 4: Enable LLM filtering
 *     contentFiltering: {
 *       llmFilter: {
 *         enabled: true,
 *         provider: 'workbench',
 *       },
 *     },
 *   },
 * };
 * ```
 */
