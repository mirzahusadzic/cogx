/**
 * Workbench Detection Utilities
 *
 * Provides functions for detecting and validating workbench instances.
 * Used by both CLI wizard and TUI onboarding to ensure workbench
 * prerequisites are met before genesis and overlay generation.
 *
 * DESIGN:
 * The workbench (eGemma) is required for:
 * - AST parsing of non-TypeScript languages (Python, Java, etc.)
 * - Embedding generation for vector search
 * - LLM-based extraction (concepts, proofs, etc.)
 *
 * Detection strategy:
 * 1. Check WORKBENCH_URL environment variable first
 * 2. Fall back to autodetection on common local ports
 * 3. Validate via /health endpoint before use
 *
 * @example
 * // Check if workbench is available
 * const url = await detectWorkbench();
 * if (url) {
 *   console.log(`Workbench found at ${url}`);
 * } else {
 *   console.log('No workbench detected');
 * }
 *
 * @example
 * // Validate specific URL
 * const isHealthy = await checkWorkbenchHealth('http://localhost:8000');
 */

import { fetch } from 'undici';
import { initializeProviders, registry } from '../llm/index.js';

/**
 * Supported LLM provider types
 */
export type LLMProviderType = 'claude' | 'gemini';

/**
 * Result of LLM provider detection
 */
export interface LLMProviderDetectionResult {
  /** Whether a configured provider was found */
  found: boolean;
  /** The detected provider type */
  provider: LLMProviderType | null;
  /** Whether API key is present */
  hasApiKey: boolean;
  /** Specific details about available providers */
  providers: {
    claude: { available: boolean; hasKey: boolean };
    gemini: { available: boolean; hasKey: boolean };
  };
}

/**
 * Combined prerequisites check result
 */
export interface PrerequisitesResult {
  /** Whether all prerequisites are met */
  allMet: boolean;
  /** Workbench detection result */
  workbench: WorkbenchDetectionResult;
  /** LLM provider detection result */
  llm: LLMProviderDetectionResult;
  /** Human-readable error messages for missing prerequisites */
  errors: string[];
}

/**
 * Result of workbench detection
 */
export interface WorkbenchDetectionResult {
  /** Whether a healthy workbench was found */
  found: boolean;
  /** URL of the workbench if found */
  url: string | null;
  /** Source of the URL (env, autodetect, or none) */
  source: 'env' | 'autodetect' | 'none';
  /** API key if set in environment */
  apiKey: string | null;
}

/**
 * Checks if a workbench URL is healthy and accessible
 *
 * Sends a GET request to the /health endpoint to verify the workbench
 * server is running and accepting connections.
 *
 * @param url - The workbench URL to check (e.g., 'http://localhost:8000')
 * @param silent - If true, suppress warning logs (default: false)
 * @returns True if the /health endpoint responds with 200 OK, false otherwise
 *
 * @example
 * const isHealthy = await checkWorkbenchHealth('http://localhost:8000');
 * if (isHealthy) {
 *   console.log('Workbench is ready for embedding generation');
 * }
 */
