/**
 * useOnboardingWizard Hook
 *
 * State machine for async onboarding wizard that runs inside the live TUI.
 * Uses background tasks and confirmation dialogs for non-blocking operation.
 *
 * Flow: detect → confirm-genesis → genesis → confirm-O1 → O1 → ... → complete
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import fs from 'fs-extra';
import path from 'path';
import type { UseBackgroundTaskManagerResult } from './useBackgroundTaskManager.js';
import { detectSources } from '../../utils/source-detector.js';

/**
 * Wizard step types
 */
export type WizardStep =
  | 'idle' // Not started
  | 'detect' // Checking if onboarding needed
  | 'confirm-genesis' // Ask to start genesis
  | 'genesis' // Genesis running in background
  | 'confirm-docs' // Ask to ingest strategic docs
  | 'genesis-docs' // Doc ingestion running
  | 'confirm-overlay' // Ask to generate next overlay
  | 'overlay' // Overlay running
  | 'complete'; // All done

/**
 * Overlay generation order (matches lineage dependency order)
 */
const OVERLAY_ORDER = ['O1', 'O2', 'O3', 'O4', 'O5', 'O6', 'O7'] as const;

/**
 * Overlays that can be generated from code alone (no docs needed)
 */
const CODE_BASED_OVERLAYS = ['O1', 'O3'] as const;

/**
 * Overlays that require strategic documentation
 */
const DOCS_BASED_OVERLAYS = ['O2', 'O4', 'O5', 'O6', 'O7'] as const;

/**
 * Overlay code to directory name mapping
 */
const OVERLAY_DIRS: Record<string, string> = {
  O1: 'structural_patterns',
  O2: 'security_guidelines',
  O3: 'lineage_patterns',
  O4: 'mission_concepts',
  O5: 'operational_patterns',
  O6: 'mathematical_proofs',
  O7: 'strategic_coherence',
};

/**
 * Human-readable overlay names
 */
const OVERLAY_NAMES: Record<string, string> = {
  O1: 'Structural',
  O2: 'Security',
  O3: 'Lineage',
  O4: 'Mission',
  O5: 'Operational',
  O6: 'Mathematical',
  O7: 'Coherence',
};

/**
 * Check if genesis has been run
 * Genesis creates the index/ directory with JSON files containing structural analysis
 */
function hasGenesis(projectRoot: string): boolean {
  const indexPath = path.join(projectRoot, '.open_cognition', 'index');
  try {
    if (!fs.existsSync(indexPath)) return false;
    const files = fs.readdirSync(indexPath);
    // Genesis is complete if index has JSON files
    return files.some((f) => f.endsWith('.json'));
  } catch {
    return false;
  }
}

/**
 * Strategic document to overlay mapping
 */
const DOC_TO_OVERLAY_MAP: Record<string, string[]> = {
  'VISION.md': ['O4'],
  'CODING_PRINCIPLES.md': ['O4'],
  'SECURITY.md': ['O2'],
  'OPERATIONAL.md': ['O5'],
  'MATHEMATICAL.md': ['O6'],
};

/**
 * Check which strategic docs have already been ingested
 * by looking in .open_cognition/index/docs/
 */
function detectIngestedDocs(projectRoot: string): string[] {
  const indexDocsDir = path.join(
    projectRoot,
    '.open_cognition',
    'index',
    'docs'
  );
  const ingested: string[] = [];

  if (!fs.existsSync(indexDocsDir)) {
    return ingested;
  }

  for (const docName of Object.keys(DOC_TO_OVERLAY_MAP)) {
    const indexFile = path.join(indexDocsDir, `${docName}.json`);
    if (fs.existsSync(indexFile)) {
      ingested.push(docName);
    }
  }

  return ingested;
}

/**
 * Detect which strategic docs exist in docs/ directory
 */
