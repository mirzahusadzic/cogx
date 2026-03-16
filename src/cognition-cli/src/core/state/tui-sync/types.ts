/**
 * TUI Sync State Machine Types
 *
 * Types for orchestrating synchronization between background agents and the TUI.
 */

/**
 * High-level status of the TUI synchronization
 */
export enum TUISyncStatus {
  IDLE = 'IDLE',
  INITIALIZING = 'INITIALIZING',
  ONBOARDING = 'ONBOARDING',
  ACTIVE = 'ACTIVE',
  ERROR = 'ERROR',
}

/**
 * Onboarding wizard steps
 */
export type WizardStep =
  | 'idle'
  | 'detect'
  | 'confirm-genesis'
  | 'genesis'
  | 'confirm-docs'
  | 'genesis-docs'
  | 'confirm-overlay'
  | 'overlay'
  | 'complete';

/**
 * Overlay scores for TUI display
 */
export interface OverlayScores {
  O1_structural: number;
  O2_security: number;
  O3_lineage: number;
  O4_mission: number;
  O5_operational: number;
  O6_mathematical: number;
  O7_strategic: number;
}

/**
 * Selection item for multi-select dialogs in wizard
 */
export interface WizardSelectionItem {
  id: string;
  label: string;
  description?: string;
  selected: boolean;
}

/**
 * Wizard confirmation dialog state
 */
export interface WizardConfirmationState {
  pending: boolean;
  mode: 'confirm' | 'select';
  title: string;
  message: string;
  confirmLabel: string;
  denyLabel: string;
  items?: WizardSelectionItem[];
  selectedIndex?: number;
}

/**
 * Onboarding wizard state
 */
export interface OnboardingState {
  step: WizardStep;
  sourceDirs: string[];
  strategicDocs: string[];
  ingestedDocs: string[];
  currentOverlay: string | null;
  completedOverlays: string[];
  skippedOverlays: string[];
  error: string | null;
  needsGenesis: boolean;
  needsDocs: boolean;
  missingOverlays: string[];
  confirmation?: WizardConfirmationState | null;
}

/**
 * Processed message for TUI display
 */
export interface TUIMessage {
  id: string;
  type:
    | 'user'
    | 'assistant'
    | 'system'
    | 'tool_progress'
    | 'error'
    | 'thinking';
  content: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
  thoughtSignature?: string;
}

/**
 * Workbench health status for TUI display
 */
export interface WorkbenchHealthStatus {
  reachable: boolean;
  embeddingReady: boolean;
  summarizationReady: boolean;
  chatModelReady: boolean;
  hasApiKey: boolean;
}

/**
 * Sigma conversation lattice statistics
 */
export interface SigmaStats {
  nodes: number;
  edges: number;
  paradigmShifts: number;
  avgNovelty: number;
  avgImportance: number;
}

/**
 * Background task information for TUI sync
 */
export interface BackgroundTask {
  id: string;
  type: 'genesis' | 'genesis-docs' | 'overlay' | 'processing';
  overlay?: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress?: number;
  message?: string;
  phase?: string;
  file?: string;
  startedAt: Date;
  completedAt?: Date;
  error?: string;
  stats?: Record<string, number>;
}

/**
 * Complete TUI Sync State
 */
export interface TUISyncState {
  status: TUISyncStatus;
  onboarding: OnboardingState;
  overlayScores: OverlayScores;
  sigmaStats: SigmaStats;
  messages: TUIMessage[];
  pendingMessageCount: number;
  monitorError: string | null;
  workbenchHealth: WorkbenchHealthStatus | null;
  activeTask: BackgroundTask | null;
  lastUpdated: string;
}

/**
 * TUI Sync Events
 */
export type TUISyncEvent =
  | { type: 'WIZARD_START'; sourceDirs?: string[] }
  | { type: 'WIZARD_STEP_CHANGE'; step: WizardStep }
  | { type: 'WIZARD_CONFIRM_SHOW'; confirmation: WizardConfirmationState }
  | { type: 'WIZARD_CONFIRM_ACTION'; action: 'confirm' | 'skip' | 'cancel' }
  | { type: 'WIZARD_SELECTION_MOVE'; direction: 'up' | 'down' }
  | { type: 'WIZARD_SELECTION_TOGGLE' }
  | { type: 'WIZARD_ERROR'; error: string }
  | { type: 'WIZARD_COMPLETE' }
  | { type: 'OVERLAY_SCORES_UPDATE'; scores: OverlayScores }
  | { type: 'SIGMA_STATS_UPDATE'; stats: SigmaStats }
  | { type: 'MESSAGE_ADD'; message: TUIMessage }
  | { type: 'MESSAGES_CLEAR' }
  | { type: 'PENDING_MESSAGES_UPDATE'; count: number }
  | { type: 'MONITOR_ERROR'; error: string | null }
  | { type: 'WORKBENCH_HEALTH_UPDATE'; health: WorkbenchHealthStatus | null }
  | { type: 'ACTIVE_TASK_UPDATE'; task: BackgroundTask | null }
  | { type: 'SYNC_ERROR'; error: Error };

/**
 * Listener for TUI sync state transitions
 */
export type TUISyncStateListener = (
  status: TUISyncStatus,
  state: TUISyncState,
  error?: Error
) => void;