export async function checkWorkbenchHealth(
  url: string,
  silent = false
): Promise<boolean> {
  try {
    const response = await fetch(`${url}/health`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    return response.ok;
  } catch (error) {
    if (!silent) {
      console.warn(
        `Workbench health check failed at ${url}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
    return false;
  }
}

/**
 * Attempts to autodetect a running workbench instance
 *
 * Probes common local development ports to find a running workbench server.
 * This reduces friction for developers by eliminating manual URL entry when
 * the workbench is running on a standard port.
 *
 * ALGORITHM:
 * - Checks ports 8000 and 8080 on localhost and 127.0.0.1
 * - Tests each URL's /health endpoint sequentially
 * - Returns the first healthy URL found, or null if none are healthy
 *
 * @returns The URL of the first healthy workbench found, or null if none detected
 *
 * @example
 * const detected = await autodetectWorkbench();
 * if (detected) {
 *   console.log(`Found workbench at ${detected}`);
 * } else {
 *   console.log('No workbench detected, please enter URL manually');
 * }
 */
export async function autodetectWorkbench(): Promise<string | null> {
  const commonUrls = [
    'http://localhost:8000',
    'http://localhost:8080',
    'http://127.0.0.1:8000',
    'http://127.0.0.1:8080',
  ];

  for (const url of commonUrls) {
    if (await checkWorkbenchHealth(url, true)) {
      return url;
    }
  }

  return null;
}

/**
 * Detects workbench availability with full context
 *
 * Combines environment variable checking with autodetection to provide
 * a complete picture of workbench availability. Used by TUI onboarding
 * to validate prerequisites before starting the wizard.
 *
 * PRIORITY ORDER:
 * 1. WORKBENCH_URL environment variable (if set and healthy)
 * 2. Autodetection on common local ports
 * 3. Returns not found if neither works
 *
 * @returns Detection result with URL, source, and API key
 *
 * @example
 * const result = await detectWorkbench();
 * if (result.found) {
 *   console.log(`Using workbench at ${result.url} (${result.source})`);
 *   if (result.apiKey) {
 *     console.log('API key is configured');
 *   }
 * }
 */
export async function detectWorkbench(): Promise<WorkbenchDetectionResult> {
  const envUrl = process.env.WORKBENCH_URL;
  const apiKey = process.env.WORKBENCH_API_KEY || null;

  // First, check environment variable
  if (envUrl) {
    const isHealthy = await checkWorkbenchHealth(envUrl, true);
    if (isHealthy) {
      return {
        found: true,
        url: envUrl,
        source: 'env',
        apiKey,
      };
    }
    // Env URL set but not healthy - still try autodetect
  }

  // Fall back to autodetection
  const detected = await autodetectWorkbench();
  if (detected) {
    return {
      found: true,
      url: detected,
      source: 'autodetect',
      apiKey,
    };
  }

  return {
    found: false,
    url: null,
    source: 'none',
    apiKey,
  };
}

/**
 * Detects available LLM providers
 *
 * Checks for configured LLM providers by looking at environment variables.
 * Used by TUI onboarding to ensure at least one provider is available
 * for documentation co-creation.
 *
 * PROVIDERS CHECKED:
 * - Claude: ANTHROPIC_API_KEY environment variable
 * - Gemini: GEMINI_API_KEY environment variable
 *
 * Note: Claude also supports OAuth authentication (handled separately by TUI),
 * but for onboarding we check for API key presence as the simplest validation.
 *
 * @param preferredProvider - Optional preferred provider to check first
 * @returns Detection result with provider details
 *
 * @example
 * const result = detectLLMProvider();
 * if (result.found) {
 *   console.log(`Using ${result.provider} provider`);
 * } else {
 *   console.log('No LLM provider configured');
 * }
 */
export async function detectLLMProvider(
  preferredProvider?: LLMProviderType
): Promise<LLMProviderDetectionResult> {
  // Initialize providers to detect all available options (including OAuth-based Claude)
  try {
    await initializeProviders({ skipMissingProviders: true });
  } catch {
    // If initialization fails, fall back to env var check
  }

  // Check what's actually registered in the provider registry
  const registeredProviders = registry.list();
  const claudeRegistered = registeredProviders.includes('claude');
  const geminiRegistered = registeredProviders.includes('gemini');

  // Also track API key presence for detailed status
  const claudeKey = process.env.ANTHROPIC_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;

  const providers = {
    claude: {
      available: claudeRegistered,
      hasKey: !!claudeKey,
    },
    gemini: {
      available: geminiRegistered,
      hasKey: !!geminiKey,
    },
  };

  // Check preferred provider first
  if (preferredProvider) {
    if (providers[preferredProvider].available) {
      return {
        found: true,
        provider: preferredProvider,
        hasApiKey: providers[preferredProvider].hasKey,
        providers,
      };
    }
  }

  // Default priority: Claude > Gemini
  if (providers.claude.available) {
    return {
      found: true,
      provider: 'claude',
      hasApiKey: providers.claude.hasKey,
      providers,
    };
  }

  if (providers.gemini.available) {
    return {
      found: true,
      provider: 'gemini',
      hasApiKey: providers.gemini.hasKey,
      providers,
    };
  }

  return {
    found: false,
    provider: null,
    hasApiKey: false,
    providers,
  };
}

/**
 * Checks all prerequisites for TUI onboarding
 *
 * Combines workbench detection and LLM provider detection to validate
 * all prerequisites are met before starting the onboarding wizard.
 *
 * PREREQUISITES:
 * 1. Workbench must be running and healthy (required for genesis)
 * 2. At least one LLM provider must be configured (required for doc co-creation)
 *
 * @param preferredProvider - Optional preferred LLM provider
 * @returns Combined result with all prerequisite checks and error messages
 *
 * @example
 * const result = await checkPrerequisites();
 * if (result.allMet) {
 *   // Start onboarding wizard
 * } else {
 *   result.errors.forEach(err => console.error(err));
 * }
 */
export async function checkPrerequisites(
  preferredProvider?: LLMProviderType
): Promise<PrerequisitesResult> {
  const workbench = await detectWorkbench();
  const llm = await detectLLMProvider(preferredProvider);

  const errors: string[] = [];

  if (!workbench.found) {
    errors.push(
      'Workbench not detected. Set WORKBENCH_URL or start workbench on localhost:8000'
    );
  }

  if (!llm.found) {
    errors.push(
      'No LLM provider configured. Set ANTHROPIC_API_KEY (Claude) or GEMINI_API_KEY (Gemini)'
    );
  }

  return {
    allMet: workbench.found && llm.found,
    workbench,
    llm,
    errors,
  };
}