function detectStrategicDocs(projectRoot: string): {
  found: string[];
  paths: string[];
} {
  const docsDir = path.join(projectRoot, 'docs');
  const found: string[] = [];
  const paths: string[] = [];

  if (!fs.existsSync(docsDir)) {
    return { found, paths };
  }

  for (const docName of Object.keys(DOC_TO_OVERLAY_MAP)) {
    const docPath = path.join(docsDir, docName);
    if (fs.existsSync(docPath)) {
      found.push(docName);
      paths.push(docPath);
    }
  }

  return { found, paths };
}

/**
 * Get which overlays can be generated based on ingested docs
 */
function getOverlaysForDocs(docs: string[]): string[] {
  const overlays = new Set<string>();

  for (const doc of docs) {
    const mappedOverlays = DOC_TO_OVERLAY_MAP[doc] || [];
    mappedOverlays.forEach((o) => overlays.add(o));
  }

  // O4 requires BOTH VISION.md AND CODING_PRINCIPLES.md
  if (!docs.includes('VISION.md') || !docs.includes('CODING_PRINCIPLES.md')) {
    overlays.delete('O4');
  }

  // O7 requires at least one doc
  if (docs.length > 0) {
    overlays.add('O7');
  }

  return Array.from(overlays);
}

/**
 * Detect which overlays are missing
 * @param projectRoot - Project root directory
 * @param runningTasks - Optional array of running tasks to exclude from missing list
 */
function detectMissingOverlays(
  projectRoot: string,
  runningTasks?: UseBackgroundTaskManagerResult['tasks']
): string[] {
  const missing: string[] = [];
  const overlaysRoot = path.join(projectRoot, '.open_cognition', 'overlays');

  // Get overlay types that are currently being generated
  const runningOverlays = new Set<string>(
    (runningTasks || [])
      .filter(
        (task) =>
          task.type === 'overlay' &&
          (task.status === 'running' || task.status === 'pending')
      )
      .map((task) => {
        // Convert overlay directory name to overlay code (e.g., lineage_patterns → O3)
        const overlayCode = Object.keys(OVERLAY_DIRS).find(
          (code) => OVERLAY_DIRS[code] === task.overlay
        );
        return overlayCode;
      })
      .filter((code): code is string => code !== undefined)
  );

  for (const overlay of OVERLAY_ORDER) {
    // Skip if overlay is currently being generated
    if (runningOverlays.has(overlay)) {
      continue;
    }

    const overlayDir = path.join(overlaysRoot, OVERLAY_DIRS[overlay]);
    try {
      if (!fs.existsSync(overlayDir)) {
        missing.push(overlay);
        continue;
      }

      // Check if overlay has content
      const files = fs.readdirSync(overlayDir);
      const hasContent =
        files.some((f) => f.endsWith('.json') || f.endsWith('.yaml')) ||
        files.includes('manifest.json');

      if (!hasContent) {
        missing.push(overlay);
      }
    } catch {
      missing.push(overlay);
    }
  }

  return missing;
}

/**
 * Wizard state
 */
export interface WizardState {
  step: WizardStep;
  sourceDirs: string[];
  strategicDocs: string[]; // Found strategic docs
  ingestedDocs: string[]; // Docs that have been ingested
  currentOverlay: string | null;
  completedOverlays: string[];
  skippedOverlays: string[];
  error: string | null;
  needsGenesis: boolean;
  needsDocs: boolean;
  missingOverlays: string[];
}

/**
 * Selection item for multi-select dialogs
 */
export interface WizardSelectionItem {
  id: string;
  label: string;
  description?: string;
  selected: boolean;
}

/**
 * Wizard confirmation state (for rendering dialog)
 */
export interface WizardConfirmationState {
  pending: boolean;
  mode: 'confirm' | 'select';
  title: string;
  message: string;
  confirmLabel: string;
  denyLabel: string;
  // Selection mode fields
  items?: WizardSelectionItem[];
  selectedIndex?: number;
}

/**
 * Hook options
 */
export interface UseOnboardingWizardOptions {
  /** Background task manager */
  taskManager: UseBackgroundTaskManagerResult;
  /** Project root directory */
  projectRoot: string;
  /** Source directories to process (auto-detected if empty) */
  sourceDirs?: string[];
  /** Auto-start wizard on mount */
  autoStart?: boolean;
  /** Debug logging */
  debug?: boolean;
  /** Callback to send message to chat (for executing slash commands) */
  onSendMessage?: (message: string) => void;
}

/**
 * Hook result
 */
export interface UseOnboardingWizardResult {
  /** Current wizard state */
  state: WizardState;
  /** Confirmation dialog state (if any) */
  confirmationState: WizardConfirmationState | null;
  /** Start the wizard */
  startWizard: (sourceDirs?: string[]) => void;
  /** Confirm current action (Y/Enter) */
  confirm: () => void;
  /** Skip current action (N) */
  skip: () => void;
  /** Cancel wizard entirely (Esc) */
  cancel: () => void;
  /** Move selection up (arrow up) */
  moveUp: () => void;
  /** Move selection down (arrow down) */
  moveDown: () => void;
  /** Toggle current selection (space) */
  toggleSelection: () => void;
  /** Is wizard active */
  isActive: boolean;
  /** Is wizard complete */
  isComplete: boolean;
}

/**
 * React hook for managing async onboarding wizard.
 *
 * Coordinates background task execution with confirmation dialogs
 * for a non-blocking onboarding experience.
 *
 * @param options - Hook configuration
 * @returns Wizard state and controls
 */
export function useOnboardingWizard(
  options: UseOnboardingWizardOptions
): UseOnboardingWizardResult {
  const {
    taskManager,
    projectRoot,
    sourceDirs = [],
    autoStart = false,
    debug = false,
    onSendMessage,
  } = options;

  // Wizard state - initialize with detection results
  const [state, setState] = useState<WizardState>(() => {
    const { found } = detectStrategicDocs(projectRoot);
    return {
      step: 'idle',
      sourceDirs: sourceDirs.length > 0 ? sourceDirs : ['src'],
      strategicDocs: found,
      ingestedDocs: [],
      currentOverlay: null,
      completedOverlays: [],
      skippedOverlays: [],
      error: null,
      needsGenesis: !hasGenesis(projectRoot),
      needsDocs: found.length === 0,
      missingOverlays: detectMissingOverlays(projectRoot, taskManager.tasks),
    };
  });

  // Confirmation state
  const [confirmationState, setConfirmationState] =
    useState<WizardConfirmationState | null>(null);

  // Ref to access latest confirmationState without triggering re-renders
  const confirmationStateRef = useRef(confirmationState);
  useEffect(() => {
    confirmationStateRef.current = confirmationState;
  }, [confirmationState]);

  // Promise resolver for confirmations
  const confirmResolver = useRef<
    ((result: 'confirm' | 'skip' | 'cancel') => void) | null
  >(null);

  // Track task ID we're waiting for
  const pendingTaskId = useRef<string | null>(null);

  // Track if we've already auto-started to prevent re-triggering
  const hasAutoStarted = useRef(false);

  /**
   * Show confirmation dialog and wait for user decision
   */
  const showConfirmation = useCallback(
    (
      config: Omit<WizardConfirmationState, 'pending'>
    ): Promise<'confirm' | 'skip' | 'cancel'> => {
      return new Promise((resolve) => {
        confirmResolver.current = resolve;
        setConfirmationState({
          pending: true,
          ...config,
        });
      });
    },
    []
  );

  /**
   * Close confirmation dialog
   */
  const closeConfirmation = useCallback(() => {
    setConfirmationState(null);
    confirmResolver.current = null;
  }, []);

  /**
   * Initialize PGC structure (create directories and metadata.json)
   */
  const initializePGC = useCallback(async () => {
    const pgcRoot = path.join(projectRoot, '.open_cognition');

    // Create directories
    await fs.ensureDir(path.join(pgcRoot, 'objects'));
    await fs.ensureDir(path.join(pgcRoot, 'transforms'));
    await fs.ensureDir(path.join(pgcRoot, 'index'));
    await fs.ensureDir(path.join(pgcRoot, 'reverse_deps'));
    await fs.ensureDir(path.join(pgcRoot, 'overlays'));

    // Create metadata.json
    const metadata = {
      version: '0.1.0',
      initialized_at: new Date().toISOString(),
      status: 'empty',
      sources: {
        code: state.sourceDirs,
        docs: [],
      },
    };
    await fs.writeJSON(path.join(pgcRoot, 'metadata.json'), metadata, {
      spaces: 2,
    });

    // Create .gitignore
    await fs.writeFile(
      path.join(pgcRoot, '.gitignore'),
      '# Ignore large object store\nobjects/\n# Ignore debug logs\ndebug-*.log\n# Keep structure\n!.gitkeep\n'
    );

    if (debug) console.log('[Wizard] PGC initialized');
  }, [projectRoot, state.sourceDirs, debug]);

  /**
   * Run genesis
   */
  const runGenesis = useCallback(
    async (sourceDirs?: string[]) => {
      try {
        if (debug) console.log('[Wizard] Starting genesis...');
        setState((s) => ({ ...s, step: 'genesis' }));

        // Use provided sourceDirs or fall back to state
        const dirsToProcess = sourceDirs || state.sourceDirs;

        if (debug) console.log('[Wizard] Genesis source dirs:', dirsToProcess);

        // Initialize PGC structure first
        await initializePGC();

        // Verify PGC was created (filesystem flush)
        const pgcRoot = path.join(projectRoot, '.open_cognition');
        const metadataPath = path.join(pgcRoot, 'metadata.json');
        if (
          !(await fs.pathExists(pgcRoot)) ||
          !(await fs.pathExists(metadataPath))
        ) {
          throw new Error('PGC initialization failed - directory not created');
        }

        if (debug)
          console.log('[Wizard] PGC verified, starting Genesis task...');

        const taskId = await taskManager.startGenesis(dirsToProcess);
        pendingTaskId.current = taskId;

        if (debug) console.log('[Wizard] Genesis started, taskId:', taskId);
      } catch (err) {
        setState((s) => ({
          ...s,
          step: 'idle',
          error: `Genesis failed: ${(err as Error).message}`,
        }));
      }
    },
    [taskManager, state.sourceDirs, debug, initializePGC, projectRoot]
  );

  /**
   * Run doc ingestion
   */
  const runDocsIngestion = useCallback(
    async (docPaths: string[]) => {
      try {
        if (debug) console.log('[Wizard] Starting doc ingestion:', docPaths);
        setState((s) => ({ ...s, step: 'genesis-docs' }));

        const taskId = await taskManager.startGenesisDocs(docPaths);
        pendingTaskId.current = taskId;

        if (debug)
          console.log('[Wizard] Doc ingestion started, taskId:', taskId);
      } catch (err) {
        setState((s) => ({
          ...s,
          step: 'idle',
          error: `Doc ingestion failed: ${(err as Error).message}`,
        }));
      }
    },
    [taskManager, debug]
  );

  /**
   * Run overlay generation
   */
  const runOverlay = useCallback(
    async (overlay: string) => {
      try {
        if (debug) console.log('[Wizard] Starting overlay:', overlay);
        setState((s) => ({ ...s, step: 'overlay', currentOverlay: overlay }));

        // Convert overlay code (O1) to directory name (structural_patterns)
        const overlayDir = OVERLAY_DIRS[overlay] || overlay;
        const taskId = await taskManager.startOverlay(overlayDir);
        pendingTaskId.current = taskId;

        if (debug) console.log('[Wizard] Overlay started, taskId:', taskId);
      } catch (err) {
        setState((s) => ({
          ...s,
          step: 'idle',
          currentOverlay: null,
          error: `${overlay} generation failed: ${(err as Error).message}`,
        }));
      }
    },
    [taskManager, debug]
  );

  /**
   * Prompt for next overlay (only from missing overlays list)
   */
  const promptNextOverlay = useCallback(
    async (justCompleted: string | null) => {
      // Filter missing overlays by what's already completed/skipped
      const processed = new Set([
        ...state.completedOverlays,
        ...state.skippedOverlays,
      ]);

      // Prioritize code-based overlays (O1, O3) before docs-based (O2, O4, O5, O6, O7)
      const remaining = state.missingOverlays
        .filter((o) => !processed.has(o))
        .sort((a, b) => {
          const aIsCodeBased = CODE_BASED_OVERLAYS.includes(
            a as (typeof CODE_BASED_OVERLAYS)[number]
          );
          const bIsCodeBased = CODE_BASED_OVERLAYS.includes(
            b as (typeof CODE_BASED_OVERLAYS)[number]
          );
          if (aIsCodeBased && !bIsCodeBased) return -1; // a comes first
          if (!aIsCodeBased && bIsCodeBased) return 1; // b comes first
          return 0; // Keep original order
        });

      const nextOverlay = remaining[0] || null;

      if (!nextOverlay) {
        // All done
        setState((s) => ({ ...s, step: 'complete' }));
        return;
      }

      // Check if we just completed code-based overlays and need to handle docs
      // Check both: completed in this session OR not in missing list (already exists)
      const codeBasedComplete = CODE_BASED_OVERLAYS.every(
        (o) =>
          state.completedOverlays.includes(o) ||
          !state.missingOverlays.includes(o)
      );
      const isFirstDocsBased = DOCS_BASED_OVERLAYS.includes(
        nextOverlay as (typeof DOCS_BASED_OVERLAYS)[number]
      );

      // Check if docs are currently being ingested
      const isIngestingDocs = taskManager.tasks.some(
        (task) =>
          task.type === 'genesis-docs' &&
          (task.status === 'running' || task.status === 'pending')
      );

      // Offer doc ingestion if:
      // 1. Code-based overlays (O1, O3) are complete
      // 2. Next overlay is docs-based (O2, O4, O5, O6, O7)
      // 3. There are NEW docs to ingest (not already in .open_cognition/index/docs/)
      // 4. No doc ingestion is currently running
      // Note: Don't require justCompleted - docs might have been created after wizard restart
      if (codeBasedComplete && isFirstDocsBased && !isIngestingDocs) {
        // Code-based overlays done, check for strategic docs
        const { found, paths } = detectStrategicDocs(projectRoot);
        const alreadyIngested = detectIngestedDocs(projectRoot);

        // Filter out docs that have already been ingested
        const newDocs = found.filter((doc) => !alreadyIngested.includes(doc));
        const newPaths = paths.filter(
          (_, i) => !alreadyIngested.includes(found[i])
        );

        if (newDocs.length > 0) {
          // Found new docs to ingest
          setState((s) => ({
            ...s,
            step: 'confirm-docs',
            strategicDocs: newDocs,
          }));

          const docList = newDocs.join(', ');
          const result = await showConfirmation({
            mode: 'confirm',
            title: 'Strategic Documentation Found',
            message: `Found ${newDocs.length} new strategic document${newDocs.length > 1 ? 's' : ''}: ${docList}. Ingest them?`,
            confirmLabel: 'Y Ingest',
            denyLabel: 'N Skip',
          });

          closeConfirmation();

          if (result === 'confirm') {
            // Ingest new docs
            await runDocsIngestion(newPaths);
            return; // Wait for ingestion to complete
          } else if (result === 'skip') {
            // Skip docs and all docs-based overlays
            setState((s) => ({
              ...s,
              skippedOverlays: [
                ...s.skippedOverlays,
                ...DOCS_BASED_OVERLAYS.filter((o) => !processed.has(o)),
              ],
              step: 'complete',
            }));
            return;
          } else {
            // Cancel
            setState((s) => ({ ...s, step: 'complete' }));
            return;
          }
        } else if (alreadyIngested.length > 0) {
          // All available docs are already ingested, proceed to overlay generation
          // Fall through to overlay confirmation below
        } else {
          // No docs found at all (neither new nor ingested), offer to exit for /onboard-project
          const result = await showConfirmation({
            mode: 'confirm',
            title: 'Documentation Required',
            message:
              'Remaining overlays (O2, O4, O5, O6, O7) require strategic documentation. ' +
              'Exit wizard to run /onboard-project and create docs?',
            confirmLabel: 'Y Exit & Create Docs',
            denyLabel: 'N Skip Remaining',
          });

          closeConfirmation();

          if (result === 'confirm') {
            // Exit wizard - user will run /onboard-project manually
            setState((s) => ({ ...s, step: 'complete' }));
            return;
          } else if (result === 'skip') {
            // Skip all remaining docs-based overlays
            setState((s) => ({
              ...s,
              skippedOverlays: [
                ...s.skippedOverlays,
                ...DOCS_BASED_OVERLAYS.filter((o) => !processed.has(o)),
              ],
              step: 'complete',
            }));
            return;
          } else {
            // Cancel
            setState((s) => ({ ...s, step: 'complete' }));
            return;
          }
        }
      }

      // Filter remaining overlays by which docs have been ingested
      if (state.ingestedDocs.length > 0) {
        const allowedOverlays = new Set([
          ...CODE_BASED_OVERLAYS,
          ...getOverlaysForDocs(state.ingestedDocs),
        ]);

        // Skip nextOverlay if we don't have the required docs
        if (!allowedOverlays.has(nextOverlay)) {
          setState((s) => ({
            ...s,
            skippedOverlays: [...s.skippedOverlays, nextOverlay],
          }));
          // Move to next overlay
          promptNextOverlay(nextOverlay);
          return;
        }
      }

      setState((s) => ({
        ...s,
        step: 'confirm-overlay',
        currentOverlay: nextOverlay,
      }));

      const prevName = justCompleted
        ? `${justCompleted} (${OVERLAY_NAMES[justCompleted] || justCompleted})`
        : 'Genesis';

      const result = await showConfirmation({
        mode: 'confirm',
        title: `Overlays: Generate ${nextOverlay} (${OVERLAY_NAMES[nextOverlay] || nextOverlay})?`,
        message: `${prevName} complete.`,
        confirmLabel: 'Y Generate',
        denyLabel: 'N Skip',
      });

      closeConfirmation();

      if (result === 'confirm') {
        await runOverlay(nextOverlay);
      } else if (result === 'skip') {
        setState((s) => ({
          ...s,
          skippedOverlays: [...s.skippedOverlays, nextOverlay],
          currentOverlay: null,
        }));
        // Prompt for next
        promptNextOverlay(nextOverlay);
      } else {
        // Cancel - stop wizard
        setState((s) => ({ ...s, step: 'complete' }));
      }
    },
    [
      state.completedOverlays,
      state.skippedOverlays,
      state.missingOverlays,
      state.ingestedDocs,
      showConfirmation,
      closeConfirmation,
      runOverlay,
      runDocsIngestion,
      projectRoot,
    ]
  );

  /**
   * Handle task completion
   */
  useEffect(() => {
    // Find our pending task
    if (!pendingTaskId.current) return;

    const task = taskManager.tasks.find((t) => t.id === pendingTaskId.current);
    if (!task) return;

    // Task still running
    if (task.status === 'running' || task.status === 'pending') return;

    // Task completed or failed
    pendingTaskId.current = null;

    if (task.status === 'completed') {
      if (debug) console.log('[Wizard] Task completed:', task.id, task.type);

      if (task.type === 'genesis') {
        // Genesis done, prompt for first overlay
        promptNextOverlay(null);
      } else if (task.type === 'genesis-docs') {
        // Doc ingestion done, mark docs as ingested and continue
        setState((s) => ({
          ...s,
          ingestedDocs: s.strategicDocs,
        }));
        promptNextOverlay(null); // Continue to next overlay
      } else if (task.type === 'overlay' && state.currentOverlay) {
        // Overlay done, mark and prompt for next
        const completedCode = state.currentOverlay; // Use overlay code (O1), not directory name

        // Refresh missing overlays list to detect newly completed overlay
        const updatedMissing = detectMissingOverlays(
          projectRoot,
          taskManager.tasks
        );

        setState((s) => ({
          ...s,
          completedOverlays: [...s.completedOverlays, completedCode],
          missingOverlays: updatedMissing,
          currentOverlay: null,
        }));
        promptNextOverlay(completedCode);
      }
    } else if (task.status === 'failed') {
      if (debug) console.log('[Wizard] Task failed:', task.id, task.error);
      setState((s) => ({
        ...s,
        step: 'idle',
        error: task.error || 'Task failed',
      }));
    }
  }, [taskManager.tasks, promptNextOverlay, debug, projectRoot]);

  /**
   * Detect available source directories using proper auto-detection
   */
  const detectSourceDirs = useCallback(async (): Promise<
    WizardSelectionItem[]
  > => {
    try {
      const detected = await detectSources(projectRoot);

      if (debug || process.env.DEBUG_WIZARD) {
        console.error(
          '[Wizard] Detected source dirs:',
          detected.code.map(
            (d) => `${d.path} (${d.fileCount} files, selected=${d.selected})`
          )
        );
      }

      if (detected.code.length === 0) {
        // Fallback if nothing detected
        return [
          {
            id: 'src',
            label: 'src',
            description: 'default',
            selected: true,
          },
        ];
      }

      const items = detected.code.map((dir) => ({
        id: dir.path.replace(/\/$/, ''), // Remove trailing slash for ID
        label: dir.path.replace(/\/$/, ''),
        description: `${dir.fileCount} ${dir.language || 'code'} files`,
        selected: dir.selected,
      }));

      if (debug || process.env.DEBUG_WIZARD) {
        console.error(
          '[Wizard] Created items:',
          items.map((i) => `${i.id} (${i.description})`)
        );
        console.error(
          '[Wizard] Unique IDs?',
          new Set(items.map((i) => i.id)).size === items.length
        );
      }

      return items;
    } catch {
      // Fallback on error
      return [
        {
          id: 'src',
          label: 'src',
          description: 'default',
          selected: true,
        },
      ];
    }
  }, [projectRoot]);

  /**
   * Start wizard with smart detection
   */
  const startWizard = useCallback(
    async (dirs?: string[]) => {
      if (debug)
        console.log('[Wizard] Starting wizard with smart detection...');

      // Re-detect what's needed in case state changed
      const needsGenesis = !hasGenesis(projectRoot);
      const { found: strategicDocs } = detectStrategicDocs(projectRoot);
      const needsDocs = strategicDocs.length === 0;
      const missingOverlays = detectMissingOverlays(
        projectRoot,
        taskManager.tasks
      );

      setState((s) => ({
        ...s,
        needsGenesis,
        needsDocs,
        strategicDocs,
        missingOverlays,
        error: null,
      }));

      if (debug) {
        console.log('[Wizard] Detection results:', {
          needsGenesis,
          needsDocs,
          missingOverlays,
        });
      }

      // Step 1: Genesis if needed
      if (needsGenesis) {
        setState((s) => ({ ...s, step: 'confirm-genesis' }));

        // Show source directory selection
        const sourceItems = dirs
          ? dirs.map((d) => ({ id: d, label: d, selected: true }))
          : await detectSourceDirs();

        const result = await showConfirmation({
          mode: 'select',
          title: 'Genesis: Select Source Directories',
          message: 'Choose directories to analyze:',
          confirmLabel: 'Start Genesis',
          denyLabel: 'Cancel',
          items: sourceItems,
          selectedIndex: 0,
        });

        if (result === 'confirm' && confirmationStateRef.current?.items) {
          const selectedDirs = confirmationStateRef.current.items
            .filter((item) => item.selected)
            .map((item) => item.id);

          if (selectedDirs.length > 0) {
            setState((s) => ({ ...s, sourceDirs: selectedDirs }));
            closeConfirmation();
            // Pass selectedDirs directly to avoid race condition with async state update
            await runGenesis(selectedDirs);
            return; // Genesis will trigger overlay prompts via completion handler
          }
        }

        closeConfirmation();

        // If cancelled by user (ESC), exit completely to prevent auto-restart
        if (result === 'cancel') {
          if (debug)
            console.log('[Wizard] User cancelled source selection, exiting');
          setState((s) => ({ ...s, step: 'complete' }));
        } else {
          setState((s) => ({ ...s, step: 'idle' }));
        }
        return;
      }

      // Step 2: Generate missing overlays
      if (missingOverlays.length > 0) {
        if (debug) {
          console.log('[Wizard] Missing overlays:', missingOverlays);
        }
        // Start with first missing overlay
        promptNextOverlay(null);
      } else {
        // Nothing to do!
        setState((s) => ({ ...s, step: 'complete' }));
      }
    },
    [
      projectRoot,
      detectSourceDirs,
      showConfirmation,
      closeConfirmation,
      runGenesis,
      promptNextOverlay,
      debug,
      onSendMessage,
    ]
  );

  /**
   * Confirm current action
   */
  const confirm = useCallback(() => {
    if (confirmResolver.current) {
      confirmResolver.current('confirm');
    }
  }, []);

  /**
   * Skip current action
   */
  const skip = useCallback(() => {
    if (confirmResolver.current) {
      confirmResolver.current('skip');
    }
  }, []);

  /**
   * Cancel wizard
   */
  const cancel = useCallback(() => {
    if (confirmResolver.current) {
      confirmResolver.current('cancel');
    }
    closeConfirmation();
    setState((s) => ({ ...s, step: 'complete' }));
  }, [closeConfirmation]);

  /**
   * Move selection up (for select mode)
   */
  const moveUp = useCallback(() => {
    if (confirmationState?.mode === 'select' && confirmationState.items) {
      const currentIdx = confirmationState.selectedIndex ?? 0;
      const newIdx =
        currentIdx > 0 ? currentIdx - 1 : confirmationState.items.length - 1;
      setConfirmationState((s) => (s ? { ...s, selectedIndex: newIdx } : null));
    }
  }, [confirmationState]);

  /**
   * Move selection down (for select mode)
   */
  const moveDown = useCallback(() => {
    if (confirmationState?.mode === 'select' && confirmationState.items) {
      const currentIdx = confirmationState.selectedIndex ?? 0;
      const newIdx =
        currentIdx < confirmationState.items.length - 1 ? currentIdx + 1 : 0;
      setConfirmationState((s) => (s ? { ...s, selectedIndex: newIdx } : null));
    }
  }, [confirmationState]);

  /**
   * Toggle current selection (for select mode)
   */
  const toggleSelection = useCallback(() => {
    if (confirmationState?.mode === 'select' && confirmationState.items) {
      const currentIdx = confirmationState.selectedIndex ?? 0;
      setConfirmationState((s) => {
        if (!s || !s.items) return s;
        const newItems = [...s.items];
        newItems[currentIdx] = {
          ...newItems[currentIdx],
          selected: !newItems[currentIdx].selected,
        };
        return { ...s, items: newItems };
      });
    }
  }, [confirmationState]);

  // Auto-start if requested (only once)
  useEffect(() => {
    if (autoStart && state.step === 'idle' && !hasAutoStarted.current) {
      hasAutoStarted.current = true;
      startWizard();
    }
  }, [autoStart, state.step, startWizard]);

  return {
    state,
    confirmationState,
    startWizard,
    confirm,
    skip,
    cancel,
    moveUp,
    moveDown,
    toggleSelection,
    isActive: state.step !== 'idle' && state.step !== 'complete',
    isComplete: state.step === 'complete',
  };
}
